import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { parseStorageConfig, resolveStorageConfig, type StorageSelection } from "./config.js";
import { stringify } from "yaml";
import { canonical, digest, emptySnapshot, MIGRATION_TABLES, validateSnapshot, type MigrationSnapshot, type MigrationStore, type MigrationTable } from "./migration.js";

/** Private migration files contain exact payloads; stdout contains inventories/digests only. */
export async function retainPrivate(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${randomUUID()}.tmp`;
  const file = await open(temporary, "wx", 0o600);
  try { await file.writeFile(JSON.stringify(value)); await file.sync(); } finally { await file.close(); }
  await rename(temporary, path);
  const directory = await open(dirname(path), "r");
  try { await directory.sync(); } finally { await directory.close(); }
}
export function dryRun(source: MigrationSnapshot, destination: MigrationSnapshot) {
  const inventory = (snapshot: MigrationSnapshot) => Object.entries(snapshot.tables).flatMap(([table, rows]) => rows.map(row => ({ table, digest: digest(row) }))).sort((a, b) => canonical(a).localeCompare(canonical(b)));
  const before = inventory(destination);
  const after = inventory(source);
  const beforeSet = new Set(before.map(canonical));
  const afterSet = new Set(after.map(canonical));
  return { sourceDigest: digest(source), destinationDigest: digest(destination), before, after, sourceOnly: after.filter(row => !beforeSet.has(canonical(row))), destinationOnly: before.filter(row => !afterSet.has(canonical(row))) };
}
interface ImportAttempt {
  version: 1; snapshot: MigrationSnapshot; sourceDigest: string; destination: string;
  cursor: number; staged: MigrationSnapshot; status: "staging" | "installed";
}
/** Cursor and staged records share one atomic journal replacement. Visibility is a single adapter transaction. */
export async function resumeImport(store: MigrationStore, path: string, destination: string, snapshot?: MigrationSnapshot, batchSize = 100): Promise<{ complete: boolean; cursor: number; digest: string }> {
  if (!Number.isSafeInteger(batchSize) || batchSize < 1) throw new Error("Invalid import batch size");
  const attempt = await loadImportAttempt(path, destination, snapshot);
  const records = (Object.keys(MIGRATION_TABLES) as MigrationTable[]).flatMap(table => attempt.snapshot.tables[table].map(row => ({ table, row })));
  const end = Math.min(records.length, attempt.cursor + batchSize);
  for (let index = attempt.cursor; index < end; index++) attempt.staged.tables[records[index]!.table].push(records[index]!.row);
  attempt.cursor = end;
  await retainPrivate(path, attempt);
  if (end < records.length) return { complete: false, cursor: end, digest: attempt.sourceDigest };
  if (digest(attempt.staged) !== attempt.sourceDigest) throw new Error("Staged import inventory mismatch");
  await store.installSnapshot(attempt.staged);
  if (digest(await store.migrationSnapshot(attempt.snapshot.projectId)) !== attempt.sourceDigest) throw new Error("Installed inventory readback mismatch");
  attempt.status = "installed";
  await retainPrivate(path, attempt);
  return { complete: true, cursor: end, digest: attempt.sourceDigest };
}
async function loadImportAttempt(path: string, destination: string, snapshot?: MigrationSnapshot): Promise<ImportAttempt> {
  let attempt: ImportAttempt;
  try { attempt = JSON.parse(await readFile(path, "utf8")); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT" || !snapshot) throw error;
    validateSnapshot(snapshot);
    attempt = { version: 1, snapshot, sourceDigest: digest(snapshot), destination, cursor: 0, staged: emptySnapshot(snapshot.projectId), status: "staging" };
    await retainPrivate(path, attempt);
  }
  const expected = snapshot ? digest(snapshot) : attempt.sourceDigest;
  if (attempt.version !== 1 || attempt.destination !== destination || attempt.sourceDigest !== digest(attempt.snapshot) || expected !== attempt.sourceDigest) throw new Error("Import attempt binding mismatch");
  validateSnapshot(attempt.snapshot);
  return attempt;
}

export async function importSnapshot(store: MigrationStore, path: string, destination: string, snapshot: MigrationSnapshot): Promise<void> {
  while (!(await resumeImport(store, path, destination, snapshot)).complete) { /* persisted bounded batches */ }
}
/** No branch or merge identity is synthesized. Original data and metadata remain recoverable, never discoverable. */
export async function quarantineLegacy(directory: string, records: unknown): Promise<{ recoveryScope: string; count: number; digest: string }> {
  if (!Array.isArray(records)) throw new Error("Legacy import requires an array of original records");
  const id = digest(records);
  const recoveryScope = `legacy-${id}`;
  await retainPrivate(join(directory, recoveryScope, "manifest.json"), { version: 1, recoveryScope, digest: id, reason: "No verified exact checkpoint/publication mapping; original records retained without ordinary pointers", records });
  return { recoveryScope, count: records.length, digest: id };
}
export function doctorLegacySql(env: Record<string, string | undefined>) {
  const found = Boolean(env.SQL_MEMORY_URL);
  return { found, adopt: false, message: found ? "SQL_MEMORY_URL is not adopted. Configure a project adapter; use migration-export/import for durable stores or migration-quarantine for legacy JSON, then migration-cutover." : "No legacy SQL selector is set." };
}
export interface CutoverJournal {
  version: 1; projectId: string; projectKey: string; configPath: string;
  source: StorageSelection; destination: StorageSelection;
  beforeConfig: string; afterConfig: string;
  snapshot: MigrationSnapshot; snapshotDigest: string;
  status: "prepared" | "switched" | "rolled-back";
  rescue?: { path: string; digest: string };
}
export async function prepareCutover(input: { path: string; configPath: string; projectKey: string; source: StorageSelection; destination: StorageSelection; sourceStore: MigrationStore; destinationStore: MigrationStore; projectId: string }): Promise<CutoverJournal> {
  try { await readFile(input.path); throw new Error("Cutover journal already exists; use migration-resume"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  const beforeConfig = await readFile(input.configPath, "utf8");
  const config = parseStorageConfig(beforeConfig);
  const project = config.projects[input.projectKey];
  if (!project || canonical(resolveStorageConfig(config, project.origins[0]).storage) !== canonical(input.source)) throw new Error("Cutover requires an explicit matching project configuration");
  const after = { ...config, projects: { ...config.projects, [input.projectKey]: { ...project, storage: input.destination } } };
  const afterConfig = stringify(after);
  parseStorageConfig(afterConfig);
  const snapshot = await input.sourceStore.migrationSnapshot(input.projectId);
  validateSnapshot(snapshot);
  await importSnapshot(input.destinationStore, `${input.path}.import`, digest(input.destination), snapshot);
  const journal: CutoverJournal = { version: 1, projectId: input.projectId, projectKey: input.projectKey, configPath: resolve(input.configPath), source: input.source, destination: input.destination, beforeConfig, afterConfig, snapshot, snapshotDigest: digest(snapshot), status: "prepared" };
  await retainPrivate(input.path, journal);
  return journal;
}
async function replaceConfig(path: string, text: string): Promise<void> {
  const temporary = `${path}.${randomUUID()}.tmp`;
  const file = await open(temporary, "wx", 0o600);
  try { await file.writeFile(text); await file.sync(); } finally { await file.close(); }
  await rename(temporary, path);
  const directory = await open(dirname(path), "r");
  try { await directory.sync(); } finally { await directory.close(); }
}
/** Operator maintenance window: stop writers before prepare, switch, resume, or rollback. */
export async function switchCutover(path: string, source: MigrationStore, destination: MigrationStore, rebind: (from: StorageSelection, to: StorageSelection) => Promise<void>, rollback = false): Promise<CutoverJournal> {
  const lockPath = `${path}.lock`;
  await acquireCutoverLock(lockPath);
  try {
    const journal = JSON.parse(await readFile(path, "utf8")) as CutoverJournal;
    if (journal.version !== 1 || digest(journal.snapshot) !== journal.snapshotDigest) throw new Error("Invalid cutover journal");
    const config = await readFile(journal.configPath, "utf8");
    if (config !== journal.beforeConfig && config !== journal.afterConfig) throw new Error("Config changed outside the cutover journal");
    if (digest(await source.migrationSnapshot(journal.projectId)) !== journal.snapshotDigest) throw new Error("Source changed since verified snapshot");
    if (rollback) {
      const rescue = await destination.migrationSnapshot(journal.projectId);
      validateSnapshot(rescue);
      const rescuePath = `${path}.rescue-${digest(rescue)}.json`;
      await retainPrivate(rescuePath, rescue);
      journal.rescue = { path: rescuePath, digest: digest(rescue) };
      await retainPrivate(path, journal);
      // Same portable snapshot route can restore this rescue into any empty adapter.
      if (digest(JSON.parse(await readFile(rescuePath, "utf8"))) !== digest(rescue)) throw new Error("Rescue verification failed");
    } else if (digest(await destination.migrationSnapshot(journal.projectId)) !== journal.snapshotDigest) throw new Error("Destination changed since verified snapshot");
    const target = rollback ? journal.beforeConfig : journal.afterConfig;
    await replaceConfig(journal.configPath, target);
    await rebind(rollback ? journal.destination : journal.source, rollback ? journal.source : journal.destination);
    if (await readFile(journal.configPath, "utf8") !== target) throw new Error("Config switch readback failed; resume journal");
    journal.status = rollback ? "rolled-back" : "switched";
    await retainPrivate(path, journal);
    return journal;
  } finally { await rm(lockPath); }
}

async function acquireCutoverLock(path: string): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const file = await open(path, "wx", 0o600);
      try { await file.writeFile(String(process.pid)); await file.sync(); } finally { await file.close(); }
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const owner = Number(await readFile(path, "utf8"));
      if (!Number.isSafeInteger(owner) || owner <= 0) throw new Error("Uncertain cutover lock owner; inspect before removing");
      await removeDeadCutoverLock(path, owner);
    }
  }
  throw new Error("Concurrent cutover operator");
}

async function removeDeadCutoverLock(path: string, owner: number): Promise<void> {
  try { process.kill(owner, 0); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    await rm(path);
    return;
  }
  throw new Error("Cutover operator is still running");
}
