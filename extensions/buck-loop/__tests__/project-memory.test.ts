import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { executeWorkflowState, resolveTrustedContext } from "../../../skills/_shared/scripts/workflow-state.js";
import { RepoFilesStorageStore } from "../../../skills/_shared/storage/file-store.js";
import { revisionHash } from "../../../skills/_shared/storage/adapter-utils.js";

const { runJev } = vi.hoisted(() => ({ runJev: vi.fn() }));

vi.mock("../../jev-tool/index.js", () => ({ runJev }));
vi.mock("../../typed-output/evaluator.js", () => ({ createTypeSafeEvaluator: vi.fn() }));

import { recallProjectMemories } from "../project-memory.js";
import { prepareSaveAttempt, saveSqlFacts } from "../sql-save.js";

let cwd: string;
let stage: string;

function git(...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

async function writeMemory(logicalName: string, body: string, category = "decision"): Promise<void> {
  const context = await resolveTrustedContext(cwd);
  const bytes = new TextEncoder().encode(`category: ${category}\n${body} memory\n`);
  const store = new RepoFilesStorageStore({ manifestRoot: context.manifestRoot!, contextRoot: join(cwd, ".context") });
  await store.writeBatch([{
    key: { projectId: context.projectId, branchId: context.branchId, subjectId: "project-memory", kind: "memory", logicalName },
    revision: logicalName, bytes, sha256: revisionHash(bytes), author: "fixture", source: "fixture", createdAt: new Date().toISOString(), links: [],
  }]);
}

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "project-memory-"));
  execFileSync("git", ["init", "-q"], { cwd });
  git("config", "user.email", "agent@example.test");
  git("config", "user.name", "Test Agent");
  writeFileSync(join(cwd, "tracked"), "tracked\n");
  git("add", "tracked");
  git("commit", "-qm", "initial");
  git("remote", "add", "origin", `https://example.test/acme/${cwd.split("/").at(-1)}.git`);
  stage = ".context/phase.md";
  runJev.mockReset();
  delete process.env.SQL_MEMORY_URL;
  delete process.env.BUCK_WORKFLOW_CONFIG;
});

afterEach(() => {
  delete process.env.SQL_MEMORY_URL;
  delete process.env.BUCK_WORKFLOW_CONFIG;
  rmSync(cwd, { recursive: true, force: true });
});

