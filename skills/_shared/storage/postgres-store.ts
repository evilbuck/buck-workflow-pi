import { createHash, randomUUID } from "node:crypto";
import type { MigrationClient, MigrationPool } from "../../../extensions/sql-memory/migrations.js";
import type { ArtifactKey, ArtifactQuery, ArtifactRevision, CheckpointSeal, LifecycleTransition, RunReceipt, ScopedCorrection, StorageStore } from "./contract.js";
import { cloneRevision, keyId, validateRevision, visible } from "./adapter-utils.js";
import { applyMigrations } from "../../../extensions/sql-memory/migrations.js";

type Row = Record<string, unknown> & {
  project_id: string; subject_id: string; kind: string; logical_name: string; branch_id: string;
  worktree_id: string; run_id: string; revision: string; bytes: Buffer; sha256: string;
  author: string; source: string; created_at: Date | string; links: ArtifactKey[] | string;
};

export class PostgresStorageStore implements StorageStore {
  readonly #pool: MigrationPool;
  constructor(pool: MigrationPool) { this.#pool = pool; }

  async migrate(): Promise<void> { await applyMigrations(this.#pool); }

  async read(key: ArtifactKey, revision?: string): Promise<ArtifactRevision | null> {
    const values = this.#keyValues(key);
    const sql = `SELECT r.* FROM artifact_revisions r ${revision === undefined ? "JOIN artifact_pointers p USING(project_id,subject_id,kind,logical_name,branch_id,worktree_id,run_id,revision)" : ""} WHERE project_id=$1 AND subject_id=$2 AND kind=$3 AND logical_name=$4 AND branch_id=$5 AND worktree_id=$6 AND run_id=$7 ${revision === undefined ? "" : "AND revision=$8"}`;
    const result = await this.#pool.query(sql, revision === undefined ? values : [...values, revision]);
    return result.rows[0] ? this.#decode(result.rows[0] as Row) : null;
  }

  async list(query: ArtifactQuery): Promise<readonly ArtifactRevision[]> {
    const result = await this.#pool.query("SELECT r.* FROM artifact_revisions r JOIN artifact_pointers p USING(project_id,subject_id,kind,logical_name,branch_id,worktree_id,run_id,revision) WHERE r.project_id=$1 ORDER BY r.created_at,r.revision", [query.projectId]);
    const visibleRows = result.rows.map((row) => this.#decode(row as Row)).filter((item) => (query.subjectId === undefined || item.key.subjectId === query.subjectId)
      && (query.kind === undefined || item.key.kind === query.kind)
      && (query.logicalNamePrefix === undefined || item.key.logicalName.startsWith(query.logicalNamePrefix)) && visible(item, query));
    return query.limit === undefined ? visibleRows : visibleRows.slice(0, query.limit);
  }

  async search(query: ArtifactQuery & { text: string }): Promise<readonly ArtifactRevision[]> {
    const words = query.text.toLocaleLowerCase().split(/\s+/u).filter(Boolean);
    const ranked = (await this.list({ ...query, limit: undefined, cursor: undefined })).map((item) => {
      const text = new TextDecoder().decode(item.bytes).toLocaleLowerCase();
      return { item, score: words.reduce((score, word) => score + Number(text.includes(word)), 0) };
    }).filter((row) => row.score > 0).sort((a, b) => b.score - a.score || a.item.key.logicalName.localeCompare(b.item.key.logicalName));
    return ranked.slice(0, query.limit).map((row) => row.item);
  }

  async writeBatch(revisions: readonly ArtifactRevision[]): Promise<readonly ArtifactRevision[]> {
    const client = await this.#pool.connect();
    try {
      await client.query("BEGIN");
      const lockKeys = [...new Set(revisions.map((revision) => keyId(revision.key)))].sort();
      for (const key of lockKeys) await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [key]);
      for (const revision of revisions) {
        validateRevision(revision);
        const ids = this.#keyValues(revision.key);
        const pointer = await client.query("SELECT revision FROM artifact_pointers WHERE project_id=$1 AND subject_id=$2 AND kind=$3 AND logical_name=$4 AND branch_id=$5 AND worktree_id=$6 AND run_id=$7 FOR UPDATE", ids);
        const current = (pointer.rows[0] as { revision: string } | undefined)?.revision ?? null;
        if (revision.expectedRevision !== undefined && revision.expectedRevision !== current) throw new Error(`stale revision rejected for ${revision.key.logicalName}`);
        await client.query("INSERT INTO artifact_revisions(project_id,subject_id,kind,logical_name,branch_id,worktree_id,run_id,revision,bytes,sha256,author,source,created_at,links) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)", [...ids, revision.revision, Buffer.from(revision.bytes), revision.sha256, revision.author, revision.source, revision.createdAt, JSON.stringify(revision.links)]);
        await client.query("INSERT INTO artifact_pointers(project_id,subject_id,kind,logical_name,branch_id,worktree_id,run_id,revision) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(project_id,subject_id,kind,logical_name,branch_id,worktree_id,run_id) DO UPDATE SET revision=EXCLUDED.revision", [...ids, revision.revision]);
      }
      await client.query("COMMIT");
      return revisions.map(cloneRevision);
    } catch (error) {
      await this.#rollback(client);
      throw error;
    } finally { client.release(); }
  }

  async correct(correction: ScopedCorrection): Promise<ArtifactRevision | null> {
    const client = await this.#pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [keyId(correction.key)]);
      const ids = this.#keyValues(correction.key);
      const pointer = await client.query("SELECT revision FROM artifact_pointers WHERE project_id=$1 AND subject_id=$2 AND kind=$3 AND logical_name=$4 AND branch_id=$5 AND worktree_id=$6 AND run_id=$7 FOR UPDATE", ids);
      if ((pointer.rows[0] as { revision: string } | undefined)?.revision !== correction.predecessorRevision) throw new Error("stale correction rejected");
      if (!correction.replacement) {
        await client.query("DELETE FROM artifact_pointers WHERE project_id=$1 AND subject_id=$2 AND kind=$3 AND logical_name=$4 AND branch_id=$5 AND worktree_id=$6 AND run_id=$7", ids);
        await client.query("COMMIT");
        return null;
      }
      const item = correction.replacement;
      validateRevision(item);
      if (keyId(item.key) !== keyId(correction.key)) throw new Error("correction cannot change artifact scope");
      await client.query("INSERT INTO artifact_revisions(project_id,subject_id,kind,logical_name,branch_id,worktree_id,run_id,revision,bytes,sha256,author,source,created_at,links) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)", [...ids, item.revision, Buffer.from(item.bytes), item.sha256, item.author, item.source, item.createdAt, JSON.stringify(item.links)]);
      await client.query("UPDATE artifact_pointers SET revision=$8 WHERE project_id=$1 AND subject_id=$2 AND kind=$3 AND logical_name=$4 AND branch_id=$5 AND worktree_id=$6 AND run_id=$7", [...ids, item.revision]);
      await client.query("COMMIT");
      return cloneRevision(item);
    } catch (error) { await this.#rollback(client); throw error; }
    finally { client.release(); }
  }

  async transition(input: LifecycleTransition): Promise<string> {
    const client = await this.#pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query("SELECT revision,state FROM artifact_lifecycle WHERE subject_id=$1 FOR UPDATE", [input.subjectId]);
      const current = result.rows[0] as { revision: string; state: string } | undefined;
      if (current && (current.revision !== input.fromRevision || current.state !== input.expectedState)) throw new Error("stale lifecycle transition refused");
      if (!current && input.expectedState !== "active") throw new Error("initial lifecycle state must be active");
      if (input.nextState === "completed" && input.evidence.length === 0) throw new Error("completion requires evidence");
      const revision = randomUUID();
      await client.query("INSERT INTO artifact_lifecycle(subject_id,revision,state,evidence) VALUES($1,$2,$3,$4::jsonb) ON CONFLICT(subject_id) DO UPDATE SET revision=EXCLUDED.revision,state=EXCLUDED.state,evidence=EXCLUDED.evidence", [input.subjectId, revision, input.nextState, JSON.stringify(input.evidence)]);
      await client.query("COMMIT");
      return revision;
    } catch (error) { await this.#rollback(client); throw error; }
    finally { client.release(); }
  }

  async writeReceipt(receipt: RunReceipt): Promise<void> {
    const client = await this.#pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query("SELECT attempt_id,status FROM artifact_runs WHERE project_id=$1 AND run_id=$2 FOR UPDATE", [receipt.projectId, receipt.runId]);
      const current = result.rows[0] as { attempt_id: string; status: string } | undefined;
      if (current && (current.attempt_id !== receipt.attemptId || current.status === "complete")) throw new Error("receipt attempt mismatch or already complete");
      if (receipt.status === "complete" && (!current || current.attempt_id !== receipt.attemptId)) throw new Error("complete receipt requires matching attempted receipt");
      await client.query("INSERT INTO artifact_runs(project_id,run_id,branch_id,worktree_id,attempt_id,status,artifact_revisions) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb) ON CONFLICT(project_id,run_id) DO UPDATE SET status=EXCLUDED.status,artifact_revisions=EXCLUDED.artifact_revisions", [receipt.projectId, receipt.runId, receipt.branchId, receipt.worktreeId, receipt.attemptId, receipt.status, JSON.stringify(receipt.artifactRevisions)]);
      await client.query("COMMIT");
    } catch (error) { await this.#rollback(client); throw error; }
    finally { client.release(); }
  }

  async readReceipt(projectId: string, runId: string): Promise<RunReceipt | null> {
    const result = await this.#pool.query("SELECT * FROM artifact_runs WHERE project_id=$1 AND run_id=$2", [projectId, runId]);
    const row = result.rows[0] as { branch_id: string; worktree_id: string; attempt_id: string; status: string; artifact_revisions: string[] } | undefined;
    return row ? { projectId, runId, branchId: row.branch_id, worktreeId: row.worktree_id, attemptId: row.attempt_id, status: row.status as RunReceipt["status"], artifactRevisions: row.artifact_revisions } : null;
  }

  async sealCheckpoint(checkpoint: CheckpointSeal): Promise<string> {
    const id = randomUUID();
    await this.#pool.query("INSERT INTO artifact_checkpoints(id,project_id,branch_id,commit_sha,integration_tip,revision_set) VALUES($1,$2,$3,$4,$5,$6::jsonb)", [id, checkpoint.projectId, checkpoint.branchId, checkpoint.commit, checkpoint.integrationTip, JSON.stringify(checkpoint.revisionSet)]);
    return id;
  }

  async bindCheckpoint(checkpointId: string, commit: string): Promise<void> {
    const result = await this.#pool.query("UPDATE artifact_checkpoints SET bound_commit=$1 WHERE id=$2 AND bound_commit IS NULL", [commit, checkpointId]);
    if (result.rowCount !== 1) throw new Error("unknown or already-bound checkpoint");
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

  async importMemoryRecords(records: readonly MemoryImportRecord[]): Promise<void> {
    const client = await this.#pool.connect();
    try {
      await client.query("BEGIN");
      for (const record of records) {
        const mapped = mapMemoryImport(record);
        const ids = this.#keyValues(mapped.key);
        await client.query("INSERT INTO artifact_revisions(project_id,subject_id,kind,logical_name,branch_id,worktree_id,run_id,revision,bytes,sha256,author,source,created_at,links) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb) ON CONFLICT(project_id,subject_id,kind,logical_name,branch_id,worktree_id,run_id,revision) DO NOTHING", [...ids, mapped.revision, Buffer.from(mapped.bytes), mapped.sha256, mapped.author, mapped.source, mapped.createdAt, JSON.stringify(mapped.links)]);
        await client.query("INSERT INTO artifact_pointers(project_id,subject_id,kind,logical_name,branch_id,worktree_id,run_id,revision) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(project_id,subject_id,kind,logical_name,branch_id,worktree_id,run_id) DO UPDATE SET revision=EXCLUDED.revision", [...ids, mapped.revision]);
        await client.query("INSERT INTO artifact_import_provenance(source_id,destination_revision,source_metadata) VALUES($1,$2,$3::jsonb) ON CONFLICT(source_id) DO UPDATE SET destination_revision=EXCLUDED.destination_revision, source_metadata=EXCLUDED.source_metadata", [record.id, record.id, JSON.stringify(mapped.metadata)]);
      }
      await client.query("COMMIT");
    } catch (error) {
      await this.#rollback(client);
      throw error;
    } finally { client.release(); }
  }

  async readMemoryImport(sourceId: string, projectId: string): Promise<MemoryImportView | null> {
    const result = await this.#pool.query("SELECT p.destination_revision, p.source_metadata, r.bytes FROM artifact_import_provenance p JOIN artifact_revisions r ON r.revision = p.destination_revision AND r.project_id = $2 WHERE p.source_id = $1", [sourceId, projectId]);
    const row = result.rows[0] as { destination_revision: string; source_metadata: MemoryImportView | string; bytes: Buffer } | undefined;
    if (!row) return null;
    const metadata = typeof row.source_metadata === "string" ? JSON.parse(row.source_metadata) as MemoryImportView : row.source_metadata;
    return { destinationRevision: row.destination_revision, category: metadata.category, supersededBy: metadata.supersededBy, ranks: metadata.ranks, body: new TextDecoder().decode(row.bytes) };
  }

  #keyValues(key: ArtifactKey): string[] { return [key.projectId, key.subjectId, key.kind, key.logicalName, key.branchId ?? "", key.worktreeId ?? "", key.runId ?? ""]; }

  #decode(row: Row): ArtifactRevision {
    return { key: { projectId: row.project_id, subjectId: row.subject_id, kind: row.kind as ArtifactKey["kind"], logicalName: row.logical_name, branchId: row.branch_id, ...(row.worktree_id ? { worktreeId: row.worktree_id } : {}), ...(row.run_id ? { runId: row.run_id } : {}) }, revision: row.revision, bytes: new Uint8Array(row.bytes), sha256: row.sha256, author: row.author, source: row.source, createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at, links: typeof row.links === "string" ? JSON.parse(row.links) as ArtifactKey[] : row.links };
  }

  async #rollback(client: MigrationClient): Promise<void> {
    try { await client.query("ROLLBACK"); } catch { /* Preserve the original operation failure. */ }
  }
}

export interface MemoryRank { id: string; rater: string; score: number }
export interface MemoryImportRecord {
  id: string;
  category: string;
  body: string;
  author: string;
  projectId: string;
  branchId: string;
  createdAt: string;
  supersededBy: string | null;
  ranks: readonly MemoryRank[];
}
export interface MemoryImportView {
  destinationRevision: string;
  category: string;
  supersededBy: string | null;
  ranks: readonly MemoryRank[];
  body: string;
}

export function mapMemoryImport(record: MemoryImportRecord): ArtifactRevision & { metadata: Pick<MemoryImportView, "category" | "supersededBy" | "ranks"> } {
  const bytes = new TextEncoder().encode(record.body);
  const key: ArtifactKey = { projectId: record.projectId, subjectId: "legacy-memory", kind: "memory", logicalName: `${record.id}.md`, branchId: record.branchId };
  return {
    key,
    revision: record.id,
    bytes,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    author: record.author,
    source: "memory-import",
    createdAt: record.createdAt,
    links: record.supersededBy === null ? [] : [{ ...key, logicalName: `${record.supersededBy}.md` }],
    expectedRevision: null,
    metadata: { category: record.category, supersededBy: record.supersededBy, ranks: record.ranks },
  };
}
