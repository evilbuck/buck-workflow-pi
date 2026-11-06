import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { commitConsumerBatch, consumerKey, type ConsumerScope, type ConsumerWrite } from "../../skills/_shared/storage/consumers.js";
import { resolveConsumerContext, withBoundStore, type TrustedWorkflowContext } from "../../skills/_shared/scripts/workflow-state.js";
import type { StorageStore } from "../../skills/_shared/storage/contract.js";
import { createRunId } from "../../skills/_shared/storage/identity.js";
import { Type, type Static } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

const TABLE = "buck_token_attribution";
const SUBJECT = "token-attribution";

const RecordSchema = Type.Object({
  recordedAt: Type.String(), sessionFile: Type.String(), sessionId: Type.String(),
  entryKey: Type.String(), projectKey: Type.String(), branch: Type.Union([Type.String(), Type.Null()]),
  worktreeRoot: Type.String(), provider: Type.String(), model: Type.String(), api: Type.String(),
  inputTokens: Type.Number(), outputTokens: Type.Number(), cacheReadTokens: Type.Number(), cacheWriteTokens: Type.Number(),
  reasoningTokens: Type.Union([Type.Number(), Type.Null()]), totalTokens: Type.Number(),
  costUsd: Type.Union([Type.Number(), Type.Null()]), costSource: Type.Union([Type.Literal("usage"), Type.Literal("none")]),
});
export type AttributionRecord = Static<typeof RecordSchema>;

function parseRecord(bytes: Uint8Array): AttributionRecord {
  const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
  if (!Value.Check(RecordSchema, value)) throw new Error("Invalid retained attribution row");
  return value;
}

export interface TotalRow {
  total_tokens: number;
  cost_usd: number | null;
}

export interface GroupRow extends TotalRow {
  label: string;
}

const require = createRequire(import.meta.url);

function logicalName(prefix: "rows" | "aliases", sessionFile: string, entryKey: string): string {
  return `${prefix}/${encodeURIComponent(sessionFile)}/${encodeURIComponent(entryKey)}.json`;
}

function scopeOf(context: TrustedWorkflowContext): ConsumerScope {
  if (!context.worktreeId || !context.runId) throw new Error("Attribution requires a bound workspace run");
  return { ...context, worktreeId: context.worktreeId, runId: context.runId };
}

function write(logicalName: string, value: unknown): ConsumerWrite {
  return { kind: "attribution", subjectId: SUBJECT, logicalName, bytes: new TextEncoder().encode(JSON.stringify(value)), source: "token-attribution" };
}

async function canonicalEntryKey(store: StorageStore, scope: ConsumerScope, record: AttributionRecord): Promise<string> {
  const name = logicalName("aliases", record.sessionFile, record.entryKey);
  const alias = await store.read(consumerKey(scope, "attribution", SUBJECT, name));
  if (!alias) return record.entryKey;
  const value: unknown = JSON.parse(new TextDecoder().decode(alias.bytes));
  if (!value || typeof value !== "object" || !("entryKey" in value) || typeof value.entryKey !== "string") throw new Error("Invalid retained attribution alias");
  return value.entryKey;
}

/** The adapter owns rows and delivery aliases. SQLite is an opt-in export only. */
export class AttributionDatabase {
  readonly tableName = TABLE;
  private readonly db?: DatabaseSync;
  private tail: Promise<void> = Promise.resolve();
  private failures: unknown[] = [];

  constructor(projectionPath?: string) {
    if (projectionPath === undefined) return;
    mkdirSync(dirname(projectionPath), { recursive: true });
    const { DatabaseSync: Database } = require("node:sqlite") as { DatabaseSync: typeof DatabaseSync };
    this.db = new Database(projectionPath);
    this.db.exec(`
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS ${TABLE} (
        recorded_at TEXT NOT NULL, session_file TEXT NOT NULL, session_id TEXT NOT NULL,
        entry_key TEXT NOT NULL, project_key TEXT NOT NULL, branch TEXT,
        worktree_root TEXT NOT NULL, provider TEXT NOT NULL, model TEXT NOT NULL, api TEXT NOT NULL,
        input_tokens INTEGER NOT NULL, output_tokens INTEGER NOT NULL,
        cache_read_tokens INTEGER NOT NULL, cache_write_tokens INTEGER NOT NULL,
        reasoning_tokens INTEGER, total_tokens INTEGER NOT NULL, cost_usd REAL, cost_source TEXT NOT NULL,
        UNIQUE(session_file, entry_key)
      );
    `);
  }

