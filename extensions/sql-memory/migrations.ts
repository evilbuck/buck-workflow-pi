import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { containsDestructiveMigration } from "./sql-gate.js";

export interface QueryResult { rows: Array<Record<string, unknown>>; rowCount?: number | null; }
export interface MigrationClient {
  query(text: string, values?: unknown[]): Promise<QueryResult>;
  release(): void;
}
export interface MigrationPool {
  query(text: string, values?: unknown[]): Promise<QueryResult>;
  connect(): Promise<MigrationClient>;
}
export interface MigrationFile { name: string; sql: string; }
export interface ApplyMigrationOptions {
  directory?: string;
  loadFiles?: () => Promise<MigrationFile[]>;
  destructive?: string;
}

const MIGRATION_NAME = /^(\d{3,})_[a-z0-9][a-z0-9_-]*\.sql$/;
// The reviewed bootstrap creates immutable-content triggers using PL/pgSQL.
// Pin its bytes; subsequent procedural changes need explicit acknowledgment.
const BOOTSTRAP_NAME = "001_initial_schema.sql";
const BOOTSTRAP_CHECKSUM = "4e76b01d169ceb8d4d940fbc9373953b77304cc5a9b0dab018d8843979ced716";

async function readMigrationFiles(directory: string): Promise<MigrationFile[]> {
  const names = (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort();
  return Promise.all(names.map(async (name) => ({ name, sql: await readFile(join(directory, name), "utf8") })));
}

function versionFromName(name: string): string {
  const match = MIGRATION_NAME.exec(name);
  if (!match) throw new Error(`Invalid migration filename: ${name}`);
  return match[1]!;
}

export async function applyMigrations(pool: MigrationPool, options: ApplyMigrationOptions = {}): Promise<{ applied: string[] }> {
  const directory = options.directory ?? join(dirname(fileURLToPath(import.meta.url)), "../../migrations");
  const files = (await (options.loadFiles ?? (() => readMigrationFiles(directory)) )()).slice().sort((a, b) => {
    const left = BigInt(versionFromName(a.name));
    const right = BigInt(versionFromName(b.name));
    return left < right ? -1 : left > right ? 1 : a.name.localeCompare(b.name);
  });
  const seenVersions: Record<string, true> = {};
  for (const file of files) {
    const version = versionFromName(file.name);
    const numericVersion = BigInt(version).toString();
    if (seenVersions[numericVersion]) throw new Error(`Duplicate migration version ${version}`);
    seenVersions[numericVersion] = true;
  }
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now(),
    checksum text NOT NULL
  )`);
  const result = await pool.query("SELECT version, checksum FROM schema_migrations ORDER BY version");
  const appliedByVersion: Record<string, string> = {};
  for (const row of result.rows) appliedByVersion[String(row.version)] = String(row.checksum);

  const applied: string[] = [];
  for (const file of files) {
    const version = versionFromName(file.name);
    const checksum = createHash("sha256").update(file.sql).digest("hex");
    const prior = appliedByVersion[version];
    if (prior !== undefined) {
      if (prior !== checksum) throw new Error(`Migration checksum mismatch for ${file.name}; applied files are immutable`);
      continue;
    }
    if (containsDestructiveMigration(file.sql) && options.destructive !== file.name
      && !(file.name === BOOTSTRAP_NAME && checksum === BOOTSTRAP_CHECKSUM)) {
      throw new Error(`Non-additive migration ${file.name} requires explicit acknowledgment naming that exact file`);
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL search_path = public");
      await client.query(file.sql);
      await client.query("INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)", [version, checksum]);
      await client.query("COMMIT");
      applied.push(file.name);
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch { /* Preserve the migration error. */ }
      throw error;
    } finally {
      client.release();
    }
  }
  return { applied };
}
