import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FileStorageStore } from "../../../skills/_shared/storage/file-store.js";
import { completeSaveAttempt, prepareSaveAttempt, recordSaveMetadata, saveSqlFacts, verifySqlSave } from "../sql-save.js";

const SUBJECT = "2026-10-12.store-save";
const context = { projectId: "fixture-project", branchId: "branch-a", worktreeId: "worktree-11111111-1111-4111-8111-111111111111", runId: "run-22222222-2222-4222-8222-222222222222", publishedRevisionIds: [] };
const dirs: string[] = [];
const previous = process.env.SQL_MEMORY_URL;
afterEach(() => {
  if (previous === undefined) delete process.env.SQL_MEMORY_URL; else process.env.SQL_MEMORY_URL = previous;
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function fixture() {
  process.env.SQL_MEMORY_URL = "configured-save-mode";
  const cwd = mkdtempSync(join(tmpdir(), "store-save-"));
  dirs.push(cwd);
  execFileSync("git", ["init"], { cwd, stdio: "ignore" });
  const store = new FileStorageStore({ root: join(cwd, "store") });
  const prepared = prepareSaveAttempt(cwd, SUBJECT);
  if ("error" in prepared) throw new Error(prepared.error);
  return { cwd, store, prepared, deps: { store, context } };
}

describe("supervisor save through the store", () => {
  it("reuses exact fact inputs, not a local receipt with a matching count", async () => {
    const { cwd, prepared, deps } = fixture();
    const ids = await saveSqlFacts(cwd, prepared, ["It's a durable decision."], deps);
    expect(await saveSqlFacts(cwd, prepared, ["It's a durable decision."], deps)).toEqual(ids);
    await expect(saveSqlFacts(cwd, prepared, ["Different fact"], deps)).rejects.toThrow(/facts changed/);
    await recordSaveMetadata(cwd, prepared, [], [], deps);
    await completeSaveAttempt(cwd, prepared, deps);
    expect(await verifySqlSave(cwd, SUBJECT, deps)).toEqual({ status: "verified" });
  });

  it("corrects the exact subject predecessor while preserving typed links", async () => {
    const { cwd, store, prepared, deps } = fixture();
    const ids = await saveSqlFacts(cwd, prepared, ["Old decision"], deps);
    const [prior] = await store.list({ ...context, subjectId: SUBJECT, kind: "memory" });
    const link = { projectId: context.projectId, branchId: context.branchId, subjectId: SUBJECT, kind: "spec" as const, logicalName: "spec-x.md" };
    await store.writeBatch([{ ...prior!, links: [link], revision: "linked-revision", expectedRevision: prior!.revision }]);
    const correction = prepareSaveAttempt(cwd, SUBJECT);
    if ("error" in correction) throw new Error(correction.error);
    const corrected = await saveSqlFacts(cwd, correction, [{ body: "Correct decision", supersedes: "linked-revision" }], deps);
    const current = await store.read(prior!.key);
    expect(current?.revision).toBe(corrected[0]);
    expect(new TextDecoder().decode(current?.bytes)).toBe("Correct decision");
    expect(current?.links).toEqual([link]);
    const rejected = prepareSaveAttempt(cwd, SUBJECT);
    if ("error" in rejected) throw new Error(rejected.error);
    await expect(saveSqlFacts(cwd, rejected, [{ body: "Unwanted successor", supersedes: ids[0] }], deps)).rejects.toThrow(/not in this project\/subject|stale/i);
    const foreign = prepareSaveAttempt(cwd, "another-subject");
    if ("error" in foreign) throw new Error(foreign.error);
    await expect(saveSqlFacts(cwd, foreign, [{ body: "Wrong subject", supersedes: corrected[0] }], deps)).rejects.toThrow(/not in this project\/subject/);
  });

  it.each(["fact", "attempt-evidence", "attempt-receipt", "metadata-evidence", "complete-receipt"])("does not report success across %s fault", async boundary => {
    const { cwd, store, prepared, deps } = fixture();
    const writeBatch = store.writeBatch.bind(store);
    const writeReceipt = store.writeReceipt.bind(store);
    store.writeBatch = async rows => {
      if (rows.some(row => boundary === "fact" ? row.key.kind === "memory" : boundary === "attempt-evidence" && row.key.kind === "receipt")) throw new Error(`${boundary} fault`);
      return writeBatch(rows);
    };
    store.writeReceipt = async receipt => {
      if (boundary === "attempt-receipt" && receipt.status === "attempted") throw new Error(`${boundary} fault`);
      if (boundary === "complete-receipt" && receipt.status === "complete") throw new Error(`${boundary} fault`);
      return writeReceipt(receipt);
    };
    const run = async () => {
      await saveSqlFacts(cwd, prepared, ["fact"], deps);
      if (boundary === "metadata-evidence") store.writeBatch = async () => { throw new Error("metadata-evidence fault"); };
      await recordSaveMetadata(cwd, prepared, [], [], deps);
      await completeSaveAttempt(cwd, prepared, deps);
    };
    await expect(run()).rejects.toThrow(`${boundary} fault`);
    expect((await store.readReceipt(context.projectId, prepared.runId))?.status).not.toBe("complete");
    expect((await verifySqlSave(cwd, SUBJECT, deps)).status).not.toBe("verified");
  });
});
