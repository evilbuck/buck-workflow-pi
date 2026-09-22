/**
 * Command-surface tests. No nested agent is started.
 *
 * - `parseArgs` — the grammar `/buck-loop` accepts.
 * - `wireBuckLoop` — registers the slash command with a fake host API and
 *   checks that `handleLoop` is the only thing the handler calls.
 */
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionUIDialogOptions } from "@mariozechner/pi-coding-agent";
import type { ActivityEvent } from "../../extension-activity.js";

const handleLoop = vi.fn();
vi.mock("../loop.js", () => ({ handleLoop: (...args: unknown[]) => handleLoop(...args) }));

import { parseArgs, USAGE, wireBuckLoop } from "../index.js";

type TestUI = {
  notify: (m: string, l?: string) => void;
  setStatus?: (key: string, text: string | undefined) => void;
  setWidget?: (key: string, content: string[] | undefined) => void;
  confirm?: (title: string, message: string, opts?: ExtensionUIDialogOptions) => Promise<boolean>;
};

type TestCommandContext = {
  cwd: string;
  hasUI?: boolean;
  ui: TestUI;
};

function createMockApi(): {
  api: ExtensionAPI;
  commands: Map<string, { handler: (args: string, ctx: TestCommandContext) => Promise<void> }>;
  sendMessage: Mock;
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

afterEach(() => {
  handleLoop.mockReset();
  vi.useRealTimers();
});

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
  it("forwards interactive dirty-tree approval through a bounded dialog", async () => {
    let decision: boolean | undefined;
    handleLoop.mockImplementation(async (opts: {
      deps?: { confirmDirty?: (request: { mode: "start" | "resume"; paths: string[] }) => Promise<boolean> };
    }) => {
      decision = await opts.deps?.confirmDirty?.({ mode: "resume", paths: ["docs/cycles/note.md"] });
      return { state: "blocked", reason: "test complete" };
    });
    const confirm = vi.fn(async (
      _title: string,
      _message: string,
      _opts?: ExtensionUIDialogOptions,
    ) => true);
    const { api, commands } = createMockApi();
    wireBuckLoop(api);

    await commands.get("buck-loop")!.handler("--resume", {
      cwd: "/tmp/repo",
      hasUI: true,
      ui: { notify: () => undefined, confirm },
    });

    expect(decision).toBe(true);
    expect(confirm).toHaveBeenCalledOnce();
    const [title, message, options] = confirm.mock.calls[0]!;
    expect(title).toBe("Uncommitted changes");
    expect(message).toContain("docs/cycles/note.md");
    expect(message).toContain("stages everything");
    expect(options?.timeout).toBeGreaterThan(0);
    expect(options?.signal).toBeInstanceOf(AbortSignal);
  });

  it("treats an interactive dirty-tree denial as denial", async () => {
    let decision: boolean | undefined;
    handleLoop.mockImplementation(async (opts: {
      deps?: { confirmDirty?: (request: { mode: "start" | "resume"; paths: string[] }) => Promise<boolean> };
    }) => {
      decision = await opts.deps?.confirmDirty?.({ mode: "start", paths: ["src/unrelated.ts"] });
      return { state: "blocked", reason: "test complete" };
    });
    const confirm = vi.fn(async (
      _title: string,
      _message: string,
      _opts?: ExtensionUIDialogOptions,
    ) => false);
    const { api, commands } = createMockApi();
    wireBuckLoop(api);

    await commands.get("buck-loop")!.handler("plan.md", {
      cwd: "/tmp/repo",
      hasUI: true,
      ui: { notify: () => undefined, confirm },
    });

    expect(decision).toBe(false);
    expect(confirm).toHaveBeenCalledOnce();
  });

  it("denies dirty-tree approval without a UI", async () => {
    let decision: boolean | undefined;
    handleLoop.mockImplementation(async (opts: {
      deps?: { confirmDirty?: (request: { mode: "start" | "resume"; paths: string[] }) => Promise<boolean> };
    }) => {
      decision = await opts.deps?.confirmDirty?.({ mode: "start", paths: ["src/unrelated.ts"] });
      return { state: "blocked", reason: "test complete" };
    });
    const confirm = vi.fn(async (
      _title: string,
      _message: string,
      _opts?: ExtensionUIDialogOptions,
    ) => true);
    const { api, commands } = createMockApi();
    wireBuckLoop(api);

    await commands.get("buck-loop")!.handler("plan.md", {
      cwd: "/tmp/repo",
      hasUI: false,
      ui: { notify: () => undefined, confirm },
    });

    expect(decision).toBe(false);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("fails closed when an RPC-style dirty-tree dialog times out", async () => {
    vi.useFakeTimers();
    let decision: boolean | undefined;
    let settled = false;
    handleLoop.mockImplementation(async (opts: {
      deps?: { confirmDirty?: (request: { mode: "start" | "resume"; paths: string[] }) => Promise<boolean> };
    }) => {
      decision = await opts.deps?.confirmDirty?.({ mode: "resume", paths: ["docs/cycles/note.md"] });
      return { state: "blocked", reason: "test complete" };
    });
    const confirm = vi.fn((
      _title: string,
      _message: string,
      opts?: ExtensionUIDialogOptions,
    ) => new Promise<boolean>((resolve) => {
      setTimeout(() => resolve(false), opts?.timeout ?? 60_000);
    }));
    const { api, commands } = createMockApi();
    wireBuckLoop(api);

    const pending = commands.get("buck-loop")!.handler("--resume", {
      cwd: "/tmp/repo",
      hasUI: true,
      ui: { notify: () => undefined, confirm },
    });
    void pending.then(() => { settled = true; });
    await vi.advanceTimersByTimeAsync(30_000);

    expect(settled).toBe(true);
    await pending;
    expect(decision).toBe(false);
    expect(confirm.mock.calls[0]?.[2]?.timeout).toBeLessThanOrEqual(30_000);
  });

  it("shows live activity before the supervisor settles and clears it afterward", async () => {
    let settle!: (value: { state: string; reason: string }) => void;
    handleLoop.mockImplementation((opts: { deps?: { onProgress?: (event: { label: string }) => void } }) => {
      opts.deps?.onProgress?.({ label: "Building phase-1-demo.md" });
      return new Promise((resolve) => { settle = resolve; });
    });
    const { api, commands } = createMockApi();
    wireBuckLoop(api);
    const statuses: Array<string | undefined> = [];
    const widgets: Array<string[] | undefined> = [];
    const pending = commands.get("buck-loop")!.handler("plan.md", {
      cwd: "/tmp/repo",
      ui: {
        notify: () => undefined,
        setStatus: (_key, text) => statuses.push(text),
        setWidget: (_key, content) => widgets.push(content),
      },
    });

    expect(statuses.some((text) => text?.includes("Starting plan.md"))).toBe(true);
    expect(statuses.some((text) => text?.includes("Building phase-1-demo.md"))).toBe(true);
    expect(widgets.some((content) => content?.join("\n").includes("buck-loop"))).toBe(true);

    settle({ state: "done", reason: "all phases completed" });
    await pending;
    expect(statuses.at(-1)).toBeUndefined();
    expect(widgets.at(-1)).toBeUndefined();
  });

  it("renders the newest six nested activity rows", async () => {
    handleLoop.mockImplementation(async (opts: { deps?: { onActivity?: (event: ActivityEvent) => void } }) => {
      for (let index = 0; index < 10; index += 1) {
        opts.deps?.onActivity?.({ kind: "toolStart", tool: "tool-" + index, target: index === 9 ? "x".repeat(100) : undefined });
      }
      opts.deps?.onActivity?.({ kind: "complete", ok: true, message: "agent finished" });
      return { state: "done", reason: "all phases completed" };
    });
    const { api, commands } = createMockApi();
    wireBuckLoop(api);
    const widgets: Array<string[] | undefined> = [];

    await commands.get("buck-loop")!.handler("plan.md", {
      cwd: "/tmp/repo",
      ui: {
        notify: () => undefined,
        setStatus: () => undefined,
        setWidget: (_key, content) => widgets.push(content),
      },
    });

    const viewport = widgets.find((lines) => lines?.some((line) => line.includes("tool-9")));
    expect(viewport?.slice(1)).toHaveLength(6);
    expect(viewport?.slice(1).every((line) => line.length <= 64)).toBe(true);
    expect(viewport?.join(" ")).not.toContain("tool-0");
    expect(viewport?.join(" ")).toContain("tool-9");
    expect(viewport?.join(" ")).toContain("…");
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
