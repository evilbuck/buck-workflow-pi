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
 * The icon is ALWAYS appended to the original window name, never replacing it.
 * On session shutdown, the icon is removed and the original name is restored.
 *
 * Outside tmux, everything fails soft — no crashes, no side effects.
 */

import { execSync } from "node:child_process";

// --- Status icon map ---

type Status = "working" | "thinking" | "done" | "stuck" | "timedout";

const STATUS_ICONS: Record<Status, string> = {
  working: "⚙️",
  thinking: "🧠",
  done: "✅",
  stuck: "🚧",
  timedout: "🛑",
};

// --- State machine ---

/**
 * Priority ordering for state transitions.
 * A higher-priority state overrides a lower-priority one.
 * Terminal states (done, stuck, timedout) can only be cleared by a reset (new prompt).
 */
const PRIORITY: Record<Status, number> = {
  working: 1,
  thinking: 2,
  stuck: 3,
  done: 3,
  timedout: 3,
};

const TERMINAL_STATES: ReadonlySet<Status> = new Set(["done", "stuck", "timedout"]);

/**
 * Patterns that suggest the assistant is asking the user a clarifying question
 * (used as a heuristic for "stuck" detection when no direct signal exists).
 */
const QUESTION_PATTERNS = [
  /\?\s*$/,                          // ends with ?
  /\?\s*["`\)]*\s*$/m,              // ends with ? possibly followed by quotes/parens
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

// --- tmux helpers ---

let _isTmux: boolean | null = null;

function isTmux(): boolean {
  if (_isTmux === null) {
    _isTmux = !!process.env.TMUX;
  }
  return _isTmux;
}

let _savedWindowName: string | null = null;

function renameTmuxWindow(icon: string): void {
  if (!isTmux()) return;
  const base = _savedWindowName ?? "pi";
  const name = icon ? `${base} ${icon}` : base;
  try {
    execSync(`tmux rename-window -- "${name}"`, {
      stdio: "ignore",
      timeout: 2000,
    });
  } catch {
    // Fail soft — tmux unavailable or rename failed
  }
}

function saveOriginalWindowName(): void {
  if (!isTmux() || _savedWindowName !== null) return;
  try {
    _savedWindowName = execSync("tmux display-message -p '#{window_name}'", {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 2000,
    }).trim();
  } catch {
    // If we can't read the current name, just leave it null
  }
}

function restoreWindowName(): void {
  if (!isTmux()) return;
  if (_savedWindowName === null) return;
  try {
    execSync(`tmux rename-window -- "${_savedWindowName}"`, {
      stdio: "ignore",
      timeout: 2000,
    });
  } catch {
    // Fail soft
  }
  _savedWindowName = null;
}

// --- State machine class ---

export class TmuxWindowStatus {
  private current: Status | null = null;
  private lastAssistantText = "";
  private lastStopReason: string | null = null;

  /**
   * Reset state for a new prompt cycle.
   * Called at the start of a new agent run.
   */
  reset(): void {
    this.current = null;
    this.lastAssistantText = "";
    this.lastStopReason = null;
  }

  /**
   * Try to transition to a new status.
   * Enforces priority rules and terminal-state locks.
   */
  transition(next: Status): void {
    // Terminal states can only be cleared by reset()
    if (this.current !== null && TERMINAL_STATES.has(this.current)) {
      return;
    }

    // Higher priority overrides lower
    if (this.current !== null && PRIORITY[next] < PRIORITY[this.current]) {
      return;
    }

    this.current = next;
    renameTmuxWindow(STATUS_ICONS[next]);
  }

  /**
   * Overwrite the tracked assistant text with the latest snapshot.
   * Called from message_update with the current partial message content.
   * We replace rather than append because message_update events contain
   * progressively growing content blocks (not deltas).
   */
  observeAssistantText(text: string): void {
    this.lastAssistantText = text;
  }

  /**
   * Record the stop reason from an assistant message.
   */
  observeStopReason(reason: string): void {
    this.lastStopReason = reason;
  }

  /**
   * Detect if the assistant ended in a "stuck" state (waiting on user).
   * Uses the stop reason + heuristic text analysis.
   *
   * Returns "stuck" if the assistant cleanly stopped but appears to be
   * asking the user a question. Returns "done" or "timedout" otherwise.
   */
  resolveTerminalStatus(): Status {
    const reason = this.lastStopReason;

    if (reason === "stop") {
      // Clean stop — check if the assistant is asking a question
      if (this.looksLikeQuestion()) {
        return "stuck";
      }
      return "done";
    }

    // Non-clean stops: length, error, aborted, etc.
    if (reason === "toolUse") {
      // Tool use is a mid-conversation state, not terminal.
      // But if we reach this from agent_end, the loop stopped.
      // Treat as done since the agent made progress.
      return "done";
    }

    return "timedout";
  }

  /**
   * Heuristic: does the last assistant text end with a question
   * or contain language suggesting it's waiting for user input?
   */
  private looksLikeQuestion(): boolean {
    const text = this.lastAssistantText.trim();
    if (!text) return false;

    // Check only the last ~500 chars for recency
    const tail = text.slice(-500);
    return QUESTION_PATTERNS.some((p) => p.test(tail));
  }

  /**
   * Finalize the status when the agent run ends.
   * Determines the terminal icon based on accumulated state.
   */
  finalize(): void {
    const terminal = this.resolveTerminalStatus();
    this.current = terminal;
    renameTmuxWindow(STATUS_ICONS[terminal]);
  }

  /**
   * Remove the status icon and restore the original window name.
   * Called when transitioning out of an active state without finalizing.
   */
  clearIcon(): void {
    this.current = null;
    renameTmuxWindow("");
  }

  /**
   * Clean up: restore the original tmux window name.
   * Called on session shutdown.
   */
  cleanup(): void {
    restoreWindowName();
    this.current = null;
    this.lastAssistantText = "";
    this.lastStopReason = null;
    _savedWindowName = null;
  }
}

// --- Factory for wiring into pi extension ---

export function createTmuxWindowStatus() {
  const machine = new TmuxWindowStatus();

  return {
    machine,

    /**
     * Wire all event handlers into the pi extension API.
     * Call this once during extension setup.
     */
    wire(pi: import("@mariozechner/pi-coding-agent").ExtensionAPI): void {
      // On session start, save the original window name
      pi.on("session_start", async () => {
        saveOriginalWindowName();
      });

      // New prompt: reset state, show working icon
      pi.on("before_agent_start", async () => {
        machine.reset();
        machine.transition("working");
      });

      // Also transition on agent_start as a safety net
      pi.on("agent_start", async () => {
        machine.transition("working");
      });

      // Stream thinking: upgrade to thinking icon
      pi.on("message_update", async (event) => {
        const evt = (event as any).assistantMessageEvent;
        if (evt?.type === "thinking_delta") {
          machine.transition("thinking");
        }

        // Accumulate assistant text for stuck detection
        // message_update provides the growing partial message, so we
        // concatenate all text blocks each time (observeAssistantText replaces).
        const msg = (event as any).message;
        if (msg?.role === "assistant") {
          const textParts: string[] = [];
          for (const block of msg?.content ?? []) {
            if (block.type === "text" && typeof block.text === "string") {
              textParts.push(block.text);
            }
          }
          if (textParts.length > 0) {
            machine.observeAssistantText(textParts.join("\n"));
          }
        }
      });

      // Track stop reason and final text from assistant messages
      pi.on("message_end", async (event) => {
        const msg = (event as any).message;
        if (msg?.role === "assistant") {
          if (msg.stopReason) {
            machine.observeStopReason(msg.stopReason);
          }
          // Capture the final complete text for stuck detection
          const textParts: string[] = [];
          for (const block of msg.content ?? []) {
            if (block.type === "text" && typeof block.text === "string") {
              textParts.push(block.text);
            }
          }
          if (textParts.length > 0) {
            machine.observeAssistantText(textParts.join("\n"));
          }
        }
      });

      // Agent finished: set terminal status
      pi.on("agent_end", async () => {
        machine.finalize();
      });

      // Session shutdown: restore original window name
      pi.on("session_shutdown", async () => {
        machine.cleanup();
      });
    },
  };
}
