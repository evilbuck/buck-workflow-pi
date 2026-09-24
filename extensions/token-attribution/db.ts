import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { DatabaseSync } from "node:sqlite";

const PRIMARY_TABLE = "attribution";
const FALLBACK_TABLE = "buck_token_attribution";
const REQUIRED_COLUMNS = [
  "recorded_at", "session_file", "session_id", "entry_key", "project_key", "branch",
  "worktree_root", "provider", "model", "api", "input_tokens", "output_tokens",
  "cache_read_tokens", "cache_write_tokens", "reasoning_tokens", "total_tokens",
  "cost_usd", "cost_source",
] as const;

export interface AttributionRecord {
  recordedAt: string;
  sessionFile: string;
  sessionId: string;
  entryKey: string;
  projectKey: string;
  branch: string | null;
  worktreeRoot: string;
  provider: string;
  model: string;
  api: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  reasoningTokens: number | null;
  totalTokens: number;
  costUsd: number | null;
  costSource: "usage" | "none";
}

export interface TotalRow {
  total_tokens: number;
  cost_usd: number | null;
}

export interface GroupRow extends TotalRow {
  label: string;
}
const require = createRequire(import.meta.url);


export function defaultStatsDbPath(): string {
  return join(homedir(), ".omp", "stats.db");
}