  insert(record: AttributionRecord): Promise<boolean> {
    return this.insertReconciled(record, record.entryKey);
  }

  insertReconciled(record: AttributionRecord, fallbackEntryKey: string): Promise<boolean> {
    return this.enqueue(record.worktreeRoot, async (store, scope) => {
      const entryKey = await canonicalEntryKey(store, scope, record);
      const name = logicalName("rows", record.sessionFile, entryKey);
      const key = consumerKey(scope, "attribution", SUBJECT, name);
      const current = await store.read(key);
      const fallbackName = logicalName("rows", record.sessionFile, fallbackEntryKey);
      const fallbackKey = consumerKey(scope, "attribution", SUBJECT, fallbackName);
      const fallback = fallbackName === name ? null : await store.read(fallbackKey);
      const original = current ?? fallback;
      const retained: AttributionRecord = original
        ? { ...parseRecord(original.bytes), entryKey }
        : { ...record, entryKey };
      const writes = [write(name, retained)];
      if (fallbackEntryKey !== entryKey) {
        const fallbackAlias = logicalName("aliases", record.sessionFile, fallbackEntryKey);
        // Distinct real entry IDs may share a fallback fingerprint. Preserve both;
        // an ID-less replay continues to refer to the first canonical delivery.
        if (!await store.read(consumerKey(scope, "attribution", SUBJECT, fallbackAlias))) {
          writes.push(write(fallbackAlias, { entryKey }));
        }
      }
      const receiptRun = createRunId();
      await commitConsumerBatch(store, scope, writes, { attemptId: receiptRun, runId: receiptRun, status: "attempted" });
      if (fallback) {
        await store.correct({ key: fallbackKey, predecessorRevision: fallback.revision, replacement: null, idempotencyKey: `reconcile:${fallback.revision}` });
      }
      // A successful delivery includes exact adapter readback, not a local marker.
      const read = await store.read(key);
      if (!read || !Buffer.from(read.bytes).equals(Buffer.from(writes[0]!.bytes))) throw new Error("Attribution retention readback mismatch");
      this.project(retained, fallbackEntryKey);
      return !original;
    });
  }

  records(cwd: string): Promise<AttributionRecord[]> {
    return this.enqueue(cwd, async (store, scope) => {
      const items = await store.list({ ...scope, publishedRevisionIds: [], subjectId: SUBJECT, kind: "attribution" });
      const aliases = new Set(items.filter((item) => item.key.logicalName.startsWith("aliases/")).map((item) => item.key.logicalName.replace(/^aliases\//u, "rows/")));
      return items.filter((item) => item.key.logicalName.startsWith("rows/") && !aliases.has(item.key.logicalName))
        .map((item) => parseRecord(item.bytes));
    });
  }

  private enqueue<T>(cwd: string, operation: (store: StorageStore, scope: ConsumerScope) => Promise<T>): Promise<T> {
    // Capture destination before earlier operations drain. Re-resolution also
    // refuses a changed selection, including after process restart.
    const bound = resolveConsumerContext(cwd);
    void bound.catch(() => undefined);
    const result = this.tail.then(async () => withBoundStore(cwd, await bound, (store, context) => operation(store, scopeOf(context))));
    this.tail = result.then(() => undefined, (error: unknown) => { this.failures.push(error); });
    return result;
  }

  async flush(): Promise<void> {
    await this.tail;
    const failures = this.failures.splice(0);
    if (failures.length === 1) throw failures[0];
    if (failures.length > 1) throw new AggregateError(failures, "Attribution persistence failed");
  }

  private project(record: AttributionRecord, fallbackEntryKey: string): void {
    if (!this.db) return;
    this.db.prepare(`DELETE FROM ${TABLE} WHERE session_file = ? AND entry_key = ?`).run(record.sessionFile, fallbackEntryKey);
    this.db.prepare(`INSERT OR REPLACE INTO ${TABLE} VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      record.recordedAt, record.sessionFile, record.sessionId, record.entryKey,
      record.projectKey, record.branch, record.worktreeRoot, record.provider, record.model, record.api,
      record.inputTokens, record.outputTokens, record.cacheReadTokens, record.cacheWriteTokens,
      record.reasoningTokens, record.totalTokens, record.costUsd, record.costSource,
    );
  }

  async close(): Promise<void> {
    try { await this.flush(); }
    finally { this.db?.close(); }
  }
}
