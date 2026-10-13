import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FileStorageStore } from "../../../skills/_shared/storage/file-store.js";
import type { StorageStore } from "../../../skills/_shared/storage/contract.js";
import type { TrustedWorkflowContext } from "../../../skills/_shared/scripts/workflow-state.js";
import {
  completeSaveAttempt,
  prepareSaveAttempt,
  probeSql,
  resumeSaveDecision,
  saveDirective,
  verifySqlSave,
  writeReceipt,
} from "../sql-save.js";

const SUBJECT = "2026-09-29.sql-save";
const PROJECT = "git@example.test:buck/workflow.git";
const URL = "postgres://example.invalid/sql-save-test";

function repo(): string {
  const cwd = mkdtempSync(join(tmpdir(), "sql-save-"));
  execFileSync("git", ["init"], { cwd, stdio: "ignore" });
  execFileSync("git", ["remote", "add", "origin", PROJECT], { cwd, stdio: "ignore" });
  return cwd;
}

function attempt(cwd: string, phase: string | null = null) {
  const prepared = prepareSaveAttempt(cwd, SUBJECT, false, phase);
  if ("error" in prepared) throw new Error(prepared.error);
  return prepared;
}

const context: TrustedWorkflowContext = { projectId: "fixture-project", branchId: "branch-a", publishedRevisionIds: [] };
function failingStore(message: string): StorageStore {
  const fail = async () => { throw new Error(message); };
  return { read: fail, list: fail, search: fail, writeBatch: fail, correct: fail, transition: fail, inspectLifecycle: async () => null, writeReceipt: fail, readReceipt: async () => null, sealCheckpoint: fail, bindCheckpoint: fail, reconcile: fail, exportArtifacts: async function* () {}, importArtifacts: fail };
}

