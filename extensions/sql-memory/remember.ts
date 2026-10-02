import { createHash } from "node:crypto";
import { resolveRememberIdentity, type SqlGitRunner } from "./identity.js";
import type { MigrationPool } from "./migrations.js";

export class RememberCategoryError extends Error {
  readonly fix: string;

  constructor(activeSlugs: string[]) {
    super("remember requires an active category slug");
    this.fix = activeSlugs.length
      ? `Use an active category slug: ${activeSlugs.join(", ")}.`
      : "No active category slugs are available; activate a category before saving.";
  }
}

export interface RememberCorrection {
  op: "correct";
  project: string;
  previousId: string;
  author: string;
  branchName: string | null;
  commitSha: string | null;
  body: string;
  context: { source_key: string; subject: string; phase: string | null; source: string };
  category: string;
  seq: number;
}

export type RememberCorrector = (pool: MigrationPool, correction: RememberCorrection) => Promise<string>;

export interface RememberParams {
  pool: MigrationPool;
  cwd: string;
  body: string;
  subject: string;
  phase?: string | null;
  category?: string;
  /** When set, run as a `correct` for the predecessor and return the successor id. */
  previousId?: string;
  /** Tool-filled correction. Required when `previousId` is set; runs inside `correctSqlMemory`. */
  correct?: RememberCorrector;
  git?: SqlGitRunner;
}

export interface RememberIdentity {
  email: string;
  origin: string;
  branch: string | null;
  commit: string | null;
}

/** Compute a stable source key for idempotent retries on identical inputs. */
export function rememberSourceKey(input: {
  subject: string;
  phase: string | null;
  body: string;
  previousId?: string | null;
}): string {
  const hash = createHash("sha256");
  hash.update(input.subject);
  hash.update("\u0001");
  hash.update(input.phase ?? "");
  hash.update("\u0001");
  hash.update(input.previousId ?? "");
  hash.update("\u0001");
  hash.update(input.body);
  return `remember:${input.subject}:${hash.digest("hex").slice(0, 16)}`;
}

/**
 * Write a memory without the caller assembling SQL. The tool resolves git
 * identity, upserts `users` and `projects`, allocates `seq`, and returns the id
 * after a same-project active readback.
 */
export async function rememberSqlMemory(params: RememberParams): Promise<string> {
  const identity = await resolveRememberIdentity(params.cwd, params.git);
  return rememberWithIdentity({ ...params, identity });
}

/** Variant for tests and callers that have already resolved git identity. */
export async function rememberWithIdentity(params: RememberParams & { identity: RememberIdentity }): Promise<string> {
  validateRememberParams(params);
  const { pool, subject, identity } = params;
  await validateRememberCategory(pool, params.category ?? "project");
  await upsertIdentity(pool, identity.email, identity.origin, subject);
  return rememberId(params);
}

function validateRememberParams(params: RememberParams & { identity: RememberIdentity }): void {
  if (!params.subject) throw new Error("remember requires subject");
  if (!params.body) throw new Error("remember requires body");
}

async function validateRememberCategory(pool: MigrationPool, category: string): Promise<void> {
  const result = await pool.query("SELECT slug FROM categories WHERE status = 'active' ORDER BY slug");
  const activeSlugs = result.rows.map((row) => row.slug as string);
  if (!activeSlugs.includes(category)) throw new RememberCategoryError(activeSlugs);
}

async function rememberId(params: RememberParams & { identity: RememberIdentity }): Promise<string> {
  const { pool, body, subject, identity, previousId } = params;
  const phase = params.phase ?? null;
  const category = params.category ?? "project";
  const projectId = await resolveProjectId(pool, identity.origin);
  const sourceKey = rememberSourceKey({ subject, phase, body, previousId: previousId ?? null });
  const existingId = await findExistingSource(pool, identity.origin, sourceKey);
  if (existingId) return verifyActiveId(pool, identity.origin, existingId);
  const id = previousId
    ? await insertSuccessor({ pool, identity, sourceKey, subject, category, phase, body, previousId, correct: params.correct })
    : await insertFresh({ pool, identity, projectId, sourceKey, subject, category, phase, body });
  return verifyActiveId(pool, identity.origin, id);
}

