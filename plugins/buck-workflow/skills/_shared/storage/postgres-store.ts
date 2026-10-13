import { createHash, randomUUID } from "node:crypto";
import type { MigrationClient, MigrationPool } from "./migrations.js";
import type { ArtifactKey, ArtifactQuery, ArtifactRevision, CheckpointSeal, LifecycleRecord, LifecycleTransition, RunReceipt, ScopedCorrection, StorageStore } from "./contract.js";
import { overlayPublishedRevisions } from "./visibility.js";
import { cloneRevision, keyId, searchableText, validateRevision } from "./adapter-utils.js";
import { assertCorrectionPredecessor, assertReceiptComplete, assertReceiptIdentity, assertReceiptReadback, correctionDecision, correctionQuery, inspectStoredLifecycle, lifecycleRevision, receiptRevisionReadable, selectPage, tombstoneRevision, type KeyedPageItem, type StoredCorrection } from "./domain.js";
import { applyMigrations } from "./migrations.js";

type Row = Record<string, unknown> & {
  project_id: string; subject_id: string; kind: string; logical_name: string; branch_id: string;
  worktree_id: string; run_id: string; revision: string; bytes: Buffer; sha256: string;
  author: string; source: string; created_at: Date | string; links: ArtifactKey[] | string;
};

function listParameters(query: ArtifactQuery): unknown[] {
  return [
    query.projectId, query.branchId, query.publishedRevisionIds, query.runId || "", query.worktreeId || "",
    query.subjectId === undefined ? null : query.subjectId,
    query.kind === undefined ? null : query.kind,
    query.logicalNamePrefix === undefined ? null : query.logicalNamePrefix,
  ];
}

const LIST_ARTIFACTS_SQL = `SELECT r.project_id, r.subject_id, r.kind, r.logical_name, r.branch_id, r.worktree_id, r.run_id, r.revision, r.source, r.created_at, COALESCE(s.search_text, '') AS search_text
  FROM artifact_revisions r
  LEFT JOIN artifact_pointers p USING(project_id,subject_id,kind,logical_name,branch_id,worktree_id,run_id,revision)
  LEFT JOIN artifact_search_text s ON s.project_id = r.project_id AND s.revision = r.revision
  WHERE r.project_id=$1
    AND ($6::text IS NULL OR r.subject_id=$6)
    AND ($7::text IS NULL OR r.kind=$7)
    AND ($8::text IS NULL OR left(r.logical_name,length($8))=$8)
    AND (
      (p.branch_id=$2 AND ((p.run_id='' AND (p.worktree_id='' OR p.worktree_id=$5)) OR (p.run_id=$4 AND p.worktree_id=$5 AND $4<>'' AND $5<>'')))
      OR (r.branch_id<>$2 AND r.run_id='' AND r.worktree_id='' AND r.revision=ANY($3::text[]))
    )
  ORDER BY r.created_at,r.revision`;

