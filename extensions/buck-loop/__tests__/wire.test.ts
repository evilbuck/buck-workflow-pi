/**
 * Command-surface tests. No nested agent is started.
 *
 * - `parseArgs` — the grammar `/buck-loop` accepts.
 * - `wireBuckLoop` — registers the slash command with a fake host API and
 *   checks that `handleLoop` is the only thing the handler calls.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { TUI, ProcessTerminal, type Component } from "@mariozechner/pi-tui";
import type { ActivityEvent } from "../../extension-activity.js";

const handleLoop = vi.fn();
vi.mock("../loop.js", () => ({ handleLoop: (...args: unknown[]) => handleLoop(...args) }));

import { parseArgs, USAGE, wireBuckLoop } from "../index.js";

function createMockApi(): {
  api: ExtensionAPI;
  commands: Map<string, { handler: (args: string, ctx: { cwd: string; ui: {
    notify: (m: string, l?: string) => void;
    setStatus?: (key: string, text: string | undefined) => void;
    setWidget?: ExtensionContext["ui"]["setWidget"];
  } }) => Promise<void> }>;
  sendMessage: ReturnType<typeof vi.fn>;
} {
  const commands = new Map();
  const sendMessage = vi.fn();
  const api = {
    registerCommand(name: string, spec: { handler: (args: string, ctx: unknown) => Promise<void> }) {
      commands.set(name, spec);
    },
    sendMessage,
  } as unknown as ExtensionAPI;
  return { api, commands, sendMessage };
}


async function readJsonlWhenFlushed(path: string): Promise<Array<{ type: string; tool?: string }>> {
  // Real filesystem visibility requires platform time; fake timers cannot drive disk I/O.
  const deadline = performance.now() + 3_000;
  while (performance.now() < deadline) {
    if (existsSync(path)) {
      const source = readFileSync(path, "utf8");
      if (source.endsWith("\n")) {
        const records = source.trim().split("\n").map((line) => JSON.parse(line) as { type: string; tool?: string });
        if (records.some((record) => record.type === "activity")) return records;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`JSONL record was not flushed: ${path}`);
}
afterEach(() => handleLoop.mockReset());

describe("parseArgs", () => {
  it("parses a single positional path as start", () => {
    expect(parseArgs(".context/demo/plan.md")).toEqual({ ok: true, command: "start", path: ".context/demo/plan.md" });
  });

  it("parses exclusive flags", () => {
    expect(parseArgs("--resume")).toEqual({ ok: true, command: "resume" });
    expect(parseArgs("--status")).toEqual({ ok: true, command: "status" });
    expect(parseArgs("--stop")).toEqual({ ok: true, command: "stop" });
  });

  it("rejects empty, unknown, conflicting, and extra arguments", () => {
    expect(parseArgs("").ok).toBe(false);
    expect(parseArgs("--nope").ok).toBe(false);
    expect(parseArgs("--resume --stop").ok).toBe(false);
    expect(parseArgs("--status plan.md").ok).toBe(false);
    expect(parseArgs("a.md b.md").ok).toBe(false);
    const empty = parseArgs("");
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.error).toContain("Usage:");
  });
});

describe("wireBuckLoop", () => {
  it("registers buck-loop once", () => {
    const { api, commands } = createMockApi();
    wireBuckLoop(api);
    expect([...commands.keys()]).toEqual(["buck-loop"]);
  });

  it("delegates start/resume/status/stop to the supervisor", async () => {
    handleLoop.mockResolvedValue({ state: "idle", reason: "no projection" });
    const { api, commands } = createMockApi();
    wireBuckLoop(api);
    const notes: string[] = [];
    const ctx = { cwd: "/tmp/repo", ui: { notify: (m: string) => notes.push(m) } };
    const handler = commands.get("buck-loop")!.handler;

    await handler("plan.md", ctx);
    expect(handleLoop).toHaveBeenLastCalledWith(expect.objectContaining({ cwd: "/tmp/repo", command: "start", path: "plan.md" }));

    await handler("--resume", ctx);
    expect(handleLoop).toHaveBeenLastCalledWith(expect.objectContaining({ cwd: "/tmp/repo", command: "resume", path: undefined }));

    await handler("--status", ctx);
    expect(handleLoop).toHaveBeenLastCalledWith(expect.objectContaining({ cwd: "/tmp/repo", command: "status", path: undefined }));

    await handler("--stop", ctx);
    expect(handleLoop).toHaveBeenLastCalledWith(expect.objectContaining({ cwd: "/tmp/repo", command: "stop", path: undefined }));
    expect(notes.some((n) => n.includes("idle:"))).toBe(true);
  });
  it("changes live density without restarting work and removes the card on stop", async () => {
    const tui = new TUI(new ProcessTerminal());
    const repaint = vi.spyOn(tui, "requestRender").mockImplementation(() => {});
    let component: (Component & { dispose?(): void }) | undefined;
    let cleared = false;
    const setWidget: ExtensionContext["ui"]["setWidget"] = (_key, content) => {
      if (typeof content === "function") component = content(tui, {} as never);
      if (content === undefined) { component?.dispose?.(); cleared = true; }
    };
    const { promise: gate, resolve: settle } = Promise.withResolvers<{ state: string; reason: string }>();
    handleLoop.mockImplementation(({ command, deps }) => {
      if (command === "stop") return { state: "aborted", reason: "operator stop" };
      deps.onProgress({ state: "building", operation: "run-skill", target: "plan.md", label: "building" });
      deps.onActivity({ kind: "toolStart", tool: "read", target: "important.ts" });
      return gate;
    });
    const { api, commands } = createMockApi();
    wireBuckLoop(api);
    const ctx = { cwd: "/tmp/repo", ui: { notify() {}, setWidget } };
    const handler = commands.get("buck-loop")!.handler;
    const pending = handler("plan.md", ctx);
    try {
      expect(component!.render(80).join("\\n")).toContain("important.ts");
      await handler("--profile compact", ctx);
      expect(component!.render(44).join("\\n")).not.toContain("important.ts");
      await handler("--profile verbose", ctx);
      expect(component!.render(80).join("\\n")).toContain("important.ts");
      expect(handleLoop).toHaveBeenCalledTimes(1);
      await handler("--stop", ctx);
      expect(cleared).toBe(true);
      expect(component!.render(80)).toEqual([]);
    } finally {
      settle({ state: "aborted", reason: "operator stop" });
      await pending;
      repaint.mockRestore();
    }
  });

  it("drains nested activity to JSONL before the supervisor settles", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "buck-loop-wire-"));
    let settle!: (result: { state: "done"; reason: string }) => void;
    const gate = new Promise<{ state: "done"; reason: string }>((resolve) => { settle = resolve; });
    handleLoop.mockImplementation((opts: { deps?: { onActivity?: (event: ActivityEvent) => void } }) => {
      opts.deps?.onActivity?.({ kind: "toolStart", tool: "read", target: "plan.md" });
      return gate;
    });
    const { api, commands } = createMockApi();
    wireBuckLoop(api);
    const pending = commands.get("buck-loop")!.handler("plan.md", { cwd, ui: { notify: () => undefined } });
    try {
      const log = await readJsonlWhenFlushed(join(cwd, ".context/workflow/buck-loop.log.jsonl"));
      expect(log).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: "activity", tool: "read" }),
      ]));

      settle({ state: "done", reason: "all phases completed" });
      await pending;
      expect(readFileSync(join(cwd, ".context/workflow/buck-loop.log.jsonl"), "utf8")).toContain('"type":"terminal"');
    } finally {
      settle({ state: "done", reason: "test cleanup" });
      await pending;
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("records a blocked terminal when the supervisor throws before saving a projection", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "buck-loop-throw-"));
    handleLoop.mockRejectedValue(new Error("supervisor failed before projection"));
    const { api, commands } = createMockApi();
    wireBuckLoop(api);
    try {
      await commands.get("buck-loop")!.handler("plan.md", { cwd, ui: { notify: () => undefined } });
      const records = readFileSync(join(cwd, ".context/workflow/buck-loop.log.jsonl"), "utf8")
        .trim().split("\n").map((line) => JSON.parse(line));
      expect(records.at(-1)).toMatchObject({
        type: "terminal", state: "blocked", ok: false, reason: "supervisor failed before projection",
      });
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });


  it("returns structured nested-call failures to the parent agent", async () => {
    const failure = {
      state: "building",
      operation: "run-skill",
      trying: "Run b-build for phase-1-demo.md",
      prompt: "canonical b-build prompt",
      agent: { kind: "work-session", id: "buck-loop-work-123", role: "b-build", model: "provider/model" },
      error: { name: "Error", message: "provider unavailable", stack: "Error: provider unavailable" },
    };
    handleLoop.mockImplementation(async (opts: { deps?: { onFailure?: (event: typeof failure) => void } }) => {
      opts.deps?.onFailure?.(failure);
      return { state: "blocked", reason: "provider unavailable" };
    });
    const { api, commands, sendMessage } = createMockApi();
    wireBuckLoop(api);

    await commands.get("buck-loop")!.handler("plan.md", { cwd: "/tmp/repo", ui: { notify: () => undefined } });

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        customType: "buck-loop-call-failure",
        display: true,
        details: failure,
        content: expect.stringContaining("provider unavailable"),
      }),
      { triggerTurn: true, deliverAs: "nextTurn" },
    );
    expect(sendMessage.mock.calls[0]?.[0].content).toContain("canonical b-build prompt");
    expect(sendMessage.mock.calls[0]?.[0].content).toContain("buck-loop-work-123");
  });

  it("prints usage and does not start work on missing path", async () => {
    const { api, commands } = createMockApi();
    wireBuckLoop(api);
    const notes: string[] = [];
    await commands.get("buck-loop")!.handler("", { cwd: "/tmp/repo", ui: { notify: (m: string) => notes.push(m) } });
    expect(handleLoop).not.toHaveBeenCalled();
    expect(notes.join("\n")).toContain(USAGE);
  });

  it("does not import xstate or b-flow", () => {
    const src = readFileSync(join(import.meta.dirname, "../index.ts"), "utf8");
    expect(src).not.toMatch(/xstate/);
    expect(src).not.toMatch(/b-flow/);
  });
});

describe("extensions/index.ts wiring", () => {
  it("invokes wireBuckLoop and does not wire b-flow", () => {
    const src = readFileSync(join(import.meta.dirname, "../../index.ts"), "utf8");
    expect(src).toMatch(/wireBuckLoop\(pi\)/);
    expect(src).not.toMatch(/b-flow/);
    expect(src).not.toMatch(/wireBflow/i);
  });
});
