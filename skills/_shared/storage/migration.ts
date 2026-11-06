import { validateArtifactKey } from "./identity.js";
import { createHash } from "node:crypto";
import { keyId, validateRevision } from "./adapter-utils.js";
import type { ArtifactKey, ArtifactRevision } from "./contract.js";

export const MIGRATION_TABLES = {
  artifact_revisions: "project_id subject_id kind logical_name branch_id worktree_id run_id revision bytes sha256 author source created_at links",
  artifact_pointers: "project_id subject_id kind logical_name branch_id worktree_id run_id revision",
  artifact_lifecycle: "subject_id revision state evidence",
  artifact_runs: "project_id run_id branch_id worktree_id attempt_id status artifact_revisions",
  artifact_checkpoints: "id project_id branch_id commit_sha integration_tip revision_set bound_commit",
  artifact_publications: "id checkpoint_id integration_tip revision_set created_at",
  artifact_attachments: "project_id sha256 bytes",
  artifact_import_provenance: "source_id destination_revision source_metadata imported_at",
  artifact_lifecycle_scope: "project_id branch_id subject_id revision state evidence provenance",
  artifact_corrections: "project_id branch_id artifact_key idempotency_key predecessor_revision result_revision replacement_sha256",
  artifact_search_text: "project_id revision search_text",
  artifact_run_duties: "project_id run_id receipt_kind metadata_duties",
} as const;
export type MigrationTable = keyof typeof MIGRATION_TABLES;
export type MigrationRow = Record<string, unknown>;
export interface MigrationSnapshot {
  version: 1;
  projectId: string;
  tables: Record<MigrationTable, MigrationRow[]>;
}
const JSON_COLUMNS: Record<string, true> = { links: true, evidence: true, artifact_revisions: true, revision_set: true, source_metadata: true, metadata_duties: true };
export function emptySnapshot(projectId: string): MigrationSnapshot {
  return { version: 1, projectId, tables: Object.fromEntries<MigrationRow[]>(Object.keys(MIGRATION_TABLES).map(table => [table, []])) as MigrationSnapshot["tables"] };
}
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value !== null && typeof value === "object") return "{" + Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => JSON.stringify(k) + ":" + canonical(v)).join(",") + "}";
  return JSON.stringify(value);
}
export function digest(value: unknown): string { return createHash("sha256").update(canonical(value)).digest("hex"); }
export function normalizeRow(row: MigrationRow): MigrationRow {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => {
    if (key === "bytes") return [key, Buffer.from(value as Uint8Array).toString("base64")];
    if (JSON_COLUMNS[key] && typeof value === "string") return [key, JSON.parse(value)];
    return [key, value instanceof Date ? value.toISOString() : value];
  }));
}
export function sqlValues(table: MigrationTable, row: MigrationRow): unknown[] {
  return MIGRATION_TABLES[table].split(" ").map(key => key === "bytes" ? Buffer.from(String(row[key]), "base64") : JSON_COLUMNS[key] ? JSON.stringify(row[key]) : row[key]);
}
export function rowKey(row: MigrationRow): ArtifactKey {
  return { projectId: String(row.project_id), subjectId: String(row.subject_id), kind: row.kind as ArtifactKey["kind"], logicalName: String(row.logical_name), ...(row.branch_id ? { branchId: String(row.branch_id) } : {}), ...(row.worktree_id ? { worktreeId: String(row.worktree_id) } : {}), ...(row.run_id ? { runId: String(row.run_id) } : {}) };
}
export function revisionRow(item: ArtifactRevision): MigrationRow {
  return { project_id: item.key.projectId, subject_id: item.key.subjectId, kind: item.key.kind, logical_name: item.key.logicalName, branch_id: item.key.branchId ?? "", worktree_id: item.key.worktreeId ?? "", run_id: item.key.runId ?? "", revision: item.revision, bytes: Buffer.from(item.bytes).toString("base64"), sha256: item.sha256, author: item.author, source: item.source, created_at: item.createdAt, links: item.links };
}
export function rowRevision(row: MigrationRow): ArtifactRevision {
  return { key: rowKey(row), revision: String(row.revision), bytes: Buffer.from(String(row.bytes), "base64"), sha256: String(row.sha256), author: String(row.author), source: String(row.source), createdAt: String(row.created_at), links: row.links as ArtifactKey[] };
}
/** Select only records owned by this project, with dependency rows selected by exact IDs. */
export function scopeSnapshot(snapshot: MigrationSnapshot): MigrationSnapshot {
  const result = emptySnapshot(snapshot.projectId);
  for (const table of Object.keys(MIGRATION_TABLES) as MigrationTable[]) result.tables[table] = snapshot.tables[table].filter(row => row.project_id === snapshot.projectId).map(normalizeTimestamps);
  const revisions = new Set(result.tables.artifact_revisions.map(row => row.revision));
  const checkpoints = new Set(result.tables.artifact_checkpoints.map(row => row.id));
  const subjects = new Set(result.tables.artifact_revisions.map(row => row.subject_id));
  result.tables.artifact_lifecycle = snapshot.tables.artifact_lifecycle.filter(row => subjects.has(row.subject_id) && revisions.has(row.revision));
  result.tables.artifact_publications = snapshot.tables.artifact_publications.filter(row => checkpoints.has(row.checkpoint_id)).map(normalizeTimestamps);
  result.tables.artifact_import_provenance = snapshot.tables.artifact_import_provenance.filter(row => revisions.has(row.destination_revision)).map(normalizeTimestamps);
  for (const rows of Object.values(result.tables)) rows.sort((a, b) => canonical(a).localeCompare(canonical(b)));
  return result;
}
export function validateSnapshot(snapshot: MigrationSnapshot): void {
  validateSnapshotShape(snapshot);
  validateSnapshotRevisions(snapshot);
}