export class PostgresStorageStore implements StorageStore {
  readonly #pool: MigrationPool;
  constructor(pool: MigrationPool) { this.#pool = pool; }

  async migrate(): Promise<void> { await applyMigrations(this.#pool); }

  async read(key: ArtifactKey, revision?: string): Promise<ArtifactRevision | null> {
    const values = this.#keyValues(key);
    const sql = `SELECT r.* FROM artifact_revisions r ${revision === undefined ? "JOIN artifact_pointers p USING(project_id,subject_id,kind,logical_name,branch_id,worktree_id,run_id,revision)" : ""} WHERE project_id=$1 AND subject_id=$2 AND kind=$3 AND logical_name=$4 AND branch_id=$5 AND worktree_id=$6 AND run_id=$7 ${revision === undefined ? "" : "AND revision=$8"}`;
    const result = await this.#pool.query(sql, revision === undefined ? values : [...values, revision]);
    const row = result.rows[0] as Row | undefined;
    if (!row || (revision === undefined && row.source === "tombstone")) return null;
    return this.#decode(row);
  }

  async list(query: ArtifactQuery): Promise<readonly ArtifactRevision[]> {
    return this.#loadPage(selectPage(await this.#metadata(query), query));
  }

  async search(query: ArtifactQuery & { text: string }): Promise<readonly ArtifactRevision[]> {
    return this.#loadPage(selectPage(await this.#metadata(query), query));
  }

  async writeBatch(revisions: readonly ArtifactRevision[]): Promise<readonly ArtifactRevision[]> {
    const client = await this.#pool.connect();
    try {
      await client.query("BEGIN");
      await this.#lockSubjects(client, revisions.map((item) => item.key));
      const lockKeys = [...new Set(revisions.map((revision) => keyId(revision.key)))].sort();
      for (const key of lockKeys) await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [key]);
      for (const revision of revisions) await this.#insertRevision(client, revision);
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
      await this.#lockSubjects(client, [correction.key]);
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [keyId(correction.key)]);
      const result = await this.#correctLocked(client, correction);
      await client.query("COMMIT");
      return result;
    } catch (error) { await this.#rollback(client); throw error; }
    finally { client.release(); }
  }

  async transition(input: LifecycleTransition): Promise<string> {
    const client = await this.#pool.connect();
    try {
      await client.query("BEGIN");
      await this.#lockSubjects(client, [{ projectId: input.projectId, subjectId: input.subjectId, branchId: input.branchId, kind: "subject-index", logicalName: "index.md" }]);
      const item = lifecycleRevision(await this.#evidenceBodies(client, input), input);
      await this.#insertRevision(client, item);
      await client.query("COMMIT");
      return item.revision;
    } catch (error) { await this.#rollback(client); throw error; }
    finally { client.release(); }
  }

  async inspectLifecycle(projectId: string, branchId: string, subjectId: string, publishedRevisionIds: readonly string[] = []): Promise<LifecycleRecord | null> {
    return inspectStoredLifecycle(await this.list({ projectId, branchId, subjectId, publishedRevisionIds }), projectId, branchId, subjectId);
  }

  async writeReceipt(receipt: RunReceipt): Promise<void> {
    const client = await this.#pool.connect();
    try {
      await client.query("BEGIN");
      await this.#persistReceipt(client, receipt);
      await client.query("COMMIT");
    } catch (error) { await this.#rollback(client); throw error; }
    finally { client.release(); }
  }

  async #persistReceipt(client: MigrationClient, receipt: RunReceipt): Promise<void> {
    const current = await this.#lockedAttempt(client, receipt);
    assertReceiptIdentity(current, receipt);
    assertReceiptComplete(current, receipt, await this.#readableRevisions(client, receipt));
    await this.#insertReceipt(client, receipt);
    const stored = await client.query("SELECT status,attempt_id,branch_id FROM artifact_runs WHERE project_id=$1 AND run_id=$2", [receipt.projectId, receipt.runId]);
    const row = stored.rows[0] as { status: RunReceipt["status"]; attempt_id: string; branch_id: string };
    assertReceiptReadback({ status: row.status, attemptId: row.attempt_id, branchId: row.branch_id }, receipt);
  }

  async #lockedAttempt(client: MigrationClient, receipt: RunReceipt): Promise<RunReceipt | null> {
    // An absent row cannot be locked by FOR UPDATE. Serialize initialization
    // and updates by the receipt's unique project/run identity through commit.
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [JSON.stringify(["receipt", receipt.projectId, receipt.runId])]);
    const result = await client.query("SELECT r.branch_id,r.worktree_id,r.attempt_id,r.status,r.artifact_revisions,d.receipt_kind,d.metadata_duties FROM artifact_runs r LEFT JOIN artifact_run_duties d USING(project_id,run_id) WHERE r.project_id=$1 AND r.run_id=$2 FOR UPDATE OF r", [receipt.projectId, receipt.runId]);
    return decodeReceipt(result.rows[0] as ReceiptRow | undefined, receipt.projectId, receipt.runId);
  }

  async #insertReceipt(client: MigrationClient, receipt: RunReceipt): Promise<void> {
    await client.query("INSERT INTO artifact_runs(project_id,run_id,branch_id,worktree_id,attempt_id,status,artifact_revisions) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb) ON CONFLICT(project_id,run_id) DO UPDATE SET status=EXCLUDED.status,artifact_revisions=EXCLUDED.artifact_revisions", [receipt.projectId, receipt.runId, receipt.branchId, receipt.worktreeId, receipt.attemptId, receipt.status, JSON.stringify(receipt.artifactRevisions)]);
    await client.query("INSERT INTO artifact_run_duties(project_id,run_id,receipt_kind,metadata_duties) VALUES($1,$2,$3,$4::jsonb) ON CONFLICT(project_id,run_id) DO UPDATE SET receipt_kind=EXCLUDED.receipt_kind,metadata_duties=EXCLUDED.metadata_duties", [receipt.projectId, receipt.runId, receipt.kind ?? "rows", JSON.stringify(receipt.metadataDuties ?? [])]);
  }

  async readReceipt(projectId: string, runId: string): Promise<RunReceipt | null> {
    const result = await this.#pool.query("SELECT r.branch_id,r.worktree_id,r.attempt_id,r.status,r.artifact_revisions,d.receipt_kind,d.metadata_duties FROM artifact_runs r LEFT JOIN artifact_run_duties d USING(project_id,run_id) WHERE r.project_id=$1 AND r.run_id=$2", [projectId, runId]);
    return decodeReceipt(result.rows[0] as ReceiptRow | undefined, projectId, runId);
  }

  async #metadata(query: ArtifactQuery, client: Pick<MigrationClient, "query"> = this.#pool): Promise<KeyedPageItem[]> {
    const result = await client.query(LIST_ARTIFACTS_SQL, listParameters(query));
    return overlayPublishedRevisions(result.rows.map((row) => this.#pageItem(row as Row)), query.branchId);
  }

  #pageItem(row: Row): KeyedPageItem {
    return { key: { projectId: row.project_id, subjectId: row.subject_id, kind: row.kind as ArtifactKey["kind"], logicalName: row.logical_name, branchId: row.branch_id, ...(row.worktree_id ? { worktreeId: row.worktree_id } : {}), ...(row.run_id ? { runId: row.run_id } : {}) }, revision: row.revision, createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at), logicalName: row.logical_name, source: row.source, searchText: String(row.search_text ?? "") };
  }

  async #loadPage(page: readonly KeyedPageItem[]): Promise<ArtifactRevision[]> {
    const loaded: ArtifactRevision[] = [];
    for (const item of page) {
      const revision = await this.read(item.key, item.revision);
      if (!revision) throw new Error("uncertain persistence blocks save");
      loaded.push(revision);
    }
    return loaded;
  }