describe("project memory recall", () => {
  it("searches the current branch without a SQL URL and returns an empty shortlist", async () => {
    const result = await recallProjectMemories(cwd, stage);
    expect(result.kind).toBe("success-empty");
    if (result.kind === "success-empty") {
      expect(result.identity.project).toBe(`https://example.test/acme/${cwd.split("/").at(-1)}.git`);
      expect(result.identity.branch).toMatch(/master|main/);
      expect(result.identity.sha).toMatch(/[0-9a-f]{40}/);
    }
  });

  it("keeps a candidate above 0.7 and drops the rest", async () => {
    await writeMemory("memory-a", "first");
    await writeMemory("memory-b", "second", "pitfall");
    runJev.mockResolvedValue({ details: { answers: {
      relevant_memory_a: { type: "noul", noul: 0.85 },
      relevant_memory_b: { type: "noul", noul: 0.4 },
    } } });
    const result = await recallProjectMemories(cwd, stage);
    expect(result.kind).toBe("success-rows");
    if (result.kind === "success-rows") expect(result.rows.map((row) => row.id)).toEqual(["memory-a"]);
    expect(runJev.mock.calls[0]?.[1]).toMatchObject({
      questions: { relevant_memory_a: { type: "noul" }, relevant_memory_b: { type: "noul" } },
    });
  });

  it("orders relevant memories by noul and breaks ties by id", async () => {
    await writeMemory("memory-a", "first");
    await writeMemory("memory-b", "second", "pitfall");
    await writeMemory("memory-c", "third", "convention");
    runJev.mockResolvedValue({ details: { answers: {
      relevant_memory_a: { type: "noul", noul: 0.75 },
      relevant_memory_b: { type: "noul", noul: 0.95 },
      relevant_memory_c: { type: "noul", noul: 0.3 },
    } } });
    const result = await recallProjectMemories(cwd, stage);
    expect(result.kind).toBe("success-rows");
    if (result.kind === "success-rows") expect(result.rows.map((row) => row.id)).toEqual(["memory-b", "memory-a"]);
  });

  it("returns the store shortlist when a judgment names an unknown id", async () => {
    await writeMemory("memory-a", "first");
    await writeMemory("memory-b", "second", "pitfall");
    runJev.mockResolvedValue({ details: { answers: {
      relevant_memory_a: { type: "noul", noul: 0.9 },
      relevant_memory_b: { type: "noul", noul: 0.8 },
      relevant_invented_id: { type: "noul", noul: 0.95 },
    } } });
    const result = await recallProjectMemories(cwd, stage);
    expect(result.kind).toBe("success-rows");
    if (result.kind === "success-rows") expect(result.rows.map((row) => row.id).sort()).toEqual(["memory-a", "memory-b"]);
  });

  it("skips judgment for one candidate and keeps the shortlist when judgment throws", async () => {
    await writeMemory("only-memory", "candidate");
    const one = await recallProjectMemories(cwd, stage);
    expect(one.kind).toBe("success-rows");
    if (one.kind === "success-rows") expect(one.rows.map((row) => row.id)).toEqual(["only-memory"]);
    expect(runJev).not.toHaveBeenCalled();

    await writeMemory("second-memory", "another", "pitfall");
    runJev.mockRejectedValue(new Error("Jev unavailable"));
    const multiple = await recallProjectMemories(cwd, stage);
    expect(multiple.kind).toBe("success-rows");
    if (multiple.kind === "success-rows") expect(multiple.rows.map((row) => row.id).sort()).toEqual(["only-memory", "second-memory"]);
  });

  it("reports a store error as a failed query rather than an empty match", async () => {
    process.env.BUCK_WORKFLOW_CONFIG = join(cwd, "missing-config.yaml");
    const result = await recallProjectMemories(cwd, stage);
    expect(result.kind).toBe("failure");
    if (result.kind === "failure") expect(result.reason).toContain("query failed (not an empty result)");
  });

  it("reports identity-missing when the checkout is not a git repository", async () => {
    rmSync(join(cwd, ".git"), { recursive: true, force: true });
    const result = await recallProjectMemories(cwd, stage);
    expect(result.kind).toBe("identity-missing");
    if (result.kind === "identity-missing") expect(result.reason).toMatch(/Project identity could not be established/);
  });

  it("uses the absolute git common directory when origin is absent", async () => {
    git("remote", "remove", "origin");
    const result = await recallProjectMemories(cwd, stage);
    expect(result.kind).toBe("success-empty");
    if (result.kind === "success-empty") {
      expect(result.identity.project).toBe(git("rev-parse", "--path-format=absolute", "--git-common-dir"));
    }
  });

  it("preserves distinct revisions for identical names and uses a recalled ID for correction", async () => {
    const context = await resolveTrustedContext(cwd);
    const write = (subjectId: string, body: string) => executeWorkflowState({ cwd, context, role: "write", request: { operation: "write", ref: { subjectId, kind: "memory", logicalName: "fact.md" }, body } }) as Promise<{ revision: string }>;
    const first = await write("first-subject", "first memory");
    const second = await write("second-subject", "second memory");
    const recalled = await recallProjectMemories(cwd, stage);
    expect(recalled.kind).toBe("success-rows");
    if (recalled.kind !== "success-rows") throw new Error("recall failed");
    expect(recalled.rows.map(row => row.id).sort()).toEqual([first.revision, second.revision].sort());
    const row = recalled.rows.find(item => item.id === first.revision)!;
    expect(await executeWorkflowState({ cwd, context, role: "read", request: { operation: "read", token: row.token } })).toMatchObject({ text: "first memory" });
    process.env.SQL_MEMORY_URL = "configured-save-mode";
    const attempt = prepareSaveAttempt(cwd, "first-subject");
    if ("error" in attempt) throw new Error(attempt.error);
    const ids = await saveSqlFacts(cwd, attempt, [{ body: "corrected memory", supersedes: row.id }], { context });
    expect(await executeWorkflowState({ cwd, context, role: "read", request: { operation: "read", ref: { subjectId: "first-subject", kind: "memory", logicalName: row.logicalName } } })).toMatchObject({ revision: ids[0], text: "corrected memory" });
    expect(await executeWorkflowState({ cwd, context, role: "read", request: { operation: "read", ref: { subjectId: "second-subject", kind: "memory", logicalName: "fact.md" } } })).toMatchObject({ revision: second.revision, text: "second memory" });
  });

  it("corrects a recalled published predecessor without changing its owning branch", async () => {
    const context = await resolveTrustedContext(cwd);
    const store = new RepoFilesStorageStore({ manifestRoot: context.manifestRoot!, contextRoot: join(cwd, ".context") });
    const ref = { subjectId: "published-subject", kind: "memory" as const, logicalName: "published/fact.md" };
    const owner = { ...context, branchId: "published-owner" };
    const published = await executeWorkflowState({ cwd, store, context: owner, role: "write", request: { operation: "write", ref, body: "published memory" } }) as { revision: string };
    const deps = { store, context: { ...context, publishedRevisionIds: [published.revision] } };
    const recalled = await recallProjectMemories(cwd, stage, deps);
    expect(recalled.kind).toBe("success-rows");
    if (recalled.kind !== "success-rows") throw new Error("published recall failed");
    expect(recalled.rows.map(item => item.id)).toEqual([published.revision]);
    process.env.SQL_MEMORY_URL = "configured-save-mode";
    const attempt = prepareSaveAttempt(cwd, "published-subject");
    if ("error" in attempt) throw new Error(attempt.error);
    const ids = await saveSqlFacts(cwd, attempt, [{ body: "branch-local corrected memory", supersedes: recalled.rows[0]!.id }], deps);
    expect(await executeWorkflowState({ cwd, ...deps, role: "read", request: { operation: "read", ref } })).toMatchObject({ revision: ids[0], text: "branch-local corrected memory" });
    expect(await executeWorkflowState({ cwd, store, context: owner, role: "read", request: { operation: "read", ref } })).toMatchObject({ revision: published.revision, text: "published memory" });
  });
});