function validateSnapshotShape(snapshot: MigrationSnapshot): void {
  if (snapshot.version !== 1 || !snapshot.projectId) throw new Error("Unsupported migration snapshot");
  for (const table of Object.keys(MIGRATION_TABLES) as MigrationTable[]) {
    if (!Array.isArray(snapshot.tables[table])) throw new Error(`Missing migration table ${table}`);
    const columns = MIGRATION_TABLES[table].split(" ").sort().join(" ");
    for (const row of snapshot.tables[table]) if (Object.keys(row).sort().join(" ") !== columns) throw new Error(`Invalid migration columns: ${table}`);
  }
  if (digest(scopeSnapshot(snapshot)) !== digest(snapshot)) throw new Error("Snapshot contains unscoped or unsorted records");
}

function validateSnapshotRevisions(snapshot: MigrationSnapshot): void {
  const revisions = new Map<string, MigrationRow>();
  for (const row of snapshot.tables.artifact_revisions) {
    const item = rowRevision(row);
    validateRevision(item);
    validateArtifactKey(item.key);
    for (const link of item.links) validateArtifactKey(link);
    const id = `${keyId(item.key)}\0${item.revision}`;
    if (revisions.has(id)) throw new Error("Duplicate migration revision");
    revisions.set(id, row);
  }
  for (const row of snapshot.tables.artifact_pointers) if (!revisions.has(`${keyId(rowKey(row))}\0${row.revision}`)) throw new Error("Migration pointer has no revision");
  for (const row of snapshot.tables.artifact_attachments) if (createHash("sha256").update(Buffer.from(String(row.bytes), "base64")).digest("hex") !== row.sha256) throw new Error("Migration attachment hash mismatch");
}

export interface MigrationStore {
  migrationSnapshot(projectId: string): Promise<MigrationSnapshot>;
  /** Atomic, empty-project-only install; exact replay is a no-op. */
  installSnapshot(snapshot: MigrationSnapshot): Promise<void>;
}
export function assertEmptyOrReplay(current: MigrationSnapshot, incoming: MigrationSnapshot): boolean {
  if (digest(current) === digest(incoming)) return true;
  if (Object.values(current.tables).some(rows => rows.length)) throw new Error("Migration destination is not empty or exact replay");
  return false;
}

/** Legacy rows cannot attest branch/publication identity. Retain original metadata without ordinary pointers. */
export function legacySnapshot(projectId: string, records: readonly Record<string, unknown>[]): MigrationSnapshot {
  const snapshot = emptySnapshot(projectId);
  for (const record of records) {
    if (typeof record.id !== "string" || !record.id || typeof record.body !== "string") throw new Error("Legacy row requires its original id and body");
    const bytes = Buffer.from(record.body);
    const key: ArtifactKey = { projectId, branchId: "legacy-quarantine", subjectId: "legacy-memory", kind: "memory", logicalName: `${record.id}.md`, worktreeId: "worktree-00000000-0000-0000-0000-000000000000", runId: "run-00000000-0000-0000-0000-000000000000" };
    const createdAt = typeof record.createdAt === "string" ? record.createdAt : "1970-01-01T00:00:00.000Z";
    const item: ArtifactRevision = { key, revision: record.id, bytes, sha256: createHash("sha256").update(bytes).digest("hex"), author: typeof record.author === "string" ? record.author : "legacy-import", source: "legacy-quarantine", createdAt, links: typeof record.supersededBy === "string" ? [{ ...key, logicalName: `${record.supersededBy}.md` }] : [] };
    snapshot.tables.artifact_revisions.push(revisionRow(item));
    snapshot.tables.artifact_search_text.push({ project_id: projectId, revision: record.id, search_text: new TextDecoder().decode(bytes).toLocaleLowerCase().replace(/\0/g, "") });
    snapshot.tables.artifact_import_provenance.push({ source_id: record.id, destination_revision: record.id, source_metadata: { ...record, recoveryScope: "legacy-quarantine", originalRecord: record }, imported_at: createdAt });
  }
  const scoped = scopeSnapshot(snapshot);
  validateSnapshot(scoped);
  return scoped;
}

