import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { ArtifactKey, ArtifactRevision, StorageStore } from "./contract.js";

export type ConformanceStore = Pick<StorageStore, "read" | "list" | "writeBatch" | "correct" | "transition">;
export interface ConformanceBackend {
  name: string;
  create(): Promise<{ store: ConformanceStore; dispose(): void }>;
}
export function defineStorageConformance(backend: ConformanceBackend): void {
  describe(`${backend.name} storage conformance`, () => {
    it("round-trips exact bytes and rolls back a stale multi-write batch", async () => {
      const instance = await backend.create();
      try {
        const key: ArtifactKey = { projectId: "fixture-project", subjectId: "fixture-subject", kind: "plan", logicalName: "plan.md", branchId: "branch-a" };
        const first = revision(key, "r1", "sealed body", null);
        await instance.store.writeBatch([first]);
        expect((await instance.store.read(key))?.bytes).toEqual(first.bytes);
        await expect(instance.store.writeBatch([revision(key, "r2", "first write", "r1"), revision(key, "r3", "stale body", "not-current")])).rejects.toThrow(/stale/i);
        expect(new TextDecoder().decode((await instance.store.read(key))!.bytes)).toBe("sealed body");
      } finally {
        instance.dispose();
      }
    });

    it("round-trips exact binary bytes and the declared hash", async () => {
      const instance = await backend.create();
      try {
        const key: ArtifactKey = { projectId: "fixture-project", subjectId: "fixture-subject", kind: "attachment", logicalName: "asset.bin", branchId: "branch-a" };
        const bytes = Uint8Array.from([0, 255, 10, 0, 1]);
        const item: ArtifactRevision = { key, revision: "bin-1", bytes, sha256: "7c59c5007eb69855ab4815d63c651125fb22aa7cad8c2c4fda9fb0ff8711b04c", author: "fixture", source: "conformance", createdAt: "2026-01-01T00:00:00.000Z", links: [], expectedRevision: null };
        await instance.store.writeBatch([item]);
        const read = await instance.store.read(key);
        expect(read?.bytes).toEqual(bytes);
        expect(read?.sha256).toBe("7c59c5007eb69855ab4815d63c651125fb22aa7cad8c2c4fda9fb0ff8711b04c");
        expect(read?.revision).toBe("bin-1");
      } finally { instance.dispose(); }
    });

    it("filters private revisions before applying the visible result limit", async () => {
      const instance = await backend.create();
      try {
        const base: ArtifactKey = { projectId: "fixture-project", subjectId: "fixture-subject", kind: "memory", logicalName: "note.md", branchId: "branch-b" };
        const privateRevision = { ...revision(base, "private-b", "private", null), createdAt: "2025-01-01T00:00:00.000Z" };
        const visibleKey = { ...base, branchId: "branch-a" };
        const visibleRevision = { ...revision(visibleKey, "visible-a", "visible", null), createdAt: "2026-01-01T00:00:00.000Z" };
        await instance.store.writeBatch([privateRevision, visibleRevision]);
        const result = await instance.store.list({ projectId: "fixture-project", branchId: "branch-a", publishedRevisionIds: [], limit: 1 });
        expect(result.map((item) => item.revision)).toEqual(["visible-a"]);
      } finally {
        instance.dispose();
      }
    });

    it("keeps corrections branch-scoped and refuses lifecycle transitions without evidence", async () => {
      const instance = await backend.create();
      try {
        const keyA: ArtifactKey = { projectId: "fixture-project", subjectId: "fixture-subject", kind: "memory", logicalName: "note.md", branchId: "branch-a" };
        const keyB = { ...keyA, branchId: "branch-b" };
        await instance.store.writeBatch([revision(keyA, "a1", "branch A", null), revision(keyB, "b1", "published baseline", null)]);
        await instance.store.correct({ key: keyA, predecessorRevision: "a1", replacement: revision(keyA, "a2", "corrected", "a1"), idempotencyKey: "correct-a" });
        expect(new TextDecoder().decode((await instance.store.read(keyB))!.bytes)).toBe("published baseline");
        expect(new TextDecoder().decode((await instance.store.read(keyA))!.bytes)).toBe("corrected");

        const subjectKey = { ...keyA, kind: "subject-index" as const, logicalName: "index.md" };
        await instance.store.writeBatch([revision(subjectKey, "subject-r1", "active", null)]);
        await expect(instance.store.transition({ subjectId: subjectKey.subjectId, fromRevision: "subject-r1", expectedState: "active", nextState: "completed", evidence: [] })).rejects.toThrow(/evidence/i);
        await instance.store.transition({ subjectId: subjectKey.subjectId, fromRevision: "subject-r1", expectedState: "active", nextState: "completed", evidence: ["verified checkpoint"] });
        await expect(instance.store.transition({ subjectId: subjectKey.subjectId, fromRevision: "subject-r1", expectedState: "active", nextState: "active", evidence: ["stale"] })).rejects.toThrow(/stale|refused/i);
      } finally {
        instance.dispose();
      }
    });
  });
}

function revision(key: ArtifactKey, id: string, body: string, expectedRevision: string | null): ArtifactRevision {
  const bytes = new TextEncoder().encode(body);
  return { key, revision: id, bytes, sha256: createHash("sha256").update(bytes).digest("hex"), author: "fixture", source: "conformance", createdAt: "2026-01-01T00:00:00.000Z", links: [], expectedRevision };
}
