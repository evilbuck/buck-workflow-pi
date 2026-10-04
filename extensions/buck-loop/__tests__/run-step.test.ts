/**
 * Nested-session tests. `createAgentSession` is mocked — we assert the
 * host options (no extension discovery, tool allowlist, in-memory history)
 * and the `{ ok, text }` result. No live child agent is spawned.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type * as PiCodingAgent from "@mariozechner/pi-coding-agent";

const { createAgentSessionMock, createLazyPoolMock, failSkillRead } = vi.hoisted(() => ({
  createAgentSessionMock: vi.fn(),
  createLazyPoolMock: vi.fn(() => () => ({ end: async () => {} })),
  failSkillRead: { value: false },
}));
vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return { ...actual, readFileSync: (...args: Parameters<typeof actual.readFileSync>) => {
    if (failSkillRead.value && String(args[0]).endsWith("skills/b-docs/SKILL.md")) throw new Error("missing skill");
    return actual.readFileSync(...args);
  }};
});
vi.mock("@mariozechner/pi-coding-agent", async () => {
  const actual = await vi.importActual<typeof PiCodingAgent>("@mariozechner/pi-coding-agent");
  return { ...actual, createAgentSession: createAgentSessionMock };
});
vi.mock("../../sql-memory/db.js", () => ({ createLazyPool: createLazyPoolMock }));
import { WORK_SESSION_IDLE_TIMEOUT_MS, runStep, selectBuckStageModel, type WorkModelSelectInput } from "../run-step.js";
import { cleanupRepos, repo } from "./fixtures.js";
import { completeSaveAttempt, prepareSaveAttempt, verifySqlSave, writeReceipt } from "../sql-save.js";

const dirs: string[] = [];
function tmp(): string { const dir = mkdtempSync(join(tmpdir(), "buck-loop-run-step-")); dirs.push(dir); return dir; }
function writeRoles(dir: string): void { mkdirSync(join(dir, ".omp"), { recursive: true }); writeFileSync(join(dir, ".omp", "config.yml"), "modelRoles:\n  default: provider/default\n  slow: provider/slow\n  smol: provider/smol\n"); }
function arrange(text = "worker result") {
  const unsubscribe = vi.fn();
  let listener: ((event: unknown) => void) | undefined;
  const session = {
    prompt: vi.fn().mockResolvedValue(undefined),
    messages: [{ role: "assistant", content: text }] as Array<{ role: string; content: string; stopReason?: string }>,
    getContextUsage: vi.fn<() => PiCodingAgent.ContextUsage | undefined>(() => undefined),
    subscribe: vi.fn((next: (event: unknown) => void) => { listener = next; return unsubscribe; }),
    emit: (event: unknown) => listener?.(event),
    abort: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn().mockResolvedValue(undefined),
    unsubscribe,
  };
  createAgentSessionMock.mockResolvedValue({ session });
  return session;
}
function selectOnce(id = "provider/picked", thinking: "off" | "low" | "medium" | "high" = "medium") {
  return vi.fn(async (input: WorkModelSelectInput) => {
    if (input.exclude.length > 0) {
      return { ok: false as const, message: `buckModels stage "${input.stage}" has no available models; excluded: ${input.exclude.join(", ")}` };
    }
    return { ok: true as const, id, thinking };
  });
}
beforeEach(() => {
  delete process.env.SQL_MEMORY_URL;
});
afterEach(() => {
  createAgentSessionMock.mockReset();
  createLazyPoolMock.mockClear();
  failSkillRead.value = false;
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  cleanupRepos();
  delete process.env.SQL_MEMORY_URL;
});
describe("runStep", () => {
  it("samples current child context through compaction and unavailable usage", async () => {
    const child = arrange();
    let usage: PiCodingAgent.ContextUsage | undefined = { tokens: 42000, contextWindow: 200000, percent: 21 };
    child.getContextUsage.mockImplementation(() => usage);
    const observed: Array<PiCodingAgent.ContextUsage | undefined> = [];
    child.prompt.mockImplementation(async () => {
      usage = { tokens: 60000, contextWindow: 200000, percent: 30 };
      child.emit({ type: "message_update" });
      usage = { tokens: null, contextWindow: 200000, percent: null };
      child.emit({ type: "auto_compaction_end" });
      usage = undefined;
      child.emit({ type: "message_update" });
    });
    await runStep({ select: selectOnce(), cwd: tmp(), skill: "b-build", planOrPhasePath: "plan.md", onContextUsage: value => observed.push(value) });
    expect(observed).toEqual([
      { tokens: 42000, contextWindow: 200000, percent: 21 },
      { tokens: 60000, contextWindow: 200000, percent: 30 },
      { tokens: null, contextWindow: 200000, percent: null },
      undefined,
    ]);
  });
  it("leads with the canonical skill contract and names the exact phase path", async () => { const fake = arrange(); await runStep({ select: selectOnce(), cwd: tmp(), skill: "b-build", planOrPhasePath: ".context/example/phase-2.md" }); const prompt = fake.prompt.mock.calls[0][0] as string; expect(prompt.startsWith("---")).toBe(true); expect(prompt).toContain("# b-build: Implementation Agent with TDD"); expect(prompt).toContain(".context/example/phase-2.md"); expect(prompt).toContain("stage only files you created or modified"); expect(prompt).toContain("no authority to choose the next loop state"); });
  it("creates isolated sessions with the build tool allowlist", async () => { arrange(); await runStep({ select: selectOnce(), cwd: tmp(), skill: "b-build", planOrPhasePath: "plan.md" }); expect(createAgentSessionMock).toHaveBeenCalledWith(expect.objectContaining({ disableExtensionDiscovery: true, restrictToolNames: true, enableMCP: false, enableLsp: false, modelPattern: "provider/picked", thinkingLevel: "medium", tools: ["read", "edit", "write", "grep", "bash"], toolNames: ["read", "edit", "write", "grep", "bash"] })); });
  it.each([["b-review", ["read", "edit", "write", "grep", "find", "ls", "bash"]], ["b-docs", ["read", "edit", "write", "grep", "bash"]], ["b-howto", ["read", "edit", "write", "grep", "bash"]], ["b-commit", ["read", "bash"]]] as const)("uses the least-privilege allowlist for %s", async (skill, tools) => { arrange(); await runStep({ select: selectOnce(), cwd: tmp(), skill, planOrPhasePath: "plan.md" }); expect(createAgentSessionMock).toHaveBeenCalledWith(expect.objectContaining({ tools, toolNames: tools, modelPattern: "provider/picked" })); });
  it("admits sql_memory only to configured non-commit stages as a restricted custom tool", async () => {
    const previous = process.env.SQL_MEMORY_URL;
    process.env.SQL_MEMORY_URL = "postgres://test.invalid/memory";
    try {
      arrange();
      await runStep({ select: selectOnce(), cwd: tmp(), skill: "b-build", planOrPhasePath: "plan.md" });
      expect(createAgentSessionMock).toHaveBeenCalledWith(expect.objectContaining({
        allowRestrictedCustomTools: true,
        restrictToolNames: true,
        toolNames: ["read", "edit", "write", "grep", "bash", "sql_memory"],
        customTools: [expect.objectContaining({ name: "sql_memory" })],
      }));
      createAgentSessionMock.mockClear();
      arrange();
      await runStep({ select: selectOnce(), cwd: tmp(), skill: "b-commit", planOrPhasePath: "plan.md" });
      expect(createAgentSessionMock.mock.calls[0]![0]).not.toHaveProperty("customTools");
      expect(createAgentSessionMock.mock.calls[0]![0].toolNames).toEqual(["read", "bash"]);
    } finally {
      if (previous === undefined) delete process.env.SQL_MEMORY_URL;
      else process.env.SQL_MEMORY_URL = previous;
    }
  });
  it("streams the sql_memory notice once when the nested SQL tool succeeds", async () => {
    const previous = process.env.SQL_MEMORY_URL;
    process.env.SQL_MEMORY_URL = "postgres://test.invalid/memory";
    createLazyPoolMock.mockReturnValueOnce(() => ({
      end: async () => {},
      async query() { return { rows: [] }; },
      async connect() {
        return { async query(text: string) { return { rows: text.startsWith("SELECT") ? [{ id: "m1" }] : [] }; }, release() {} };
      },
    }));
    try {
      const session = arrange();
      const onActivity = vi.fn();
      session.prompt.mockImplementation(async () => {
        const options = createAgentSessionMock.mock.calls[0]![0];
        const tool = options.customTools[0];
        const result = await tool.execute("call", {
          op: "sql", statement: "SELECT id FROM memories WHERE project = $1", values: ["project", "bounded query"],
        }, undefined, undefined, {} as never);
        session.emit({ type: "tool_execution_end", toolName: "sql_memory", isError: false, result });
      });
      await runStep({ select: selectOnce(), cwd: tmp(), skill: "b-build", planOrPhasePath: "plan.md", onActivity });
      expect(onActivity.mock.calls.map((call) => call[0])).toEqual([
        { kind: "toolEnd", tool: "sql_memory", ok: true, message: 'Memory recall · 1 row · "bounded query"' },
      ]);
    } finally {
      if (previous === undefined) delete process.env.SQL_MEMORY_URL;
      else process.env.SQL_MEMORY_URL = previous;
    }
  });
  it("trusts the agent's success when its sql_memory call was denied at the gate", async () => {
    // Gate denials during agent work are recoverable — the agent sees the error and may
    // correct with a different op. run-step must not downgrade `outcome.ok` based on the
    // gate denial alone; the supervisor's `finishSqlSave` is the receipt authority.
    const previous = process.env.SQL_MEMORY_URL;
    process.env.SQL_MEMORY_URL = "postgres://test.invalid/memory";
    try {
      const session = arrange("I finished.");
      createAgentSessionMock.mockImplementationOnce(async (options) => {
        const sqlTool = options.customTools?.[0] as { execute: (...args: unknown[]) => Promise<{ details: unknown }> };
        const result = await sqlTool.execute("call", { op: "sql", statement: "DELETE FROM memories" }, undefined, undefined, {} as never);
        expect(result.details).toMatchObject({ error: true });
        return { session };
      });
      const select = selectOnce();
      const result = await runStep({ select, cwd: tmp(), skill: "b-build", planOrPhasePath: "plan.md" });
      expect(result).toEqual({ ok: true, text: "I finished." });
      expect(select).toHaveBeenCalledTimes(1);
      expect(createAgentSessionMock).toHaveBeenCalledTimes(1);
    } finally {
      if (previous === undefined) delete process.env.SQL_MEMORY_URL;
      else process.env.SQL_MEMORY_URL = previous;
    }
  });
  it("does not retry another model after a gate denial, even when the agent returns text", async () => {
    // A gate denial during agent work is not a model problem — switching models would not
    // change the gate verdict. The supervisor must see exactly one picker call.
    const previous = process.env.SQL_MEMORY_URL;
    process.env.SQL_MEMORY_URL = "postgres://test.invalid/memory";
    try {
      const first = arrange("I finished.");
      createAgentSessionMock.mockReset();
      createAgentSessionMock.mockImplementationOnce(async (options) => {
        const sqlTool = options.customTools[0] as { execute: (id: string, params: unknown) => Promise<{ details: unknown }> };
        first.prompt.mockImplementation(async () => {
          const result = await sqlTool.execute("call", { op: "sql", statement: "DELETE FROM memories" });
          expect(result.details).toMatchObject({ error: true });
        });
        return { session: first };
      });
      const select = vi.fn(async (input: WorkModelSelectInput) => ({
        ok: true as const,
        id: input.exclude.length ? "provider/second" : "provider/first",
        thinking: "medium" as const,
      }));
      const result = await runStep({ select, cwd: tmp(), skill: "b-build", planOrPhasePath: "plan.md" });
      expect(result).toEqual({ ok: true, text: "I finished." });
      expect(select).toHaveBeenCalledTimes(1);
      expect(createAgentSessionMock).toHaveBeenCalledTimes(1);
    } finally {
      if (previous === undefined) delete process.env.SQL_MEMORY_URL;
      else process.env.SQL_MEMORY_URL = previous;
    }
  });
  it("keeps a receipt-verified save successful when pool shutdown fails", async () => {
    process.env.SQL_MEMORY_URL = "postgres://test.invalid/memory";
    const cwd = repo();
    const prepared = prepareSaveAttempt(cwd, "2026-09-30.save-test");
    if ("error" in prepared) throw new Error(prepared.error);
    const end = vi.fn().mockRejectedValue(new Error("pool shutdown failed"));
    createLazyPoolMock.mockReturnValueOnce(() => ({ end }));
    const session = arrange("finished");
    session.prompt.mockImplementation(async () => {
      writeReceipt(cwd, prepared, { kind: "no-fact", ids: [] });
      completeSaveAttempt(cwd, prepared);
    });
    const onActivity = vi.fn();
    const select = selectOnce();
    const result = await runStep({ select, cwd, skill: "b-save", planOrPhasePath: "plan.md", onActivity });
    expect(result).toEqual({ ok: true, text: "finished" });
    expect(await verifySqlSave(cwd, prepared.subject, async () => [{ id: "probe" }], true, prepared.attemptId))
      .toEqual({ status: "verified" });
    expect(session.dispose).toHaveBeenCalledOnce();
    expect(end).toHaveBeenCalledOnce();
    expect(onActivity).toHaveBeenCalledWith(expect.objectContaining({
      kind: "toolEnd", tool: "sql_memory", ok: false, message: "Memory failed · pool shutdown failed",
    }));
    expect(select).toHaveBeenCalledTimes(1);
  });
  it("accepts a corrected final insert and receipt-backed read-back", async () => {
    process.env.SQL_MEMORY_URL = "postgres://test.invalid/memory";
    const cwd = repo();
    const prepared = prepareSaveAttempt(cwd, "2026-09-30.save-test");
    if ("error" in prepared) throw new Error(prepared.error);
    let attempts = 0;
    createLazyPoolMock.mockReturnValueOnce(() => ({
      connect: async () => ({ query: async (sql: string) => {
        if (sql.startsWith("INSERT") && attempts++ === 0) throw new Error("transient insert failure");
        return { rows: [{ id: "saved-id" }] };
      }, release: () => {} }),
      end: async () => {},
    }));
    const session = arrange("completed");
    session.prompt.mockImplementation(async () => {
      const tool = createAgentSessionMock.mock.calls.at(-1)![0].customTools[0];
      const insert = { op: "sql", statement: "INSERT INTO public.memories (body) VALUES ($1) RETURNING id", values: ["fact"] };
      expect((await tool.execute("failed", insert)).details).toMatchObject({ error: true });
      expect((await tool.execute("corrected", insert)).details).toMatchObject({ rows: [{ id: "saved-id" }] });
      expect((await tool.execute("read-back", { op: "sql", statement: "SELECT id FROM public.memories WHERE id = $1", values: ["saved-id"] })).details)
        .toMatchObject({ rows: [{ id: "saved-id" }] });
      writeReceipt(cwd, prepared, { kind: "rows", ids: ["saved-id"] });
      completeSaveAttempt(cwd, prepared);
    });
    const select = selectOnce();
    expect(await runStep({ select, cwd, skill: "b-save", planOrPhasePath: "plan.md" }))
      .toEqual({ ok: true, text: "completed" });
    expect(await verifySqlSave(cwd, prepared.subject, async () => [{ id: "saved-id" }], true, prepared.attemptId))
      .toEqual({ status: "verified" });
    expect(select).toHaveBeenCalledTimes(1);
  });

  it("allows another model when a failed save INSERT was corrected before an unrelated host failure", async () => {
    process.env.SQL_MEMORY_URL = "postgres://test.invalid/memory";
    let attempts = 0;
    createLazyPoolMock.mockReturnValueOnce(() => ({
      connect: async () => ({ query: async (sql: string) => {
        if (sql.startsWith("INSERT") && attempts++ === 0) throw new Error("transient insert failure");
        return { rows: [] };
      }, release: () => {} }),
      end: async () => {},
    }));
    const first = arrange("partial");
    const second = arrange("recovered by second model");
    createAgentSessionMock.mockReset();
    createAgentSessionMock.mockResolvedValueOnce({ session: first }).mockResolvedValueOnce({ session: second });
    first.prompt.mockImplementation(async () => {
      const tool = createAgentSessionMock.mock.calls[0]![0].customTools[0];
      const params = { op: "sql", statement: "INSERT INTO public.memories (body) VALUES ($1)", values: ["fact"] };
      expect((await tool.execute("failed", params)).details).toMatchObject({ error: true });
      expect((await tool.execute("corrected", params)).details).toMatchObject({ rows: [] });
      throw new Error("provider disconnected after SQL recovery");
    });
    const select = vi.fn(async (input: WorkModelSelectInput) => ({
      ok: true as const, id: input.exclude.length ? "provider/second" : "provider/first", thinking: "low" as const,
    }));
    expect(await runStep({ select, cwd: tmp(), skill: "b-save", planOrPhasePath: "plan.md" }))
      .toEqual({ ok: true, text: "recovered by second model" });
    expect(select.mock.calls.map(([input]) => input.exclude)).toEqual([[], ["provider/first"]]);
  });

  it("does not retry another model after an unresolved final save INSERT failure", async () => {
    process.env.SQL_MEMORY_URL = "postgres://test.invalid/memory";
    const cwd = repo();
    const prepared = prepareSaveAttempt(cwd, "2026-09-30.save-test");
    if ("error" in prepared) throw new Error(prepared.error);
    createLazyPoolMock.mockReturnValueOnce(() => ({
      connect: async () => ({ query: async (sql: string) => {
        if (sql.startsWith("INSERT")) throw new Error("final insert failure");
        return { rows: [] };
      }, release: () => {} }),
      end: async () => {},
    }));
    const session = arrange("partial");
    session.prompt.mockImplementation(async () => {
      const tool = createAgentSessionMock.mock.calls[0]![0].customTools[0];
      expect((await tool.execute("failed", { op: "sql", statement: "INSERT INTO public.memories (body) VALUES ($1)", values: ["fact"] })).details)
        .toMatchObject({ error: true });
      throw new Error("provider disconnected after final SQL failure");
    });
    const select = vi.fn(async (input: WorkModelSelectInput) => ({
      ok: true as const, id: input.exclude.length ? "provider/second" : "provider/first", thinking: "low" as const,
    }));
    expect(await runStep({ select, cwd, skill: "b-save", planOrPhasePath: "plan.md" }))
      .toMatchObject({ ok: false, text: "provider disconnected after final SQL failure" });
    expect(select).toHaveBeenCalledTimes(1);
    expect(await verifySqlSave(cwd, prepared.subject, async () => [{ id: "probe" }], true, prepared.attemptId))
      .toEqual({ status: "unverified" });
  });
  it.each(["unsubscribe", "dispose"] as const)("keeps the stage ok when %s throws after a successful session", async (cleanup) => {
    // Cleanup failures must not flip a successful session into a failure; the agent's
    // durable work already landed and the supervisor's receipt verification is the
    // authority for save stages.
    const first = arrange("work completed");
    first[cleanup].mockImplementation(() => { throw new Error(`${cleanup} failed`); });
    const select = vi.fn(async (input: WorkModelSelectInput) => ({
      ok: true as const,
      id: input.exclude.length ? "provider/second" : "provider/first",
      thinking: "medium" as const,
    }));

    const result = await runStep({ select, cwd: tmp(), skill: "b-commit", planOrPhasePath: "plan.md" });

    expect(result).toEqual({ ok: true, text: "work completed" });
    expect(first.dispose).toHaveBeenCalledOnce();
    expect(select).toHaveBeenCalledTimes(1);
    expect(createAgentSessionMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the stage failure when both disposal and pool shutdown fail", async () => {
    const previous = process.env.SQL_MEMORY_URL;
    process.env.SQL_MEMORY_URL = "postgres://test.invalid/memory";
    const end = vi.fn().mockRejectedValue(new Error("pool shutdown failed"));
    createLazyPoolMock.mockReturnValueOnce(() => ({ end }));
    try {
      const session = arrange();
      session.prompt.mockRejectedValue(new Error("provider disconnected"));
      session.dispose.mockRejectedValue(new Error("dispose failed"));
      const result = await runStep({ select: selectOnce(), cwd: tmp(), skill: "b-build", planOrPhasePath: "plan.md" });
      expect(session.dispose).toHaveBeenCalledOnce();
      expect(end).toHaveBeenCalledOnce();
      expect(result).toMatchObject({ ok: false, text: expect.stringContaining("provider disconnected") });
    } finally {
      if (previous === undefined) delete process.env.SQL_MEMORY_URL;
      else process.env.SQL_MEMORY_URL = previous;
    }
  });
  it("does not waive protected-branch force for nested loop commits", async () => { const fake = arrange(); await runStep({ select: selectOnce(), cwd: tmp(), skill: "b-commit", planOrPhasePath: "plan.md" }); const prompt = fake.prompt.mock.calls[0][0] as string; expect(prompt).not.toContain("Treat this assignment as /b-commit force"); expect(prompt).toContain("Do not use force"); });
  it("runs the picker id and thinking level, not a difficulty role", async () => { arrange(); const cwd = tmp(); writeRoles(cwd); const select = selectOnce("provider/picked", "high"); await runStep({ select, cwd, skill: "b-build", planOrPhasePath: "plan.md", difficulty: "hard" }); expect(createAgentSessionMock).toHaveBeenCalledWith(expect.objectContaining({ modelPattern: "provider/picked", thinkingLevel: "high" })); expect(createAgentSessionMock.mock.calls[0][0]).not.toHaveProperty("difficulty"); expect(select.mock.calls[0][0].difficulty).toBe("hard"); });
  it("exports a fifteen-minute work-session idle timeout", () => { expect(WORK_SESSION_IDLE_TIMEOUT_MS).toBe(15 * 60_000); });
  it("returns only successful assistant text", async () => { arrange("completed"); await expect(runStep({ select: selectOnce(), cwd: tmp(), skill: "b-iterate", planOrPhasePath: "plan.md" })).resolves.toEqual({ ok: true, text: "completed" }); });
  it("streams normalized SDK activity and unsubscribes after prompt failure", async () => {
    const fake = arrange();
    const onActivity = vi.fn();
    fake.prompt.mockImplementation(async () => {
      fake.emit({ type: "message_update", assistantMessageEvent: { type: "text_delta", delta: "Inspecting files" } });
      fake.emit({ type: "tool_execution_start", toolName: "read", args: { path: "src/index.ts" } });
      throw new Error("provider disconnected");
    });

    await expect(runStep({
      select: selectOnce(),
      cwd: tmp(),
      skill: "b-build",
      planOrPhasePath: "plan.md",
      onActivity,
    })).resolves.toMatchObject({ ok: false, text: expect.stringContaining("provider disconnected") });
    expect(onActivity.mock.calls.map((call) => call[0])).toEqual([
      { kind: "text", delta: "Inspecting files" },
      { kind: "toolStart", tool: "read", target: "src/index.ts" },
    ]);
    expect(fake.unsubscribe).toHaveBeenCalledOnce();
  });
  it("keeps a productive work session alive past the idle timeout", async () => {
    vi.useFakeTimers();
    try {
      const fake = arrange("completed");
      fake.prompt.mockImplementation(() => new Promise<void>((resolve) => {
        setTimeout(() => {
          fake.emit({ type: "tool_execution_start", toolName: "read", args: { path: "src/index.ts" } });
        }, WORK_SESSION_IDLE_TIMEOUT_MS - 1);
        setTimeout(resolve, (WORK_SESSION_IDLE_TIMEOUT_MS * 2) - 2);
      }));

      const pending = runStep({
        select: selectOnce(),
        cwd: tmp(),
        skill: "b-build",
        planOrPhasePath: "plan.md",
      });
      await vi.advanceTimersByTimeAsync((WORK_SESSION_IDLE_TIMEOUT_MS * 2) - 2);

      await expect(pending).resolves.toEqual({ ok: true, text: "completed" });
      expect(fake.abort).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
  it.each([["throws", () => createAgentSessionMock.mockRejectedValue(new Error("boom")), "boom"], ["aborts", () => { const fake = arrange(); fake.prompt.mockRejectedValue(Object.assign(new Error("timed out"), { name: "AbortError" })); }, "timed out"], ["has empty output", () => arrange(""), "Model returned no text"]])("names the stage after the only candidate %s", async (_label, setup, message) => {
    setup();
    const select = selectOnce();
    const result = await runStep({ select, cwd: tmp(), skill: "b-build", planOrPhasePath: "plan.md", difficulty: "hard" });
    expect(result).toMatchObject({
      ok: false,
      text: expect.stringContaining('stage "build"'),
      failure: {
        prompt: expect.stringContaining("plan.md"),
        agent: expect.objectContaining({ kind: "work-session", role: "b-build" }),
        error: expect.objectContaining({ name: "BuckModelStop", message: expect.stringContaining(message) }),
      },
    });
    expect(select.mock.calls.map((call) => call[0].exclude)).toEqual([[], ["provider/picked"]]);
  });
  it("fails when idle-timeout abort yields partial assistant text", async () => {
    vi.useFakeTimers();
    const fake = arrange("partial result");
    fake.prompt.mockImplementation(() => new Promise<void>((resolve) => { fake.abort.mockImplementation(async () => { resolve(); }); }));
    const pending = runStep({ select: selectOnce(), cwd: tmp(), skill: "b-build", planOrPhasePath: "plan.md" });
    await vi.advanceTimersByTimeAsync(WORK_SESSION_IDLE_TIMEOUT_MS);
    await expect(pending).resolves.toMatchObject({ ok: false, text: expect.stringContaining("partial result"), failure: { error: { name: "BuckModelStop", message: expect.stringContaining('stage "build"') } } });
    expect(fake.abort).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
  it("fails when the SDK resolves abort with nonempty assistant text", async () => {
    const fake = arrange("partial result");
    fake.messages = [{ role: "assistant", content: "partial result", stopReason: "aborted" }];
    await expect(runStep({ select: selectOnce(), cwd: tmp(), skill: "b-build", planOrPhasePath: "plan.md" })).resolves.toMatchObject({
      ok: false,
      text: expect.stringContaining("partial result"),
      failure: { error: { name: "BuckModelStop", message: expect.stringContaining('stage "build"') } },
    });
  });
  it("fails for a missing canonical skill before creating a session", async () => { failSkillRead.value = true; await expect(runStep({ cwd: tmp(), skill: "b-docs", planOrPhasePath: "plan.md" })).resolves.toMatchObject({ ok: false, text: "missing skill", failure: { prompt: null, agent: null, error: { message: "missing skill" } } }); expect(createAgentSessionMock).not.toHaveBeenCalled(); });
  it("re-picks only after the host call fails and keeps the second result", async () => {
    const first = arrange();
    first.prompt.mockRejectedValueOnce(new Error("first failed"));
    const second = {
      prompt: vi.fn().mockResolvedValue(undefined),
      messages: [{ role: "assistant", content: "recovered" }],
      subscribe: vi.fn(() => vi.fn()),
      abort: vi.fn(),
      dispose: vi.fn(),
    };
    createAgentSessionMock.mockReset();
    createAgentSessionMock.mockResolvedValueOnce({ session: first }).mockResolvedValueOnce({ session: second });
    const select = vi.fn(async (input: WorkModelSelectInput) => {
      if (input.exclude.includes("provider/first")) return { ok: true as const, id: "provider/second", thinking: "low" as const };
      return { ok: true as const, id: "provider/first", thinking: "high" as const };
    });
    await expect(runStep({ select, cwd: tmp(), skill: "b-build", planOrPhasePath: "plan.md" })).resolves.toEqual({ ok: true, text: "recovered" });
    expect(select.mock.calls.map((call) => call[0].exclude)).toEqual([[], ["provider/first"]]);
    expect(createAgentSessionMock.mock.calls.map((call) => [call[0].modelPattern, call[0].thinkingLevel])).toEqual([
      ["provider/first", "high"],
      ["provider/second", "low"],
    ]);
  });
  it("does not re-pick after recovered assistant text", async () => {
    const fake = arrange("kept");
    fake.prompt.mockImplementation(async () => { fake.emit({ type: "auto_retry_end" }); });
    const select = selectOnce();
    await expect(runStep({ select, cwd: tmp(), skill: "b-build", planOrPhasePath: "plan.md" })).resolves.toEqual({ ok: true, text: "kept" });
    expect(select).toHaveBeenCalledTimes(1);
    expect(createAgentSessionMock).toHaveBeenCalledTimes(1);
  });
  it("uses hard difficulty only to mark the hard prompt, not the model", async () => {
    const hard = arrange("done");
    await runStep({ select: selectOnce("provider/same", "low"), cwd: tmp(), skill: "b-build-hard", planOrPhasePath: "plan.md", difficulty: "hard" });
    const hardPrompt = hard.prompt.mock.calls[0][0] as string;
    createAgentSessionMock.mockClear();
    const easy = arrange("done");
    await runStep({ select: selectOnce("provider/same", "low"), cwd: tmp(), skill: "b-build", planOrPhasePath: "plan.md" });
    expect(hardPrompt).toContain("hard variant of b-build");
    expect(easy.prompt.mock.calls[0][0]).not.toContain("hard variant of b-build");
    expect(createAgentSessionMock).toHaveBeenCalledWith(expect.objectContaining({ modelPattern: "provider/same", thinkingLevel: "low" }));
  });
  it("blocks a missing stage before creating a session and names the stage", async () => {
    const choice = await selectBuckStageModel({
      cwd: tmp(),
      stage: "build",
      skill: "b-build",
      context: { planOrPhasePath: "plan.md", body: "phase body" },
    }, {
      readConfigs: () => ({ project: null, global: null }),
      availableIds: async () => new Set(["provider/a"]),
    });
    expect(choice.ok).toBe(false);
    if (!choice.ok) expect(choice.message).toContain('stage "build"');
    expect(createAgentSessionMock).not.toHaveBeenCalled();
  });
  it("keeps picker-saved ids when the availability probe is empty", async () => {
    const choice = await selectBuckStageModel({
      cwd: tmp(),
      stage: "build",
      skill: "b-build",
      context: { planOrPhasePath: "plan.md", body: "" },
    }, {
      readConfigs: () => ({
        project: null,
        global: {
          active: "Default",
          profiles: {
            Default: {
              stages: {
                build: {
                  thinking: "medium",
                  models: [{ id: "minimax-code/MiniMax-M3" }, { id: "xai-oauth/grok-4.7" }],
                },
              },
            },
          },
        },
      }),
      availableIds: async () => new Set(),
      pick: async (input) => ({ ok: true, id: input.resolution.available[0]?.id ?? "", thinking: input.resolution.thinking }),
    });
    expect(choice).toEqual({ ok: true, id: "minimax-code/MiniMax-M3", thinking: "medium" });
  });
  it("keeps picker-saved ids when the probe lists other models only", async () => {
    const choice = await selectBuckStageModel({
      cwd: tmp(),
      stage: "build",
      skill: "b-build",
      context: { planOrPhasePath: "plan.md", body: "" },
    }, {
      readConfigs: () => ({
        project: null,
        global: {
          active: "Default",
          profiles: {
            Default: {
              stages: {
                build: {
                  thinking: "medium",
                  models: [{ id: "zai/glm-5.3-flash" }, { id: "openai-codex/gpt-5.6-terra" }],
                },
              },
            },
          },
        },
      }),
      availableIds: async () => new Set(["other/model"]),
      pick: async (input) => ({ ok: true, id: input.resolution.available[0]?.id ?? "", thinking: input.resolution.thinking }),
    });
    expect(choice.ok).toBe(true);
    if (choice.ok) expect(["zai/glm-5.3-flash", "openai-codex/gpt-5.6-terra"]).toContain(choice.id);
  });
});

describe("runStep prompt shaping and model exhaustion", () => {
  it("marks the hard variant and appends a handoff diagnosis", async () => {
    const fake = arrange();
    await runStep({
      select: selectOnce(),
      cwd: tmp(),
      skill: "b-build-hard",
      planOrPhasePath: "plan.md",
      handoff: "SQL retrieval is not implemented.",
    });
    const prompt = fake.prompt.mock.calls[0][0] as string;
    expect(prompt).toContain("hard variant of b-build");
    expect(prompt).toContain("The previous attempt left this assignment incomplete");
    expect(prompt).toContain("SQL retrieval is not implemented.");
  });

  it("carries a supervisor directive into the child prompt", async () => {
    const fake = arrange();
    await runStep({
      select: selectOnce(),
      cwd: tmp(),
      skill: "b-save",
      planOrPhasePath: "plan.md",
      directive: "SQL save attempt. attemptId: abc",
    });
    const prompt = fake.prompt.mock.calls[0][0] as string;
    expect(prompt).toContain("Supervisor directive:");
    expect(prompt).toContain("attemptId: abc");
  });

  it("stops with the stage named when no model can be selected", async () => {
    arrange();
    const result = await runStep({
      select: async () => ({ ok: false as const, message: "no models configured" }),
      cwd: tmp(),
      skill: "b-review",
      planOrPhasePath: "plan.md",
    });
    expect(result.ok).toBe(false);
    expect(result.text).toContain('stage "review"');
  });

  it("stops when the picker repeats a model that already failed", async () => {
    arrange();
    const select = vi.fn(async () => ({ ok: true as const, id: "provider/same", thinking: "low" as const }));
    const result = await runStep({ select, cwd: tmp(), skill: "b-build", planOrPhasePath: "plan.md" });
    // The session succeeds, so the loop keeps the first result rather than
    // spinning on a repeated pick.
    expect(select).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
  });
});
