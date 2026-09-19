/**
 * Seams under test:
 * - `parseArgs` — closed command grammar
 * - `wireBuckLoop` — registers `/buck-loop` and delegates to `handleLoop`
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const handleLoop = vi.fn();
vi.mock("../loop.js", () => ({ handleLoop: (...args: unknown[]) => handleLoop(...args) }));

import { parseArgs, USAGE, wireBuckLoop } from "../index.js";

function createMockApi(): {
  api: ExtensionAPI;
  commands: Map<string, { handler: (args: string, ctx: { cwd: string; ui: {
    notify: (m: string, l?: string) => void;
    setStatus?: (key: string, text: string | undefined) => void;
    setWidget?: (key: string, content: string[] | undefined) => void;
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
