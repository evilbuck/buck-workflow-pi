import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FileStorageStore } from "../../../skills/_shared/storage/file-store.js";
import { completeSaveAttempt, prepareSaveAttempt, recordSaveMetadata, resumeSaveDecision, saveSqlFacts, verifySqlSave } from "../sql-save.js";

const dirs: string[] = [];
const previous = process.env.SQL_MEMORY_URL;
const context = { projectId: "fixture-project", branchId: "branch-a", worktreeId: "worktree-11111111-1111-4111-8111-111111111111", runId: "run-22222222-2222-4222-8222-222222222222", publishedRevisionIds: [] };
afterEach(() => {
  if (previous === undefined) delete process.env.SQL_MEMORY_URL; else process.env.SQL_MEMORY_URL = previous;
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function fixture() {
  process.env.SQL_MEMORY_URL = "configured-save-mode";
  const cwd = mkdtempSync(join(tmpdir(), "sql-save-guards-"));
  dirs.push(cwd);
  execFileSync("git", ["init"], { cwd, stdio: "ignore" });
  return cwd;
}

describe("save refusal boundaries", () => {
  it.each(["../escape", "nested/folder", "", "a b"])("refuses an unsafe subject %s before creating attempt state", subject => {
    const cwd = fixture();
    expect(prepareSaveAttempt(cwd, subject)).toEqual({ error: "SQL save subject path is not a single subject folder." });
    expect(existsSync(join(cwd, ".context/workflow/sql-save-attempt.json"))).toBe(false);
  });
  it("refuses completion and metadata evidence without persisted facts", async () => {
    const cwd = fixture();
    const attempt = prepareSaveAttempt(cwd, "subject");
    if ("error" in attempt) throw new Error(attempt.error);
    const deps = { store: new FileStorageStore({ root: join(cwd, "store") }), context };
    await expect(completeSaveAttempt(cwd, attempt, deps)).rejects.toThrow(/metadata evidence/);
    await expect(recordSaveMetadata(cwd, attempt, [], [], deps)).rejects.toThrow(/facts evidence/);
  });
  it("refuses missing fact readback and cannot stamp metadata complete", async () => {
    const cwd = fixture();
    const attempt = prepareSaveAttempt(cwd, "subject");
    if ("error" in attempt) throw new Error(attempt.error);
    const store = new FileStorageStore({ root: join(cwd, "store") });
    const deps = { store, context };
    await saveSqlFacts(cwd, attempt, ["fact"], deps);
    const read = store.read.bind(store);
    store.read = async (key, revision) => key.kind === "memory" ? null : read(key, revision);
    await expect(recordSaveMetadata(cwd, attempt, [], [], deps)).rejects.toThrow(/not readable/);
    expect(await verifySqlSave(cwd, "subject", deps, false)).toMatchObject({ status: "block" });
  });
  it("blocks a missing subject and commit without durable verification", async () => {
    const cwd = fixture();
    expect(await verifySqlSave(cwd, null)).toMatchObject({ status: "block" });
    expect(resumeSaveDecision("committing", { status: "unverified" })).toBe("block");
    expect(resumeSaveDecision("saving", { status: "block", reason: "outage" })).toBe("block");
  });
});
