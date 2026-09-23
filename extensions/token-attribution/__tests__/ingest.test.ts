import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AttributionDatabase } from "../db.js";
import { extractUsageRecord, scanSessionArtifacts } from "../index.js";
import type { GitIdentity } from "../git-identity.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const identity: GitIdentity = {
  projectKey: "git@example.test:repo.git",
  branch: "feature/nested",
  worktreeRoot: "/repo/worktree",
  detached: false,
};

function assistant(totalTokens = 30) {
  return {
    role: "assistant",
    provider: "openai",
    model: "gpt-5",
    api: "openai-responses",
    timestamp: 1_758_624_000_000,
    usage: {
      input: 20,
      output: 10,
      cacheRead: 3,
      cacheWrite: 2,
      reasoningTokens: 4,
      totalTokens,
      cost: { total: 0.004 },
    },
  };
}

describe("token attribution ingestion", () => {
  it("extracts normalized token buckets and uses the entry id as the delivery key", () => {
    expect(extractUsageRecord({ type: "message", id: "entry-7", timestamp: "2026-09-23T10:00:00Z", message: assistant() }, "/sessions/a.jsonl", "session-a", identity)).toMatchObject({
      entryKey: "entry-7",
      provider: "openai",
      model: "gpt-5",
      inputTokens: 20,
      outputTokens: 10,
      cacheReadTokens: 3,
      cacheWriteTokens: 2,
      reasoningTokens: 4,
      totalTokens: 30,
      costUsd: 0.004,
      costSource: "usage",
      branch: "feature/nested",
    });
  });

  it("ingests nested assistant JSONL once even when the child already inserted the row", async () => {
    const root = mkdtempSync(join(tmpdir(), "token-ingest-"));
    roots.push(root);
    const sessionFile = join(root, "parent.jsonl");
    writeFileSync(sessionFile, "");
    const artifacts = join(root, basename(sessionFile, ".jsonl"));
    mkdirSync(artifacts);
    const child = join(artifacts, "child.jsonl");
    writeFileSync(child, `${JSON.stringify({ type: "message", id: "nested-1", timestamp: "2026-09-23T10:00:00Z", message: assistant() })}\n`);

    const dbPath = join(root, "stats.db");
    const ledger = new AttributionDatabase(dbPath);
    const record = extractUsageRecord({ type: "message", timestamp: "2026-09-23T10:00:00Z", message: assistant() }, child, "parent", identity)!;
    expect(ledger.insert(record)).toBe(true);
    expect(await scanSessionArtifacts(ledger, sessionFile, identity)).toBe(0);
    ledger.close();

    const inspect = new DatabaseSync(dbPath, { readOnly: true });
    expect(inspect.prepare("SELECT session_file, entry_key, branch, COUNT(*) AS count FROM attribution GROUP BY session_file, entry_key, branch").all()).toEqual([
      { session_file: child, entry_key: "nested-1", branch: "feature/nested", count: 1 },
    ]);
    inspect.close();
  });

  it("parses only bytes appended since the previous nested scan", async () => {
    const root = mkdtempSync(join(tmpdir(), "token-ingest-cursor-"));
    roots.push(root);
    const sessionFile = join(root, "parent.jsonl");
    writeFileSync(sessionFile, "");
    const artifacts = join(root, basename(sessionFile, ".jsonl"));
    mkdirSync(artifacts);
    const child = join(artifacts, "child.jsonl");
    writeFileSync(child, `${JSON.stringify({ type: "message", id: "nested-1", message: assistant() })}\n`);
    const ledger = new AttributionDatabase(join(root, "stats.db"));
    const insert = vi.spyOn(ledger, "insert");
    const cursors = new Map();

    expect(await scanSessionArtifacts(ledger, sessionFile, identity, cursors)).toBe(1);
    appendFileSync(child, `${JSON.stringify({ type: "message", id: "nested-2", message: assistant(40) })}\n`);
    expect(await scanSessionArtifacts(ledger, sessionFile, identity, cursors)).toBe(1);
    expect(insert).toHaveBeenCalledTimes(2);
    ledger.close();
  });
});
