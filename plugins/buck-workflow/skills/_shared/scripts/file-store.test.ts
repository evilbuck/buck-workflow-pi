import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ArtifactKey, ArtifactRevision } from "../storage/contract.js";
import { defineStorageConformance } from "../storage/conformance.js";
import { ExternalFilesStorageStore, FileStorageStore, RepoFilesStorageStore } from "../storage/file-store.js";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

defineStorageConformance({
  name: "repo-files adapter",
  async create() {
    const root = await mkdtemp(join(tmpdir(), "buck-repo-files-"));
    roots.push(root);
    return { store: new RepoFilesStorageStore({ contextRoot: join(root, ".context"), manifestRoot: join(root, "state") }), dispose() {} };
  },
});

defineStorageConformance({
  name: "external-files adapter",
  async create() {
    const root = await mkdtemp(join(tmpdir(), "buck-external-files-"));
    roots.push(root);
    return { store: new ExternalFilesStorageStore({ projectKey: "fixture-project", root: join(root, "state") }), dispose() {} };
  },
});

async function fixture(): Promise<{ store: FileStorageStore; root: string }> {
  const root = await mkdtemp(join(tmpdir(), "buck-storage-"));
  roots.push(root);
  return { store: new FileStorageStore({ root: join(root, "state"), editableRoot: join(root, "context") }), root };
}