function createTable(db: DatabaseSync, table: string): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${table} (
      recorded_at TEXT NOT NULL,
      session_file TEXT NOT NULL,
      session_id TEXT NOT NULL,
      entry_key TEXT NOT NULL,
      project_key TEXT NOT NULL,
      branch TEXT,
      worktree_root TEXT NOT NULL,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      api TEXT NOT NULL,
      input_tokens INTEGER NOT NULL,
      output_tokens INTEGER NOT NULL,
      cache_read_tokens INTEGER NOT NULL,
      cache_write_tokens INTEGER NOT NULL,
      reasoning_tokens INTEGER,
      total_tokens INTEGER NOT NULL,
      cost_usd REAL,
      cost_source TEXT NOT NULL,
      UNIQUE(session_file, entry_key)
    );
    CREATE INDEX IF NOT EXISTS ${table}_project_branch_idx
      ON ${table}(project_key, branch);
  `);
}

function tableExists(db: DatabaseSync, table: string): boolean {
  return db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table) !== undefined;
}

function ownsSchema(db: DatabaseSync, table: string): boolean {
  if (!tableExists(db, table)) return false;
  const columns = new Set(
    (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((row) => row.name),
  );
  return REQUIRED_COLUMNS.every((column) => columns.has(column));
}

export class AttributionDatabase {
  readonly tableName: string;
  private readonly db: DatabaseSync;

  constructor(path = defaultStatsDbPath()) {
    mkdirSync(dirname(path), { recursive: true });
    const { DatabaseSync: Database } = require("node:sqlite") as { DatabaseSync: typeof DatabaseSync };
    this.db = new Database(path);
    this.db.exec("PRAGMA busy_timeout = 5000;");

    if (!tableExists(this.db, PRIMARY_TABLE)) {
      this.tableName = PRIMARY_TABLE;
      createTable(this.db, this.tableName);
    } else if (ownsSchema(this.db, PRIMARY_TABLE)) {
      this.tableName = PRIMARY_TABLE;
    } else {
      if (tableExists(this.db, FALLBACK_TABLE) && !ownsSchema(this.db, FALLBACK_TABLE)) {
        this.db.close();
        throw new Error(`${FALLBACK_TABLE} exists with an incompatible schema`);
      }
      this.tableName = FALLBACK_TABLE;
      createTable(this.db, this.tableName);
    }
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS ${this.tableName}_project_branch_idx
        ON ${this.tableName}(project_key, branch);
      DROP INDEX IF EXISTS ${this.tableName}_delivery_idx;
    `);
  }

  insert(record: AttributionRecord): boolean {
    const result = this.db.prepare(`
      INSERT OR IGNORE INTO ${this.tableName} (
        recorded_at, session_file, session_id, entry_key, project_key, branch,
        worktree_root, provider, model, api, input_tokens, output_tokens,
        cache_read_tokens, cache_write_tokens, reasoning_tokens, total_tokens,
        cost_usd, cost_source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      record.recordedAt, record.sessionFile, record.sessionId, record.entryKey,
      record.projectKey, record.branch, record.worktreeRoot, record.provider,
      record.model, record.api, record.inputTokens, record.outputTokens,
      record.cacheReadTokens, record.cacheWriteTokens, record.reasoningTokens,
      record.totalTokens, record.costUsd, record.costSource,
    );
    return result.changes === 1;
  }

  insertReconciled(record: AttributionRecord, fallbackEntryKey: string): boolean {
    if (record.entryKey === fallbackEntryKey) return this.insert(record);

    this.db.exec("BEGIN IMMEDIATE");
    try {
      const targetExists = this.db.prepare(`
        SELECT 1 FROM ${this.tableName}
        WHERE session_file = ? AND entry_key = ?
      `).get(record.sessionFile, record.entryKey) !== undefined;

      if (targetExists) {
        this.db.prepare(`
          DELETE FROM ${this.tableName}
          WHERE session_file = ? AND entry_key = ?
        `).run(record.sessionFile, fallbackEntryKey);
      } else {
        this.db.prepare(`
          UPDATE ${this.tableName}
          SET entry_key = ?
          WHERE session_file = ? AND entry_key = ?
        `).run(record.entryKey, record.sessionFile, fallbackEntryKey);
      }

      const inserted = this.insert(record);
      this.db.exec("COMMIT");
      return inserted;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  hasBranch(projectKey: string, branch: string): boolean {
    return this.db.prepare(`SELECT 1 FROM ${this.tableName} WHERE project_key = ? AND branch = ? LIMIT 1`)
      .get(projectKey, branch) !== undefined;
  }

  total(projectKey: string, branch?: string): TotalRow | null {
    const branchClause = branch === undefined ? "" : " AND branch = ?";
    const params = branch === undefined ? [projectKey] : [projectKey, branch];
    const row = this.db.prepare(`
      SELECT SUM(total_tokens) AS total_tokens, SUM(cost_usd) AS cost_usd
      FROM ${this.tableName} WHERE project_key = ?${branchClause}
    `).get(...params) as { total_tokens: number | null; cost_usd: number | null };
    return row.total_tokens === null ? null : { total_tokens: row.total_tokens, cost_usd: row.cost_usd };
  }

  groups(projectKey: string, kind: "branch" | "model", branch?: string): GroupRow[] {
    const branchClause = branch === undefined ? "" : " AND branch = ?";
    const params = branch === undefined ? [projectKey] : [projectKey, branch];
    const label = kind === "branch" ? "COALESCE(branch, '(none)')" : "provider || '/' || model";
    return this.db.prepare(`
      SELECT ${label} AS label, SUM(total_tokens) AS total_tokens, SUM(cost_usd) AS cost_usd
      FROM ${this.tableName}
      WHERE project_key = ?${branchClause}
      GROUP BY label ORDER BY total_tokens DESC, label ASC
    `).all(...params) as unknown as GroupRow[];
  }

  matchingProjects(substring: string): Array<{ project_key: string } & TotalRow> {
    return this.db.prepare(`
      SELECT project_key, SUM(total_tokens) AS total_tokens, SUM(cost_usd) AS cost_usd
      FROM ${this.tableName} WHERE project_key LIKE ? ESCAPE '\\'
      GROUP BY project_key ORDER BY total_tokens DESC, project_key ASC
    `).all(`%${substring.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`) as unknown as Array<{ project_key: string } & TotalRow>;
  }

  close(): void {
    this.db.close();
  }
}