  async #insertRevision(client: MigrationClient, revision: ArtifactRevision): Promise<void> {
    validateRevision(revision);
    const ids = this.#keyValues(revision.key);
    const pointer = await client.query("SELECT revision FROM artifact_pointers WHERE project_id=$1 AND subject_id=$2 AND kind=$3 AND logical_name=$4 AND branch_id=$5 AND worktree_id=$6 AND run_id=$7 FOR UPDATE", ids);
    const current = (pointer.rows[0] as { revision: string } | undefined)?.revision ?? null;
    if (revision.expectedRevision !== undefined && revision.expectedRevision !== current) throw new Error(`stale revision rejected for ${revision.key.logicalName}`);
    await client.query("INSERT INTO artifact_revisions(project_id,subject_id,kind,logical_name,branch_id,worktree_id,run_id,revision,bytes,sha256,author,source,created_at,links) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)", [...ids, revision.revision, Buffer.from(revision.bytes), revision.sha256, revision.author, revision.source, revision.createdAt, JSON.stringify(revision.links)]);
    await client.query("INSERT INTO artifact_search_text(project_id,revision,search_text) VALUES($1,$2,$3)", [revision.key.projectId, revision.revision, searchableText(revision.bytes)]);
    await client.query("INSERT INTO artifact_pointers(project_id,subject_id,kind,logical_name,branch_id,worktree_id,run_id,revision) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(project_id,subject_id,kind,logical_name,branch_id,worktree_id,run_id) DO UPDATE SET revision=EXCLUDED.revision", [...ids, revision.revision]);
  }

  async #correctLocked(client: MigrationClient, correction: ScopedCorrection): Promise<ArtifactRevision | null> {
    const query = correctionQuery(correction);
    const existing = await client.query("SELECT predecessor_revision,result_revision,replacement_sha256 FROM artifact_corrections WHERE project_id=$1 AND branch_id=$2 AND artifact_key=$3 AND idempotency_key=$4", [query.projectId, query.branchId, keyId(correction.key), correction.idempotencyKey]);
    const row = existing.rows[0] as { predecessor_revision: string; result_revision: string | null; replacement_sha256: string | null } | undefined;
    const stored: StoredCorrection | null = row ? { predecessorRevision: row.predecessor_revision, resultRevision: row.result_revision, replacementSha256: row.replacement_sha256 } : null;
    if (correctionDecision(stored, correction) === "replay") return stored?.resultRevision ? this.#readStored(correction.key, stored.resultRevision) : null;
    const expected = assertCorrectionPredecessor(await this.#metadata(query, client), correction);
    const item = { ...(correction.replacement ?? tombstoneRevision(correction.key, correction.predecessorRevision)), expectedRevision: expected };
    await this.#insertRevision(client, item);
    await client.query("INSERT INTO artifact_corrections(project_id,branch_id,artifact_key,idempotency_key,predecessor_revision,result_revision,replacement_sha256) VALUES($1,$2,$3,$4,$5,$6,$7)", [query.projectId, query.branchId, keyId(correction.key), correction.idempotencyKey, correction.predecessorRevision, correction.replacement ? item.revision : null, correction.replacement?.sha256 ?? null]);
    return correction.replacement ? cloneRevision(item) : null;
  }

  async #readStored(key: ArtifactKey, revision: string): Promise<ArtifactRevision> {
    const result = await this.#pool.query("SELECT * FROM artifact_revisions WHERE project_id=$1 AND subject_id=$2 AND kind=$3 AND logical_name=$4 AND branch_id=$5 AND worktree_id=$6 AND run_id=$7 AND revision=$8", [...this.#keyValues(key), revision]);
    const row = result.rows[0] as Row | undefined;
    if (!row) throw new Error("uncertain persistence blocks save");
    return this.#decode(row);
  }

  async #evidenceBodies(client: MigrationClient, input: LifecycleTransition): Promise<ArtifactRevision[]> {
    const query: ArtifactQuery = { projectId: input.projectId, branchId: input.branchId, subjectId: input.subjectId, publishedRevisionIds: input.publishedRevisionIds ?? [] };
    const bodies = [];
    for (const item of selectPage(await this.#metadata(query, client), {})) {
      const result = await client.query("SELECT * FROM artifact_revisions WHERE project_id=$1 AND revision=$2 AND branch_id=$3", [item.key.projectId, item.revision, item.key.branchId ?? ""]);
      const row = result.rows[0] as Row | undefined;
      if (!row) throw new Error("uncertain persistence blocks save");
      bodies.push(this.#decode(row));
    }
    return bodies;
  }

  async #readableRevisions(client: MigrationClient, receipt: RunReceipt): Promise<Set<string>> {
    if (receipt.artifactRevisions.length === 0) return new Set();
    const result = await client.query("SELECT * FROM artifact_revisions WHERE project_id=$1 AND branch_id=$2 AND revision = ANY($3::text[])", [receipt.projectId, receipt.branchId, receipt.artifactRevisions]);
    return new Set(result.rows.map((row) => this.#decode(row as Row)).filter((item) => receiptRevisionReadable(item, receipt)).map((item) => item.revision));
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

  async #lockSubjects(client: MigrationClient, keys: readonly ArtifactKey[]): Promise<void> {
    // Writers and lifecycle intents serialize before selecting current evidence,
    // including initialization when no pointer or lifecycle row exists yet.
    const locks = [...new Set(keys.map((key) => JSON.stringify(["subject", key.projectId, key.subjectId])))].sort();
    for (const lock of locks) await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [lock]);
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

type ReceiptRow = { branch_id: string; worktree_id: string; attempt_id: string; status: RunReceipt["status"]; artifact_revisions: string[] | string; receipt_kind: RunReceipt["kind"] | null; metadata_duties: string[] | string | null };

function decodeReceipt(row: ReceiptRow | undefined, projectId: string, runId: string): RunReceipt | null {
  if (!row) return null;
  const duties = row.metadata_duties == null ? undefined : typeof row.metadata_duties === "string" ? JSON.parse(row.metadata_duties) as string[] : row.metadata_duties;
  return { projectId, runId, branchId: row.branch_id, worktreeId: row.worktree_id, attemptId: row.attempt_id, status: row.status, artifactRevisions: typeof row.artifact_revisions === "string" ? JSON.parse(row.artifact_revisions) as string[] : row.artifact_revisions, ...(row.receipt_kind ? { kind: row.receipt_kind, metadataDuties: duties } : {}) };
}
