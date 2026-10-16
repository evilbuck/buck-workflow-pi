import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FileStorageStore } from "../../../skills/_shared/storage/file-store.js";
import type { TrustedWorkflowContext } from "../../../skills/_shared/scripts/workflow-state.js";
import { completeSaveAttempt, loadSaveAttempt, prepareSaveAttempt, probeSql, recordSaveMetadata, resumeSaveDecision, saveDirective, saveSqlFacts, verifySqlSave, writeReceipt } from "../sql-save.js";

const SUBJECT = "2026-09-29.sql-save";
const PROJECT = "git@example.test:buck/workflow.git";
const context: TrustedWorkflowContext = { projectId: "fixture-project", branchId: "branch-a", worktreeId: "worktree-11111111-1111-4111-8111-111111111111", runId: "run-22222222-2222-4222-8222-222222222222", publishedRevisionIds: [] };
const dirs: string[] = [];
const previous = process.env.SQL_MEMORY_URL;
afterEach(() => {
  if (previous === undefined) delete process.env.SQL_MEMORY_URL; else process.env.SQL_MEMORY_URL = previous;
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function fixture() {
  process.env.SQL_MEMORY_URL = "configured-save-mode";
  const cwd = mkdtempSync(join(tmpdir(), "sql-save-"));
  dirs.push(cwd);
  execFileSync("git", ["init"], { cwd, stdio: "ignore" });
  execFileSync("git", ["remote", "add", "origin", PROJECT], { cwd, stdio: "ignore" });
  const attempt = prepareSaveAttempt(cwd, SUBJECT);
  if ("error" in attempt) throw new Error(attempt.error);
  const store = new FileStorageStore({ root: join(cwd, "store") });
  return { cwd, attempt, store, deps: { store, context } };
}

describe("authoritative save attempts", () => {
  it.each([{ facts: [] }, { facts: ["A durable decision"] }])("completes facts $facts only after durable metadata, and recovers without exports", async ({ facts }) => {
    const { cwd, attempt, store, deps } = fixture();
    const ids = await saveSqlFacts(cwd, attempt, facts, deps);
    await expect(completeSaveAttempt(cwd, attempt, deps)).rejects.toThrow(/metadata evidence/);
    expect(await verifySqlSave(cwd, SUBJECT, deps)).toEqual({ status: "unverified" });
    await recordSaveMetadata(cwd, attempt, [], [], deps);
    await completeSaveAttempt(cwd, attempt, deps);
    const exact = { projectId: context.projectId, branchId: context.branchId, worktreeId: context.worktreeId, runId: attempt.runId, attemptId: attempt.attemptId, status: "complete", artifactRevisions: ids, kind: facts.length ? "rows" : "no-fact", metadataDuties: ["save-metadata", facts.length ? "readback" : "probe"] };
    expect(await store.readReceipt(context.projectId, attempt.runId)).toEqual(exact);
    rmSync(join(cwd, ".context"), { recursive: true });
    expect(await loadSaveAttempt(cwd, deps)).toEqual(attempt);
    expect(await verifySqlSave(cwd, SUBJECT, deps, true, attempt.attemptId)).toEqual({ status: "verified" });
    await completeSaveAttempt(cwd, attempt, deps);
    expect(await store.readReceipt(context.projectId, attempt.runId)).toEqual(exact);
  });

  it("never promotes a local completed flag or a missing durable receipt", async () => {
    const { cwd, attempt, store, deps } = fixture();
    await saveSqlFacts(cwd, attempt, [], deps);
    const path = join(cwd, attempt.receiptRel);
    writeFileSync(path, JSON.stringify({ ...JSON.parse(readFileSync(path, "utf8")), completed: true }));
    expect(await verifySqlSave(cwd, SUBJECT, deps)).toEqual({ status: "unverified" });
    store.readReceipt = async () => null;
    await expect(completeSaveAttempt(cwd, attempt, deps)).rejects.toThrow(/metadata evidence/);
    expect(await verifySqlSave(cwd, SUBJECT, deps)).toEqual({ status: "unverified" });
  });

  it("does not manufacture metadata when verifying an attempted receipt", async () => {
    const { cwd, attempt, store, deps } = fixture();
    await saveSqlFacts(cwd, attempt, ["fact"], deps);
    expect(await verifySqlSave(cwd, SUBJECT, deps, false)).toEqual({ status: "verified" });
    expect(await verifySqlSave(cwd, SUBJECT, deps)).toEqual({ status: "unverified" });
    expect((await store.readReceipt(context.projectId, attempt.runId))?.status).toBe("attempted");
  });

  it.each(["projectId", "branchId", "worktreeId", "runId", "attemptId", "kind", "artifactRevisions", "metadataDuties"])("rejects inexact durable %s readback", async field => {
    const { cwd, attempt, store, deps } = fixture();
    await saveSqlFacts(cwd, attempt, [], deps);
    await recordSaveMetadata(cwd, attempt, [], [], deps);
    const read = store.readReceipt.bind(store);
    store.readReceipt = async (project, run) => {
      const receipt = await read(project, run);
      return receipt ? { ...receipt, [field]: field === "artifactRevisions" || field === "metadataDuties" ? ["wrong"] : "wrong" } : null;
    };
    await expect(completeSaveAttempt(cwd, attempt, deps)).rejects.toThrow(/attempted receipt/);
    expect(await verifySqlSave(cwd, SUBJECT, deps)).toEqual({ status: "unverified" });
  });

  it("fails completion if the exact receipt write/readback fails", async () => {
    const { cwd, attempt, store, deps } = fixture();
    await saveSqlFacts(cwd, attempt, [], deps);
    await recordSaveMetadata(cwd, attempt, [], [], deps);
    const write = store.writeReceipt.bind(store);
    store.writeReceipt = async receipt => { if (receipt.status === "complete") throw new Error("receipt fault"); await write(receipt); };
    await expect(completeSaveAttempt(cwd, attempt, deps)).rejects.toThrow("receipt fault");
    expect((await store.readReceipt(context.projectId, attempt.runId))?.status).toBe("attempted");
    expect(await verifySqlSave(cwd, SUBJECT, deps)).toEqual({ status: "unverified" });
  });

  it("refuses stale attempt identity and changed Git project", async () => {
    const { cwd, attempt, deps } = fixture();
    await saveSqlFacts(cwd, attempt, [], deps);
    expect(await verifySqlSave(cwd, SUBJECT, deps, false, "wrong")).toMatchObject({ status: "block" });
    execFileSync("git", ["remote", "set-url", "origin", "https://example.test/new.git"], { cwd });
    expect(await verifySqlSave(cwd, SUBJECT, deps)).toMatchObject({ status: "block", reason: expect.stringContaining("project does not match") });
  });

  it("keeps phase identity only for matching retries and excludes credentials", () => {
    const { cwd, attempt } = fixture();
    expect(prepareSaveAttempt(cwd, SUBJECT, true)).toEqual(attempt);
    const next = prepareSaveAttempt(cwd, SUBJECT, true, "phase-2.md");
    expect(next).not.toEqual(attempt);
    execFileSync("git", ["remote", "set-url", "origin", "https://alice:secret@example.test/acme/project.git"], { cwd });
    const safe = prepareSaveAttempt(cwd, SUBJECT);
    if ("error" in safe) throw new Error(safe.error);
    expect(safe.project).toBe("https://example.test/acme/project.git");
    expect(readFileSync(join(cwd, ".context/workflow/sql-save-attempt.json"), "utf8")).not.toContain("secret");
    expect(saveDirective(safe)).not.toContain("alice");
  });

  it("does not accept an unpersisted local receipt", async () => {
    const { cwd, attempt, deps } = fixture();
    writeReceipt(cwd, attempt, { kind: "no-fact", ids: [] });
    expect(await verifySqlSave(cwd, SUBJECT, deps)).toEqual({ status: "unverified" });
    await expect(completeSaveAttempt(cwd, attempt, deps)).rejects.toThrow(/metadata evidence/);
  });

  it("blocks outages even with complete local exports and skips outside SQL mode", async () => {
    const { cwd, attempt, store, deps } = fixture();
    await saveSqlFacts(cwd, attempt, [], deps);
    await recordSaveMetadata(cwd, attempt, [], [], deps);
    await completeSaveAttempt(cwd, attempt, deps);
    store.read = async () => { throw new Error("store down"); };
    expect(await verifySqlSave(cwd, SUBJECT, deps)).toMatchObject({ status: "block", reason: expect.stringContaining("store down") });
    store.list = async () => { throw new Error("store down"); };
    expect(await probeSql(deps)).toMatchObject({ status: "block", reason: expect.stringContaining("store down") });
    delete process.env.SQL_MEMORY_URL;
    expect(await verifySqlSave(cwd, SUBJECT, deps)).toEqual({ status: "skip" });
    expect(resumeSaveDecision("committing", { status: "unverified" })).toBe("block");
    expect(resumeSaveDecision("saving", { status: "unverified" })).toBe("continue");
  });
});
