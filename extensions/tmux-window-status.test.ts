import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  StateMachine,
  wire,
  type Status,
  type StatusDisplay,
} from "./tmux-window-status.js";

// ============================================================
// Helpers
// ============================================================

/** Record of every show/clear/teardown call, in order. */
function recordingDisplay(): StatusDisplay & { log: string[] } {
  const log: string[] = [];
  return {
    log,
    show(status: Status) {
      log.push(`show:${status}`);
    },
    clear() {
      log.push("clear");
    },
    init() {
      log.push("init");
    },
    teardown() {
      log.push("teardown");
    },
  };
}

/** Build a mock pi API that captures event handlers. */
function mockPi() {
  const handlers = new Map<string, Function[]>();
  return {
    on: vi.fn((event: string, handler: Function) => {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
    }),
    async emit(event: string, payload?: any) {
      for (const h of handlers.get(event) ?? []) {
        await h(payload);
      }
    },
  };
}

// ============================================================
// StateMachine — pure logic
// ============================================================

describe("StateMachine", () => {
  let sm: StateMachine;

  beforeEach(() => {
    sm = new StateMachine();
  });

  // ----- transitions -----

  describe("non-terminal transitions", () => {
    it("starts as null", () => {
      expect(sm.current).toBeNull();
    });

    it("null → working", () => {
      expect(sm.transition("working")).toBe(true);
      expect(sm.current).toBe("working");
    });

    it("working → thinking", () => {
      sm.transition("working");
      expect(sm.transition("thinking")).toBe(true);
      expect(sm.current).toBe("thinking");
    });

    it("thinking → working (the key fix)", () => {
      sm.transition("working");
      sm.transition("thinking");
      expect(sm.transition("working")).toBe(true);
      expect(sm.current).toBe("working");
    });

    it("oscillates freely between working and thinking", () => {
      sm.transition("working");
      sm.transition("thinking");
      sm.transition("working");
      sm.transition("thinking");
      expect(sm.current).toBe("thinking");
      sm.transition("working");
      expect(sm.current).toBe("working");
    });

    it("can go directly to a terminal state", () => {
      expect(sm.transition("done")).toBe(true);
      expect(sm.current).toBe("done");
    });
  });

  describe("terminal-state locking", () => {
    it("done blocks working", () => {
      sm.transition("done");
      expect(sm.transition("working")).toBe(false);
      expect(sm.current).toBe("done");
    });

    it("stuck blocks thinking", () => {
      sm.transition("stuck");
      expect(sm.transition("thinking")).toBe(false);
      expect(sm.current).toBe("stuck");
    });

    it("timedout blocks done", () => {
      sm.transition("timedout");
      expect(sm.transition("done")).toBe(false);
      expect(sm.current).toBe("timedout");
    });

    it("done blocks another terminal state", () => {
      sm.transition("done");
      expect(sm.transition("timedout")).toBe(false);
    });

    it("reset clears the terminal lock", () => {
      sm.transition("done");
      sm.reset();
      expect(sm.current).toBeNull();
      expect(sm.transition("working")).toBe(true);
      expect(sm.current).toBe("working");
    });

    it("reset clears all accumulated state", () => {
      sm.transition("working");
      sm.observeAssistantText("some text");
      sm.observeStopReason("stop");
      sm.reset();
      // resolveTerminalStatus will use null stop reason → timedout
      expect(sm.resolveTerminalStatus()).toBe("timedout");
    });
  });

  // ----- resolveTerminalStatus -----

  describe("resolveTerminalStatus", () => {
    it("stop + statement → done", () => {
      sm.observeStopReason("stop");
      sm.observeAssistantText("I've updated the file.");
      expect(sm.resolveTerminalStatus()).toBe("done");
    });

    it("stop + empty text → done", () => {
      sm.observeStopReason("stop");
      sm.observeAssistantText("");
      expect(sm.resolveTerminalStatus()).toBe("done");
    });

    it("stop + no text observed → done", () => {
      sm.observeStopReason("stop");
      expect(sm.resolveTerminalStatus()).toBe("done");
    });

    it("toolUse → done", () => {
      sm.observeStopReason("toolUse");
      expect(sm.resolveTerminalStatus()).toBe("done");
    });

    it("length → timedout", () => {
      sm.observeStopReason("length");
      expect(sm.resolveTerminalStatus()).toBe("timedout");
    });

    it("error → timedout", () => {
      sm.observeStopReason("error");
      expect(sm.resolveTerminalStatus()).toBe("timedout");
    });

    it("aborted → timedout", () => {
      sm.observeStopReason("aborted");
      expect(sm.resolveTerminalStatus()).toBe("timedout");
    });

    it("null stop reason → timedout", () => {
      expect(sm.resolveTerminalStatus()).toBe("timedout");
    });

    it("unknown stop reason → timedout", () => {
      sm.observeStopReason("something_unexpected");
      expect(sm.resolveTerminalStatus()).toBe("timedout");
    });
  });

  // ----- stuck detection -----

  describe("stuck detection", () => {
    it.each([
      ["trailing question mark", "Which approach should I take?"],
      ["'would you like'", "Would you like me to continue?"],
      ["'do you want'", "Do you want me to refactor this?"],
      ["'should I'", "Should I proceed with option A?"],
      ["'please let me know'", "Please let me know if this works."],
      ["'how would you like'", "How would you like this structured?"],
      ["'can you clarify'", "Can you clarify what you mean?"],
      ["'which approach'", "Which approach do you prefer?"],
    ])("detects stuck via %s", (_label, text) => {
      sm.observeStopReason("stop");
      sm.observeAssistantText(text);
      expect(sm.resolveTerminalStatus()).toBe("stuck");
    });

    it("statement ending with period → done", () => {
      sm.observeStopReason("stop");
      sm.observeAssistantText("I've completed the refactoring.");
      expect(sm.resolveTerminalStatus()).toBe("done");
    });

    it("question in last 500 chars → stuck", () => {
      const filler = "x".repeat(600);
      sm.observeStopReason("stop");
      sm.observeAssistantText(`${filler} What would you like me to do next?`);
      expect(sm.resolveTerminalStatus()).toBe("stuck");
    });

    it("question buried before last 500 chars → done", () => {
      const text = "Which option?\n" + "x".repeat(600);
      sm.observeStopReason("stop");
      sm.observeAssistantText(text);
      expect(sm.resolveTerminalStatus()).toBe("done");
    });
  });

  // ----- finalize -----

  describe("finalize", () => {
    it("applies terminal status and returns it", () => {
      sm.observeStopReason("stop");
      sm.observeAssistantText("Done.");
      expect(sm.finalize()).toBe("done");
      expect(sm.current).toBe("done");
    });

    it("returns stuck when appropriate", () => {
      sm.observeStopReason("stop");
      sm.observeAssistantText("Should I continue?");
      expect(sm.finalize()).toBe("stuck");
      expect(sm.current).toBe("stuck");
    });

    it("returns timedout for error", () => {
      sm.observeStopReason("error");
      expect(sm.finalize()).toBe("timedout");
      expect(sm.current).toBe("timedout");
    });
  });
});

