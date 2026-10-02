/**
 * SQL-mode save receipts for the Buck-loop supervisor.
 *
 * The supervisor generates the attempt id before `b-save` starts, then
 * read-backs the receipt's memory ids before `saving` can become `committing`.
 * The database URL is never written to the attempt file or the receipt.
 */
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createLazyPool } from "../sql-memory/db.js";
import { checkSqlForRole } from "../sql-memory/sql-gate.js";
import { sqlMemoryRows, sqlMemorySaveTransaction, type SqlMemoryActivitySink } from "../sql-memory/index.js";
import { redactRemoteCredentials } from "../token-attribution/git-identity.js";

const ATTEMPT_REL = ".context/workflow/sql-save-attempt.json";
const SECRET_KEY = /password|connection|database_url|sql_memory_url|^url$/i;
const READBACK_SQL = `SELECT m.id::text AS id
  FROM memories m
  JOIN projects p ON p.id = m.project
  WHERE p.origin_url = $1 AND m.id = $2 AND m.invalid_at IS NULL`;

export interface SaveAttempt {
  attemptId: string;
  runId: string;
  subject: string;
  project: string;
  phase: string | null;
  receiptRel: string;
}

export interface SaveReceipt {
  attemptId: string;
  runId: string;
  subject: string;
  project: string;
  kind: "rows" | "no-fact";
  ids: string[];
  probed: true;
  completed?: true;
}

export type SaveCheck =
  | { status: "skip" }
  | { status: "verified" }
  | { status: "unverified" }
  | { status: "block"; reason: string };

export type SqlQuery = ((sql: string, values: unknown[]) => Promise<Array<Record<string, unknown>>>) & {
  transaction?: <T>(work: (query: SqlQuery) => Promise<T>) => Promise<T>;
};
export type SaveFact = string | { body: string; supersedes?: string };

/** True when the process was given a SQL memory target. The URL itself is not persisted. */
export function sqlMode(): boolean {
  return Boolean(process.env.SQL_MEMORY_URL);
}

/** Prepare a new cycle before its saving projection is persisted. */
export function prepareSaveAttempt(cwd: string, subject: string, reuse = false, phase: string | null = null): SaveAttempt | { error: string } {
  if (!safeSubject(subject)) return { error: "SQL save subject path is not a single subject folder." };
  const project = projectOrigin(cwd);
  if (!project) return { error: "Shared SQL memory is configured, but project identity could not be established; no save was started." };
  const previous = readAttempt(cwd);
  if (reuse && previous?.subject === subject && previous.project === project && previous.phase === phase) return previous;
  const attempt = attemptFor(subject, project, phase);
  writeJson(cwd, ATTEMPT_REL, attempt);
  return attempt;
}

/** A receipt is not save-stage proof until all metadata work has succeeded. */
export function completeSaveAttempt(cwd: string, attempt: SaveAttempt): void {
  const receipt = readReceipt(cwd, attempt);
  if (!receipt || receiptShape(receipt, attempt).status !== "verified") throw new Error("SQL save receipt is missing or invalid");
  writeJson(cwd, attempt.receiptRel, { ...receipt, completed: true });
}

/** Child-facing contract. This is not a repair diagnosis. */
export function saveDirective(attempt: SaveAttempt): string {
  return [
    "SQL save attempt.",
    `attemptId: ${attempt.attemptId}`,
    `runId: ${attempt.runId}`,
    `project: ${attempt.project}`,
    `phase: ${attempt.phase ?? "null"}`,
    `receipt: ${attempt.receiptRel}`,
    "Connectivity probe succeeded.",
    "Do not write .context/memory files or the memory index.",
    "Do not record the database URL, password, or connection string in any file.",
    "Look up the source key before insert; use save-stage sql_memory op correct for corrections. Read back each returned or reused active id in this project before writing a rows receipt. If read-back fails, do not write a receipt. Use kind no-fact with ids [] only when this session has no reusable fact.",
    "After all metadata duties succeed, set completed: true on the receipt; persistence alone is not stage completion.",
  ].join("\n");
}

export function writeReceipt(cwd: string, attempt: SaveAttempt, body: Pick<SaveReceipt, "kind" | "ids">): void {
  const receipt: SaveReceipt = {
    attemptId: attempt.attemptId,
    runId: attempt.runId,
    subject: attempt.subject,
    project: attempt.project,
    kind: body.kind,
    ids: body.ids,
    probed: true,
  };
  writeJson(cwd, attempt.receiptRel, receipt);
}

