import { createHash, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { ArtifactKey, ArtifactRevision, StorageStore } from "./contract.js";
import { discoverStoredContext, lookupKnowledge } from "./domain.js";

export type ConformanceStore = Pick<StorageStore, "read" | "list" | "search" | "writeBatch" | "correct" | "transition" | "inspectLifecycle" | "writeReceipt" | "readReceipt">;
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
    it("uses the branch revision as an overlay over a published baseline", async () => {
      const instance = await backend.create();
      try {
        const baselineKey: ArtifactKey = { projectId: "fixture-project", subjectId: "fixture-subject", kind: "plan", logicalName: "plan.md", branchId: "main" };
        const branchKey = { ...baselineKey, branchId: "branch-a" };
        await instance.store.writeBatch([
          revision(baselineKey, "baseline-r1", "published baseline", null),
          revision(branchKey, "branch-r1", "private branch draft", null),
        ]);
        const result = await instance.store.list({
          projectId: "fixture-project",
          branchId: "branch-a",
          publishedRevisionIds: ["baseline-r1"],
        });
        expect(result.map((item) => item.revision)).toEqual(["branch-r1"]);
        expect(new TextDecoder().decode((await instance.store.read(baselineKey))!.bytes)).toBe("published baseline");
        expect(new TextDecoder().decode((await instance.store.read(baselineKey, "baseline-r1"))!.bytes)).toBe("published baseline");
        const published = await instance.store.list({ projectId: "fixture-project", branchId: "branch-b", publishedRevisionIds: ["baseline-r1"] });
        expect(published.map((item) => item.revision)).toEqual(["baseline-r1"]);
        expect(new TextDecoder().decode(published[0]!.bytes)).toBe("published baseline");
      } finally {
        instance.dispose();
      }
    });

    it("binds receipt completion to the attempted run, project, branch, and worktree", async () => {
      const instance = await backend.create();
      try {
        const attempted = {
          projectId: "fixture-project",
          branchId: "branch-a",
          worktreeId: "worktree-a",
          runId: "run-a",
          attemptId: "attempt-a",
          status: "attempted" as const,
          artifactRevisions: [] as string[],
          kind: "no-fact" as const,
          metadataDuties: ["probe"],
        };
        await instance.store.writeReceipt(attempted);
        await expect(instance.store.writeReceipt({ ...attempted, branchId: "branch-b", status: "complete" })).rejects.toThrow(/identity|scope/i);
        expect(await instance.store.readReceipt("fixture-project", "run-a")).toMatchObject({ status: "attempted", branchId: "branch-a" });
        await instance.store.writeReceipt({ ...attempted, status: "complete" });
        expect(await instance.store.readReceipt("fixture-project", "run-a")).toMatchObject({ status: "complete", attemptId: "attempt-a", kind: "no-fact" });
      } finally {
        instance.dispose();
      }
    });
    it("refuses a complete receipt whose revision set or readback does not match the attempt", async () => {
      const instance = await backend.create();
      try {
        const key: ArtifactKey = { projectId: "fixture-project", subjectId: "fixture-subject", kind: "memory", logicalName: "saved.md", branchId: "branch-a" };
        await instance.store.writeBatch([revision(key, "saved-r1", "saved", null)]);
        const attempted = { projectId: "fixture-project", branchId: "branch-a", worktreeId: "worktree-a", runId: "run-rows", attemptId: "attempt-rows", status: "attempted" as const, artifactRevisions: ["saved-r1"], kind: "rows" as const, metadataDuties: ["readback"] };
        await instance.store.writeReceipt(attempted);
        await expect(instance.store.writeReceipt({ ...attempted, status: "complete", artifactRevisions: ["missing"] })).rejects.toThrow(/revision set|uncertain persistence/i);
        await expect(instance.store.writeReceipt({ ...attempted, status: "complete", metadataDuties: [] })).rejects.toThrow(/readback/i);
        await instance.store.writeReceipt({ ...attempted, status: "complete" });
        expect(await instance.store.readReceipt("fixture-project", "run-rows")).toMatchObject({ status: "complete", artifactRevisions: ["saved-r1"] });
      } finally { instance.dispose(); }
    });
    it("requires every attempt-bound metadata duty for row and no-fact completion", async () => {
      const instance = await backend.create();
      try {
        const key: ArtifactKey = { projectId: "fixture-project", subjectId: "fixture-subject", kind: "memory", logicalName: "saved.md", branchId: "branch-a" };
        await instance.store.writeBatch([revision(key, "duty-fact", "saved fact", null)]);
        for (const kind of ["rows", "no-fact"] as const) {
          const readDuty = kind === "rows" ? "readback" : "probe";
          const attempted = { projectId: key.projectId, branchId: key.branchId!, worktreeId: "worktree-a", runId: `duties-${kind}`, attemptId: `attempt-${kind}`, status: "attempted" as const, artifactRevisions: kind === "rows" ? ["duty-fact"] : [], kind, metadataDuties: [readDuty, "backlog", "phase-status", "draft-commit"] };
          await instance.store.writeReceipt(attempted);
          await expect(instance.store.writeReceipt({ ...attempted, metadataDuties: [readDuty] })).rejects.toThrow(/required metadata duties/);
          for (const missing of ["backlog", "phase-status", "draft-commit"]) {
            await expect(instance.store.writeReceipt({ ...attempted, status: "complete", metadataDuties: attempted.metadataDuties.filter((duty) => duty !== missing) })).rejects.toThrow(/successful metadata duties/);
            expect(await instance.store.readReceipt(key.projectId, attempted.runId)).toEqual(attempted);
          }
          // Perform and verify metadata work before attesting its success.
          const metadata = ["backlog", "phase-status", "draft-commit"].map((duty) => revision({ ...key, kind: "backlog", logicalName: `${kind}-${duty}.md` }, `${kind}-${duty}`, `completed ${duty}`, null));
          await instance.store.writeBatch(metadata);
          for (const item of metadata) expect((await instance.store.read(item.key, item.revision))?.bytes).toEqual(item.bytes);
          await instance.store.writeReceipt({ ...attempted, status: "complete" });
          expect(await instance.store.readReceipt(key.projectId, attempted.runId)).toEqual({ ...attempted, status: "complete" });
        }
      } finally { instance.dispose(); }
    });
    it("keeps corrections branch-scoped and refuses lifecycle transitions without evidence", async () => {
      const instance = await backend.create();
      try {
        const keyA: ArtifactKey = { projectId: "fixture-project", subjectId: "fixture-subject", kind: "memory", logicalName: "note.md", branchId: "branch-a" };
        const keyB = { ...keyA, branchId: "branch-b" };
        await instance.store.writeBatch([revision(keyA, "a1", "branch A", null), revision(keyB, "b1", "published baseline", null)]);
        const corrected = revision(keyA, "a2", "corrected", "a1");
        await instance.store.correct({ key: keyA, predecessorRevision: "a1", replacement: corrected, idempotencyKey: "correct-a" });
        expect((await instance.store.correct({ key: keyA, predecessorRevision: "a1", replacement: corrected, idempotencyKey: "correct-a" }))?.revision).toBe("a2");
        await expect(instance.store.correct({ key: keyA, predecessorRevision: "a1", replacement: revision(keyA, "a3", "other", "a1"), idempotencyKey: "correct-a" })).rejects.toThrow(/idempotency/i);
        expect(new TextDecoder().decode((await instance.store.read(keyB))!.bytes)).toBe("published baseline");
        expect(new TextDecoder().decode((await instance.store.read(keyA))!.bytes)).toBe("corrected");
        await instance.store.correct({ key: keyA, predecessorRevision: "a2", replacement: null, idempotencyKey: "tombstone-a" });
        expect(await instance.store.read(keyA)).toBeNull();
        expect(await instance.store.list({ projectId: "fixture-project", branchId: "branch-a", publishedRevisionIds: ["b1"] })).toEqual([]);
        expect(new TextDecoder().decode((await instance.store.read(keyB, "b1"))!.bytes)).toBe("published baseline");

        const subjectA = { ...keyA, kind: "subject-index" as const, logicalName: "index.md" };
        const planA = { ...subjectA, kind: "plan" as const, logicalName: "plan-topic.md" };
        const subjectB = { ...subjectA, branchId: "branch-b" };
        await instance.store.writeBatch([
          revision(subjectA, "index-a", ACTIVE_INDEX, null),
          revision(planA, "plan-a", OPEN_PLAN, null),
          revision(subjectB, "index-b", MALFORMED_INDEX, null),
        ]);
        await expect(instance.store.transition({ projectId: subjectA.projectId, branchId: "branch-a", subjectId: subjectA.subjectId, fromRevision: "index-a", expectedState: "active", intent: { kind: "close-verified" }, evidence: ["verified checkpoint"] })).rejects.toThrow(/evidence/i);
        await instance.store.writeBatch([revision(planA, "plan-a2", COMPLETED_PLAN, "plan-a")]);
        await instance.store.transition({ projectId: subjectA.projectId, branchId: "branch-a", subjectId: subjectA.subjectId, fromRevision: "index-a", expectedState: "active", intent: { kind: "close-verified" }, evidence: ["verified checkpoint"] });
        expect(await instance.store.inspectLifecycle(subjectA.projectId, "branch-a", subjectA.subjectId)).toMatchObject({ state: "completed" });
        expect(await instance.store.inspectLifecycle(subjectA.projectId, "branch-b", subjectA.subjectId)).toMatchObject({ provenance: "malformed" });
        await expect(instance.store.transition({ projectId: subjectB.projectId, branchId: "branch-b", subjectId: subjectB.subjectId, fromRevision: "index-b", expectedState: "active", intent: { kind: "activate" }, evidence: ["stale"] })).rejects.toThrow(/malformed/i);
        await expect(instance.store.transition({ projectId: subjectA.projectId, branchId: "branch-a", subjectId: subjectA.subjectId, fromRevision: "index-a", expectedState: "active", intent: { kind: "activate" }, evidence: ["stale"] })).rejects.toThrow(/stale|refused/i);
      } finally {
        instance.dispose();
      }
    });
    it("pages visible knowledge after hiding higher-scoring private candidates", async () => {
      const instance = await backend.create();
      try {
        const privateKey: ArtifactKey = { projectId: "fixture-project", subjectId: "fixture-subject", kind: "memory", logicalName: "private.md", branchId: "branch-b" };
        const firstKey = { ...privateKey, logicalName: "alpha.md", branchId: "branch-a" };
        const secondKey = { ...firstKey, logicalName: "beta.md" };
        await instance.store.writeBatch([
          revision(privateKey, "private-rank", "secret ".repeat(20), null),
          revision(firstKey, "visible-alpha", "secret", null),
          revision(secondKey, "visible-beta", "secret", null),
        ]);
        const query = { projectId: "fixture-project", branchId: "branch-a", publishedRevisionIds: [] as string[], text: "secret", limit: 1 };
        const first = await lookupKnowledge(instance.store, query);
        const second = await lookupKnowledge(instance.store, { ...query, cursor: first[0]?.revision });
        expect(first.map((item) => item.revision)).toEqual(["visible-alpha"]);
        expect(second.map((item) => item.revision)).toEqual(["visible-beta"]);
      } finally { instance.dispose(); }
    });
    it("discovers links and backlog from the branch overlay and excludes completed subjects", async () => {
      const instance = await backend.create();
      try {
        const active: ArtifactKey = { projectId: "fixture-project", subjectId: "open-subject", kind: "backlog", logicalName: "todo.md", branchId: "branch-a" };
        const closed = { ...active, subjectId: "closed-subject" };
        const linkTarget: ArtifactKey = { projectId: "fixture-project", subjectId: "closed-subject", kind: "memory", logicalName: "note.md", branchId: "branch-a" };
        const linked = { ...revision(active, "backlog-open", "open", null), links: [linkTarget] };
        const closedIndex = { ...closed, kind: "subject-index" as const, logicalName: "index.md" };
        const closedPlan = { ...closedIndex, kind: "plan" as const, logicalName: "plan-topic.md" };
        await instance.store.writeBatch([
          linked,
          revision(closed, "backlog-closed", "closed", null),
          revision(closedIndex, "closed-index", ACTIVE_INDEX, null),
          revision(closedPlan, "closed-plan", COMPLETED_PLAN, null),
        ]);
        await instance.store.transition({ projectId: "fixture-project", branchId: "branch-a", subjectId: "closed-subject", fromRevision: "closed-index", expectedState: "active", intent: { kind: "close-verified" }, evidence: ["verified checkpoint"] });
        const discovered = await discoverStoredContext(instance.store, { projectId: "fixture-project", branchId: "branch-a", publishedRevisionIds: [] });
        expect(discovered.backlog.map((item) => item.revision)).toEqual(["backlog-open"]);
        expect(discovered.links).toEqual([]);
        const filtered = await discoverStoredContext(instance.store, { projectId: "fixture-project", branchId: "branch-a", publishedRevisionIds: [], kind: "backlog", logicalNamePrefix: "todo" });
        expect(filtered.backlog.map((item) => item.revision)).toEqual(["backlog-open"]);
        expect(filtered.links).toEqual([]);
        const otherBranch = { ...closed, branchId: "branch-b" };
        await instance.store.writeBatch([revision(otherBranch, "backlog-b", "still private", null)]);
        const branchB = await discoverStoredContext(instance.store, { projectId: "fixture-project", branchId: "branch-b", publishedRevisionIds: [] });
        expect(branchB.backlog.map((item) => item.revision)).toEqual(["backlog-b"]);
      } finally { instance.dispose(); }
    });
    it("resolves published legacy lifecycle before kind, name, and linked-source filters", async () => {
      const instance = await backend.create();
      try {
        const closed: ArtifactKey = { projectId: "fixture-project", subjectId: "closed-subject", branchId: "main", kind: "subject-index", logicalName: "index.md" };
        const backlog = { ...closed, kind: "backlog" as const, logicalName: "todo.md" };
        const source = { ...backlog, subjectId: "open-subject", branchId: "branch-a" };
        await instance.store.writeBatch([
          revision(closed, "legacy-index", "---\nstatus: active\n---\n", null),
          revision({ ...closed, kind: "plan", logicalName: "plan-topic.md" }, "legacy-plan", COMPLETED_PLAN, null),
          revision(backlog, "legacy-backlog", "closed task", null),
          { ...revision(source, "linked-open", "open task", null), links: [backlog] },
        ]);
        const query = { projectId: closed.projectId, branchId: "branch-a", publishedRevisionIds: ["legacy-index", "legacy-plan", "legacy-backlog"] };
        expect((await discoverStoredContext(instance.store, { ...query, kind: "backlog" })).backlog.map((item) => item.revision)).toEqual(["linked-open"]);
        expect((await discoverStoredContext(instance.store, { ...query, kind: "subject-index", logicalNamePrefix: "index" })).subjects).toEqual([]);
        expect((await discoverStoredContext(instance.store, { ...query, subjectId: source.subjectId, kind: "backlog", logicalNamePrefix: "todo" })).links).toEqual([]);
        expect((await discoverStoredContext(instance.store, { ...query, subjectId: closed.subjectId, logicalNamePrefix: "todo" })).backlog).toEqual([]);
      } finally { instance.dispose(); }
    });
    it("loads the immutable revision selected before a concurrent pointer update", async () => {
      const instance = await backend.create();
      const originalRead = instance.store.read.bind(instance.store);
      try {
        const key: ArtifactKey = { projectId: "fixture-project", subjectId: "fixture-subject", kind: "memory", logicalName: "note.md", branchId: "main" };
        await instance.store.writeBatch([revision(key, "selected", "published bytes", null)]);
        let advanced = false;
        instance.store.read = async (requested, selected) => {
          if (!advanced) {
            advanced = true;
            await instance.store.writeBatch([revision(key, "private", "private bytes", "selected")]);
          }
          return originalRead(requested, selected);
        };
        const items = await instance.store.list({ projectId: key.projectId, branchId: "branch-b", publishedRevisionIds: ["selected"] });
        expect(items.map((item) => item.revision)).toEqual(["selected"]);
        expect(new TextDecoder().decode(items[0]!.bytes)).toBe("published bytes");
        expect((await originalRead(key))?.revision).toBe("private");
      } finally { instance.store.read = originalRead; instance.dispose(); }
    });
    it("keeps published bytes searchable and pageable after their owner advances privately", async () => {
      const instance = await backend.create();
      try {
        const key: ArtifactKey = { projectId: "fixture-project", subjectId: "fixture-subject", kind: "memory", logicalName: "note.md", branchId: "main" };
        await instance.store.writeBatch([revision(key, "v1", "published needle", null)]);
        await instance.store.writeBatch([revision(key, "v2", "private needle", "v1")]);
        const query = { projectId: key.projectId, branchId: "branch-b", publishedRevisionIds: ["v1"], limit: 1 };
        for (const items of [await instance.store.list(query), await instance.store.search({ ...query, text: "needle" })]) {
          expect(items.map((item) => item.revision)).toEqual(["v1"]);
          expect(new TextDecoder().decode(items[0]!.bytes)).toBe("published needle");
        }
        expect(await instance.store.list({ ...query, cursor: "v1" })).toEqual([]);
        expect((await instance.store.list({ ...query, branchId: "main" })).map((item) => item.revision)).toEqual(["v2"]);
      } finally { instance.dispose(); }
    });

    it("corrects and tombstones inherited predecessors without touching their published owner", async () => {
      const instance = await backend.create();
      try {
        const key: ArtifactKey = { projectId: "fixture-project", subjectId: "fixture-subject", kind: "memory", logicalName: "note.md", branchId: "main" };
        await instance.store.writeBatch([revision(key, "published", "baseline", null)]);
        const overlay = { ...key, branchId: "branch-a" };
        const correction = { key: overlay, predecessorRevision: "published", replacement: revision(overlay, "corrected", "branch correction", null), idempotencyKey: "first", publishedRevisionIds: ["published"] };
        await expect(instance.store.correct({ ...correction, publishedRevisionIds: [] })).rejects.toThrow(/stale/);
        await instance.store.correct(correction);
        expect((await instance.store.correct(correction))?.revision).toBe("corrected");
        const query = { projectId: key.projectId, branchId: "branch-b", publishedRevisionIds: ["published"] };
        expect((await instance.store.list(query)).map((item) => item.revision)).toEqual(["published"]);
        await instance.store.correct({ ...correction, key: { ...key, branchId: "branch-c" }, replacement: null, idempotencyKey: "delete" });
        expect(await instance.store.list({ ...query, branchId: "branch-c" })).toEqual([]);
        expect(new TextDecoder().decode((await instance.store.read(key, "published"))!.bytes)).toBe("baseline");
      } finally { instance.dispose(); }
    });

    it("binds first lifecycle intents to the index and preserves published close/private reopen views", async () => {
      const instance = await backend.create();
      try {
        const scope = { projectId: "fixture-project", branchId: "main", subjectId: "fixture-subject" };
        const input = { ...scope, fromRevision: null, expectedState: "missing" as const, intent: { kind: "initialize" as const }, evidence: [] };
        const draft = await instance.store.transition(input);
        expect(await instance.store.inspectLifecycle(scope.projectId, scope.branchId, scope.subjectId)).toMatchObject({ state: "draft", provenance: "canonical" });
        const active = await instance.store.transition({ ...input, fromRevision: draft, expectedState: "draft", intent: { kind: "activate" } });
        const plan: ArtifactKey = { ...scope, kind: "plan", logicalName: "plan-topic.md" };
        await instance.store.writeBatch([revision(plan, "finished-plan", COMPLETED_PLAN, null)]);
        const close = { ...input, fromRevision: active, expectedState: "active" as const, intent: { kind: "close-verified" as const } };
        await expect(instance.store.transition({ ...close, fromRevision: "not-current" })).rejects.toThrow(/stale/);
        const closed = await instance.store.transition(close);
        await expect(instance.store.transition({ ...close, fromRevision: closed, expectedState: "completed", intent: { kind: "reopen", reason: "" } })).rejects.toThrow(/reason/);
        const query = { projectId: scope.projectId, branchId: "branch-b", publishedRevisionIds: [closed, "finished-plan"] };
        expect((await discoverStoredContext(instance.store, query)).subjects).toEqual([]);
        expect(await instance.store.inspectLifecycle(scope.projectId, "branch-b", scope.subjectId, query.publishedRevisionIds)).toMatchObject({ state: "completed", revision: closed });
        const reopened = await instance.store.transition({ ...close, branchId: "branch-a", fromRevision: closed, expectedState: "completed", intent: { kind: "reopen", reason: "new work" }, publishedRevisionIds: query.publishedRevisionIds });
        expect((await discoverStoredContext(instance.store, { ...query, branchId: "branch-a" })).subjects.map((item) => item.revision)).toEqual([reopened]);
        expect((await discoverStoredContext(instance.store, query)).subjects).toEqual([]);
      } finally { instance.dispose(); }
    });

    it("refuses receipt readback from another run or worktree while accepting branch and matching-run facts", async () => {
      const instance = await backend.create();
      try {
        const key: ArtifactKey = { projectId: "fixture-project", branchId: "branch-a", subjectId: "fixture-subject", kind: "memory", logicalName: "note.md" };
        const run = "run-11111111-1111-4111-8111-111111111111";
        const worktree = "worktree-11111111-1111-4111-8111-111111111111";
        const otherRun = "run-22222222-2222-4222-8222-222222222222";
        const otherTree = "worktree-22222222-2222-4222-8222-222222222222";
        for (const id of ["wrong-run", "wrong-tree", "branch-fact", "matching"]) {
          const receiptRun = id === "matching" ? run : `run-${randomUUID()}`;
          const artifactKey = id === "branch-fact" ? { ...key, logicalName: `${id}.md` } : {
            ...key, logicalName: `${id}.md`, runId: id === "wrong-run" ? otherRun : receiptRun,
            worktreeId: id === "wrong-tree" ? otherTree : worktree,
          };
          await instance.store.writeBatch([revision(artifactKey, id, id, null)]);
          const attempted = { projectId: key.projectId, branchId: key.branchId!, runId: receiptRun, worktreeId: worktree, attemptId: id, status: "attempted" as const, artifactRevisions: [id], metadataDuties: ["readback"], kind: "rows" as const };
          await instance.store.writeReceipt(attempted);
          if (id.startsWith("wrong")) await expect(instance.store.writeReceipt({ ...attempted, status: "complete" })).rejects.toThrow(/readback|persistence/);
          else {
            await instance.store.writeReceipt({ ...attempted, status: "complete" });
            expect(await instance.store.readReceipt(key.projectId, attempted.runId)).toMatchObject({ status: "complete", artifactRevisions: [id] });
          }
        }
      } finally { instance.dispose(); }
    });
  });
}

const ACTIVE_INDEX = "---\nstatus: active\nlifecycle_schema: 1\nlifecycle_revision: 1\nlifecycle_last_transition: activate\n---\n";
const MALFORMED_INDEX = "---\nstatus: active\nlifecycle_schema: 2\nlifecycle_revision: 1\nlifecycle_last_transition: activate\n---\n";
const OPEN_PLAN = "---\nstatus: active\n---\n\n## Acceptance criteria\n- [ ] open\n";
const COMPLETED_PLAN = "---\nstatus: completed\n---\n\n## Acceptance criteria\n- [x] done\n";

function revision(key: ArtifactKey, id: string, body: string, expectedRevision: string | null): ArtifactRevision {
  const bytes = new TextEncoder().encode(body);
  return { key, revision: id, bytes, sha256: createHash("sha256").update(bytes).digest("hex"), author: "fixture", source: "conformance", createdAt: "2026-01-01T00:00:00.000Z", links: [], expectedRevision };
}
