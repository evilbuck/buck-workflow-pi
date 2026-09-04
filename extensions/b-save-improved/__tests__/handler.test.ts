import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as OmpModels from "../../omp-models.js";

const execFileCaptured = vi.fn();
const execFileCapturedWithStdin = vi.fn();
const createAgentSession = vi.fn();
const recordCommandError = vi.fn();
const { resolveOmpRole } = vi.hoisted(() => ({ resolveOmpRole: vi.fn() }));

vi.mock("../../command-progress.js", () => ({
  createProgress: () => ({ step: vi.fn(), clear: vi.fn(), fail: vi.fn(), done: vi.fn() }),
  execFileCaptured: (...args: unknown[]) => execFileCaptured(...args),
  execFileCapturedWithStdin: (...args: unknown[]) => execFileCapturedWithStdin(...args),
  recordCommandError: (...args: unknown[]) => recordCommandError(...args),
}));

vi.mock("@mariozechner/pi-coding-agent", () => ({
  createAgentSession: (...args: unknown[]) => createAgentSession(...args),
  SessionManager: { inMemory: () => ({}) },
  SettingsManager: { inMemory: () => ({}) },
}));

vi.mock("../../omp-models.js", async (importOriginal) => ({
  ...(await importOriginal<typeof OmpModels>()),
  resolveOmpRole,
}));


import { wire } from "../index.js";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const scribeJson = JSON.stringify({
  memory: {
    frontmatter: { domains: ["x"], topics: ["y"], priority: "high", status: "completed" },
    title: "T",
    body: "B",
  },
  index_entry: { summary: "S" },
  backlog: { complete_explicit: [], complete_inferred: [], new_items: [] },
  retain_facts: ["fact"],
});

function sessionWith(text: string) {
  return {
    session: {
      prompt: vi.fn(async () => {}),
      abort: vi.fn(),
      dispose: vi.fn(),
      messages: [{ role: "assistant", content: text }],
    },
  };
}

function createMockApi() {
  const commands = new Map<string, { handler: Function }>();
  const sendMessage = vi.fn();
  const api = {
    on: vi.fn(),
    registerCommand: vi.fn((name: string, opts: { handler: Function }) => commands.set(name, opts)),
    registerTool: vi.fn(),
    sendMessage,
  } as unknown as ExtensionAPI;
  return { api, commands, sendMessage };
}

const preflightOk = {
  code: 0,
  today: "2026-08-26",
  subject: { name: "2026-08-26.foo", path: ".context/2026-08-26.foo", created: false },
  existing_memory: { path: ".context/memory/foo-2026-08-26.md" },
  specs: [],
  iterates: [],
  plans: [],
  phases: { needs_adjudication: [], files: [], table_drift: [] },
  user_goal: { missing: [] },
  loose_artifacts: [],
  git: { status_porcelain: "", diff_stat: "" },
  memory_backend: { backend: "hindsight", expect_retain: true },
};