describe("SQL save receipts", () => {
  const previous = process.env.SQL_MEMORY_URL;
  let cwd = "";

  afterEach(() => {
    if (previous === undefined) delete process.env.SQL_MEMORY_URL;
    else process.env.SQL_MEMORY_URL = previous;
    if (cwd) rmSync(cwd, { recursive: true, force: true });
  });

  it("writes an attempt without the database URL and rejects a stale receipt", async () => {
    process.env.SQL_MEMORY_URL = URL;
    cwd = repo();
    const first = attempt(cwd);
    writeReceipt(cwd, first, { kind: "rows", ids: ["11111111-1111-4111-8111-111111111111"] });
    const second = attempt(cwd);
    const stale = await verifySqlSave(cwd, SUBJECT);
    expect(stale).toEqual({ status: "unverified" });
    expect(second.attemptId).not.toBe(first.attemptId);
    const text = readFileSync(join(cwd, ".context/workflow/sql-save-attempt.json"), "utf8");
    expect(text).not.toContain(URL);
    expect(text).not.toContain("password");
  });

  it("blocks a receipt after the Git origin changes", async () => {
    process.env.SQL_MEMORY_URL = URL;
    cwd = repo();
    const current = attempt(cwd);
    writeReceipt(cwd, current, { kind: "no-fact", ids: [] });
    execFileSync("git", ["remote", "set-url", "origin", "git@example.test:org/new.git"], { cwd });
    await expect(verifySqlSave(cwd, SUBJECT)).resolves.toEqual({
      status: "block",
      reason: "SQL save receipt project does not match the current Git project.",
    });
  });
  it("rotates attempt ids before a new save and retains the source key only for a retry", async () => {
    process.env.SQL_MEMORY_URL = URL;
    cwd = repo();
    const first = attempt(cwd);
    writeReceipt(cwd, first, { kind: "no-fact", ids: [] });
    completeSaveAttempt(cwd, first);
    const second = attempt(cwd);
    expect(second.attemptId).not.toBe(first.attemptId);
    expect(second.runId).not.toBe(first.runId);
    expect(await verifySqlSave(cwd, SUBJECT)).toEqual({ status: "unverified" });
    expect(prepareSaveAttempt(cwd, SUBJECT, true)).toEqual(second);
  });
  it("keeps phase provenance stable on retry but rotates a new phase's source key", () => {
    process.env.SQL_MEMORY_URL = URL;
    cwd = repo();
    const first = attempt(cwd, `.context/${SUBJECT}/phase-1.md`);
    expect(saveDirective(first)).toContain(`phase: .context/${SUBJECT}/phase-1.md`);
    expect(saveDirective(first)).toContain(`subject: ${SUBJECT}\n`);
    expect(prepareSaveAttempt(cwd, SUBJECT, true, first.phase)).toEqual(first);
    const next = prepareSaveAttempt(cwd, SUBJECT, true, `.context/${SUBJECT}/phase-2.md`);
    if ("error" in next) throw new Error(next.error);
    expect(next.runId).not.toBe(first.runId);
    expect(saveDirective(next)).toContain(`phase: .context/${SUBJECT}/phase-2.md`);
  });
  it("redacts credential-bearing origins before persisting or prompting", () => {
    process.env.SQL_MEMORY_URL = URL;
    cwd = repo();
    execFileSync("git", ["remote", "set-url", "origin", "https://alice:secret@example.test/acme/project.git"], { cwd });
    const current = attempt(cwd);
    const stored = readFileSync(join(cwd, ".context/workflow/sql-save-attempt.json"), "utf8");
    expect(current.project).toBe("https://example.test/acme/project.git");
    expect(stored).not.toContain("alice");
    expect(stored).not.toContain("secret");
    expect(saveDirective(current)).not.toContain("alice:secret");
  });
  it("blocks a receipt that records a database URL", async () => {
    process.env.SQL_MEMORY_URL = URL;
    cwd = repo();
    const current = attempt(cwd);
    writeReceipt(cwd, current, { kind: "no-fact", ids: [] });
    const file = join(cwd, current.receiptRel);
    const body = JSON.parse(readFileSync(file, "utf8")) as { database_url?: string };
    body.database_url = URL;
    writeFileSync(file, JSON.stringify(body));
    await expect(verifySqlSave(cwd, SUBJECT)).resolves.toEqual({
      status: "block",
      reason: "SQL save receipt recorded a database URL or secret.",
    });
  });

  it("blocks a completed receipt whose revision is not visible", async () => {
    process.env.SQL_MEMORY_URL = URL;
    cwd = repo();
    const store = new FileStorageStore({ root: join(cwd, "store") });
    const current = attempt(cwd);
    const id = "22222222-2222-4222-8222-222222222222";
    writeReceipt(cwd, current, { kind: "rows", ids: [id] });
    expect(await verifySqlSave(cwd, SUBJECT, { store, context })).toEqual({ status: "unverified" });
    completeSaveAttempt(cwd, current);
    await expect(verifySqlSave(cwd, SUBJECT, { store, context })).resolves.toEqual({
      status: "block",
      reason: `SQL save receipt ids were not readable for this project: ${id}`,
    });
  });

  it("accepts a no-fact receipt only after a successful probe", async () => {
    process.env.SQL_MEMORY_URL = URL;
    cwd = repo();
    const current = attempt(cwd);
    const store = new FileStorageStore({ root: join(cwd, "store") });
    writeReceipt(cwd, current, { kind: "no-fact", ids: [] });
    expect(await verifySqlSave(cwd, SUBJECT, { store, context })).toEqual({ status: "unverified" });
    completeSaveAttempt(cwd, current);
    await expect(verifySqlSave(cwd, SUBJECT, { store, context })).resolves.toEqual({ status: "verified" });
    const down = failingStore("connection refused");
    await expect(verifySqlSave(cwd, SUBJECT, { store: down, context })).resolves.toEqual({
      status: "block",
      reason: "SQL save connectivity probe failed: connection refused",
    });
    await expect(probeSql({ store: down, context })).resolves.toEqual({
      status: "block",
      reason: "SQL save connectivity probe failed: connection refused",
    });
  });

  it("refuses to commit an unverified save and retries a missing receipt", () => {
    expect(resumeSaveDecision("committing", { status: "unverified" })).toBe("block");
    expect(resumeSaveDecision("saving", { status: "unverified" })).toBe("continue");
    expect(resumeSaveDecision("saving", { status: "block", reason: "down" })).toBe("block");
    expect(resumeSaveDecision("committing", { status: "verified" })).toBe("continue");
  });

  it("does not open the store when SQL memory is unset", async () => {
    delete process.env.SQL_MEMORY_URL;
    cwd = repo();
    await expect(verifySqlSave(cwd, SUBJECT, { store: failingStore("should not query"), context })).resolves.toEqual({ status: "skip" });
  });
});
