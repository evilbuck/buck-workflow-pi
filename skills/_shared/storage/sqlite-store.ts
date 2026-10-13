import { randomUUID } from "node:crypto";
import { dirname } from "node:path";
import { mkdirSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import type { ArtifactKey, ArtifactQuery, ArtifactRevision, CheckpointSeal, LifecycleRecord, LifecycleTransition, RunReceipt, ScopedCorrection, StorageStore } from "./contract.js";
import { cloneRevision, keyId, searchableText, validateRevision } from "./adapter-utils.js";
import { assertCorrectionPredecessor, assertReceiptComplete, assertReceiptIdentity, correctionDecision, correctionQuery, inspectStoredLifecycle, lifecycleRevision, receiptRevisionReadable, selectPage, tombstoneRevision, type PageItem, type StoredCorrection } from "./domain.js";
import { overlayPublishedRevisions } from "./visibility.js";
import { loadSQLiteModule } from "./sqlite-capability.js";

const SCHEMA = `PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS artifact_revisions (
  project_id TEXT NOT NULL, subject_id TEXT NOT NULL, kind TEXT NOT NULL, logical_name TEXT NOT NULL,
  branch_id TEXT NOT NULL, worktree_id TEXT NOT NULL DEFAULT '', run_id TEXT NOT NULL DEFAULT '', revision TEXT NOT NULL,
  bytes BLOB NOT NULL, sha256 TEXT NOT NULL, author TEXT NOT NULL, source TEXT NOT NULL, created_at TEXT NOT NULL, links TEXT NOT NULL,
  PRIMARY KEY(project_id, subject_id, kind, logical_name, branch_id, worktree_id, run_id, revision)
);
CREATE TABLE IF NOT EXISTS artifact_pointers (
  project_id TEXT NOT NULL, subject_id TEXT NOT NULL, kind TEXT NOT NULL, logical_name TEXT NOT NULL,
  branch_id TEXT NOT NULL, worktree_id TEXT NOT NULL DEFAULT '', run_id TEXT NOT NULL DEFAULT '', revision TEXT NOT NULL,
  PRIMARY KEY(project_id, subject_id, kind, logical_name, branch_id, worktree_id, run_id),
  FOREIGN KEY(project_id, subject_id, kind, logical_name, branch_id, worktree_id, run_id, revision)
    REFERENCES artifact_revisions(project_id, subject_id, kind, logical_name, branch_id, worktree_id, run_id, revision)
);
CREATE TABLE IF NOT EXISTS artifact_lifecycle(subject_id TEXT PRIMARY KEY, revision TEXT NOT NULL, state TEXT NOT NULL, evidence TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS artifact_runs(project_id TEXT NOT NULL, run_id TEXT NOT NULL, branch_id TEXT NOT NULL, worktree_id TEXT NOT NULL, attempt_id TEXT NOT NULL, status TEXT NOT NULL, artifact_revisions TEXT NOT NULL, PRIMARY KEY(project_id, run_id));
CREATE TABLE IF NOT EXISTS artifact_checkpoints(id TEXT PRIMARY KEY, project_id TEXT NOT NULL, branch_id TEXT NOT NULL, commit_sha TEXT NOT NULL, integration_tip TEXT NOT NULL, revision_set TEXT NOT NULL, bound_commit TEXT);
CREATE TABLE IF NOT EXISTS artifact_publications(id TEXT PRIMARY KEY, checkpoint_id TEXT NOT NULL REFERENCES artifact_checkpoints(id), integration_tip TEXT NOT NULL, revision_set TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS artifact_attachments(project_id TEXT NOT NULL, sha256 TEXT NOT NULL, bytes BLOB NOT NULL, PRIMARY KEY(project_id, sha256));
CREATE TABLE IF NOT EXISTS artifact_import_provenance(source_id TEXT PRIMARY KEY, destination_revision TEXT NOT NULL, source_metadata TEXT NOT NULL, imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS artifact_lifecycle_scope(project_id TEXT NOT NULL, branch_id TEXT NOT NULL, subject_id TEXT NOT NULL, revision TEXT NOT NULL, state TEXT NOT NULL, evidence TEXT NOT NULL, provenance TEXT NOT NULL, PRIMARY KEY(project_id, branch_id, subject_id));
CREATE TABLE IF NOT EXISTS artifact_corrections(project_id TEXT NOT NULL, branch_id TEXT NOT NULL, artifact_key TEXT NOT NULL, idempotency_key TEXT NOT NULL, predecessor_revision TEXT NOT NULL, result_revision TEXT, replacement_sha256 TEXT, PRIMARY KEY(project_id, branch_id, artifact_key, idempotency_key));
CREATE TABLE IF NOT EXISTS artifact_search_text(project_id TEXT NOT NULL, revision TEXT NOT NULL, search_text TEXT NOT NULL, PRIMARY KEY(project_id, revision));
CREATE TABLE IF NOT EXISTS artifact_run_duties(project_id TEXT NOT NULL, run_id TEXT NOT NULL, receipt_kind TEXT NOT NULL, metadata_duties TEXT NOT NULL, PRIMARY KEY(project_id, run_id));
CREATE INDEX IF NOT EXISTS artifact_revisions_project_kind ON artifact_revisions(project_id, kind, created_at);
CREATE INDEX IF NOT EXISTS artifact_revisions_branch ON artifact_revisions(project_id, branch_id, created_at);`;

type Row = Record<string, unknown>;

const LIST_ARTIFACTS_SQL = `SELECT r.project_id, r.subject_id, r.kind, r.logical_name, r.branch_id, r.worktree_id, r.run_id, r.revision, r.source, r.created_at, COALESCE(s.search_text, '') AS search_text
  FROM artifact_revisions r
  LEFT JOIN artifact_pointers p USING(project_id,subject_id,kind,logical_name,branch_id,worktree_id,run_id,revision)
  LEFT JOIN artifact_search_text s ON s.project_id = r.project_id AND s.revision = r.revision
  WHERE r.project_id=:project
    AND (:subject IS NULL OR r.subject_id=:subject)
    AND (:kind IS NULL OR r.kind=:kind)
    AND (:prefix IS NULL OR substr(r.logical_name,1,length(:prefix))=:prefix)
    AND ((p.branch_id=:branch AND ((p.run_id='' AND (p.worktree_id='' OR p.worktree_id=:worktree)) OR (p.run_id=:run AND p.worktree_id=:worktree AND :run<>'' AND :worktree<>'')))
      OR (r.branch_id<>:branch AND r.run_id='' AND r.worktree_id='' AND __PUBLISHED__))
  ORDER BY r.created_at,r.revision`;

function listBindings(query: ArtifactQuery): Record<string, SQLInputValue> {
  const optional = Object.fromEntries([
    ["subject", query.subjectId],
    ["kind", query.kind],
    ["prefix", query.logicalNamePrefix],
  ].filter(([, value]) => value !== undefined)) as Record<string, SQLInputValue>;
  const bindings: Record<string, SQLInputValue> = {
    project: query.projectId,
    branch: query.branchId,
    run: query.runId ?? "",
    worktree: query.worktreeId ?? "",
    ...optional,
  };
  query.publishedRevisionIds.forEach((revision, index) => { bindings[`published${index}`] = revision; });
  return bindings;
}

function publishedClause(revisions: readonly string[]): string {
  return revisions.length === 0 ? "0" : `r.revision IN (${revisions.map((_, index) => `:published${index}`).join(",")})`;
}

export class SQLiteStorageStore implements StorageStore {
  readonly #database: DatabaseSync;
  private constructor(database: DatabaseSync) { this.#database = database; this.#database.exec(SCHEMA); }

  static async open(path: string, options: { busyTimeoutMs?: number } = {}): Promise<SQLiteStorageStore> {
    const { DatabaseSync } = await loadSQLiteModule();
    if (path !== ":memory:") await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    const database = new DatabaseSync(path) as DatabaseSync;
    if (path !== ":memory:") database.exec("PRAGMA journal_mode = WAL");
    database.exec(`PRAGMA busy_timeout = ${Math.max(0, options.busyTimeoutMs ?? 5_000)}`);
    return new SQLiteStorageStore(database);
  }
  static openSync(path: string, options: { busyTimeoutMs?: number } = {}): SQLiteStorageStore {
    const { DatabaseSync } = require("node:sqlite") as { DatabaseSync: new (path: string) => DatabaseSync };
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    const database = new DatabaseSync(path);
    if (path !== ":memory:") database.exec("PRAGMA journal_mode = WAL");
    database.exec(`PRAGMA busy_timeout = ${Math.max(0, options.busyTimeoutMs ?? 5_000)}`);
    return new SQLiteStorageStore(database);
  }


  close(): void { this.#database.close(); }

  async backup(destination: string): Promise<void> {
    if (destination.includes("'") || destination.includes("\0")) throw new Error("invalid SQLite backup path");
    await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
    this.#database.exec(`VACUUM INTO '${destination}'`);
  }

  async read(key: ArtifactKey, revision?: string): Promise<ArtifactRevision | null> {
    const ids = this.#keyValues(key);
    const row = this.#database.prepare(`SELECT r.* FROM artifact_revisions r ${revision === undefined ? "JOIN artifact_pointers p USING(project_id,subject_id,kind,logical_name,branch_id,worktree_id,run_id,revision)" : ""} WHERE project_id=? AND subject_id=? AND kind=? AND logical_name=? AND branch_id=? AND worktree_id=? AND run_id=? ${revision === undefined ? "" : "AND revision=?"}`).get(...ids, ...(revision === undefined ? [] : [revision])) as Row | undefined;
    if (!row || (revision === undefined && String(row.source) === "tombstone")) return null;
    return this.#decode(row);
  }
  readSync(key: ArtifactKey): ArtifactRevision | null {
    const ids = this.#keyValues(key);
    const row = this.#database.prepare("SELECT r.* FROM artifact_revisions r JOIN artifact_pointers p USING(project_id,subject_id,kind,logical_name,branch_id,worktree_id,run_id,revision) WHERE project_id=? AND subject_id=? AND kind=? AND logical_name=? AND branch_id=? AND worktree_id=? AND run_id=?").get(...ids) as Row | undefined;
    if (!row || String(row.source) === "tombstone") return null;
    return this.#decode(row);
  }


  async list(query: ArtifactQuery): Promise<readonly ArtifactRevision[]> {
    return this.#loadPage(selectPage(this.#metadata(query), query));
  }

  async search(query: ArtifactQuery & { text: string }): Promise<readonly ArtifactRevision[]> {
    return this.#loadPage(selectPage(this.#metadata(query), query));
  }

  async writeBatch(revisions: readonly ArtifactRevision[]): Promise<readonly ArtifactRevision[]> {
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      for (const revision of revisions) this.#insertRevision(revision);
      this.#database.exec("COMMIT");
      return revisions.map(cloneRevision);
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  async correct(correction: ScopedCorrection): Promise<ArtifactRevision | null> {
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const result = this.#correctLocked(correction);
      this.#database.exec("COMMIT");
      return result;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  async transition(input: LifecycleTransition): Promise<string> {
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const revision = this.#transitionLocked(input);
      this.#database.exec("COMMIT");
      return revision;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  async inspectLifecycle(projectId: string, branchId: string, subjectId: string, publishedRevisionIds: readonly string[] = []): Promise<LifecycleRecord | null> {
    return inspectStoredLifecycle(await this.list({ projectId, branchId, subjectId, publishedRevisionIds }), projectId, branchId, subjectId);
  }

  async writeReceipt(receipt: RunReceipt): Promise<void> {
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      this.#writeReceiptLocked(receipt);
      this.#database.exec("COMMIT");
    } catch (error) { this.#database.exec("ROLLBACK"); throw error; }
  }

  async readReceipt(projectId: string, runId: string): Promise<RunReceipt | null> {
    const row = this.#database.prepare("SELECT r.branch_id,r.worktree_id,r.attempt_id,r.status,r.artifact_revisions,d.receipt_kind,d.metadata_duties FROM artifact_runs r LEFT JOIN artifact_run_duties d USING(project_id,run_id) WHERE r.project_id=? AND r.run_id=?").get(projectId, runId) as Row | undefined;
    return decodeReceipt(row, projectId, runId);
  }

  #metadata(query: ArtifactQuery): Array<PageItem & { key: ArtifactKey }> {
    const sql = LIST_ARTIFACTS_SQL.replace("__PUBLISHED__", publishedClause(query.publishedRevisionIds));
    const rows = this.#database.prepare(sql).all(listBindings(query)) as Row[];
    return overlayPublishedRevisions(rows.map((row) => this.#pageItem(row)), query.branchId);
  }

  #pageItem(row: Row): PageItem & { key: ArtifactKey } {
    return { key: { projectId: String(row.project_id), subjectId: String(row.subject_id), kind: String(row.kind) as ArtifactKey["kind"], logicalName: String(row.logical_name), branchId: String(row.branch_id), ...(row.worktree_id ? { worktreeId: String(row.worktree_id) } : {}), ...(row.run_id ? { runId: String(row.run_id) } : {}) }, revision: String(row.revision), createdAt: String(row.created_at), logicalName: String(row.logical_name), source: String(row.source), searchText: String(row.search_text ?? "") };
  }

  async #loadPage(page: ReadonlyArray<PageItem & { key: ArtifactKey }>): Promise<ArtifactRevision[]> {
    const loaded: ArtifactRevision[] = [];
    for (const item of page) {
      const revision = await this.read(item.key, item.revision);
      if (!revision) throw new Error("uncertain persistence blocks save");
      loaded.push(revision);
    }
    return loaded;
  }

  #insertRevision(revision: ArtifactRevision): void {
    validateRevision(revision);
    const ids = this.#keyValues(revision.key);
    const pointer = this.#database.prepare("SELECT revision FROM artifact_pointers WHERE project_id=? AND subject_id=? AND kind=? AND logical_name=? AND branch_id=? AND worktree_id=? AND run_id=?").get(...ids) as { revision: string } | undefined;
    if (revision.expectedRevision !== undefined && revision.expectedRevision !== (pointer?.revision ?? null)) throw new Error(`stale revision rejected for ${revision.key.logicalName}`);
    this.#database.prepare("INSERT INTO artifact_revisions VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(...ids, revision.revision, revision.bytes, revision.sha256, revision.author, revision.source, revision.createdAt, JSON.stringify(revision.links));
    this.#database.prepare("INSERT INTO artifact_search_text VALUES (?,?,?)").run(revision.key.projectId, revision.revision, searchableText(revision.bytes));
    this.#database.prepare("INSERT INTO artifact_pointers VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(project_id,subject_id,kind,logical_name,branch_id,worktree_id,run_id) DO UPDATE SET revision=excluded.revision").run(...ids, revision.revision);
  }

  #correctLocked(correction: ScopedCorrection): ArtifactRevision | null {
    const existing = this.#database.prepare("SELECT predecessor_revision,result_revision,replacement_sha256 FROM artifact_corrections WHERE project_id=? AND branch_id=? AND artifact_key=? AND idempotency_key=?").get(correction.key.projectId, correction.key.branchId ?? "", keyId(correction.key), correction.idempotencyKey) as Row | undefined;
    const stored: StoredCorrection | null = existing ? { predecessorRevision: String(existing.predecessor_revision), resultRevision: existing.result_revision == null ? null : String(existing.result_revision), replacementSha256: existing.replacement_sha256 == null ? null : String(existing.replacement_sha256) } : null;
    if (correctionDecision(stored, correction) === "replay") return stored?.resultRevision ? this.#readStored(correction.key, stored.resultRevision) : null;
    const expected = assertCorrectionPredecessor(this.#metadata(correctionQuery(correction)), correction);
    const item = { ...(correction.replacement ?? tombstoneRevision(correction.key, correction.predecessorRevision)), expectedRevision: expected };
    this.#insertRevision(item);
    this.#database.prepare("INSERT INTO artifact_corrections VALUES (?,?,?,?,?,?,?)").run(correction.key.projectId, correction.key.branchId ?? "", keyId(correction.key), correction.idempotencyKey, correction.predecessorRevision, correction.replacement ? item.revision : null, correction.replacement?.sha256 ?? null);
    return correction.replacement ? cloneRevision(item) : null;
  }

  #readStored(key: ArtifactKey, revision: string): ArtifactRevision {
    const row = this.#database.prepare("SELECT * FROM artifact_revisions WHERE project_id=? AND subject_id=? AND kind=? AND logical_name=? AND branch_id=? AND worktree_id=? AND run_id=? AND revision=?").get(...this.#keyValues(key), revision) as Row | undefined;
    if (!row) throw new Error("uncertain persistence blocks save");
    return this.#decode(row);
  }

  #transitionLocked(input: LifecycleTransition): string {
    const item = lifecycleRevision(this.#evidenceBodies(input), input);
    this.#insertRevision(item);
    return item.revision;
  }

  #evidenceBodies(input: LifecycleTransition): ArtifactRevision[] {
    const query: ArtifactQuery = { projectId: input.projectId, branchId: input.branchId, subjectId: input.subjectId, publishedRevisionIds: input.publishedRevisionIds ?? [] };
    return selectPage(this.#metadata(query), {}).map((item) => {
      const row = this.#database.prepare("SELECT * FROM artifact_revisions WHERE project_id=? AND revision=? AND branch_id=?").get(item.key.projectId, item.revision, item.key.branchId ?? "") as Row | undefined;
      if (!row) throw new Error("uncertain persistence blocks save");
      return this.#decode(row);
    });
  }

  #writeReceiptLocked(receipt: RunReceipt): void {
    const current = this.#database.prepare("SELECT r.branch_id,r.worktree_id,r.attempt_id,r.status,r.artifact_revisions,d.receipt_kind,d.metadata_duties FROM artifact_runs r LEFT JOIN artifact_run_duties d USING(project_id,run_id) WHERE r.project_id=? AND r.run_id=?").get(receipt.projectId, receipt.runId) as Row | undefined;
    const attempted = decodeReceipt(current, receipt.projectId, receipt.runId);
    assertReceiptIdentity(attempted, receipt);
    assertReceiptComplete(attempted, receipt, this.#readableRevisions(receipt));
    this.#database.prepare("INSERT INTO artifact_runs VALUES (?,?,?,?,?,?,?) ON CONFLICT(project_id,run_id) DO UPDATE SET status=excluded.status,artifact_revisions=excluded.artifact_revisions").run(receipt.projectId, receipt.runId, receipt.branchId, receipt.worktreeId, receipt.attemptId, receipt.status, JSON.stringify(receipt.artifactRevisions));
    this.#database.prepare("INSERT INTO artifact_run_duties VALUES (?,?,?,?) ON CONFLICT(project_id,run_id) DO UPDATE SET receipt_kind=excluded.receipt_kind,metadata_duties=excluded.metadata_duties").run(receipt.projectId, receipt.runId, receipt.kind ?? "rows", JSON.stringify(receipt.metadataDuties ?? []));
    const stored = this.#database.prepare("SELECT status,attempt_id,branch_id FROM artifact_runs WHERE project_id=? AND run_id=?").get(receipt.projectId, receipt.runId) as Row;
    if (String(stored.status) !== receipt.status || String(stored.attempt_id) !== receipt.attemptId || String(stored.branch_id) !== receipt.branchId) throw new Error("receipt readback mismatch");
  }

  #readableRevisions(receipt: RunReceipt): Set<string> {
    const readable = new Set<string>();
    for (const revision of receipt.artifactRevisions) {
      const rows = this.#database.prepare("SELECT * FROM artifact_revisions WHERE project_id=? AND branch_id=? AND revision=?").all(receipt.projectId, receipt.branchId, revision) as Row[];
      if (rows.some((row) => receiptRevisionReadable(this.#decode(row), receipt))) readable.add(revision);
    }
    return readable;
  }

  async sealCheckpoint(checkpoint: CheckpointSeal): Promise<string> {
    const id = randomUUID();
    this.#database.prepare("INSERT INTO artifact_checkpoints VALUES (?,?,?,?,?,?,NULL)").run(id, checkpoint.projectId, checkpoint.branchId, checkpoint.commit, checkpoint.integrationTip, JSON.stringify(checkpoint.revisionSet));
    return id;
  }

  async bindCheckpoint(checkpointId: string, commit: string): Promise<void> {
    const result = this.#database.prepare("UPDATE artifact_checkpoints SET bound_commit=? WHERE id=? AND bound_commit IS NULL").run(commit, checkpointId);
    if (result.changes !== 1) throw new Error("unknown or already-bound checkpoint");
  }

  async reconcile(_integrationTip: string): Promise<void> {
    // Git proof and publication policy are implemented by the publication service.
  }

  async *exportArtifacts(query: ArtifactQuery): AsyncIterable<ArtifactRevision> {
    for (const item of await this.list({ ...query, limit: undefined, cursor: undefined })) yield item;
  }

  async importArtifacts(revisions: AsyncIterable<ArtifactRevision>): Promise<void> {
    const batch: ArtifactRevision[] = [];
    for await (const revision of revisions) batch.push(revision);
    await this.writeBatch(batch);
  }


  #keyValues(key: ArtifactKey): SQLInputValue[] { return [key.projectId, key.subjectId, key.kind, key.logicalName, key.branchId ?? "", key.worktreeId ?? "", key.runId ?? ""]; }
  #decode(row: Row): ArtifactRevision {
    return { key: { projectId: String(row.project_id), subjectId: String(row.subject_id), kind: String(row.kind) as ArtifactKey["kind"], logicalName: String(row.logical_name), branchId: String(row.branch_id), ...(row.worktree_id ? { worktreeId: String(row.worktree_id) } : {}), ...(row.run_id ? { runId: String(row.run_id) } : {}) }, revision: String(row.revision), bytes: new Uint8Array(row.bytes as ArrayBuffer), sha256: String(row.sha256), author: String(row.author), source: String(row.source), createdAt: String(row.created_at), links: JSON.parse(String(row.links)) as ArtifactKey[] };
  }
}

function decodeReceipt(row: Row | undefined, projectId: string, runId: string): RunReceipt | null {
  if (!row) return null;
  return { projectId, runId, branchId: String(row.branch_id), worktreeId: String(row.worktree_id), attemptId: String(row.attempt_id), status: String(row.status) as RunReceipt["status"], artifactRevisions: JSON.parse(String(row.artifact_revisions)) as string[], ...(row.receipt_kind ? { kind: String(row.receipt_kind) as RunReceipt["kind"], metadataDuties: JSON.parse(String(row.metadata_duties)) as string[] } : {}) };
}
