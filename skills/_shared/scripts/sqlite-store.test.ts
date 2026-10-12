import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { defineStorageConformance, type ConformanceBackend } from "../storage/conformance.js";
import { loadSQLiteModule } from "../storage/sqlite-capability.js";
import { SQLiteStorageStore } from "../storage/sqlite-store.js";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

const backend: ConformanceBackend = {
  name: "on-disk SQLite adapter",
  async create() {
    const root = await mkdtemp(join(tmpdir(), "buck-sqlite-"));
    roots.push(root);
    const store = await SQLiteStorageStore.open(join(root, "storage.sqlite"));
    return { store, dispose: () => store.close() };
  },
};

defineStorageConformance(backend);

describe("SQLite adapter disk persistence", () => {
  it("retains committed binary bytes after closing and reopening the database", async () => {
    const root = await mkdtemp(join(tmpdir(), "buck-sqlite-reopen-"));
    roots.push(root);
    const path = join(root, "storage.sqlite");
    const bytes = new Uint8Array([0, 255, 1, 0]);
    const revision = { key: { projectId: "p", subjectId: "s", kind: "attachment" as const, logicalName: "asset.bin", branchId: "branch-a" }, revision: randomUUID(), bytes, sha256: createHash("sha256").update(bytes).digest("hex"), author: "test", source: "fixture", createdAt: new Date(0).toISOString(), links: [], expectedRevision: null };
    const store = await SQLiteStorageStore.open(path);
    await store.writeBatch([revision]);
    store.close();
    const reopened = await SQLiteStorageStore.open(path);
    try { expect((await reopened.read(revision.key))?.bytes).toEqual(bytes); }
    finally { reopened.close(); }
  });

  it("keeps a backup snapshot stable after a later write", async () => {
    const root = await mkdtemp(join(tmpdir(), "buck-sqlite-backup-"));
    roots.push(root);
    const path = join(root, "storage.sqlite");
    const bytes = new Uint8Array([0, 255, 1, 0]);
    const key = { projectId: "p", subjectId: "s", kind: "attachment" as const, logicalName: "asset.bin", branchId: "branch-a" };
    const first = { key, revision: "backup-r1", bytes, sha256: createHash("sha256").update(bytes).digest("hex"), author: "test", source: "fixture", createdAt: new Date(0).toISOString(), links: [], expectedRevision: null };
    const store = await SQLiteStorageStore.open(path);
    await store.writeBatch([first]);
    await store.backup(join(root, "backup.sqlite"));
    const later = new Uint8Array([9]);
    await store.writeBatch([{ ...first, revision: "backup-r2", bytes: later, sha256: createHash("sha256").update(later).digest("hex"), expectedRevision: first.revision }]);
    store.close();
    const restored = await SQLiteStorageStore.open(join(root, "backup.sqlite"));
    try {
      expect((await restored.read(key))?.bytes).toEqual(bytes);
      expect((await restored.read(key))?.revision).toBe("backup-r1");
    } finally { restored.close(); }
  });

  it("fails a lock-contended write without replacing the committed revision", async () => {
    const root = await mkdtemp(join(tmpdir(), "buck-sqlite-lock-"));
    roots.push(root);
    const path = join(root, "storage.sqlite");
    const store = await SQLiteStorageStore.open(path, { busyTimeoutMs: 100 });
    const key = { projectId: "p", subjectId: "s", kind: "plan" as const, logicalName: "plan.md", branchId: "branch-a" };
    const bytes = new TextEncoder().encode("committed");
    const first = { key, revision: "lock-r1", bytes, sha256: createHash("sha256").update(bytes).digest("hex"), author: "test", source: "fixture", createdAt: new Date(0).toISOString(), links: [], expectedRevision: null };
    await store.writeBatch([first]);
    const { DatabaseSync } = await loadSQLiteModule();
    const other = new DatabaseSync(path) as { exec(sql: string): void; close(): void };
    other.exec("BEGIN IMMEDIATE");
    const nextBytes = new TextEncoder().encode("contended");
    const started = Date.now();
    await expect(store.writeBatch([{ ...first, revision: "lock-r2", bytes: nextBytes, sha256: createHash("sha256").update(nextBytes).digest("hex"), expectedRevision: "lock-r1" }])).rejects.toThrow(/locked/i);
    expect(Date.now() - started).toBeLessThan(1_000);
    expect((await store.read(key))?.revision).toBe("lock-r1");
    other.exec("ROLLBACK");
    other.close();
    store.close();
  });
});
