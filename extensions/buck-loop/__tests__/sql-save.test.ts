import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { SqlQuery } from "../sql-save.js";
import {
  completeSaveAttempt,
  prepareSaveAttempt,
  saveSqlFacts,
  probeSql,
  saveDirective,
  resumeSaveDecision,
  verifySqlSave,
  writeReceipt,
} from "../sql-save.js";
import { createLazyPool } from "../../sql-memory/db.js";
import { sqlMemorySaveTransaction } from "../../sql-memory/index.js";

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

const emptyQuery: SqlQuery = async () => [];

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
    const stale = await verifySqlSave(cwd, SUBJECT, emptyQuery);
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
    await expect(verifySqlSave(cwd, SUBJECT, async () => [{ ok: 1 }])).resolves.toEqual({
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
    expect(await verifySqlSave(cwd, SUBJECT, async () => [])).toEqual({ status: "unverified" });
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
    await expect(verifySqlSave(cwd, SUBJECT, emptyQuery)).resolves.toEqual({
      status: "block",
      reason: "SQL save receipt recorded a database URL or secret.",
    });
  });

  it("verifies listed ids and blocks a missing row", async () => {
    process.env.SQL_MEMORY_URL = URL;
    cwd = repo();
    const current = attempt(cwd);
    const id = "22222222-2222-4222-8222-222222222222";
    writeReceipt(cwd, current, { kind: "rows", ids: [id] });
    const found: SqlQuery = async (_sql, values) => values[1] === id ? [{ id }] : [];
    expect(await verifySqlSave(cwd, SUBJECT, found)).toEqual({ status: "unverified" });
    completeSaveAttempt(cwd, current);
    await expect(verifySqlSave(cwd, SUBJECT, found)).resolves.toEqual({ status: "verified" });
    await expect(verifySqlSave(cwd, SUBJECT, emptyQuery)).resolves.toEqual({
      status: "block",
      reason: `SQL save receipt ids were not readable for this project: ${id}`,
    });
  });

  it("accepts a no-fact receipt only after a successful probe", async () => {
    process.env.SQL_MEMORY_URL = URL;
    cwd = repo();
    const current = attempt(cwd);
    writeReceipt(cwd, current, { kind: "no-fact", ids: [] });
    const ok: SqlQuery = async () => [{ ok: 1 }];
    const down: SqlQuery = async () => { throw new Error("connection refused"); };
    expect(await verifySqlSave(cwd, SUBJECT, ok)).toEqual({ status: "unverified" });
    completeSaveAttempt(cwd, current);
    await expect(verifySqlSave(cwd, SUBJECT, ok)).resolves.toEqual({ status: "verified" });
    await expect(verifySqlSave(cwd, SUBJECT, down)).resolves.toEqual({
      status: "block",
      reason: "SQL save connectivity probe failed: connection refused",
    });
    await expect(probeSql(down)).resolves.toEqual({
      status: "block",
      reason: "SQL save connectivity probe failed: connection refused",
    });
  });

  it("does not issue a rows receipt when read-back cannot see the inserted row", async () => {
    process.env.SQL_MEMORY_URL = URL;
    cwd = repo();
    execFileSync("git", ["config", "user.email", "save@example.test"], { cwd });
    const current = attempt(cwd);
    const missingReadback: SqlQuery = async (sql) => {
      if (sql.startsWith("SELECT id FROM projects")) return [{ id: "11111111-1111-4111-8111-111111111111" }];
      if (sql.startsWith("INSERT INTO memories")) return [{ id: "22222222-2222-4222-8222-222222222222" }];
      return [];
    };
    await expect(saveSqlFacts(cwd, current, ["test fact"], missingReadback)).rejects.toThrow("not readable");
    expect(await verifySqlSave(cwd, SUBJECT, missingReadback)).toEqual({ status: "unverified" });
  });

  it("refuses to commit an unverified save and retries a missing receipt", () => {
    expect(resumeSaveDecision("committing", { status: "unverified" })).toBe("block");
    expect(resumeSaveDecision("saving", { status: "unverified" })).toBe("continue");
    expect(resumeSaveDecision("saving", { status: "block", reason: "down" })).toBe("block");
    expect(resumeSaveDecision("committing", { status: "verified" })).toBe("continue");
  });

  it("does not query when SQL memory is unset", async () => {
    delete process.env.SQL_MEMORY_URL;
    cwd = repo();
    const queried: SqlQuery = async () => { throw new Error("should not query"); };
    await expect(verifySqlSave(cwd, SUBJECT, queried)).resolves.toEqual({ status: "skip" });
  });
});