/** Persist reusable facts before applying filesystem metadata. Retries reuse source keys. */
export async function saveSqlFacts(cwd: string, attempt: SaveAttempt, facts: SaveFact[], query?: SqlQuery, onActivity?: SqlMemoryActivitySink): Promise<string[]> {
  if (query) return saveFactsWithQuery(cwd, attempt, facts, guardedQuery(query));
  const url = process.env.SQL_MEMORY_URL;
  if (!url) throw new Error("SQL_MEMORY_URL is not set");
  const pool = createLazyPool(url)();
  const saveQuery: SqlQuery = (sql, values) => sqlMemoryRows(pool, sql, values, "save", onActivity);
  saveQuery.transaction = (work) => sqlMemorySaveTransaction(pool, work, onActivity);
  try {
    return await saveFactsWithQuery(cwd, attempt, facts, saveQuery);
  } finally {
    await pool.end();
  }
}

function guardedQuery(query: SqlQuery): SqlQuery {
  const guarded: SqlQuery = (sql, values) => {
    const gate = checkSqlForRole(sql, "save");
    if (!gate.allowed) throw new Error(`SQL save policy denied statement: ${gate.reason}`);
    return query(sql, values);
  };
  if (query.transaction) guarded.transaction = (work) => query.transaction!((inside) => work(guardedQuery(inside)));
  return guarded;
}

async function saveFactsWithQuery(cwd: string, attempt: SaveAttempt, facts: SaveFact[], query: SqlQuery): Promise<string[]> {
  if (facts.length === 0) return saveNoFacts(cwd, attempt, query);
  const email = git(cwd, "config", "user.email");
  if (!email) throw new Error("SQL save requires git user.email");
  const branch = git(cwd, "branch", "--show-current");
  const sha = git(cwd, "rev-parse", "HEAD");
  const provenance = branch && sha ? [branch, sha] : [null, null];
  await query("INSERT INTO users (email) VALUES ($1) ON CONFLICT (email) DO NOTHING", [email]);
  await query(
    "INSERT INTO projects (origin_url, name) VALUES ($1, $2) ON CONFLICT (origin_url) DO NOTHING",
    [attempt.project, attempt.subject],
  );
  const projectRows = await query("SELECT id FROM projects WHERE origin_url = $1", [attempt.project]);
  const projectId = projectRows[0]?.id;
  if (typeof projectId !== "string") throw new Error("SQL save could not resolve project id");
  const ids: string[] = [];
  for (const [index, fact] of facts.entries()) {
    ids.push(await storeCorrectedFact(attempt, query, { email, projectId, provenance }, fact, index + 1));
  }
  for (const id of ids) {
    const rows = await query(READBACK_SQL, [attempt.project, id]);
    if (rows.length !== 1) throw new Error(`SQL save row was not readable for this project: ${id}`);
  }
  writeReceipt(cwd, attempt, { kind: "rows", ids });
  return ids;
}

async function storeCorrectedFact(
  attempt: SaveAttempt,
  query: SqlQuery,
  identity: { email: string; projectId: string; provenance: (string | null)[] },
  fact: SaveFact,
  seq: number,
): Promise<string> {
  const body = typeof fact === "string" ? fact : fact.body;
  const supersedes = typeof fact === "string" ? undefined : fact.supersedes;
  if (!supersedes) return storeFact(attempt, query, identity, body, seq);
  if (!query.transaction) throw new Error("SQL correction requires a gated transaction");
  return query.transaction(async (inside) => {
    const claimed = await inside(
      "UPDATE memories SET invalid_at = now() WHERE id = $1 AND project = $2 AND invalid_at IS NULL RETURNING id::text AS id",
      [supersedes, identity.projectId],
    );
    if (claimed.length !== 1) {
      const old = await inside(
        "SELECT m.superseded_by::text AS successor FROM memories m JOIN projects p ON p.id = m.project WHERE p.origin_url = $1 AND m.id = $2",
        [attempt.project, supersedes],
      );
      if (old.length !== 1) throw new Error("SQL correction target is not in this project");
      const existing = await findSourceFact(attempt, inside, seq);
      if (existing && old[0]?.successor === existing) return existing;
      throw new Error("SQL correction target was superseded by another memory");
    }
    const id = await storeFact(attempt, inside, identity, body, seq);
    const updated = await inside(
      "UPDATE memories SET superseded_by = $1 WHERE id = $2 AND project = $3 AND invalid_at IS NOT NULL AND superseded_by IS NULL RETURNING id::text AS id",
      [id, supersedes, identity.projectId],
    );
    if (updated.length !== 1) throw new Error("SQL correction target could not be invalidated");
    return id;
  });
}

async function saveNoFacts(cwd: string, attempt: SaveAttempt, query: SqlQuery): Promise<string[]> {
  const probed = await probeSql(query);
  if (probed.status !== "verified") throw new Error(probed.status === "block" ? probed.reason : "SQL save requires connectivity");
  writeReceipt(cwd, attempt, { kind: "no-fact", ids: [] });
  return [];
}