describe("project memory ranking validation", () => {
  beforeEach(async () => {
    await writeMemory("memory-a", "first");
    await writeMemory("memory-b", "second", "pitfall");
  });

  async function expectShortlistFallback(runJevResult: unknown): Promise<void> {
    runJev.mockResolvedValue(runJevResult);
    const result = await recallProjectMemories(cwd, stage);
    expect(result.kind).toBe("success-rows");
    if (result.kind === "success-rows") expect(result.rows.map((row) => row.id).sort()).toEqual(["memory-a", "memory-b"]);
  }

  it("falls back when the judgment carries no answers object", async () => {
    await expectShortlistFallback({ details: {} });
  });

  it("falls back when an answer is not a noul", async () => {
    await expectShortlistFallback({ details: { answers: {
      relevant_memory_a: { type: "choice", choice: "yes" },
      relevant_memory_b: { type: "noul", noul: 0.9 },
    } } });
  });

  it("falls back when a noul score is not a finite number", async () => {
    await expectShortlistFallback({ details: { answers: {
      relevant_memory_a: { type: "noul", noul: "high" },
      relevant_memory_b: { type: "noul", noul: 0.9 },
    } } });
  });

  it("falls back when the judgment does not cover every candidate", async () => {
    await expectShortlistFallback({ details: { answers: { relevant_memory_a: { type: "noul", noul: 0.9 } } } });
  });

  it("returns the full shortlist when no score clears the threshold", async () => {
    runJev.mockResolvedValue({ details: { answers: {
      relevant_memory_a: { type: "noul", noul: 0.69 },
      relevant_memory_b: { type: "noul", noul: 0.1 },
    } } });
    const result = await recallProjectMemories(cwd, stage);
    expect(result.kind).toBe("success-rows");
    if (result.kind === "success-rows") expect(result.rows.map((row) => row.id).sort()).toEqual(["memory-a", "memory-b"]);
  });
});