describe.skipIf(!process.env.SQL_MEMORY_TEST_URL)("disposable SQL save integration", () => {
  it("stores apostrophes, reuses a source key, and verifies no-fact saves", async () => {
    const cwd = repo();
    const oldUrl = process.env.SQL_MEMORY_URL;
    process.env.SQL_MEMORY_URL = process.env.SQL_MEMORY_TEST_URL;
    const pool = createLazyPool(process.env.SQL_MEMORY_TEST_URL!)();
    const query: SqlQuery = async (sql, values) => (await pool.query(sql, values)).rows;
    query.transaction = (work) => sqlMemorySaveTransaction(pool, work);
    const project = `https://example.test/sql-save-${crypto.randomUUID()}.git`;
    execFileSync("git", ["remote", "set-url", "origin", project], { cwd });
    execFileSync("git", ["config", "user.email", "sql-save-test@example.test"], { cwd });
    try {
      const first = attempt(cwd, `.context/${SUBJECT}/phase-1-save.md`);
      const ids = await saveSqlFacts(cwd, first, ["It's a durable decision."], query);
      expect(ids).toHaveLength(1);
      expect(await saveSqlFacts(cwd, first, ["It's a durable decision."], query)).toEqual(ids);
      completeSaveAttempt(cwd, first);
      expect(await verifySqlSave(cwd, SUBJECT, query)).toEqual({ status: "verified" });
      const row = await query("SELECT body, context FROM memories WHERE id = $1", ids);
      expect(row[0]?.body).toBe("It's a durable decision.");
      expect(row[0]?.context).toMatchObject({ phase: `.context/${SUBJECT}/phase-1-save.md` });
      const correction = attempt(cwd, `.context/${SUBJECT}/phase-2-correct.md`);
      const corrected = await saveSqlFacts(cwd, correction, [{ body: "It's a corrected decision.", supersedes: ids[0] }], query);
      expect(corrected[0]).not.toBe(ids[0]);
      const predecessor = await query("SELECT invalid_at, superseded_by::text AS successor FROM memories WHERE id = $1", ids);
      expect(predecessor[0]?.invalid_at).not.toBeNull();
      expect(predecessor[0]?.successor).toBe(corrected[0]);
      expect((await query("SELECT context FROM memories WHERE id = $1", corrected))[0]?.context)
        .toMatchObject({ phase: `.context/${SUBJECT}/phase-2-correct.md` });
      expect(await saveSqlFacts(cwd, correction, [{ body: "It's a corrected decision.", supersedes: ids[0] }], query)).toEqual(corrected);
      completeSaveAttempt(cwd, correction);
      expect(await verifySqlSave(cwd, SUBJECT, query)).toEqual({ status: "verified" });
      const rejected = attempt(cwd);
      await expect(saveSqlFacts(cwd, rejected, [{ body: "Unwanted successor", supersedes: ids[0] }], query))
        .rejects.toThrow("superseded by another memory");
      const orphans = await query("SELECT id FROM memories WHERE project = (SELECT id FROM projects WHERE origin_url = $1) AND body = $2", [project, "Unwanted successor"]);
      expect(orphans).toEqual([]);
      const failedUpdate = attempt(cwd);
      const failing: SqlQuery = query;
      failing.transaction = (work) => sqlMemorySaveTransaction(pool, async (inside) => work((sql, values) => {
        if (sql.startsWith("UPDATE memories SET invalid_at")) throw new Error("injected update failure");
        return inside(sql, values);
      }));
      await expect(saveSqlFacts(cwd, failedUpdate, [{ body: "Rolled-back successor", supersedes: corrected[0] }], failing))
        .rejects.toThrow("injected update failure");
      expect(await query("SELECT id FROM memories WHERE project = (SELECT id FROM projects WHERE origin_url = $1) AND body = $2", [project, "Rolled-back successor"])).toEqual([]);
      expect((await query("SELECT invalid_at FROM memories WHERE id = $1", [corrected[0]]))[0]?.invalid_at).toBeNull();
      const second = attempt(cwd);
      expect(await saveSqlFacts(cwd, second, [], query)).toEqual([]);
      completeSaveAttempt(cwd, second);
      expect(await verifySqlSave(cwd, SUBJECT, query)).toEqual({ status: "verified" });
    } finally {
      await query("DELETE FROM memories WHERE id IN (SELECT m.id FROM memories m JOIN projects p ON p.id = m.project WHERE p.origin_url = $1)", [project]);
      await query("DELETE FROM projects WHERE origin_url = $1", [project]);
      await pool.end();
      rmSync(cwd, { recursive: true, force: true });
      if (oldUrl === undefined) delete process.env.SQL_MEMORY_URL;
      else process.env.SQL_MEMORY_URL = oldUrl;
    }
  });
});