async function upsertIdentity(pool: MigrationPool, email: string, origin: string, subject: string): Promise<void> {
  await pool.query(
    "INSERT INTO users (email) VALUES ($1) ON CONFLICT (email) DO NOTHING",
    [email],
  );
  await pool.query(
    "INSERT INTO projects (origin_url, name) VALUES ($1, $2) ON CONFLICT (origin_url) DO NOTHING",
    [origin, subject],
  );
}

async function resolveProjectId(pool: MigrationPool, origin: string): Promise<string> {
  const rows = await pool.query("SELECT id::text AS id FROM projects WHERE origin_url = $1", [origin]);
  const id = rows.rows[0]?.id;
  if (typeof id !== "string") throw new Error("remember could not resolve project id");
  return id;
}

async function findExistingSource(pool: MigrationPool, origin: string, sourceKey: string): Promise<string | null> {
  const rows = await pool.query(
    "SELECT m.id::text AS id FROM memories m JOIN projects p ON p.id = m.project WHERE p.origin_url = $1 AND m.invalid_at IS NULL AND m.context @> $2::jsonb LIMIT 1",
    [origin, JSON.stringify({ source_key: sourceKey })],
  );
  const id = rows.rows[0]?.id;
  return typeof id === "string" ? id : null;
}

async function insertFresh(params: {
  pool: MigrationPool;
  identity: RememberIdentity;
  projectId: string;
  sourceKey: string;
  subject: string;
  category: string;
  phase: string | null;
  body: string;
}): Promise<string> {
  const { pool, identity, projectId, sourceKey, subject, category, phase, body } = params;
  const seq = await nextSeq(pool, identity.origin);
  const inserted = await pool.query(
    "INSERT INTO memories (author, project, branch_name, commit_sha, body, context, category, seq) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8) RETURNING id::text AS id",
    [
      identity.email,
      projectId,
      identity.branch,
      identity.commit,
      body,
      JSON.stringify({ source_key: sourceKey, subject, phase, source: "sql-memory-remember" }),
      category,
      seq,
    ],
  );
  const id = inserted.rows[0]?.id;
  if (typeof id !== "string") throw new Error("remember did not return a memory id");
  return id;
}

async function nextSeq(pool: MigrationPool, origin: string): Promise<number> {
  const rows = await pool.query(
    "SELECT coalesce(max(seq), 0)::bigint AS bigint FROM memories m JOIN projects p ON p.id = m.project WHERE p.origin_url = $1 AND m.invalid_at IS NULL",
    [origin],
  );
  const value = rows.rows[0]?.bigint;
  const numeric = typeof value === "string" || typeof value === "number" || typeof value === "bigint" ? Number(value) : 0;
  return (Number.isFinite(numeric) ? numeric : 0) + 1;
}

async function verifyActiveId(pool: MigrationPool, origin: string, id: string): Promise<string> {
  const rows = await pool.query(
    "SELECT m.id::text AS id FROM memories m JOIN projects p ON p.id = m.project WHERE p.origin_url = $1 AND m.id = $2 AND m.invalid_at IS NULL",
    [origin, id],
  );
  const active = rows.rows[0]?.id;
  if (typeof active !== "string") throw new Error("remember readback did not find an active same-project row");
  return active;
}

async function insertSuccessor(params: {
  pool: MigrationPool;
  identity: RememberIdentity;
  sourceKey: string;
  subject: string;
  category: string;
  phase: string | null;
  body: string;
  previousId: string;
  correct: RememberCorrector | undefined;
}): Promise<string> {
  const { pool, identity, sourceKey, subject, category, phase, body, previousId, correct } = params;
  if (!correct) throw new Error("remember correction requires correctSqlMemory");
  const seq = await nextSeq(pool, identity.origin);
  return correct(pool, {
    op: "correct",
    project: identity.origin,
    previousId,
    author: identity.email,
    branchName: identity.branch,
    commitSha: identity.commit,
    body,
    context: { source_key: sourceKey, subject, phase, source: "sql-memory-remember" },
    category,
    seq,
  });
}