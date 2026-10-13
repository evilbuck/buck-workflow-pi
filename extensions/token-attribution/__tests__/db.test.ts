import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AttributionDatabase, type AttributionRecord } from "../db.js";
import { flushConfiguredRetains } from "../../../skills/_shared/storage/consumers.js";
import { SQLiteStorageStore } from "../../../skills/_shared/storage/sqlite-store.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function tempDb(): string {
  const root = mkdtempSync(join(tmpdir(), "token-attribution-"));
  roots.push(root);
  return join(root, "stats.db");
}

function record(overrides: Partial<AttributionRecord> = {}): AttributionRecord {
  return {
    recordedAt: "2026-09-23T10:00:00.000Z",
    sessionFile: "/sessions/parent/child.jsonl",
    sessionId: "parent",
    entryKey: "entry-1",
    projectKey: "git@example.test:repo.git",
    branch: "feature/a",
    worktreeRoot: "/repo/a",
    provider: "openai",
    model: "gpt-5",
    api: "openai-responses",
    inputTokens: 100,
    outputTokens: 40,
    cacheReadTokens: 20,
    cacheWriteTokens: 5,
    reasoningTokens: 10,
    totalTokens: 165,
    costUsd: 0.0123,
    costSource: "usage",
    ...overrides,
  };
}

describe("AttributionDatabase", () => {
  it("inserts a delivery once and leaves OMP-owned tables untouched", () => {
    const path = tempDb();
    const seed = new DatabaseSync(path);
    seed.exec("CREATE TABLE messages (id TEXT PRIMARY KEY, payload TEXT); INSERT INTO messages VALUES ('kept', 'omp');");
    seed.close();

    const ledger = new AttributionDatabase(path);
    expect(ledger.insert(record())).toBe(true);
    expect(ledger.insert(record())).toBe(false);
    ledger.close();

    const inspect = new DatabaseSync(path, { readOnly: true });
    expect(inspect.prepare("SELECT COUNT(*) AS count FROM attribution").get()).toEqual({ count: 1 });
    expect(inspect.prepare("SELECT * FROM messages").all()).toEqual([{ id: "kept", payload: "omp" }]);
    inspect.close();
  });

  it("keeps distinct entry ids with otherwise identical delivery fields", () => {
    const path = tempDb();
    const bootstrap = new AttributionDatabase(path);
    bootstrap.close();
    const legacy = new DatabaseSync(path);
    legacy.exec(`
      CREATE UNIQUE INDEX attribution_delivery_idx
      ON attribution(session_file, recorded_at, provider, model, total_tokens)
    `);
    legacy.close();
    const ledger = new AttributionDatabase(path);

    expect(ledger.insert(record({ entryKey: "entry-1" }))).toBe(true);
    expect(ledger.insert(record({ entryKey: "entry-2" }))).toBe(true);
    ledger.close();

    const inspect = new DatabaseSync(path, { readOnly: true });
    expect(inspect.prepare("SELECT entry_key FROM attribution ORDER BY entry_key").all()).toEqual([
      { entry_key: "entry-1" },
      { entry_key: "entry-2" },
    ]);
    inspect.close();
  });

  it("uses the fallback table when attribution already belongs to another schema", () => {
    const path = tempDb();
    const seed = new DatabaseSync(path);
    seed.exec("CREATE TABLE attribution (foreign_column TEXT);");
    seed.close();

    const ledger = new AttributionDatabase(path);
    expect(ledger.tableName).toBe("buck_token_attribution");
    expect(ledger.insert(record())).toBe(true);
    ledger.close();

    const inspect = new DatabaseSync(path, { readOnly: true });
    expect(inspect.prepare("SELECT COUNT(*) AS count FROM buck_token_attribution").get()).toEqual({ count: 1 });
    expect(inspect.prepare("PRAGMA table_info(attribution)").all()).toHaveLength(1);
    inspect.close();
  });
});

describe("attribution retention on the configured store", () => {
  const previousConfig = process.env.BUCK_WORKFLOW_CONFIG;

  afterEach(() => {
    if (previousConfig === undefined) delete process.env.BUCK_WORKFLOW_CONFIG;
    else process.env.BUCK_WORKFLOW_CONFIG = previousConfig;
  });

  it("retains each inserted Buck-owned row with a receipt while host tables stay untouched", async () => {
    const path = tempDb();
    const storeRoot = mkdtempSync(join(tmpdir(), "attribution-retain-"));
    roots.push(storeRoot);
    const database = join(storeRoot, "state.sqlite");
    const configPath = join(storeRoot, "config.yaml");
    writeFileSync(configPath, `version: 1\nstorage:\n  adapter: sqlite\n  database: ${database}\n`);
    process.env.BUCK_WORKFLOW_CONFIG = configPath;

    const seed = new DatabaseSync(path);
    seed.exec("CREATE TABLE messages (id TEXT PRIMARY KEY, payload TEXT); INSERT INTO messages VALUES ('kept', 'omp');");
    seed.close();
    const ledger = new AttributionDatabase(path);
    expect(ledger.insert(record())).toBe(true);
    await flushConfiguredRetains();
    ledger.close();

    const store = SQLiteStorageStore.openSync(database);
    try {
      const probe = new DatabaseSync(database, { readOnly: true });
      const rows = probe.prepare("SELECT logical_name, run_id FROM artifact_revisions WHERE subject_id='token-attribution' AND kind='attribution'").all() as Array<{ logical_name: string; run_id: string }>;
      probe.close();
      expect(rows.map((row) => row.logical_name)).toContain("rows/entry-1.json");
      await expect(store.readReceipt("configured-project", rows[0]!.run_id)).resolves.toMatchObject({
        attemptId: rows[0]!.run_id,
        worktreeId: "/repo/a",
        status: "attempted",
      });
    } finally {
      store.close();
    }
    const inspect = new DatabaseSync(path, { readOnly: true });
    expect(inspect.prepare("SELECT * FROM messages").all()).toEqual([{ id: "kept", payload: "omp" }]);
    inspect.close();
  });
});
