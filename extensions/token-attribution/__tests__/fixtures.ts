import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, vi } from "vitest";
import { AttributionDatabase, type AttributionRecord } from "../db.js";
import type { StorageAdapter } from "../../../skills/_shared/storage/contract.js";

const roots: string[] = [];
const ledgers: AttributionDatabase[] = [];
afterEach(async () => {
  try {
    for (const ledger of ledgers.splice(0)) await ledger.close();
  } finally {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  }
});

export function fixture(adapter: StorageAdapter = "sqlite") {
  const base = mkdtempSync(join(tmpdir(), "attribution-adapter-"));
  roots.push(base);
  const root = join(base, "checkout");
  mkdirSync(root);
  const config = join(base, "config.yaml");
  const database = join(base, "state.sqlite");
  const extra = adapter === "sqlite" ? `  database: ${database}\n`
    : adapter === "external-files" ? `  root: ${join(base, "external", "{project}")}\n`
    : adapter === "postgres" ? "  connection_env: BUCK_WORKFLOW_TEST_DATABASE_URL\n" : "";
  writeFileSync(config, `version: 1\nstorage:\n  adapter: ${adapter}\n${extra}`);
  vi.stubEnv("BUCK_WORKFLOW_CONFIG", config);
  vi.stubEnv("XDG_CONFIG_HOME", join(base, "machine"));
  return { base, root, config, database, projection: join(base, "stats.db") };
}

export function openLedger(projection?: string): AttributionDatabase {
  const ledger = new AttributionDatabase(projection);
  ledgers.push(ledger);
  return ledger;
}

export function record(root: string, overrides: Partial<AttributionRecord> = {}): AttributionRecord {
  return {
    recordedAt: "2026-09-23T10:00:00.000Z", sessionFile: join(root, "sessions", "child.jsonl"),
    sessionId: "parent", entryKey: "entry-1", projectKey: "git@example.test:repo.git",
    branch: "feature/a", worktreeRoot: root, provider: "openai", model: "gpt-5", api: "openai-responses",
    inputTokens: 100, outputTokens: 40, cacheReadTokens: 20, cacheWriteTokens: 5,
    reasoningTokens: 10, totalTokens: 165, costUsd: 0.0123, costSource: "usage", ...overrides,
  };
}

export function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}