function revision(key: ArtifactKey, body: Uint8Array, expectedRevision: string | null): ArtifactRevision {
  return { key, revision: randomUUID(), bytes: body, sha256: createHash("sha256").update(body).digest("hex"), author: "test", source: "fixture", createdAt: new Date(0).toISOString(), links: [], expectedRevision };
}
async function waitForWriter(root: string): Promise<void> {
  for (let attempt = 0; attempt < 1000; attempt++) {
    try { await readFile(join(root, "state", ".lock")); return; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  throw new Error("writer did not acquire its file lock");
}


describe("file storage adapter", () => {
  it("serializes overlapping disjoint batches on one instance without losing either generation", async () => {
    const { store, root } = await fixture();
    const batch = Array.from({ length: 100 }, (_, index) => revision(
      { projectId: "p", subjectId: "s", kind: "plan", logicalName: `plan-${index}.md`, branchId: "branch-a" },
      new TextEncoder().encode(`body-${index}`), null,
    ));
    const extra = revision({ ...batch[0]!.key, logicalName: "extra.md" }, new TextEncoder().encode("extra"), null);
    const firstWrite = store.writeBatch(batch);
    await waitForWriter(root);
    await Promise.all([firstWrite, store.writeBatch([extra])]);
    for (const item of [...batch, extra]) expect(await store.read(item.key)).toMatchObject({ revision: item.revision, bytes: item.bytes });
  });

  it("rejects only the stale overlapping writer and keeps its revision out of history", async () => {
    const { store, root } = await fixture();
    const key: ArtifactKey = { projectId: "p", subjectId: "s", kind: "plan", logicalName: "plan.md", branchId: "branch-a" };
    const first = revision(key, new TextEncoder().encode("first"), null);
    await store.writeBatch([first]);
    const left = revision(key, new TextEncoder().encode("left"), first.revision);
    const right = revision(key, new TextEncoder().encode("right"), first.revision);
    const filler = Array.from({ length: 100 }, (_, index) => revision({ ...key, logicalName: `filler-${index}.md` }, new Uint8Array([index]), null));
    const firstWrite = store.writeBatch([left, ...filler]);
    await waitForWriter(root);
    const outcomes = await Promise.allSettled([firstWrite, store.writeBatch([right])]);
    expect(outcomes[0]?.status).toBe("fulfilled");
    expect(outcomes[1]).toMatchObject({ status: "rejected", reason: expect.objectContaining({ message: expect.stringMatching(/stale/) }) });
    expect((await store.read(key))?.revision).toBe(left.revision);
    expect(await store.read(key, right.revision)).toBeNull();
  });

  it.each([
    { logicalName: "../escape.md" },
    { branchId: "../escape" },
    { worktreeId: "../escape", runId: "run-invalid" },
    { projectId: "../escape" },
  ])("refuses unsafe identity %j before committing any batch revision", async (unsafe) => {
    const { store } = await fixture();
    const key: ArtifactKey = { projectId: "p", subjectId: "s", kind: "plan", logicalName: "plan.md", branchId: "branch-a" };
    const first = revision(key, new TextEncoder().encode("original"), null);
    await store.writeBatch([first]);
    const next = revision(key, new TextEncoder().encode("uncommitted"), first.revision);
    const invalid = revision({ ...key, ...unsafe }, new TextEncoder().encode("unsafe"), null);
    await expect(store.writeBatch([next, invalid])).rejects.toThrow(/identity|logicalName|unsafe/);
    expect((await store.read(key))?.revision).toBe(first.revision);
    expect(await store.read(key, next.revision)).toBeNull();
    expect((await store.read(key, first.revision))?.bytes).toEqual(first.bytes);
  });

  it("reports a committed projection failure and recovers the exact revision without inventing a user edit", async () => {
    const { store, root } = await fixture();
    const key: ArtifactKey = { projectId: "p", subjectId: "s", kind: "plan", logicalName: "plan.md", branchId: "branch-a" };
    await mkdir(join(root, "context", "plan.md"), { recursive: true });
    const item = revision(key, new TextEncoder().encode("committed"), null);
    await expect(store.writeBatch([item])).rejects.toThrow(/generation 1 committed; editable projection pending recovery/);
    await rm(join(root, "context", "plan.md"), { recursive: true });
    await writeFile(join(root, "context", "plan.md"), "partially projected");
    const recovered = new FileStorageStore({ root: join(root, "state"), editableRoot: join(root, "context") });
    expect(await recovered.read(key)).toMatchObject({ revision: item.revision, bytes: item.bytes, source: "fixture" });
    expect(await readFile(join(root, "context", "plan.md"), "utf8")).toBe("committed");
    await expect(readFile(join(root, "state", "projection.pending"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("keeps binary immutable revisions and rejects a stale generation without advancing its pointer", async () => {
    const { store, root } = await fixture();
    const key: ArtifactKey = { projectId: "p", subjectId: "s", kind: "attachment", logicalName: "asset.bin", branchId: "branch-a" };
    const bytes = new Uint8Array([0, 255, 4, 0]);
    const first = revision(key, bytes, null);
    await store.writeBatch([first]);
    const second = revision(key, new Uint8Array([9]), first.revision);
    await store.writeBatch([second]);
    await expect(store.writeBatch([revision(key, new Uint8Array([8]), first.revision)])).rejects.toThrow(/stale/i);
    expect((await store.read(key, first.revision))?.bytes).toEqual(bytes);
    expect((await store.read(key))?.revision).toBe(second.revision);
    expect(new Uint8Array(await readFile(join(root, "context", "asset.bin")))).toEqual(new Uint8Array([9]));
  });

  it("turns direct edits into a new private revision before read returns", async () => {
    const { store, root } = await fixture();
    const key: ArtifactKey = { projectId: "p", subjectId: "s", kind: "plan", logicalName: "plan.md", branchId: "branch-a" };
    const first = revision(key, new TextEncoder().encode("sealed"), null);
    await store.writeBatch([first]);
    await writeFile(join(root, "context", "plan.md"), "edited outside the store");
    const reconciled = await store.read(key);
    expect(reconciled?.revision).not.toBe(first.revision);
    expect(new TextDecoder().decode(reconciled?.bytes)).toBe("edited outside the store");
    expect(reconciled?.source).toBe("direct-file-edit");
  });

  it("does not expose another branch's pointer in ordinary listing", async () => {
    const { store } = await fixture();
    const shared: ArtifactKey = { projectId: "p", subjectId: "s", kind: "memory", logicalName: "note.md", branchId: "branch-b" };
    await store.writeBatch([revision(shared, new TextEncoder().encode("private"), null)]);
    expect(await store.list({ projectId: "p", branchId: "branch-a", publishedRevisionIds: [] })).toEqual([]);
  });

  it("discards an interrupted generation and keeps the committed revision readable", async () => {
    const { store, root } = await fixture();
    const key: ArtifactKey = { projectId: "p", subjectId: "s", kind: "plan", logicalName: "plan.md", branchId: "branch-a" };
    const first = revision(key, new TextEncoder().encode("committed"), null);
    await store.writeBatch([first]);
    await writeFile(join(root, "state", "manifest.next"), "{\"generation\":99,\"current\":{}}\n");
    await writeFile(join(root, "state", ".lock"), "999999\n");
    await writeFile(join(root, "context", "plan.md"), "staged-but-not-committed");
    const recovered = new FileStorageStore({ root: join(root, "state"), editableRoot: join(root, "context"), lockTimeoutMs: 200 });
    const current = await recovered.read(key);
    expect(current?.revision).toBe(first.revision);
    expect(new TextDecoder().decode(current?.bytes)).toBe("committed");
    expect(new TextDecoder().decode(new Uint8Array(await readFile(join(root, "context", "plan.md"))))).toBe("committed");
    const next = revision(key, new TextEncoder().encode("after-recovery"), first.revision);
    await recovered.writeBatch([next]);
    expect((await recovered.read(key))?.revision).toBe(next.revision);
  });
  it("restores a committed projection instead of treating an unfinished projection as a user edit", async () => {
    const { store, root } = await fixture();
    const key: ArtifactKey = { projectId: "p", subjectId: "s", kind: "plan", logicalName: "plan.md", branchId: "branch-a" };
    const first = revision(key, new TextEncoder().encode("committed-v1"), null);
    await store.writeBatch([first]);
    const second = revision(key, new TextEncoder().encode("committed-v2"), first.revision);
    await store.writeBatch([second]);
    await writeFile(join(root, "context", "plan.md"), "committed-v1");
    const stamp = JSON.parse(await readFile(join(root, "state", "projections.json"), "utf8")) as { projected: Record<string, { revision: string; sha256: string }> };
    const id = Object.keys(stamp.projected)[0]!;
    stamp.projected[id] = { revision: first.revision, sha256: first.sha256 };
    await writeFile(join(root, "state", "projections.json"), `${JSON.stringify(stamp)}\n`);
    const current = await store.read(key);
    expect(current?.revision).toBe(second.revision);
    expect(new TextDecoder().decode(current?.bytes)).toBe("committed-v2");
    expect(await readFile(join(root, "context", "plan.md"), "utf8")).toBe("committed-v2");
  });

  it("reconciles a direct edit into a private revision before sealing", async () => {
    const { store, root } = await fixture();
    const key: ArtifactKey = { projectId: "p", subjectId: "s", kind: "plan", logicalName: "plan.md", branchId: "branch-a" };
    const first = revision(key, new TextEncoder().encode("sealed"), null);
    await store.writeBatch([first]);
    await writeFile(join(root, "context", "plan.md"), "edited before seal");
    await store.sealCheckpoint({ projectId: "p", branchId: "branch-a", commit: "abc123", integrationTip: "def456", revisionSet: [{ revision: first.revision, sha256: first.sha256 }] });
    const manifest = JSON.parse(await readFile(join(root, "state", "manifest.json"), "utf8")) as { revisions: Record<string, { source: string }> };
    expect(Object.values(manifest.revisions).some((record) => record.source === "direct-file-edit")).toBe(true);
  });
});

describe("external file adapter", () => {
  it("defaults to a traversal-safe project root and keeps worktree projections apart", async () => {
    const configHome = await mkdtemp(join(tmpdir(), "buck-xdg-"));
    roots.push(configHome);
    const previous = process.env.XDG_CONFIG_HOME;
    process.env.XDG_CONFIG_HOME = configHome;
    try {
      const projectKey = "git@github.com:evilbuck/buck-workflow-pi.git";
      const store = new ExternalFilesStorageStore({ projectKey });
      const base: ArtifactKey = { projectId: "p", subjectId: "s", kind: "plan", logicalName: "plan.md", branchId: "branch-a", worktreeId: `worktree-${randomUUID()}`, runId: `run-${randomUUID()}` };
      const other = { ...base, worktreeId: `worktree-${randomUUID()}`, runId: `run-${randomUUID()}` };
      await store.writeBatch([revision(base, new TextEncoder().encode("worktree-one"), null), revision(other, new TextEncoder().encode("worktree-two"), null)]);
      const segment = "h-14833ef89f7fbf7004973d26f3a59858e1174abc6eb74718cf20b74656424142";
      const root = join(configHome, "buck-workflow", segment, ".context");
      expect(await readFile(join(root, "branch-a", base.worktreeId!, base.runId!, "plan.md"), "utf8")).toBe("worktree-one");
      expect(await readFile(join(root, "branch-a", other.worktreeId, other.runId, "plan.md"), "utf8")).toBe("worktree-two");
      expect(new TextDecoder().decode((await store.read(base))!.bytes)).toBe("worktree-one");
      const escaped = new ExternalFilesStorageStore({ projectKey: "../escape", root: join(configHome, "buck-workflow", "{project}", ".context") });
      await escaped.writeBatch([revision({ ...base, logicalName: "escape.md" }, new TextEncoder().encode("contained"), null)]);
      expect(await readFile(join(configHome, "buck-workflow", "h-1ba7343c47dc442de7dec43a995deb9a7b62234ecca16d7c6f597b5155bd85b1", ".context", "branch-a", base.worktreeId!, base.runId!, "escape.md"), "utf8")).toBe("contained");
      await expect(readFile(join(configHome, "escape"))).rejects.toThrow();
    } finally {
      if (previous === undefined) delete process.env.XDG_CONFIG_HOME;
      else process.env.XDG_CONFIG_HOME = previous;
    }
  });

});