async function storeFact(
  attempt: SaveAttempt,
  query: SqlQuery,
  identity: { email: string; projectId: string; provenance: (string | null)[] },
  body: string,
  seq: number,
): Promise<string> {
  const sourceKey = `${attempt.subject}:${attempt.runId}:${seq}`;
  const context = JSON.stringify({ source_key: sourceKey, subject: attempt.subject, phase: attempt.phase, source: "b-save-improved" });
  const existing = await findSourceFact(attempt, query, seq);
  const rows = existing ? [{ id: existing }] : await query(
    "INSERT INTO memories (author, project, branch_name, commit_sha, body, context, category, seq) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8) RETURNING id::text AS id",
    [identity.email, identity.projectId, ...identity.provenance, body, context, "project", seq],
  );
  const id = rows[0]?.id;
  if (typeof id !== "string") throw new Error("SQL save did not return a memory id");
  return id;
}

async function findSourceFact(attempt: SaveAttempt, query: SqlQuery, seq: number): Promise<string | null> {
  const rows = await query(
    "SELECT m.id::text AS id FROM memories m JOIN projects p ON p.id = m.project WHERE p.origin_url = $1 AND m.invalid_at IS NULL AND m.context @> $2::jsonb LIMIT 1",
    [attempt.project, JSON.stringify({ source_key: `${attempt.subject}:${attempt.runId}:${seq}` })],
  );
  return typeof rows[0]?.id === "string" ? rows[0].id : null;
}

export async function probeSql(query: SqlQuery = (sql, values) => defaultQuery(sql, values, onActivity), onActivity?: SqlMemoryActivitySink): Promise<SaveCheck> {
  if (!sqlMode()) return { status: "skip" };
  try {
    await guardedQuery(query)("SELECT id FROM projects LIMIT 1", []);
    return { status: "verified" };
  } catch (error) {
    return { status: "block", reason: `SQL save connectivity probe failed: ${errorMessage(error)}` };
  }
}

/** Confirm the current attempt's receipt against same-project active rows. */
export async function verifySqlSave(cwd: string, subject: string | null, query: SqlQuery = (sql, values) => defaultQuery(sql, values, onActivity), requireComplete = true, expectedAttemptId?: string | null, onActivity?: SqlMemoryActivitySink): Promise<SaveCheck> {
  if (!sqlMode()) return { status: "skip" };
  if (!subject) return { status: "block", reason: "SQL save has no subject; refusing to commit." };
  const attempt = readAttempt(cwd);
  if (!matchesProjectedAttempt(attempt, subject, expectedAttemptId)) {
    return expectedAttemptId !== undefined
      ? { status: "block", reason: "SQL save attempt does not match the projected transition." }
      : { status: "unverified" };
  }
  const projectCheck = verifyAttemptProject(cwd, attempt);
  if (projectCheck.status !== "verified") return projectCheck;
  const receipt = readReceipt(cwd, attempt);
  if (!receipt) return { status: "unverified" };
  const shape = receiptShape(receipt, attempt);
  if (shape.status !== "verified") return shape;
  if (requireComplete && receipt.completed !== true) return { status: "unverified" };
  return confirmReceipt(receipt, attempt, guardedQuery(query));
}
function verifyAttemptProject(cwd: string, attempt: SaveAttempt): SaveCheck {
  const current = projectOrigin(cwd);
  return current && current === attempt.project
    ? { status: "verified" }
    : { status: "block", reason: "SQL save receipt project does not match the current Git project." };
}

function matchesProjectedAttempt(attempt: SaveAttempt | null, subject: string, expectedId?: string | null): attempt is SaveAttempt {
  return attempt !== null && attempt.subject === subject
    && (expectedId === undefined || attempt.attemptId === expectedId);
}


/** Resume may retry an unverified save. It must not commit one. Outages always block. */
export function resumeSaveDecision(state: string, check: SaveCheck): "continue" | "block" {
  if (check.status === "skip" || check.status === "verified") return "continue";
  if (check.status === "block" || state === "committing") return "block";
  return "continue";
}

function attemptFor(subject: string, project: string, phase: string | null): SaveAttempt {
  const attemptId = randomUUID();
  const runId = randomUUID();
  return {
    attemptId,
    runId,
    subject,
    project,
    phase,
    receiptRel: join(".context", subject, "sql-memory-receipts", `${runId}-${attemptId}.json`),
  };
}

