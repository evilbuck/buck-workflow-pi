import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { afterAll, describe, expect, it } from "vitest";
import type { MigrationPool } from "../../../extensions/sql-memory/migrations.js";
import type { ArtifactKey, ArtifactRevision } from "../storage/contract.js";
import { defineStorageConformance, type ConformanceBackend } from "../storage/conformance.js";
import { PostgresStorageStore } from "../storage/postgres-store.js";
import { createBranchIdentity } from "../storage/identity.js";

const databaseUrl = process.env.BUCK_WORKFLOW_TEST_DATABASE_URL;
const require = createRequire(import.meta.url);
const pg = require("pg") as { Pool: new (options: { connectionString: string; max: number }) => MigrationPool & { end(): Promise<void> } };
const pool = databaseUrl ? new pg.Pool({ connectionString: databaseUrl, max: 4 }) : undefined;
const store = pool ? new PostgresStorageStore(pool) : undefined;

afterAll(async () => { await pool?.end(); });

describe.skipIf(!databaseUrl || !pool || !store)("PostgreSQL storage adapter", () => {
  const backend: ConformanceBackend = {
    name: "disposable PostgreSQL adapter",
    async create() {
      await store!.migrate();
      const client = await pool!.connect();
      try {
        await client.query("BEGIN");
        await client.query("DELETE FROM artifact_pointers WHERE project_id=$1", ["fixture-project"]);
        await client.query("DELETE FROM artifact_revisions WHERE project_id=$1", ["fixture-project"]);
        await client.query("DELETE FROM artifact_lifecycle WHERE subject_id=$1", ["fixture-subject"]);
        await client.query("COMMIT");
      } catch (error) {
        try { await client.query("ROLLBACK"); } catch { /* Preserve cleanup failure. */ }
        throw error;
      } finally { client.release(); }
      return { store: store!, dispose: () => undefined };
    },
  };
  defineStorageConformance(backend);

  it("persists project-scoped branch incarnations with ref and lineage evidence", async () => {
    await store!.migrate();
    const projectId = `branches-${randomUUID()}`;
    const otherProject = `branches-${randomUUID()}`;
    const first = createBranchIdentity("refs/heads/topic", "a".repeat(40));
    const reused = createBranchIdentity("refs/heads/topic", "b".repeat(40));
    const insert = "INSERT INTO artifact_branches(project_id,branch_id,ref,incarnation,initial_tip,observed_tip,integration_tip,parent_branch_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)";
    try {
      await pool!.query(insert, [projectId, first.branchId, first.ref, first.incarnation, first.initialTip, "c".repeat(40), "d".repeat(40), null]);
      await pool!.query(insert, [projectId, reused.branchId, reused.ref, reused.incarnation, reused.initialTip, "e".repeat(40), "d".repeat(40), first.branchId]);
      await pool!.query(insert, [otherProject, first.branchId, first.ref, first.incarnation, first.initialTip, first.initialTip, null, null]);
      const rows = await pool!.query("SELECT project_id,branch_id,ref,incarnation,initial_tip,observed_tip,integration_tip,parent_branch_id FROM artifact_branches WHERE project_id=$1 ORDER BY initial_tip", [projectId]);
      expect(rows.rows).toEqual([
        { project_id: projectId, branch_id: first.branchId, ref: first.ref, incarnation: first.incarnation, initial_tip: first.initialTip, observed_tip: "c".repeat(40), integration_tip: "d".repeat(40), parent_branch_id: null },
        { project_id: projectId, branch_id: reused.branchId, ref: reused.ref, incarnation: reused.incarnation, initial_tip: reused.initialTip, observed_tip: "e".repeat(40), integration_tip: "d".repeat(40), parent_branch_id: first.branchId },
      ]);
      await expect(pool!.query(insert, [otherProject, `branch-${randomUUID()}`, reused.ref, randomUUID(), reused.initialTip, reused.initialTip, null, reused.branchId])).rejects.toMatchObject({ code: "23503" });
      const isolated = await pool!.query("SELECT observed_tip FROM artifact_branches WHERE project_id=$1 AND branch_id=$2", [otherProject, first.branchId]);
      expect(isolated.rows).toEqual([{ observed_tip: first.initialTip }]);
    } finally {
      await pool!.query("DELETE FROM artifact_branches WHERE project_id=$1 OR project_id=$2", [projectId, otherProject]);
    }
  });

  it("preserves exact binary revisions and isolates concurrent stale writers", async () => {
    await store!.migrate();
    const key: ArtifactKey = { projectId: `pg-${randomUUID()}`, subjectId: "subject", kind: "attachment", logicalName: "asset.bin", branchId: "branch-a" };
    const bytes = new Uint8Array([0, 255, 8, 0]);
    const makeRevision = (body: Uint8Array, expectedRevision: string | null): ArtifactRevision => ({ key, revision: randomUUID(), bytes: body, sha256: createHash("sha256").update(body).digest("hex"), author: "test", source: "integration", createdAt: new Date().toISOString(), links: [], expectedRevision });
    const first = makeRevision(bytes, null);
    await store!.writeBatch([first]);
    const left = makeRevision(new Uint8Array([1]), first.revision);
    const right = makeRevision(new Uint8Array([2]), first.revision);
    const outcomes = await Promise.allSettled([store!.writeBatch([left]), store!.writeBatch([right])]);
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);
    expect((await store!.read(key, first.revision))?.bytes).toEqual(bytes);
  });

  it("preserves memory ids, categories, ranks, and correction links through import", async () => {
    await store!.migrate();
    const projectId = `import-${randomUUID()}`;
    const original = { id: "11111111-1111-4111-8111-111111111111", category: "project", body: "original fact", author: "ada", projectId, branchId: "branch-a", createdAt: "2026-01-01T00:00:00.000Z", supersededBy: "22222222-2222-4222-8222-222222222222", ranks: [{ id: "rank-1", rater: "ada", score: 3 }] };
    const corrected = { id: "22222222-2222-4222-8222-222222222222", category: "decision", body: "corrected fact", author: "ada", projectId, branchId: "branch-a", createdAt: "2026-01-02T00:00:00.000Z", supersededBy: null, ranks: [{ id: "rank-2", rater: "bea", score: 5 }] };
    await store!.importMemoryRecords([original, corrected]);
    await store!.importMemoryRecords([original, corrected]);
    const imported = await store!.readMemoryImport(original.id, projectId);
    expect(imported).toEqual({ destinationRevision: original.id, category: "project", supersededBy: corrected.id, ranks: original.ranks, body: "original fact" });
    const successor = await store!.readMemoryImport(corrected.id, projectId);
    expect(successor?.destinationRevision).toBe(corrected.id);
    expect(successor?.body).toBe("corrected fact");
  });

  it("drops a revision whose transaction died before commit and keeps the prior pointer", async () => {
    await store!.migrate();
    const key: ArtifactKey = { projectId: `crash-${randomUUID()}`, subjectId: "subject", kind: "plan", logicalName: "plan.md", branchId: "branch-a" };
    const bytes = new TextEncoder().encode("committed");
    const first: ArtifactRevision = { key, revision: randomUUID(), bytes, sha256: createHash("sha256").update(bytes).digest("hex"), author: "test", source: "crash", createdAt: "2026-01-01T00:00:00.000Z", links: [], expectedRevision: null };
    await store!.writeBatch([first]);
    const ghost = randomUUID();
    const client = await pool!.connect();
    await client.query("BEGIN");
    await client.query("INSERT INTO artifact_revisions(project_id,subject_id,kind,logical_name,branch_id,worktree_id,run_id,revision,bytes,sha256,author,source,created_at,links) VALUES($1,$2,$3,$4,$5,'','',$6,$7,$8,'test','crash',now(),'[]'::jsonb)", [key.projectId, key.subjectId, key.kind, key.logicalName, key.branchId, ghost, Buffer.from(new Uint8Array([7])), "ab".repeat(32)]);
    // pg aborts the open transaction when release is asked to destroy the connection.
    const crashingClient: { release(destroy?: boolean): void } = client;
    crashingClient.release(true);
    expect((await store!.read(key))?.revision).toBe(first.revision);
    const visible = await pool!.query("SELECT revision FROM artifact_revisions WHERE revision = $1", [ghost]);
    expect(visible.rows).toEqual([]);
  });
});
