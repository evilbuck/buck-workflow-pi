import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { extractUsageRecord, scanSessionArtifacts, type ArtifactScanCursors } from "../index.js";
import type { GitIdentity } from "../git-identity.js";
import { fixture, openLedger } from "./fixtures.js";
import { SQLiteStorageStore } from "../../../skills/_shared/storage/sqlite-store.js";

function assistant(totalTokens = 30) {
  return {
    role: "assistant", provider: "openai", model: "gpt-5", api: "openai-responses", timestamp: 1_758_624_000_000,
    usage: { input: 20, output: 10, cacheRead: 3, cacheWrite: 2, reasoningTokens: 4, totalTokens, cost: { total: 0.004 } },
  };
}

function setup() {
  const { root } = fixture();
  const identity: GitIdentity = { projectKey: "git@example.test:repo.git", branch: "feature/nested", worktreeRoot: root, detached: false };
  const sessionFile = join(root, "parent.jsonl");
  writeFileSync(sessionFile, "");
  const artifacts = join(root, basename(sessionFile, ".jsonl"));
  mkdirSync(artifacts);
  const child = join(artifacts, "child.jsonl");
  const ledger = openLedger();
  const cursors: ArtifactScanCursors = new Map();
  return { root, identity, sessionFile, child, ledger, cursors };
}

describe("token attribution ingestion", () => {
  it("extracts normalized token buckets and uses the entry id as the delivery key", () => {
    const { identity, child } = setup();
    expect(extractUsageRecord({ type: "message", id: "entry-7", timestamp: "2026-09-23T10:00:00Z", message: assistant() }, child, "session-a", identity)).toMatchObject({
      entryKey: "entry-7", provider: "openai", model: "gpt-5", inputTokens: 20, outputTokens: 10,
      cacheReadTokens: 3, cacheWriteTokens: 2, reasoningTokens: 4, totalTokens: 30,
      costUsd: 0.004, costSource: "usage", branch: "feature/nested",
    });
  });

  it("ingests nested assistant JSONL once even when the child already inserted the row", async () => {
    const { root, identity, child, sessionFile, ledger } = setup();
    writeFileSync(child, `${JSON.stringify({ type: "message", id: "nested-1", timestamp: "2026-09-23T10:00:00Z", message: assistant() })}\n`);
    const record = extractUsageRecord({ type: "message", timestamp: "2026-09-23T10:00:00Z", message: assistant() }, child, "parent", identity)!;
    expect(await ledger.insert(record)).toBe(true);
    expect(await scanSessionArtifacts(ledger, sessionFile, identity)).toBe(0);
    expect(await ledger.records(root)).toEqual([{ ...record, entryKey: "nested-1" }]);
  });

  it("processes appended bytes and preserves partial JSONL deliveries", async () => {
    const { root, identity, child, sessionFile, ledger, cursors } = setup();
    const first = `${JSON.stringify({ type: "message", id: "nested-1", message: assistant() })}\n`;
    writeFileSync(child, first);
    expect(await scanSessionArtifacts(ledger, sessionFile, identity, cursors)).toBe(1);
    const next = JSON.stringify({ type: "message", id: "nested-2", message: assistant(40) });
    appendFileSync(child, next.slice(0, 20));
    expect(await scanSessionArtifacts(ledger, sessionFile, identity, cursors)).toBe(0);
    appendFileSync(child, `${next.slice(20)}\n`);
    expect(await scanSessionArtifacts(ledger, sessionFile, identity, cursors)).toBe(1);
    expect((await ledger.records(root)).map((row) => [row.entryKey, row.totalTokens]).sort()).toEqual([["nested-1", 30], ["nested-2", 40]]);
    expect(cursors.get(child)).toMatchObject({ offset: Buffer.byteLength(first + next + "\n"), remainder: Buffer.alloc(0) });
  });

  it("observes retention failures and retries the failed line instead of advancing its cursor", async () => {
    const { root, identity, child, sessionFile, ledger, cursors } = setup();
    writeFileSync(child, `${JSON.stringify({ type: "message", id: "nested-retry", message: assistant() })}\n`);
    vi.spyOn(SQLiteStorageStore.prototype, "writeReceipt").mockRejectedValueOnce(new Error("receipt fault"));
    await expect(scanSessionArtifacts(ledger, sessionFile, identity, cursors)).rejects.toThrow("receipt fault");
    await expect(ledger.flush()).rejects.toThrow("receipt fault");
    expect(cursors.get(child)!.remainder.toString("utf8")).toContain("nested-retry");
    expect(await scanSessionArtifacts(ledger, sessionFile, identity, cursors)).toBe(0);
    expect((await ledger.records(root)).map((row) => row.entryKey)).toEqual(["nested-retry"]);
    expect(cursors.get(child)!.remainder).toEqual(Buffer.alloc(0));
  });
});