function receiptShape(value: unknown, attempt: SaveAttempt): SaveCheck {
  if (hasSecretKey(value)) return { status: "block", reason: "SQL save receipt recorded a database URL or secret." };
  const receipt = parseReceipt(value);
  if (!receipt || !sameAttempt(receipt, attempt)) return { status: "unverified" };
  if (receipt.kind === "no-fact") {
    return receipt.ids.length === 0
      ? { status: "verified" }
      : { status: "block", reason: "SQL no-fact receipt listed memory ids." };
  }
  return receipt.ids.length > 0 ? { status: "verified" } : { status: "unverified" };
}

async function confirmReceipt(receipt: SaveReceipt, attempt: SaveAttempt, query: SqlQuery): Promise<SaveCheck> {
  if (receipt.kind === "no-fact") return probeSql(query);
  try {
    const missing = await missingIds(receipt, attempt.project, query);
    if (missing.length > 0) {
      return { status: "block", reason: `SQL save receipt ids were not readable for this project: ${missing.join(", ")}` };
    }
    return { status: "verified" };
  } catch (error) {
    return { status: "block", reason: `SQL save read-back failed: ${errorMessage(error)}` };
  }
}

async function missingIds(receipt: SaveReceipt, project: string, query: SqlQuery): Promise<string[]> {
  const missing: string[] = [];
  for (const id of receipt.ids) {
    const rows = await query(READBACK_SQL, [project, id]);
    if (rows.length === 0) missing.push(id);
  }
  return missing;
}

function sameAttempt(value: SaveReceipt, attempt: SaveAttempt): boolean {
  return value.attemptId === attempt.attemptId
    && value.runId === attempt.runId
    && value.subject === attempt.subject
    && value.project === attempt.project
    && value.probed === true;
}

function readAttempt(cwd: string): SaveAttempt | null {
  return parseAttempt(readJson(cwd, ATTEMPT_REL));
}

function readReceipt(cwd: string, attempt: SaveAttempt): SaveReceipt | null {
  return parseReceipt(readJson(cwd, attempt.receiptRel));
}

function parseAttempt(value: unknown): SaveAttempt | null {
  if (!isAttempt(value) || hasSecretKey(value)) return null;
  return value;
}

function parseReceipt(value: unknown): SaveReceipt | null {
  if (!isReceipt(value)) return null;
  return value;
}

function isAttempt(value: unknown): value is SaveAttempt {
  if (!value || typeof value !== "object") return false;
  const row = value as SaveAttempt;
  return typeof row.attemptId === "string"
    && typeof row.runId === "string"
    && typeof row.subject === "string"
    && typeof row.project === "string"
    && typeof row.receiptRel === "string"
    && (row.phase === null || typeof row.phase === "string");
}

function isReceipt(value: unknown): value is SaveReceipt {
  if (!value || typeof value !== "object") return false;
  const row = value as SaveReceipt;
  if (!Array.isArray(row.ids) || !row.ids.every((id) => typeof id === "string")) return false;
  return (row.kind === "rows" || row.kind === "no-fact") && row.probed === true;
}

function hasSecretKey(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  return Object.keys(value).some((key) => SECRET_KEY.test(key));
}


function safeSubject(subject: string): boolean {
  return /^[\w.-]+$/.test(subject);
}

function projectOrigin(cwd: string): string | null {
  const origin = git(cwd, "remote", "get-url", "origin");
  if (origin) return redactRemoteCredentials(origin);
  const commonDir = git(cwd, "rev-parse", "--git-common-dir");
  if (!commonDir) return null;
  return commonDir.startsWith("/") ? commonDir : resolve(cwd, commonDir);
}

function git(cwd: string, ...args: string[]): string | null {
  try {
    const value = execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    return value || null;
  } catch {
    return null;
  }
}

function readJson(cwd: string, rel: string): unknown {
  const full = contained(cwd, rel);
  if (!full || !existsSync(full)) return null;
  try {
    return JSON.parse(readFileSync(full, "utf8"));
  } catch {
    return null;
  }
}

function writeJson(cwd: string, rel: string, value: SaveAttempt | SaveReceipt): void {
  const full = contained(cwd, rel);
  if (!full) throw new Error(`SQL save path escapes the project: ${rel}`);
  mkdirSync(dirname(full), { recursive: true });
  const temporary = `${full}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(temporary, full);
}

function contained(cwd: string, rel: string): string | null {
  const root = resolve(cwd);
  const full = resolve(root, rel);
  return full === root || full.startsWith(`${root}/`) ? full : null;
}

async function defaultQuery(sql: string, values: unknown[], onActivity?: SqlMemoryActivitySink): Promise<Array<Record<string, unknown>>> {
  const url = process.env.SQL_MEMORY_URL;
  if (!url) throw new Error("SQL_MEMORY_URL is not set");
  const pool = createLazyPool(url)();
  try {
    return await sqlMemoryRows(pool, sql, values, "save", onActivity);
  } finally {
    if ("end" in pool && typeof pool.end === "function") await pool.end();
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
