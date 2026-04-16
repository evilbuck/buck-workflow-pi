/**
 * tmux Window Status Module
 *
 * Appends status icons to the active tmux window name based on pi session state:
 *   ⚙️  working       — agent is actively processing
 *   🧠  thinking      — streaming thinking output (more specific than working)
 *   ✅  done          — agent completed cleanly (stopReason === "stop")
 *   🚧  stuck         — agent ended by asking the user a question
 *   🛑  timed out     — agent ended with error/length/aborted
 *
 * Architecture:
 *   StateMachine  — pure logic, no IO, fully testable
 *   TmuxAdapter   — injectable tmux side effects
 *   wire()        — connects pi lifecycle events → state machine → adapter
 */

import { execSync } from "node:child_process";
import { appendFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// ============================================================
// Public types
// ============================================================

export type Status = "working" | "thinking" | "done" | "stuck" | "timedout";

export const STATUS_ICONS: Record<Status, string> = {
  working: "⚙️",
  thinking: "🧠",
  done: "✅",
  stuck: "🚧",
  timedout: "🛑",
};

/** Adapter that the state machine calls on every state change. */
export interface StatusDisplay {
  /** Called with the new status whenever the visible state changes. */
  show(status: Status): void;
  /** Remove any status indicator (e.g. restore original window name). */
  clear(): void;
  /** Save any initial state needed for later restore (e.g. original window name). */
  init(): void;
  /** Full teardown — restore original state. */
  teardown(): void;
}

// ============================================================
// State machine — pure logic, no IO
// ============================================================

const TERMINAL_STATES: ReadonlySet<Status> = new Set([
  "done",
  "stuck",
  "timedout",
]);

/**
 * Patterns that suggest the assistant is asking a clarifying question
 * rather than just using a question mark in a statement.
 * Checked against the last ~500 chars of the assistant's final text.
 *
 * Note: bare trailing `?` is intentionally excluded — LLMs frequently
 * end statements with `?` ("How can I help?", "Make sense?") without
 * actually needing user input.
 */
const QUESTION_PATTERNS = [
  /should i\b/i,
  /would you like\b/i,
  /do you (?:want|prefer|need)\b/i,
  /which (?:approach|option|method)\b/i,
  /please (?:clarify|confirm|let me know)\b/i,
  /let me know\b/i,
  /what (?:would you|should|do you)\b/i,
  /how would you like\b/i,
  /can you (?:clarify|provide|confirm)\b/i,
];

export class StateMachine {
  private _current: Status | null = null;
  private lastAssistantText = "";
  private lastStopReason: string | null = null;

  /** Current state (null before first transition). Read-only for observers. */
  get current(): Status | null {
    return this._current;
  }

  /** Reset for a new prompt cycle. Clears terminal-state lock. */
  reset(): void {
    this._current = null;
    this.lastAssistantText = "";
    this.lastStopReason = null;
  }

  /**
   * Attempt a state transition.
   * Returns true if the transition was accepted.
   *
   * Rules:
   *   - Terminal states are locked — only reset() can clear them.
   *   - Non-terminal states (working ↔ thinking) transition freely.
   */
  transition(next: Status): boolean {
    if (this._current !== null && TERMINAL_STATES.has(this._current)) {
      return false;
    }
    this._current = next;
    return true;
  }

  /** Record assistant text for stuck detection. Replaces on each call. */
  observeAssistantText(text: string): void {
    this.lastAssistantText = text;
  }

  /** Record the stop reason from the last assistant message. */
  observeStopReason(reason: string): void {
    this.lastStopReason = reason;
  }

  /**
   * Determine the terminal status from accumulated stop reason + text.
   * Does NOT mutate state — call transition() or finalize() to apply.
   */
  resolveTerminalStatus(): Status {
    const reason = this.lastStopReason;

    if (reason === "stop") {
      return this.looksLikeQuestion() ? "stuck" : "done";
    }

    if (reason === "toolUse") {
      return "done";
    }

    return "timedout";
  }

  /** Resolve and apply terminal status. Returns the resolved status. */
  finalize(): Status {
    const terminal = this.resolveTerminalStatus();
    this._current = terminal;
    return terminal;
  }

  private looksLikeQuestion(): boolean {
    const text = this.lastAssistantText.trim();
    if (!text) return false;
    const tail = text.slice(-500);
    return QUESTION_PATTERNS.some((p) => p.test(tail));
  }
}

// ============================================================
// Tmux adapter — injectable side effects
// ============================================================

/** Regex that matches any trailing status icon(s) and surrounding whitespace. */
const ICON_SUFFIX_RE = /(?:\s+(?:⚙️|🧠|✅|🚧|🛑|⏳))+\s*$/;

export class TmuxAdapter implements StatusDisplay {
  private savedName: string | null = null;
  private readonly inTmux: boolean;

  constructor() {
    this.inTmux = !!process.env.TMUX;
  }

  init(): void {
    if (!this.inTmux || this.savedName !== null) return;
    try {
      let name = execSync("tmux display-message -p '#{window_name}'", {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 2000,
      }).trim();
      // Strip any previously appended status icons so they don't stack
      name = name.replace(ICON_SUFFIX_RE, "");
      this.savedName = name;
    } catch {
      // Can't read window name — fall back to "pi"
    }
  }

  show(status: Status): void {
    if (!this.inTmux) return;
    const base = this.savedName ?? "pi";
    const name = `${base} ${STATUS_ICONS[status]}`;
    try {
      execSync(`tmux rename-window -- "${name}"`, {
        stdio: "ignore",
        timeout: 2000,
      });
    } catch {
      // Fail soft
    }
  }

  clear(): void {
    if (!this.inTmux) return;
    const name = this.savedName ?? "pi";
    try {
      execSync(`tmux rename-window -- "${name}"`, {
        stdio: "ignore",
        timeout: 2000,
      });
    } catch {
      // Fail soft
    }
  }

  teardown(): void {
    if (!this.inTmux) return;
    if (this.savedName !== null) {
      try {
        execSync(`tmux rename-window -- "${this.savedName}"`, {
          stdio: "ignore",
          timeout: 2000,
        });
      } catch {
        // Fail soft
      }
    }
    this.savedName = null;
  }
}

// ============================================================
// Wiring — pi lifecycle events → state machine → display
// ============================================================

export interface WiringDeps {
  machine?: StateMachine;
  display?: StatusDisplay;
}

function extractTextBlocks(msg: any): string {
  if (!msg?.content) return "";
  const parts: string[] = [];
  for (const block of msg.content) {
    if (block.type === "text" && typeof block.text === "string") {
      parts.push(block.text);
    }
  }
  return parts.join("\n");
}

/**
 * Wire a state machine + display into the pi extension API.
 * Returns the machine for external access (e.g. testing).
 */
// --- JSONL debug logger ---
const LOG_DIR = join(homedir(), ".cache", "pi-tmux-status");
const LOG_FILE = join(LOG_DIR, "events.jsonl");

function logEvent(event: string, data: Record<string, unknown>): void {
  try {
    if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
    const entry = { ts: new Date().toISOString(), event, ...data };
    appendFileSync(LOG_FILE, JSON.stringify(entry) + "\n", "utf-8");
  } catch {
    // Fail soft
  }
}

export function wire(
  pi: import("@mariozechner/pi-coding-agent").ExtensionAPI,
  deps: WiringDeps = {},
): StateMachine {
  const machine = deps.machine ?? new StateMachine();
  const display = deps.display ?? new TmuxAdapter();

  pi.on("session_start", async () => {
    logEvent("session_start", {});
    display.init();
  });

  pi.on("before_agent_start", async () => {
    machine.reset();
    const ok = machine.transition("working");
    logEvent("before_agent_start", { accepted: ok, state: machine.current });
    if (ok) {
      display.show("working");
    }
  });

  pi.on("agent_start", async () => {
    const ok = machine.transition("working");
    logEvent("agent_start", { accepted: ok, state: machine.current });
    if (ok) {
      display.show("working");
    }
  });

  pi.on("message_update", async (event) => {
    const evt = (event as any).assistantMessageEvent;
    if (evt?.type === "thinking_delta") {
      if (machine.transition("thinking")) {
        logEvent("message_update", { delta: "thinking", state: machine.current });
        display.show("thinking");
      }
    } else if (evt?.type === "text_delta") {
      if (machine.transition("working")) {
        logEvent("message_update", { delta: "text", state: machine.current });
        display.show("working");
      }
    }

    const msg = (event as any).message;
    if (msg?.role === "assistant") {
      const text = extractTextBlocks(msg);
      if (text) machine.observeAssistantText(text);
    }
  });

  pi.on("message_end", async (event) => {
    const msg = (event as any).message;
    logEvent("message_end", {
      role: msg?.role ?? null,
      stopReason: msg?.stopReason ?? null,
      textLen: msg?.content
        ? (msg.content as any[])
            .filter((b: any) => b.type === "text")
            .reduce((n: number, b: any) => n + (b.text?.length ?? 0), 0)
        : 0,
    });
    if (msg?.role === "assistant") {
      if (msg.stopReason) machine.observeStopReason(msg.stopReason);
      const text = extractTextBlocks(msg);
      if (text) machine.observeAssistantText(text);
    }
  });

  pi.on("agent_end", async () => {
    const terminal = machine.finalize();
    logEvent("agent_end", { terminal, state: machine.current });
    display.show(terminal);
  });

  pi.on("session_shutdown", async () => {
    logEvent("session_shutdown", { state: machine.current });
    // Finalize as a fallback — if agent_end never fired (e.g. cancelled),
    // show a terminal status before teardown restores the original name.
    if (machine.current !== null && !TERMINAL_STATES.has(machine.current)) {
      const terminal = machine.finalize();
      display.show(terminal);
    }
    display.teardown();
    machine.reset();
  });

  return machine;
}