export function migrationSelect(table: MigrationTable, parameter: string, postgres = false): string {
  const columns = MIGRATION_TABLES[table].split(" ").map(column => postgres && ["created_at", "imported_at"].includes(column) ? `to_char(${column} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS ${column}` : column).join(",");
  const dependencies: Partial<Record<MigrationTable, string>> = {
    artifact_lifecycle: "revision IN (SELECT revision FROM artifact_revisions WHERE project_id=" + parameter + ")",
    artifact_publications: "checkpoint_id IN (SELECT id FROM artifact_checkpoints WHERE project_id=" + parameter + ")",
    artifact_import_provenance: "destination_revision IN (SELECT revision FROM artifact_revisions WHERE project_id=" + parameter + ")",
  };
  return "SELECT " + columns + " FROM " + table + " WHERE " + (dependencies[table] ?? "project_id=" + parameter);
}

function normalizeTimestamps(row: MigrationRow): MigrationRow {
  const result = { ...row };
  for (const column of ["created_at", "imported_at"]) {
    const value = result[column];
    if (typeof value !== "string") continue;
    const iso = /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(value) ? `${value.replace(" ", "T")}.000Z` : value;
    result[column] = iso.replace(/(\.\d{3,}?)0+Z$/, "$1Z");
  }
  return result;
}

/** Branch/run exports are explicit subsets; refuse scope-incomplete provenance rather than silently dropping it. */
export function selectSnapshot(snapshot: MigrationSnapshot, scope: { branchId: string; worktreeId?: string; runId?: string }): MigrationSnapshot {
  const selected = structuredClone(snapshot);
  for (const rows of Object.values(selected.tables)) {
    for (let index = rows.length - 1; index >= 0; index--) {
      const row = rows[index]!;
      if (!matchesMigrationScope(row, scope)) rows.splice(index, 1);
    }
  }
  const revisions = new Set(selected.tables.artifact_revisions.map(row => row.revision));
  const hashes = new Set(selected.tables.artifact_revisions.map(row => row.sha256));
  const runs = new Set(selected.tables.artifact_runs.map(row => row.run_id));
  selected.tables.artifact_search_text = selected.tables.artifact_search_text.filter(row => revisions.has(row.revision));
  selected.tables.artifact_run_duties = selected.tables.artifact_run_duties.filter(row => runs.has(row.run_id));
  selected.tables.artifact_attachments = selected.tables.artifact_attachments.filter(row => hashes.has(row.sha256));
  const result = scopeSnapshot(selected);
  assertScopeDependencies(result, revisions);
  validateSnapshot(result);
  return result;
}

function matchesMigrationScope(row: MigrationRow, scope: { branchId: string; worktreeId?: string; runId?: string }): boolean {
  const fields = { branch_id: scope.branchId, worktree_id: scope.worktreeId, run_id: scope.runId };
  return Object.entries(fields).every(([column, value]) => value === undefined || row[column] === undefined || row[column] === value);
}

function assertScopeDependencies(snapshot: MigrationSnapshot, revisions: Set<unknown>): void {
  const required = snapshot.tables.artifact_runs.flatMap(row => row.artifact_revisions as string[]);
  for (const row of snapshot.tables.artifact_checkpoints) required.push(...(row.revision_set as { revision: string }[]).map(member => member.revision));
  for (const row of snapshot.tables.artifact_corrections) {
    required.push(String(row.predecessor_revision));
    if (row.result_revision) required.push(String(row.result_revision));
  }
  if (required.some(revision => !revisions.has(revision))) throw new Error("Selected scope excludes provenance dependencies; export the project instead");
}

/** Pre-cutover memory-import rows had guessed branch assignment, not original checkpoint evidence. */
export function quarantineMappedLegacy(snapshot: MigrationSnapshot): MigrationSnapshot {
  const legacy = snapshot.tables.artifact_revisions.filter(row => row.source === "memory-import");
  if (!legacy.length) return snapshot;
  const result = structuredClone(snapshot);
  const legacyIds = new Set(legacy.map(row => row.revision));
  result.tables.artifact_pointers = result.tables.artifact_pointers.filter(row => !legacyIds.has(row.revision));
  for (const row of result.tables.artifact_revisions) {
    if (!legacyIds.has(row.revision)) continue;
    const original = structuredClone(row);
    row.worktree_id = "worktree-00000000-0000-0000-0000-000000000000";
    row.run_id = "run-00000000-0000-0000-0000-000000000000";
    row.source = "legacy-quarantine";
    const provenance = result.tables.artifact_import_provenance.find(item => item.destination_revision === row.revision);
    const originalPointers = snapshot.tables.artifact_pointers.filter(pointer => pointer.revision === original.revision && keyId(rowKey(pointer)) === keyId(rowKey(original)));
    const source_metadata = { ...(provenance?.source_metadata as Record<string, unknown> ?? {}), recoveryScope: "legacy-quarantine", originalRevision: original, originalPointers };
    if (provenance) provenance.source_metadata = source_metadata;
    else result.tables.artifact_import_provenance.push({ source_id: String(row.revision), destination_revision: row.revision, source_metadata, imported_at: row.created_at });
  }
  return scopeSnapshot(result);
}
