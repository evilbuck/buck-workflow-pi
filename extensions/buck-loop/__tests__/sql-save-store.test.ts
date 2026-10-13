import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FileStorageStore } from "../../../skills/_shared/storage/file-store.js";
import type { TrustedWorkflowContext } from "../../../skills/_shared/scripts/workflow-state.js";
import { completeSaveAttempt, prepareSaveAttempt, saveSqlFacts, verifySqlSave } from "../sql-save.js";

const SUBJECT = "2026-10-12.store-save";
const context: TrustedWorkflowContext = {
  projectId: "fixture-project",
  branchId: "branch-a",
  publishedRevisionIds: [],
};

function repo(): string {
  const cwd = mkdtempSync(join(tmpdir(), "store-save-"));
  execFileSync("git", ["init"], { cwd, stdio: "ignore" });
  execFileSync("git", ["remote", "add", "origin", "git@example.test:buck/workflow.git"], { cwd, stdio: "ignore" });
  return cwd;
}

describe("supervisor save through the store", () => {
  const previous = process.env.SQL_MEMORY_URL;
  const dirs: string[] = [];
  afterEach(() => {
    if (previous === undefined) delete process.env.SQL_MEMORY_URL;
    else process.env.SQL_MEMORY_URL = previous;
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it("writes a rows receipt from the store revision and does not issue a follow-up read", async () => {
    process.env.SQL_MEMORY_URL = "postgres://example.invalid/unused";
    const cwd = repo();
    dirs.push(cwd);
    const store = new FileStorageStore({ root: join(cwd, "store") });
    const prepared = prepareSaveAttempt(cwd, SUBJECT);
    if ("error" in prepared) throw new Error(prepared.error);
    const reads: string[] = [];
    const original = store.read.bind(store);
    store.read = async (key, revision) => {
      reads.push(key.logicalName);
      return original(key, revision);
    };
    const ids = await saveSqlFacts(cwd, prepared, ["It's a durable decision."], { store, context });
    expect(ids).toHaveLength(1);
    expect(reads).toEqual([]);
    const receipt = JSON.parse(readFileSync(join(cwd, prepared.receiptRel), "utf8"));
    expect(receipt).toMatchObject({ kind: "rows", ids, probed: true });
    const stored = await store.list({ projectId: context.projectId, branchId: context.branchId, publishedRevisionIds: [] });
    expect(stored.map((item) => item.revision)).toEqual(ids);
    expect(new TextDecoder().decode(stored[0]!.bytes)).toBe("It's a durable decision.");
    expect(await saveSqlFacts(cwd, prepared, ["It's a durable decision."], { store, context })).toEqual(ids);
    completeSaveAttempt(cwd, prepared);
    expect(await verifySqlSave(cwd, SUBJECT, { store, context })).toEqual({ status: "verified" });
  });

  it("corrects through the predecessor revision and rejects a stale second successor", async () => {
    process.env.SQL_MEMORY_URL = "postgres://example.invalid/unused";
    const cwd = repo();
    dirs.push(cwd);
    const store = new FileStorageStore({ root: join(cwd, "store") });
    const first = prepareSaveAttempt(cwd, SUBJECT, false, `.context/${SUBJECT}/phase-1.md`);
    if ("error" in first) throw new Error(first.error);
    const ids = await saveSqlFacts(cwd, first, ["It's a durable decision."], { store, context });
    const correction = prepareSaveAttempt(cwd, SUBJECT, false, `.context/${SUBJECT}/phase-2.md`);
    if ("error" in correction) throw new Error(correction.error);
    const corrected = await saveSqlFacts(cwd, correction, [{ body: "It's a corrected decision.", supersedes: ids[0] }], { store, context });
    expect(corrected[0]).not.toBe(ids[0]);
    expect(await saveSqlFacts(cwd, correction, [{ body: "It's a corrected decision.", supersedes: ids[0] }], { store, context })).toEqual(corrected);
    const current = await store.list({ projectId: context.projectId, branchId: context.branchId, publishedRevisionIds: [], kind: "memory" });
    expect(current.map((item) => item.revision)).toContain(corrected[0]);
    expect(new TextDecoder().decode(current.find((item) => item.revision === corrected[0])!.bytes)).toBe("It's a corrected decision.");
    const rejected = prepareSaveAttempt(cwd, SUBJECT);
    if ("error" in rejected) throw new Error(rejected.error);
    await expect(saveSqlFacts(cwd, rejected, [{ body: "Unwanted successor", supersedes: ids[0] }], { store, context })).rejects.toThrow(/not in this project|stale/i);
  });
});