// ============================================================
// Wiring — pi events → state machine → display
// ============================================================

describe("wire", () => {
  it("happy path: working → thinking → working → done", async () => {
    const pi = mockPi();
    const display = recordingDisplay();
    const machine = wire(pi as any, { display });

    await pi.emit("session_start");
    expect(display.log).toContain("init");

    await pi.emit("before_agent_start");
    expect(machine.current).toBe("working");
    expect(display.log).toContain("show:working");

    await pi.emit("message_update", {
      assistantMessageEvent: { type: "thinking_delta" },
    });
    expect(machine.current).toBe("thinking");
    expect(display.log).toContain("show:thinking");

    await pi.emit("message_update", {
      assistantMessageEvent: { type: "text_delta" },
      message: {
        role: "assistant",
        content: [{ type: "text", text: "Result." }],
      },
    });
    expect(machine.current).toBe("working");
    expect(display.log.filter((l) => l === "show:working")).toHaveLength(2);

    await pi.emit("message_end", {
      message: {
        role: "assistant",
        stopReason: "stop",
        content: [{ type: "text", text: "Result." }],
      },
    });
    await pi.emit("agent_end");
    expect(machine.current).toBe("done");
    expect(display.log).toContain("show:done");

    await pi.emit("session_shutdown");
    expect(display.log).toContain("teardown");
  });

  it("error lifecycle: working → thinking → timedout", async () => {
    const pi = mockPi();
    const display = recordingDisplay();
    const machine = wire(pi as any, { display });

    await pi.emit("session_start");
    await pi.emit("before_agent_start");
    await pi.emit("message_update", {
      assistantMessageEvent: { type: "thinking_delta" },
    });
    expect(machine.current).toBe("thinking");

    await pi.emit("message_end", {
      message: { role: "assistant", stopReason: "error", content: [] },
    });
    await pi.emit("agent_end");
    expect(machine.current).toBe("timedout");
    expect(display.log).toContain("show:timedout");
  });

  it("new prompt resets terminal state", async () => {
    const pi = mockPi();
    const display = recordingDisplay();
    const machine = wire(pi as any, { display });

    await pi.emit("session_start");

    // First prompt ends with error
    await pi.emit("before_agent_start");
    await pi.emit("message_end", {
      message: { role: "assistant", stopReason: "error", content: [] },
    });
    await pi.emit("agent_end");
    expect(machine.current).toBe("timedout");

    // Second prompt — terminal lock must be cleared
    await pi.emit("before_agent_start");
    expect(machine.current).toBe("working");

    await pi.emit("message_update", {
      assistantMessageEvent: { type: "thinking_delta" },
    });
    expect(machine.current).toBe("thinking");

    await pi.emit("message_update", {
      assistantMessageEvent: { type: "text_delta" },
    });
    expect(machine.current).toBe("working");

    await pi.emit("message_end", {
      message: {
        role: "assistant",
        stopReason: "stop",
        content: [{ type: "text", text: "Done!" }],
      },
    });
    await pi.emit("agent_end");
    expect(machine.current).toBe("done");
  });
});
