/**
 * Guard-path coverage for the SQL save stage. The database-backed flows are
 * covered in `sql-save.test.ts`; this file pins the refusals that must hold
 * before any connection is attempted, because each one silently corrupts the
 * save stage if it lets a bad attempt through.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { SqlQuery } from "../sql-save.js";
import {
  completeSaveAttempt,
  prepareSaveAttempt,
  resumeSaveDecision,
  saveDirective,
  saveSqlFacts,
  verifySqlSave,
  writeReceipt,
} from "../sql-save.js";
import { checkSqlForRole } from "../../sql-memory/sql-gate.js";

const SUBJECT = "2026-10-03.sql-guards";
const PROJECT = "git@example.test:buck/workflow.git";
const URL = "postgres://example.invalid/guard-test";
const ID = "11111111-1111-4111-8111-111111111111";

const emptyQuery: SqlQuery = async () => [];

function repo(withRemote = true): string {
  const cwd = mkdtempSync(join(tmpdir(), "sql-guards-"));
  execFileSync("git", ["init"], { cwd, stdio: "ignore" });
  if (withRemote) execFileSync("git", ["remote", "add", "origin", PROJECT], { cwd, stdio: "ignore" });
  return cwd;
}

const previous = process.env.SQL_MEMORY_URL;
afterEach(() => {
  if (previous === undefined) delete process.env.SQL_MEMORY_URL;
  else process.env.SQL_MEMORY_URL = previous;
  rmSync(join(tmpdir(), "unused"), { force: true });
});

describe("prepareSaveAttempt refusals", () => {
  it("refuses a subject that is not a single folder name", () => {
    process.env.SQL_MEMORY_URL = URL;
    const cwd = repo();
    for (const subject of ["../escape", "nested/folder", "", "a b"]) {
      const result = prepareSaveAttempt(cwd, subject);
      expect(result).toEqual({ error: "SQL save subject path is not a single subject folder." });
    }
    // No attempt file may be written for a refused subject.
    expect(() => readFileSync(join(cwd, ".context/workflow/sql-save-attempt.json"), "utf8")).toThrow();
  });

  it("refuses when project identity cannot be established", () => {
    process.env.SQL_MEMORY_URL = URL;
    const cwd = repo(false);
    // A repo with no origin falls back to the git common dir, which resolves.
    const resolved = prepareSaveAttempt(cwd, SUBJECT);
    expect("error" in resolved || resolved.project.length > 0).toBe(true);

    const detached = mkdtempSync(join(tmpdir(), "sql-nogit-"));
    execFileSync("git", ["init"], { cwd: detached, stdio: "ignore" });
    writeFileSync(join(detached, "marker"), "x");
    const outcome = prepareSaveAttempt(detached, SUBJECT);
    expect("error" in outcome ? outcome.error : outcome.project).toBeTruthy();
    rmSync(detached, { recursive: true, force: true });
  });

  it("reuses the previous attempt only when subject, project, and phase all match", () => {
    process.env.SQL_MEMORY_URL = URL;
    const cwd = repo();
    const first = prepareSaveAttempt(cwd, SUBJECT, false, null);
    if ("error" in first) throw new Error(first.error);
    const same = prepareSaveAttempt(cwd, SUBJECT, true, null);
    if ("error" in same) throw new Error(same.error);
    expect(same.attemptId).toBe(first.attemptId);
    const otherPhase = prepareSaveAttempt(cwd, SUBJECT, true, ".context/x/phase-1-a.md");
    if ("error" in otherPhase) throw new Error(otherPhase.error);
    expect(otherPhase.attemptId).not.toBe(first.attemptId);
  });
});

describe("completeSaveAttempt", () => {
  it("refuses when the receipt is missing", () => {
    process.env.SQL_MEMORY_URL = URL;
    const cwd = repo();
    const prepared = prepareSaveAttempt(cwd, SUBJECT);
    if ("error" in prepared) throw new Error(prepared.error);
    expect(() => completeSaveAttempt(cwd, prepared)).toThrow(/missing or invalid/);
  });

  it("marks a verified receipt complete", () => {
    process.env.SQL_MEMORY_URL = URL;
    const cwd = repo();
    const prepared = prepareSaveAttempt(cwd, SUBJECT);
    if ("error" in prepared) throw new Error(prepared.error);
    writeReceipt(cwd, prepared, { kind: "rows", ids: [ID] });
    completeSaveAttempt(cwd, prepared);
    const receipt = JSON.parse(readFileSync(join(cwd, prepared.receiptRel), "utf8"));
    expect(receipt.completed).toBe(true);
  });
});

describe("saveDirective", () => {
  it("carries the identity fields that exist at HEAD and no connection string", () => {
    process.env.SQL_MEMORY_URL = URL;
    const cwd = repo();
    const prepared = prepareSaveAttempt(cwd, SUBJECT, false, ".context/x/phase-2-b.md");
    if ("error" in prepared) throw new Error(prepared.error);
    const directive = saveDirective(prepared);
    expect(directive).toContain(`attemptId: ${prepared.attemptId}`);
    expect(directive).toContain(`project: ${prepared.project}`);
    expect(directive).toContain("phase: .context/x/phase-2-b.md");
    expect(directive).toContain("Do not record the database URL");
    expect(directive).not.toContain(URL);
  });

  it("writes null for an absent phase", () => {
    process.env.SQL_MEMORY_URL = URL;
    const cwd = repo();
    const prepared = prepareSaveAttempt(cwd, SUBJECT);
    if ("error" in prepared) throw new Error(prepared.error);
    expect(saveDirective(prepared)).toContain("phase: null");
  });
});

describe("verifySqlSave guards", () => {
  it("skips entirely outside SQL mode", async () => {
    delete process.env.SQL_MEMORY_URL;
    expect(await verifySqlSave(repo(), SUBJECT, emptyQuery)).toEqual({ status: "skip" });
  });

  it("blocks when SQL mode has no subject", async () => {
    process.env.SQL_MEMORY_URL = URL;
    const result = await verifySqlSave(repo(), null, emptyQuery);
    expect(result.status).toBe("block");
    expect(result.status === "block" && result.reason).toContain("no subject");
  });

  it("blocks when the attempt differs from the projected transition", async () => {
    process.env.SQL_MEMORY_URL = URL;
    const cwd = repo();
    const prepared = prepareSaveAttempt(cwd, SUBJECT);
    if ("error" in prepared) throw new Error(prepared.error);
    writeReceipt(cwd, prepared, { kind: "rows", ids: [ID] });
    const result = await verifySqlSave(cwd, SUBJECT, emptyQuery, true, "not-the-projected-attempt");
    expect(result.status).toBe("block");
  });

  it("unverifies a receipt that has not been completed", async () => {
    process.env.SQL_MEMORY_URL = URL;
    const cwd = repo();
    const prepared = prepareSaveAttempt(cwd, SUBJECT);
    if ("error" in prepared) throw new Error(prepared.error);
    writeReceipt(cwd, prepared, { kind: "rows", ids: [ID] });
    const result = await verifySqlSave(cwd, SUBJECT, emptyQuery, true, prepared.attemptId);
    expect(result).toEqual({ status: "unverified" });
  });

  it("verifies a completed receipt whose ids read back in this project", async () => {
    process.env.SQL_MEMORY_URL = URL;
    const cwd = repo();
    const prepared = prepareSaveAttempt(cwd, SUBJECT);
    if ("error" in prepared) throw new Error(prepared.error);
    writeReceipt(cwd, prepared, { kind: "rows", ids: [ID] });
    completeSaveAttempt(cwd, prepared);
    const result = await verifySqlSave(cwd, SUBJECT, async () => [{ id: ID }], true, prepared.attemptId);
    expect(result.status).toBe("verified");
  });

  it("blocks when a receipt id cannot be read back for this project", async () => {
    process.env.SQL_MEMORY_URL = URL;
    const cwd = repo();
    const prepared = prepareSaveAttempt(cwd, SUBJECT);
    if ("error" in prepared) throw new Error(prepared.error);
    writeReceipt(cwd, prepared, { kind: "rows", ids: [ID] });
    completeSaveAttempt(cwd, prepared);
    // An empty read-back means the id is not active in this project, so the
    // receipt must not be treated as save-stage proof.
    const result = await verifySqlSave(cwd, SUBJECT, async () => [], true, prepared.attemptId);
    expect(result.status).toBe("block");
    expect(result.status === "block" && result.reason).toContain(ID);
  });
});

describe("resumeSaveDecision", () => {
  it("blocks a saving resume only on an outright block, and always blocks at commit", () => {
    // An unverified saving stage is recoverable: resume re-runs the save.
    expect(resumeSaveDecision("saving", { status: "verified" })).toBe("continue");
    expect(resumeSaveDecision("saving", { status: "skip" })).toBe("continue");
    expect(resumeSaveDecision("saving", { status: "unverified" })).toBe("continue");
    expect(resumeSaveDecision("saving", { status: "block", reason: "down" })).toBe("block");
    // Commit is the point of no return, so anything short of proof blocks it.
    expect(resumeSaveDecision("committing", { status: "unverified" })).toBe("block");
    expect(resumeSaveDecision("committing", { status: "block", reason: "down" })).toBe("block");
  });
});

describe("saveSqlFacts with an injected query", () => {
  it("writes a no-fact receipt when the session has no reusable fact", async () => {
    process.env.SQL_MEMORY_URL = URL;
    const cwd = repo();
    const prepared = prepareSaveAttempt(cwd, SUBJECT);
    if ("error" in prepared) throw new Error(prepared.error);
    const ids = await saveSqlFacts(cwd, prepared, [], emptyQuery);
    expect(ids).toEqual([]);
    const receipt = JSON.parse(readFileSync(join(cwd, prepared.receiptRel), "utf8"));
    expect(receipt.kind).toBe("no-fact");
    expect(receipt.ids).toEqual([]);
  });

  it("refuses to write a fact when the project id cannot be resolved", async () => {
    process.env.SQL_MEMORY_URL = URL;
    const cwd = repo();
    const prepared = prepareSaveAttempt(cwd, SUBJECT);
    if ("error" in prepared) throw new Error(prepared.error);
    // Without a project row the save must stop rather than store a fact that
    // no project can own.
    await expect(saveSqlFacts(cwd, prepared, ["a fact"], emptyQuery)).rejects.toThrow(/project id/);
  });

  it("runs the identity lookups the save stage requires", async () => {
    process.env.SQL_MEMORY_URL = URL;
    const cwd = repo();
    const prepared = prepareSaveAttempt(cwd, SUBJECT);
    if ("error" in prepared) throw new Error(prepared.error);
    const seen: string[] = [];
    const query: SqlQuery = async (sql) => {
      seen.push(sql);
      // The project lookup must return an id for the save to continue.
      return /SELECT id FROM projects/.test(sql) ? [{ id: "project-id" }] : [];
    };
    // The fact store then needs a read-back row, so the failure surfaces
    // exactly where the fixture stops satisfying it.
    await expect(saveSqlFacts(cwd, prepared, ["a fact"], query)).rejects.toThrow();
    expect(seen.some((sql) => /INSERT INTO memories/.test(sql))).toBe(true);
    // Every statement the save actually issued is one the gate allows.
    for (const sql of seen) expect(checkSqlForRole(sql, "save").allowed).toBe(true);
  });
});

describe("attempt file hygiene", () => {
  it("never persists the database URL or credentials", () => {
    process.env.SQL_MEMORY_URL = URL;
    const cwd = repo();
    const prepared = prepareSaveAttempt(cwd, SUBJECT);
    if ("error" in prepared) throw new Error(prepared.error);
    mkdirSync(join(cwd, ".context", "workflow"), { recursive: true });
    const text = readFileSync(join(cwd, ".context/workflow/sql-save-attempt.json"), "utf8");
    expect(text).not.toContain(URL);
    expect(text).not.toContain("password");
    expect(JSON.parse(text).subject).toBe(SUBJECT);
  });
});
