import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ArtifactKey, ArtifactRevision } from "../storage/contract.js";
import { FileStorageStore } from "../storage/file-store.js";
import { SQLiteStorageStore } from "../storage/sqlite-store.js";
import { dryRun, importSnapshot, prepareCutover, quarantineLegacy, resumeImport, switchCutover } from "../storage/cutover.js";
import { digest, emptySnapshot, legacySnapshot, scopeSnapshot, selectSnapshot, type MigrationSnapshot } from "../storage/migration.js";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "cutover-")); roots.push(root);
  const file = (name: string) => new FileStorageStore({ root: join(root, name), editableRoot: join(root, `${name}-edit`) });
  return { root, file };
}
function revision(body: string, links: ArtifactKey[] = []): ArtifactRevision {
  const bytes = Buffer.from(body);
  const key: ArtifactKey = { projectId: "project", branchId: "branch", subjectId: "subject", kind: "memory", logicalName: "fact.md" };
  return { key, revision: randomUUID(), bytes, sha256: createHash("sha256").update(bytes).digest("hex"), author: "test", source: "fixture", createdAt: new Date(0).toISOString(), links, expectedRevision: null };
}

describe("operational migration", () => {
  it("retains history, binary bytes, corrections, receipts and exact pointers across file/SQLite/file", async () => {
    const { root, file } = await fixture();
    const source = file("source");
    const first = revision("binary\0\ufffd", [revision("link").key]);
    await source.writeBatch([first]);
    const next = { ...revision("corrected"), expectedRevision: first.revision };
    const correction = { key: first.key, predecessorRevision: first.revision, idempotencyKey: "correction", replacement: next };
    await source.correct(correction);
    const receipt = { projectId: "project", branchId: "branch", worktreeId: "worktree", runId: "run", attemptId: "attempt", status: "attempted" as const, artifactRevisions: [next.revision], metadataDuties: ["index", "readback"] };
    await source.writeReceipt(receipt);
    await source.writeReceipt({ ...receipt, status: "complete" });
    await source.sealCheckpoint({ projectId: "project", branchId: "branch", commit: "a".repeat(40), integrationTip: "b".repeat(40), revisionSet: [{ revision: next.revision, sha256: next.sha256 }] });
    const manifest = await readFile(join(root, "source", "manifest.json"));
    const snapshot = await source.migrationSnapshot("project");
    expect(await readFile(join(root, "source", "manifest.json"))).toEqual(manifest);
    const sqlite = await SQLiteStorageStore.open(join(root, "destination.sqlite"));
    try {
      await importSnapshot(sqlite, join(root, "import.json"), "sqlite", snapshot);
      expect(await sqlite.migrationSnapshot("project")).toEqual(snapshot);
      expect((await sqlite.read(first.key, first.revision))?.bytes).toEqual(new Uint8Array(first.bytes));
      expect((await sqlite.read(first.key))?.revision).toBe(next.revision);
      expect(await sqlite.correct(correction)).toMatchObject({ revision: next.revision });
      expect(await sqlite.readReceipt("project", "run")).toMatchObject({ status: "complete", metadataDuties: ["index", "readback"] });
      const restored = file("restored");
      await importSnapshot(restored, join(root, "restore.json"), "file", await sqlite.migrationSnapshot("project"));
      expect(await restored.migrationSnapshot("project")).toEqual(snapshot);
      expect(await restored.correct(correction)).toMatchObject({ revision: next.revision });
    } finally { sqlite.close(); }
  });

  it("reopens staged import without partial visibility and replays a crash after data commit", async () => {
    const { root, file } = await fixture();
    const source = file("source");
    await source.writeBatch([revision("old")]);
    const snapshot = await source.migrationSnapshot("project");
    const journal = join(root, "attempt.json");
    expect((await resumeImport(file("destination"), journal, "destination", snapshot, 1)).complete).toBe(false);
    expect(await file("destination").list({ projectId: "project", branchId: "branch", publishedRevisionIds: [] })).toEqual([]);
    const staged = await readFile(journal, "utf8");
    await importSnapshot(file("destination"), journal, "destination", snapshot);
    await writeFile(journal, staged); // durable data committed, completion cursor acknowledgement lost
    await importSnapshot(file("destination"), journal, "destination", snapshot);
    expect(await file("destination").migrationSnapshot("project")).toEqual(snapshot);
    await expect(resumeImport(file("destination"), journal, "another-destination", snapshot)).rejects.toThrow(/binding/);
    expect((await stat(journal)).mode & 0o777).toBe(0o600);
  });

  it("reports destination-only records and metadata-only differences", async () => {
    const { file } = await fixture();
    await file("source").writeBatch([revision("bytes")]);
    const source = await file("source").migrationSnapshot("project");
    const destination = structuredClone(source);
    destination.tables.artifact_revisions[0]!.links = [{ ...revision("link").key, logicalName: "different.md" }];
    const report = dryRun(source, scopeSnapshot(destination));
    expect(report.sourceOnly).toHaveLength(1);
    expect(report.destinationOnly).toHaveLength(1);
    expect(report.sourceDigest).not.toBe(report.destinationDigest);
    const destinationOnly = dryRun(emptySnapshot("project"), source);
    expect(destinationOnly.after).toEqual([]);
    expect(destinationOnly.destinationOnly.map(row => row.table).sort()).toEqual(["artifact_pointers", "artifact_revisions", "artifact_search_text"]);
  });

  it("resumes after config replacement and rescues destination history before rollback", async () => {
    const { root, file } = await fixture();
    const source = file("source"), destination = file("destination");
    const first = revision("before"); await source.writeBatch([first]);
    const configPath = join(root, "config.yaml");
    const before = "version: 1\nprojects:\n  project:\n    origins: [https://example.org/repo]\n    storage:\n      adapter: repo-files\n";
    await writeFile(configPath, before);
    const path = join(root, "switch.json");
    await prepareCutover({ path, configPath, projectId: "project", projectKey: "project", source: { adapter: "repo-files" }, destination: { adapter: "sqlite", database: join(root, "test.sqlite") }, sourceStore: source, destinationStore: destination });
    await expect(switchCutover(path, source, destination, async () => { throw new Error("interrupted after config rename"); })).rejects.toThrow(/interrupted/);
    expect(await readFile(configPath, "utf8")).not.toBe(before);
    await switchCutover(path, source, destination, async () => {});
    const next = { ...revision("after"), expectedRevision: first.revision };
    await destination.correct({ key: first.key, predecessorRevision: first.revision, idempotencyKey: "post-switch", replacement: next });
    const rollback = await switchCutover(path, source, destination, async () => {}, true);
    expect(await readFile(configPath, "utf8")).toBe(before);
    const rescue = JSON.parse(await readFile(rollback.rescue!.path, "utf8")) as MigrationSnapshot;
    await importSnapshot(file("rescue"), join(root, "rescue-import.json"), "rescue", rescue);
    expect((await file("rescue").read(first.key))?.revision).toBe(next.revision);
    expect(await file("rescue").correctionLineage("project")).toEqual(new Map([[next.revision, first.revision]]));
    expect((await source.read(first.key))?.revision).toBe(first.revision);
    expect(digest(await destination.migrationSnapshot("project"))).toBe(rollback.rescue!.digest);
  });

  it("retains ambiguous named-branch and branchless legacy records in private recovery manifests", async () => {
    const { root, file } = await fixture();
    const records = [{ id: "named", branch: "main", body: "unknown checkpoint", category: "decision", ranks: [{ id: "rank", score: 9 }] }, { id: "branchless", body: "retained" }];
    const result = await quarantineLegacy(root, records);
    const manifestPath = join(root, result.recoveryScope, "manifest.json");
    expect(JSON.parse(await readFile(manifestPath, "utf8")).records).toEqual(records);
    expect(await quarantineLegacy(root, records)).toEqual(result);
    expect(await file("ordinary").list({ projectId: "project", branchId: "main", publishedRevisionIds: [] })).toEqual([]);
  });

  it("imports legacy categories, ranks and correction links without publishing guessed branch provenance", async () => {
    const { root, file } = await fixture();
    const records = [{ id: "old", branchId: "branch", body: "old fact", category: "decision", ranks: [{ id: "rank", rater: "ada", score: 8 }], supersededBy: "new" }, { id: "new", body: "new fact", category: "project", supersededBy: null, ranks: [] }];
    const snapshot = legacySnapshot("project", records);
    const store = await SQLiteStorageStore.open(join(root, "legacy.sqlite"));
    try { await importSnapshot(store, join(root, "legacy-import.json"), "legacy", snapshot); }
    finally { store.close(); }
    const reopened = await SQLiteStorageStore.open(join(root, "legacy.sqlite"), { readOnly: true });
    try {
      expect(await reopened.list({ projectId: "project", branchId: "branch", publishedRevisionIds: [] })).toEqual([]);
      const retained = await reopened.migrationSnapshot("project");
      expect(retained.tables.artifact_import_provenance.map(row => (row.source_metadata as Record<string, unknown>).originalRecord)).toEqual(expect.arrayContaining(records));
      await importSnapshot(file("legacy-file"), join(root, "legacy-file-import.json"), "legacy-file", retained);
      expect(await file("legacy-file").migrationSnapshot("project")).toEqual(snapshot);
      expect(snapshot.tables.artifact_revisions.find(row => row.revision === "old")!.links).toMatchObject([{ logicalName: "new.md", branchId: "legacy-quarantine" }]);
    } finally { reopened.close(); }
  });

  it("exports one branch without exposing another branch or its run provenance", async () => {
    const { file } = await fixture();
    const own = revision("own"), other = { ...revision("other"), key: { ...own.key, branchId: "other" } };
    await file("source").writeBatch([own, other]);
    const selected = selectSnapshot(await file("source").migrationSnapshot("project"), { branchId: "branch" });
    expect(selected.tables.artifact_revisions.map(row => row.revision)).toEqual([own.revision]);
    await file("selected").installSnapshot(selected);
    expect((await file("selected").list({ projectId: "project", branchId: "branch", publishedRevisionIds: [] })).map(row => row.revision)).toEqual([own.revision]);
    expect(await file("selected").list({ projectId: "project", branchId: "other", publishedRevisionIds: [] })).toEqual([]);
  });

  it("quarantines previously mapped legacy rows even when a branch name and valid hash exist", async () => {
    const { root, file } = await fixture();
    const legacy = { ...revision("previously mapped"), source: "memory-import" };
    await file("source").writeBatch([legacy]);
    const before = await readFile(join(root, "source", "manifest.json"));
    const snapshot = await file("source").migrationSnapshot("project");
    await importSnapshot(file("destination"), join(root, "old-legacy.json"), "destination", snapshot);
    expect(await file("destination").list({ projectId: "project", branchId: "branch", publishedRevisionIds: [legacy.revision] })).toEqual([]);
    expect(await file("destination").read(legacy.key, legacy.revision)).toBeNull();
    expect(snapshot.tables.artifact_import_provenance[0]!.source_metadata).toMatchObject({ recoveryScope: "legacy-quarantine", originalRevision: { revision: legacy.revision, branch_id: "branch", sha256: legacy.sha256 }, originalPointers: [{ revision: legacy.revision }] });
    expect(await readFile(join(root, "source", "manifest.json"))).toEqual(before);
  });

  it("projects only the bound branch when installing a multi-branch repo-files snapshot", async () => {
    const { root, file } = await fixture();
    const own = revision("own draft"), other = { ...revision("other draft"), key: { ...own.key, branchId: "other" } };
    await file("source").writeBatch([own, other]);
    const destination = new FileStorageStore({ root: join(root, "destination"), editableRoot: join(root, "projection"), migrationBranchId: "branch" });
    await destination.installSnapshot(await file("source").migrationSnapshot("project"));
    expect(await readFile(join(root, "projection", "fact.md"), "utf8")).toBe("own draft");
    expect((await destination.read(other.key))?.revision).toBe(other.revision);
    expect(await readFile(join(root, "projection", "fact.md"), "utf8")).toBe("own draft");
  });
});
