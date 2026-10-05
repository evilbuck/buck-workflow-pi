import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanupRepos, git, phaseMd, planMd, repo, writeTree } from "./fixtures.js";
import { handleLoop } from "../loop.js";
import { completeSaveAttempt, prepareSaveAttempt, writeReceipt } from "../sql-save.js";
import type { RunStepResult } from "../run-step.js";

vi.mock("../../sql-memory/db.js", () => ({
  createLazyPool: () => () => ({
    async query() { return { rows: [{ ready: 1 }] }; },
    async connect() { return { async query() { return { rows: [{ ready: 1 }] }; }, release() {} }; },
    async end() {},
  }),
}));
vi.mock("../project-memory.js", async () => ({
  ...await vi.importActual<typeof import("../project-memory.js")>("../project-memory.js"),
  recallProjectMemories: async () => ({ kind: "success-empty", identity: { project: "https://example.test/acme/project.git", branch: "loop-work", sha: "a".repeat(40) } }),
}));

const SUBJECT = "2026-09-18.demo";
const PLAN = `.context/${SUBJECT}/plan-demo.md`;
const originalUrl = process.env.SQL_MEMORY_URL;
beforeEach(() => { process.env.SQL_MEMORY_URL = "postgres://test.invalid/save-client"; });
afterEach(() => {
  cleanupRepos();
  if (originalUrl === undefined) delete process.env.SQL_MEMORY_URL;
  else process.env.SQL_MEMORY_URL = originalUrl;
});

function fixture(): string {
  const cwd = repo();
  writeTree(cwd, { [PLAN]: planMd(), [`.context/${SUBJECT}/phase-1-p1.md`]: phaseMd(1, "pending") });
  return cwd;
}

function deps(save: (cwd: string, phase: string) => Promise<RunStepResult>) {
  return {
    now: () => "2026-09-18T00:00:00.000Z",
    runStep: vi.fn(async (opts: { cwd: string; skill: string; planOrPhasePath: string }): Promise<RunStepResult> => {
      if (opts.skill === "b-build") writeTree(opts.cwd, { [opts.planOrPhasePath]: phaseMd(1, "completed") });
      if (opts.skill === "b-review") return { ok: true, text: "# Review\n\n### Documentation Impact\n- No documentation impact\n\n### How-to Impact\n- No how-to impact\n" };
      if (opts.skill === "b-save") return save(opts.cwd, opts.planOrPhasePath);
      if (opts.skill === "b-commit") git(opts.cwd, ["commit", "-qm", "saved"]);
      return { ok: true, text: opts.skill };
    }),
    choose: async () => { throw new Error("SQL save failure must not become a judgment"); },
  };
}

describe("save client receipt boundary", () => {
  it("blocks an unresolved tool failure without retrying save or committing", async () => {
    const cwd = fixture();
    const work = deps(async () => ({ ok: true, text: "No receipt written", sqlFailure: "Memory failed · Validation failed for sql_memory" }));
    const result = await handleLoop({ cwd, command: "start", path: PLAN, deps: work });
    expect(result.state).toBe("blocked");
    expect(result.reason).toContain("SQL save failed before a verified receipt");
    expect(result.reason).toContain("Validation failed");
    expect(work.runStep.mock.calls.map(([opts]) => opts.skill)).toEqual(["b-build", "b-review", "b-save"]);
  });

  it("commits a verified completed receipt despite a late client SQL error", async () => {
    const cwd = fixture();
    const work = deps(async (root, phase) => {
      const attempt = prepareSaveAttempt(root, SUBJECT, true, phase);
      if ("error" in attempt) throw new Error(attempt.error);
      writeReceipt(root, attempt, { kind: "no-fact", ids: [] });
      completeSaveAttempt(root, attempt);
      git(root, ["add", "-f", ".context"]);
      return { ok: true, text: "Durable save completed", sqlFailure: "Memory failed · late SQL error" };
    });
    const result = await handleLoop({ cwd, command: "start", path: PLAN, deps: work });
    expect(result.state, result.reason).toBe("done");
    expect(work.runStep.mock.calls.map(([opts]) => opts.skill)).toEqual(["b-build", "b-review", "b-save", "b-commit"]);
  });
});
