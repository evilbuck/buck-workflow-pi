import { randomUUID } from "node:crypto";
import { dirname } from "node:path";
import { mkdir } from "node:fs/promises";
import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import type { ArtifactKey, ArtifactQuery, ArtifactRevision, CheckpointSeal, LifecycleTransition, RunReceipt, ScopedCorrection, StorageStore } from "./contract.js";
import { cloneRevision, keyId, validateRevision, visible } from "./adapter-utils.js";
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
CREATE INDEX IF NOT EXISTS artifact_revisions_project_kind ON artifact_revisions(project_id, kind, created_at);
CREATE INDEX IF NOT EXISTS artifact_revisions_branch ON artifact_revisions(project_id, branch_id, created_at);`;

type Row = Record<string, unknown>;

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

  close(): void { this.#database.close(); }

  async backup(destination: string): Promise<void> {
    if (destination.includes("'") || destination.includes("\0")) throw new Error("invalid SQLite backup path");
    await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
    this.#database.exec(`VACUUM INTO '${destination}'`);
  }

  async read(key: ArtifactKey, revision?: string): Promise<ArtifactRevision | null> {
    const ids = this.#keyValues(key);
    const row = this.#database.prepare(`SELECT r.* FROM artifact_revisions r ${revision === undefined ? "JOIN artifact_pointers p USING(project_id,subject_id,kind,logical_name,branch_id,worktree_id,run_id,revision)" : ""} WHERE project_id=? AND subject_id=? AND kind=? AND logical_name=? AND branch_id=? AND worktree_id=? AND run_id=? ${revision === undefined ? "" : "AND revision=?"}`).get(...ids, ...(revision === undefined ? [] : [revision])) as Row | undefined;
    return row ? this.#decode(row) : null;
  }

  async list(query: ArtifactQuery): Promise<readonly ArtifactRevision[]> {
    const rows = this.#database.prepare("SELECT r.* FROM artifact_revisions r JOIN artifact_pointers p USING(project_id,subject_id,kind,logical_name,branch_id,worktree_id,run_id,revision) WHERE r.project_id=? ORDER BY r.created_at, r.revision").all(query.projectId) as Row[];
    const candidates = rows.map((row) => this.#decode(row)).filter((item) => (query.subjectId === undefined || item.key.subjectId === query.subjectId)
      && (query.kind === undefined || item.key.kind === query.kind)
      && (query.logicalNamePrefix === undefined || item.key.logicalName.startsWith(query.logicalNamePrefix)) && visible(item, query));
    return query.limit === undefined ? candidates : candidates.slice(0, query.limit);
  }

  async search(query: ArtifactQuery & { text: string }): Promise<readonly ArtifactRevision[]> {
    const words = query.text.toLocaleLowerCase().split(/\s+/u).filter(Boolean);
    const scored = (await this.list({ ...query, limit: undefined, cursor: undefined })).map((item) => {
      const text = new TextDecoder().decode(item.bytes).toLocaleLowerCase();
      return { item, score: words.reduce((score, word) => score + Number(text.includes(word)), 0) };
    }).filter((row) => row.score > 0).sort((a, b) => b.score - a.score || a.item.key.logicalName.localeCompare(b.item.key.logicalName));
    return scored.slice(0, query.limit).map((row) => row.item);
  }

  async writeBatch(revisions: readonly ArtifactRevision[]): Promise<readonly ArtifactRevision[]> {
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      for (const revision of revisions) {
        validateRevision(revision);
        const ids = this.#keyValues(revision.key);
        const pointer = this.#database.prepare("SELECT revision FROM artifact_pointers WHERE project_id=? AND subject_id=? AND kind=? AND logical_name=? AND branch_id=? AND worktree_id=? AND run_id=?").get(...ids) as { revision: string } | undefined;
        if (revision.expectedRevision !== undefined && revision.expectedRevision !== (pointer?.revision ?? null)) throw new Error(`stale revision rejected for ${revision.key.logicalName}`);
        this.#database.prepare("INSERT INTO artifact_revisions VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(...ids, revision.revision, revision.bytes, revision.sha256, revision.author, revision.source, revision.createdAt, JSON.stringify(revision.links));
        this.#database.prepare("INSERT INTO artifact_pointers VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(project_id,subject_id,kind,logical_name,branch_id,worktree_id,run_id) DO UPDATE SET revision=excluded.revision").run(...ids, revision.revision);
      }
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
      const keyValues = this.#keyValues(correction.key);
      const pointer = this.#database.prepare("SELECT revision FROM artifact_pointers WHERE project_id=? AND subject_id=? AND kind=? AND logical_name=? AND branch_id=? AND worktree_id=? AND run_id=?").get(...keyValues) as { revision: string } | undefined;
      if (pointer?.revision !== correction.predecessorRevision) throw new Error("stale correction rejected");
      if (!correction.replacement) {
        this.#database.prepare("DELETE FROM artifact_pointers WHERE project_id=? AND subject_id=? AND kind=? AND logical_name=? AND branch_id=? AND worktree_id=? AND run_id=?").run(...keyValues);
        this.#database.exec("COMMIT");
        return null;
      }
      const item = correction.replacement;
      validateRevision(item);
      if (keyId(item.key) !== keyId(correction.key)) throw new Error("correction cannot change artifact scope");
      const ids = this.#keyValues(item.key);
      this.#database.prepare("INSERT INTO artifact_revisions VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(...ids, item.revision, item.bytes, item.sha256, item.author, item.source, item.createdAt, JSON.stringify(item.links));
      this.#database.prepare("UPDATE artifact_pointers SET revision=? WHERE project_id=? AND subject_id=? AND kind=? AND logical_name=? AND branch_id=? AND worktree_id=? AND run_id=?").run(item.revision, ...ids);
      this.#database.exec("COMMIT");
      return cloneRevision(item);
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  async transition(input: LifecycleTransition): Promise<string> {
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const current = this.#database.prepare("SELECT revision,state FROM artifact_lifecycle WHERE subject_id=?").get(input.subjectId) as { revision: string; state: string } | undefined;
      if (current && (current.revision !== input.fromRevision || current.state !== input.expectedState)) throw new Error("stale lifecycle transition refused");
      if (!current && input.expectedState !== "active") throw new Error("initial lifecycle state must be active");
      if (input.nextState === "completed" && input.evidence.length === 0) throw new Error("completion requires evidence");
      const revision = randomUUID();
      this.#database.prepare("INSERT INTO artifact_lifecycle VALUES (?,?,?,?) ON CONFLICT(subject_id) DO UPDATE SET revision=excluded.revision,state=excluded.state,evidence=excluded.evidence").run(input.subjectId, revision, input.nextState, JSON.stringify(input.evidence));
      this.#database.exec("COMMIT");
      return revision;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  async writeReceipt(receipt: RunReceipt): Promise<void> {
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const current = this.#database.prepare("SELECT attempt_id,status FROM artifact_runs WHERE project_id=? AND run_id=?").get(receipt.projectId, receipt.runId) as { attempt_id: string; status: string } | undefined;
      if (current && (current.attempt_id !== receipt.attemptId || current.status === "complete")) throw new Error("receipt attempt mismatch or already complete");
      if (receipt.status === "complete" && (!current || current.attempt_id !== receipt.attemptId)) throw new Error("complete receipt requires matching attempted receipt");
      this.#database.prepare("INSERT INTO artifact_runs VALUES (?,?,?,?,?,?,?) ON CONFLICT(project_id,run_id) DO UPDATE SET status=excluded.status,artifact_revisions=excluded.artifact_revisions").run(receipt.projectId, receipt.runId, receipt.branchId, receipt.worktreeId, receipt.attemptId, receipt.status, JSON.stringify(receipt.artifactRevisions));
      this.#database.exec("COMMIT");
    } catch (error) { this.#database.exec("ROLLBACK"); throw error; }
  }

  async readReceipt(projectId: string, runId: string): Promise<RunReceipt | null> {
    const row = this.#database.prepare("SELECT * FROM artifact_runs WHERE project_id=? AND run_id=?").get(projectId, runId) as Row | undefined;
    return row ? { projectId, runId, branchId: String(row.branch_id), worktreeId: String(row.worktree_id), attemptId: String(row.attempt_id), status: String(row.status) as RunReceipt["status"], artifactRevisions: JSON.parse(String(row.artifact_revisions)) as string[] } : null;
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
