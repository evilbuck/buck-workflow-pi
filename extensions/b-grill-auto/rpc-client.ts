/**
 * RPC Client for b-grill-auto.
 *
 * Spawns a Pi subprocess in RPC mode with a configurable model/provider,
 * communicates via JSONL protocol, and returns parsed agent_end results.
 *
 * Protocol:
 *   → Send: { "id": "<uuid>", "type": "prompt", "message": "<text>" }
 *   ← Receive: JSON lines on stdout (turn_end, agent_end, message_update, etc.)
 *   → Abort:  { "type": "abort" }
 */

import { spawn, type ChildProcess } from "node:child_process";
import { StringDecoder } from "node:string_decoder";
import type { AgentEndResult, RPCEvent } from "./types.js";

const DEFAULT_TIMEOUT_MS = 120_000; // 2 minutes per question

/**
 * Manages a Pi RPC subprocess for sending prompts and receiving responses.
 */
export class GrillRpcClient {
  private proc: ChildProcess | null = null;
  private running = false;
  private buffer = "";
  private decoder = new StringDecoder("utf-8");
  private events: RPCEvent[] = [];
  private resolvePrompt: ((result: AgentEndResult) => void) | null = null;
  private rejectPrompt: ((err: Error) => void) | null = null;
  private promptTimeout: ReturnType<typeof setTimeout> | null = null;
  private timeoutMs: number;

  readonly provider: string;
  readonly model: string;

  constructor(
    provider: string,
    model: string,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  ) {
    this.provider = provider;
    this.model = model;
    this.timeoutMs = timeoutMs;
  }

  /**
   * Spawn the Pi RPC subprocess.
   * Command: pi --mode rpc --no-tools --no-session --provider X --model Y
   */
  start(): Promise<boolean> {
    return new Promise((resolve) => {
      const cmd = "pi";
      const args = [
        "--mode", "rpc",
        "--no-tools",
        "--no-session",
        "--provider", this.provider,
        "--model", this.model,
      ];

      try {
        this.proc = spawn(cmd, args, {
          stdio: ["pipe", "pipe", "pipe"],
        });
      } catch (err) {
        console.error("[grill-rpc] Failed to spawn pi:", err);
        resolve(false);
        return;
      }

      this.running = true;
      this.buffer = "";

      const stdout = this.proc.stdout;
      if (!stdout) {
        resolve(false);
        return;
      }

      stdout.on("data", (chunk: Buffer) => {
        if (!this.running) return;
        this.buffer += this.decoder.write(chunk);
        this.processBuffer();
      });

      this.proc.stderr?.on("data", (chunk: Buffer) => {
        // Log stderr for debugging but don't treat as fatal
        const text = this.decoder.write(chunk).trim();
        if (text) {
          console.error(`[grill-rpc] stderr: ${text}`);
        }
      });

      this.proc.on("error", (err) => {
        console.error("[grill-rpc] Process error:", err);
        this.running = false;
        this.rejectPending(new Error(`RPC process error: ${err.message}`));
      });

      this.proc.on("close", (code) => {
        this.running = false;
        this.rejectPending(new Error(`RPC process exited with code ${code}`));
      });

      // Give Pi time to initialize
      setTimeout(() => {
        resolve(this.proc !== null && this.running);
      }, 2000);
    });
  }

  /**
   * Send a prompt and wait for the agent_end response.
   */
  sendPrompt(message: string, timeoutMs?: number): Promise<AgentEndResult> {
    if (!this.proc || !this.running) {
      return Promise.reject(new Error("RPC client not started"));
    }

    // Clear any pending prompt
    this.clearPendingPrompt();

    this.events = [];

    const id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36);
    const prompt = { id, type: "prompt", message };

    try {
      this.proc.stdin!.write(JSON.stringify(prompt) + "\n");
    } catch (err) {
      return Promise.reject(new Error(`Failed to send prompt: ${err}`));
    }