describe("b-save-improved handler", () => {
  beforeEach(() => {
    execFileCaptured.mockReset();
    execFileCapturedWithStdin.mockReset();
    createAgentSession.mockReset();
    recordCommandError.mockReset();
    resolveOmpRole.mockReset();
    resolveOmpRole.mockImplementation((_cwd: string, role: string) => {
      if (role === "slow") return "anthropic/slow";
      if (role === "smol") return "openai/smol";
      return "cursor/default";
    });
  });

  it("notifies when .context is missing", async () => {
    execFileCaptured.mockResolvedValue({ code: 3, stdout: "", stderr: "" });
    const { api, commands } = createMockApi();
    wire(api);
    const notes: string[] = [];
    await commands.get("b-save-improved")!.handler("--dry-run", {
      cwd: "/tmp",
      ui: { notify: (m: string) => notes.push(m) },
    });
    expect(notes.join(" ")).toMatch(/No \.context/);
    expect(recordCommandError).not.toHaveBeenCalled();
  });

  it("applies a dry-run after a successful scribe and skips retain", async () => {
    execFileCaptured.mockResolvedValue({ code: 0, stdout: JSON.stringify(preflightOk), stderr: "" });
    execFileCapturedWithStdin.mockResolvedValue({
      code: 0,
      stdout: JSON.stringify({ applied: [{ path: "m.md", action: "created", reason: "write" }], staged_inferred: [], errors: [] }),
      stderr: "",
    });
    createAgentSession.mockResolvedValue(sessionWith(scribeJson));
    const { api, commands, sendMessage } = createMockApi();
    wire(api);
    const notes: string[] = [];
    await commands.get("b-save-improved")!.handler("--dry-run --no-retain", {
      cwd: "/tmp",
      hasUI: false,
      sessionManager: { getEntries: () => [{ role: "user", content: "hi" }] },
      ui: { notify: (m: string) => notes.push(m) },
    });
    expect(execFileCapturedWithStdin).toHaveBeenCalled();
    expect(notes.some((n) => n.includes("created m.md"))).toBe(true);
    expect(sendMessage).not.toHaveBeenCalled();
    expect(recordCommandError).not.toHaveBeenCalled();
  });

  it("uses a restricted OMP child session for the scribe", async () => {
    execFileCaptured.mockResolvedValue({ code: 0, stdout: JSON.stringify(preflightOk), stderr: "" });
    execFileCapturedWithStdin.mockResolvedValue({
      code: 0,
      stdout: JSON.stringify({ applied: [], staged_inferred: [], errors: [] }),
      stderr: "",
    });
    createAgentSession.mockResolvedValue(sessionWith(scribeJson));
    const { api, commands } = createMockApi();
    wire(api);
    await commands.get("b-save-improved")!.handler("--dry-run --no-retain", {
      cwd: "/tmp",
      sessionManager: { getEntries: () => [] },
      ui: { notify: vi.fn() },
    });
    expect(createAgentSession).toHaveBeenCalledWith(expect.objectContaining({
      toolNames: [],
      restrictToolNames: true,
      disableExtensionDiscovery: true,
      enableMCP: false,
      enableLsp: false,
      agentId: expect.stringMatching(/^b-save-improved-model-/),
    }));
    expect(createAgentSession.mock.calls[0][0].settingsManager).toBeUndefined();
    expect(createAgentSession.mock.calls[0][0].taskDepth).toBeUndefined();
  });

  it("retries a failed default scribe with the configured smol fallback", async () => {
    execFileCaptured.mockResolvedValue({ code: 0, stdout: JSON.stringify(preflightOk), stderr: "" });
    execFileCapturedWithStdin.mockResolvedValue({
      code: 0,
      stdout: JSON.stringify({ applied: [], staged_inferred: [], errors: [] }),
      stderr: "",
    });
    createAgentSession
      .mockResolvedValueOnce(sessionWith(""))
      .mockResolvedValueOnce(sessionWith(scribeJson));
    const { api, commands } = createMockApi();
    wire(api);
    const notes: string[] = [];
    await commands.get("b-save-improved")!.handler("--dry-run --no-retain", {
      cwd: "/tmp",
      sessionManager: { getEntries: () => [] },
      ui: { notify: (m: string) => notes.push(m) },
    });
    expect(createAgentSession.mock.calls.map(([options]) => options.modelPattern))
      .toEqual(["cursor/default", "openai/smol"]);
    expect(notes.join(" ")).toMatch(/cursor\/default failed.*Retrying.*openai\/smol/i);
    expect(execFileCapturedWithStdin).toHaveBeenCalled();
    expect(recordCommandError).not.toHaveBeenCalled();
  });

  it("does not override an explicit model after failure", async () => {
    execFileCaptured.mockResolvedValue({ code: 0, stdout: JSON.stringify(preflightOk), stderr: "" });
    createAgentSession.mockResolvedValue(sessionWith(""));
    const { api, commands } = createMockApi();
    wire(api);
    const notes: string[] = [];
    await commands.get("b-save-improved")!.handler("--dry-run --no-retain --model provider/pinned", {
      cwd: "/tmp",
      sessionManager: { getEntries: () => [] },
      ui: { notify: (m: string) => notes.push(m) },
    });
    expect(createAgentSession).toHaveBeenCalledTimes(1);
    expect(createAgentSession.mock.calls[0][0].modelPattern).toBe("provider/pinned");
    expect(notes.join(" ")).toMatch(/provider\/pinned failed.*Change.*--model/i);
    expect(execFileCapturedWithStdin).not.toHaveBeenCalled();
    expect(recordCommandError).toHaveBeenCalled();
  });

  it("names both failed models and how to recover when fallback is exhausted", async () => {
    execFileCaptured.mockResolvedValue({ code: 0, stdout: JSON.stringify(preflightOk), stderr: "" });
    createAgentSession
      .mockResolvedValueOnce(sessionWith(""))
      .mockResolvedValueOnce(sessionWith(""));
    const { api, commands } = createMockApi();
    wire(api);
    const notes: string[] = [];
    await commands.get("b-save-improved")!.handler("--dry-run --no-retain", {
      cwd: "/tmp",
      sessionManager: { getEntries: () => [] },
      ui: { notify: (m: string) => notes.push(m) },
    });
    expect(createAgentSession).toHaveBeenCalledTimes(2);
    expect(notes.join(" ")).toMatch(/cursor\/default failed.*Fallback model openai\/smol also failed.*Change.*--model/i);
    expect(execFileCapturedWithStdin).not.toHaveBeenCalled();
    expect(recordCommandError).toHaveBeenCalled();
  });

  it("falls back to /b-save when the scribe returns nothing usable", async () => {
    execFileCaptured.mockResolvedValue({ code: 0, stdout: JSON.stringify(preflightOk), stderr: "" });
    createAgentSession.mockResolvedValue(sessionWith("not-json"));
    const { api, commands } = createMockApi();
    wire(api);
    const notes: string[] = [];
    await commands.get("b-save-improved")!.handler("", {
      cwd: "/tmp",
      ui: { notify: (m: string) => notes.push(m) },
    });
    expect(notes.join(" ")).toMatch(/Fall back to \/b-save/);
    expect(execFileCapturedWithStdin).not.toHaveBeenCalled();
    expect(recordCommandError).toHaveBeenCalledWith(
      expect.anything(),
      "b-save-improved",
      "scribe",
      expect.stringMatching(/Fall back to \/b-save/),
    );
  });

  it("notifies preflight filesystem errors", async () => {
    execFileCaptured.mockResolvedValue({ code: 1, stdout: JSON.stringify({ error: "not a git repository" }), stderr: "" });
    const { api, commands } = createMockApi();
    wire(api);
    const notes: string[] = [];
    await commands.get("b-save-improved")!.handler("", {
      cwd: "/tmp",
      ui: { notify: (m: string) => notes.push(m) },
    });
    expect(notes.join(" ")).toMatch(/not a git repository/);
    expect(recordCommandError).toHaveBeenCalledWith(
      expect.anything(),
      "b-save-improved",
      "preflight",
      "not a git repository",
      1,
    );
  });

  it("asks the user to pick a subject on exit 2 when UI is missing", async () => {
    execFileCaptured.mockResolvedValue({
      code: 2,
      stdout: JSON.stringify({ error: "ambiguous subject", subject_candidates: [{ name: "a" }, { name: "b" }] }),
      stderr: "",
    });
    const { api, commands } = createMockApi();
    wire(api);
    const notes: string[] = [];
    await commands.get("b-save-improved")!.handler("", {
      cwd: "/tmp",
      hasUI: false,
      ui: { notify: (m: string) => notes.push(m) },
    });
    expect(notes.join(" ")).toMatch(/Ambiguous subject/);
    expect(recordCommandError).toHaveBeenCalledWith(
      expect.anything(),
      "b-save-improved",
      "preflight",
      expect.stringMatching(/Ambiguous subject/),
    );
  });

  it("re-runs preflight after a subject pick and still applies", async () => {
    execFileCaptured
      .mockResolvedValueOnce({
        code: 2,
        stdout: JSON.stringify({ error: "ambiguous subject", subject_candidates: [{ name: "2026-08-26.foo" }] }),
        stderr: "",
      })
      .mockResolvedValueOnce({ code: 0, stdout: JSON.stringify(preflightOk), stderr: "" });
    execFileCapturedWithStdin.mockResolvedValue({
      code: 0,
      stdout: JSON.stringify({ applied: [{ path: "m.md", action: "updated" }], staged_inferred: [{ slug: "z" }], errors: [] }),
      stderr: "",
    });
    createAgentSession.mockResolvedValue(sessionWith(scribeJson));
    const { api, commands } = createMockApi();
    wire(api);
    const notes: string[] = [];
    await commands.get("b-save-improved")!.handler("", {
      cwd: "/tmp",
      hasUI: true,
      sessionManager: { getEntries: () => [] },
      ui: {
        notify: (m: string) => notes.push(m),
        select: async () => "2026-08-26.foo",
      },
    });
    expect(notes.join(" ")).toMatch(/archive-inferred/);
  });

  it("offers Create new subject and re-runs preflight with the suggested name", async () => {
    execFileCaptured
      .mockResolvedValueOnce({
        code: 2,
        stdout: JSON.stringify({
          error: "ambiguous subject",
          subject_candidates: [{ name: "2026-08-26.foo" }, { name: "2026-08-20.bar" }],
          suggested_subject: "2026-08-26.x",
        }),
        stderr: "",
      })
      .mockResolvedValueOnce({ code: 0, stdout: JSON.stringify({
        ...preflightOk,
        subject: { name: "2026-08-26.x", path: ".context/2026-08-26.x", created: true },
      }), stderr: "" });
    execFileCapturedWithStdin.mockResolvedValue({
      code: 0,
      stdout: JSON.stringify({ applied: [{ path: "m.md", action: "created" }], staged_inferred: [], errors: [] }),
      stderr: "",
    });
    createAgentSession.mockResolvedValue(sessionWith(scribeJson));
    const { api, commands } = createMockApi();
    wire(api);
    const notes: string[] = [];
    const options: string[] = [];
    await commands.get("b-save-improved")!.handler("--dry-run --no-retain", {
      cwd: "/tmp",
      hasUI: true,
      sessionManager: { getEntries: () => [] },
      ui: {
        notify: (m: string) => notes.push(m),
        select: async (_prompt: string, items: string[]) => {
          options.push(...items);
          return items[0];
        },
      },
    });
    expect(options).toEqual(["Create 2026-08-26.x", "2026-08-26.foo", "2026-08-20.bar"]);
    expect(execFileCaptured.mock.calls[1][1]).toEqual(expect.arrayContaining(["--subject", "2026-08-26.x"]));
    expect(notes.some((n) => n.includes("created m.md"))).toBe(true);
  });

  it("runs the auditor when phases need adjudication", async () => {
    const withPhases = {
      ...preflightOk,
      phases: { needs_adjudication: ["phase-2.md"], files: [{ path: "phase-2.md" }], table_drift: [{ file: "phase-2.md" }] },
      specs: [{ path: "spec-x.md" }],
      user_goal: { missing: ["plan-x.md"] },
    };
    execFileCaptured.mockResolvedValue({ code: 0, stdout: JSON.stringify(withPhases), stderr: "" });
    execFileCapturedWithStdin.mockResolvedValue({
      code: 0,
      stdout: JSON.stringify({ applied: [], staged_inferred: [], errors: [] }),
      stderr: "",
    });
    createAgentSession
      .mockResolvedValueOnce(sessionWith(scribeJson))
      .mockResolvedValueOnce(sessionWith(JSON.stringify({ verdicts: [{ path: "spec-x.md", verdict: "complete", evidence: "a:1" }] })));
    const { api, commands, sendMessage } = createMockApi();
    wire(api);
    const notes: string[] = [];
    await commands.get("b-save-improved")!.handler("", {
      cwd: "/tmp",
      sessionManager: { getEntries: () => [] },
      ui: { notify: (m: string) => notes.push(m) },
    });
    expect(createAgentSession).toHaveBeenCalledTimes(2);
    const sessionOpts = createAgentSession.mock.calls[0][0] as { agentDir?: string };
    expect(sessionOpts.agentDir).toMatch(/\.omp\/agent$/);
    expect(notes.join(" ")).toMatch(/User Goal missing/);
    expect(sendMessage).toHaveBeenCalled();

  });

  it("records a failed apply and skips post-apply side effects", async () => {
    execFileCaptured.mockResolvedValue({ code: 0, stdout: JSON.stringify({ ...preflightOk, memory_backend: { backend: null, expect_retain: false } }), stderr: "" });
    execFileCapturedWithStdin.mockResolvedValue({
      code: 1,
      stdout: JSON.stringify({
        applied: [{ path: "m.md", action: "created" }],
        staged_inferred: [],
        errors: ["EACCES: permission denied"],
      }),
      stderr: "",
    });
    createAgentSession.mockResolvedValue(sessionWith(scribeJson));
    const { api, commands, sendMessage } = createMockApi();
    wire(api);
    const notes: string[] = [];
    await commands.get("b-save-improved")!.handler("", {
      cwd: "/tmp",
      sessionManager: { getEntries: () => [] },
      ui: { notify: (m: string) => notes.push(m) },
    });
    expect(notes).toEqual([]);
    expect(recordCommandError).toHaveBeenCalledWith(
      expect.anything(),
      "b-save-improved",
      "apply",
      "EACCES: permission denied",
      1,
    );
    expect(execFileCaptured).toHaveBeenCalledTimes(1);
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