    return new Promise((resolve, reject) => {
      this.resolvePrompt = resolve;
      this.rejectPrompt = reject;

      this.promptTimeout = setTimeout(() => {
        this.clearPendingPrompt();
        reject(new Error(`Prompt timed out after ${timeoutMs ?? this.timeoutMs}ms`));
      }, timeoutMs ?? this.timeoutMs);
    });
  }

  /**
   * Abort the current prompt.
   */
  abort(): void {
    if (!this.proc?.stdin || !this.running) return;
    try {
      this.proc.stdin.write(JSON.stringify({ type: "abort" }) + "\n");
    } catch {
      // Ignore abort errors
    }
  }

  /**
   * Clean up the subprocess.
   */
  close(): void {
    this.running = false;
    this.clearPendingPrompt();

    if (this.proc) {
      try {
        // Try graceful shutdown
        this.proc.stdin?.write(JSON.stringify({ type: "abort" }) + "\n");
        this.proc.stdin?.end();
        // Give it a moment to shut down
        setTimeout(() => {
          if (this.proc && !this.proc.killed) {
            this.proc.kill("SIGTERM");
          }
        }, 500);
      } catch {
        // Force kill on error
        this.proc.kill("SIGKILL");
      }
      this.proc = null;
    }
  }

  /**
   * Process the incoming buffer for complete JSON lines.
   */
  private processBuffer(): void {
    while (this.buffer.includes("\n")) {
      const newlineIndex = this.buffer.indexOf("\n");
      const line = this.buffer.slice(0, newlineIndex).trim();
      this.buffer = this.buffer.slice(newlineIndex + 1);

      if (!line) continue;

      try {
        const event = JSON.parse(line) as RPCEvent;
        this.events.push(event);
        this.handleEvent(event);
      } catch {
        // Malformed JSON — skip
      }
    }
  }

  /**
   * Handle a single RPC event.
   */
  private handleEvent(event: RPCEvent): void {
    switch (event.type) {
      case "agent_end":
        this.handleAgentEnd(event);
        break;
      case "response":
        // Check for prompt rejection
        if (event.command === "prompt" && event.success === false) {
          this.clearPendingPrompt();
          this.rejectPrompt?.(new Error(`Prompt rejected: ${event.error ?? "unknown error"}`));
        }
        break;
      default:
        // Other events (message_update, turn_end) are just accumulated
        break;
    }
  }

  /**
   * Extract full text from agent_end event and resolve the pending prompt.
   *
   * Protocol shape:
   *   { "type": "agent_end", "message": { "content": [...], "stopReason": "stop" } }
   *
   * Content items have type: "text", "thinking", or "toolCall".
   * We extract text from the full message content, not from streaming deltas.
   */
  private handleAgentEnd(event: RPCEvent): void {
    const msg = (event as { message?: Record<string, unknown> }).message;
    if (!msg) return;

    const content = (msg.content as Array<Record<string, string>>) ?? [];
    const texts: string[] = [];
    let thinking: string | null = null;

    for (const block of content) {
      if (block.type === "text") {
        texts.push(block.text ?? "");
      } else if (block.type === "thinking") {
        thinking = block.thinking ?? block.text ?? null;
      }
    }

    // Fallback: if message has no content array, check for direct text field
    let text = texts.join("");
    if (!text && typeof msg.text === "string") {
      text = msg.text;
    }

    // Final fallback: use streaming accumulated text
    if (!text) {
      text = this.extractStreamingText();
    }

    const stopReason = (msg.stopReason as string) ?? "unknown";

    this.clearPendingPrompt();
    this.resolvePrompt?.({
      text,
      thinking,
      stopReason,
      rawEvents: this.events as Record<string, unknown>[],
    });
  }

  /**
   * Extract text accumulated from message_update streaming events.
   */
  private extractStreamingText(): string {
    const parts: string[] = [];
    for (const event of this.events) {
      if (event.type === "message_update") {
        const update = event as Record<string, unknown>;
        const deltaObj = update.assistantMessageEvent as Record<string, string> | undefined;
        if (deltaObj?.delta) {
          parts.push(deltaObj.delta);
        }
      }
    }
    return parts.join("");
  }

  /**
   * Clear any pending prompt resolution/rejection.
   */
  private clearPendingPrompt(): void {
    if (this.promptTimeout) {
      clearTimeout(this.promptTimeout);
      this.promptTimeout = null;
    }
    this.resolvePrompt = null;
    this.rejectPrompt = null;
  }

  /**
   * Reject any pending prompt with the given error.
   */
  private rejectPending(err: Error): void {
    this.clearPendingPrompt();
    this.rejectPrompt?.(err);
  }
}
