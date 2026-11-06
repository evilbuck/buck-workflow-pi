import { mkdtempSync, rmSync, writeFileSync, mkdirSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import {
  commitConsumerBatch, flushConfiguredRetains, readConsumer, retainConfiguredArtifact,
  retainPresentationPackage, scheduleConfiguredRetain, listVisiblePlans, type ConsumerScope,
  classifyContextPath,
} from "../storage/consumers.js";
import { SQLiteStorageStore } from "../storage/sqlite-store.js";
import { withConfiguredStore, resolveTrustedContext } from "./workflow-state.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function scope(worktreeId: string, runId: string, branchId = "branch-a"): ConsumerScope {
  return { projectId: "project-1", branchId, worktreeId, runId, publishedRevisionIds: [] };
}

async function opened(): Promise<SQLiteStorageStore> {
  const root = mkdtempSync(join(tmpdir(), "consumer-persist-"));
  roots.push(root);
  return SQLiteStorageStore.open(join(root, "state.sqlite"));
}

describe("remaining durable consumers", () => {
  it("commits a save batch and attempt receipt on the same adapter and reads the ids back", async () => {
    const store = await opened();
    const committed = await commitConsumerBatch(store, scope("wt-1", "run-1"), [
      { kind: "memory", subjectId: "subj", logicalName: "memory/fact.md", bytes: new TextEncoder().encode("fact") },
      { kind: "receipt", subjectId: "subj", logicalName: "attempts/a1.json", bytes: new TextEncoder().encode("{\"ids\":[]}") },
    ], { attemptId: "a1", status: "attempted", kind: "rows", metadataDuties: ["index"] });
    expect(committed.revisions).toHaveLength(2);
    const receipt = await store.readReceipt("project-1", "run-1");
    expect(receipt).toMatchObject({ attemptId: "a1", artifactRevisions: committed.revisions, worktreeId: "wt-1", runId: "run-1" });
    const body = await readConsumer(store, scope("wt-1", "run-1"), "memory", "subj", "memory/fact.md");
    expect(new TextDecoder().decode(body?.bytes)).toBe("fact");
    store.close();
  });

  it("keeps mutable resume pointers private to each worktree run", async () => {
    const store = await opened();
    await commitConsumerBatch(store, scope("wt-1", "run-1"), [
      { kind: "checkpoint", subjectId: "loop", logicalName: "workflow/buck-loop.json", bytes: new TextEncoder().encode("{\"state\":\"building\"}") },
    ], { attemptId: "left", status: "attempted" });
    await commitConsumerBatch(store, scope("wt-2", "run-2"), [
      { kind: "checkpoint", subjectId: "loop", logicalName: "workflow/buck-loop.json", bytes: new TextEncoder().encode("{\"state\":\"saving\"}") },
    ], { attemptId: "right", status: "attempted" });
    const left = await readConsumer(store, scope("wt-1", "run-1"), "checkpoint", "loop", "workflow/buck-loop.json");
    const right = await readConsumer(store, scope("wt-2", "run-2"), "checkpoint", "loop", "workflow/buck-loop.json");
    const crossed = await readConsumer(store, scope("wt-1", "run-2"), "checkpoint", "loop", "workflow/buck-loop.json");
    expect(new TextDecoder().decode(left!.bytes)).toContain("building");
    expect(new TextDecoder().decode(right!.bytes)).toContain("saving");
    expect(crossed).toBeNull();
    expect((await store.readReceipt("project-1", "run-1"))?.attemptId).toBe("left");
    expect((await store.readReceipt("project-1", "run-2"))?.attemptId).toBe("right");
    store.close();
  });

  it("round-trips retained presentation bytes and keeps run-private audits invisible on another branch", async () => {
    const store = await opened();
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff]);
    await commitConsumerBatch(store, scope("wt-1", "run-1"), [
      { kind: "attachment", subjectId: "deck", logicalName: "presentations/deck/assets/fig.png", bytes: png },
      { kind: "audit", subjectId: "review", logicalName: "passes/01/review.json", bytes: new TextEncoder().encode("{\"pass\":1}") },
    ], { attemptId: "pkg", status: "attempted", kind: "rows", metadataDuties: ["package"] });
    const attachment = await readConsumer(store, scope("wt-1", "run-1"), "attachment", "deck", "presentations/deck/assets/fig.png");
    expect(attachment?.bytes).toEqual(png);
    const otherBranch = scope("wt-9", "run-9", "branch-b");
    otherBranch.publishedRevisionIds = [];
    expect(await readConsumer(store, otherBranch, "audit", "review", "passes/01/review.json")).toBeNull();
    expect(await store.list({ projectId: "project-1", branchId: "branch-b", publishedRevisionIds: [], kind: "audit" })).toEqual([]);
    store.close();
  });

  it("lists adapter-backed plans and does not surface another branch draft", async () => {
    const store = await opened();
    await commitConsumerBatch(store, scope("wt-1", "run-1"), [
      { kind: "plan", subjectId: "2026-10-10.demo", logicalName: "plan-demo.md", bytes: new TextEncoder().encode("# Demo\n") },
    ], { attemptId: "plan", status: "attempted" });
    await commitConsumerBatch(store, scope("wt-2", "run-2", "branch-b"), [
      { kind: "plan", subjectId: "2026-10-10.demo", logicalName: "plan-secret.md", bytes: new TextEncoder().encode("# Secret\n") },
    ], { attemptId: "other", status: "attempted" });
    const visible = await listVisiblePlans(store, scope("wt-1", "run-1"));
    expect(visible.map((item) => item.key.logicalName)).toEqual(["plan-demo.md"]);
    store.close();
  });

  it("preserves links and refuses a stale consumer revision without changing native identity", async () => {
    const store = await opened();
    try {
      const bound = scope("wt-1", "run-1");
      const write = { kind: "plan" as const, subjectId: "demo", logicalName: "plan.md", bytes: new TextEncoder().encode("native body") };
      const link = { projectId: bound.projectId, branchId: bound.branchId, kind: "spec" as const, subjectId: "demo", logicalName: "spec.md" };
      const first = await commitConsumerBatch(store, bound, [{ ...write, links: [link], expectedRevision: null }], { attemptId: "same", status: "attempted" });
      const next = await commitConsumerBatch(store, bound, [{ ...write, bytes: new TextEncoder().encode("consumer update"), expectedRevision: first.revisions[0] }], { attemptId: "same", status: "attempted" });
      await expect(commitConsumerBatch(store, bound, [{ ...write, expectedRevision: first.revisions[0] }], { attemptId: "same", status: "attempted" })).rejects.toThrow(/revision|stale|conflict/i);
      const current = await readConsumer(store, bound, "plan", "demo", "plan.md");
      expect(current).toMatchObject({ revision: next.revisions[0], links: [link], bytes: new TextEncoder().encode("consumer update") });
      expect((await store.list({ projectId: bound.projectId, branchId: bound.branchId, publishedRevisionIds: [], kind: "plan" })).map((item) => item.key.logicalName)).toEqual(["plan.md"]);
      const root = classifyContextPath(".context/demo/index.md");
      const nested = classifyContextPath(".context/demo/notes/index.md");
      expect(root.kind).toBe("subject-index");
      expect(nested).toEqual({ kind: "capture", subjectId: "demo", logicalName: "notes/index.md" });
    } finally { store.close(); }
  });

  it("keeps nested index content out of canonical lifecycle inspection", async () => {
    const store = await opened();
    try {
      const bound = scope("wt-1", "run-1");
      await store.transition({ projectId: bound.projectId, branchId: bound.branchId, subjectId: "demo", fromRevision: null, expectedState: "missing", intent: { kind: "initialize" }, evidence: [] });
      await commitConsumerBatch(store, bound, [{ ...classifyContextPath(".context/demo/notes/index.md"), bytes: new TextEncoder().encode("---\nstatus: completed\n---\n# Nested notes\n") }], { attemptId: "nested", status: "attempted" });
      expect(await store.inspectLifecycle(bound.projectId, bound.branchId, "demo")).toMatchObject({ state: "draft", effectiveState: "draft", provenance: "canonical" });
    } finally { store.close(); }
  });
});

describe("configured-store retains from synchronous writers", () => {
  const previousConfig = process.env.BUCK_WORKFLOW_CONFIG;
  const previousXdg = process.env.XDG_CONFIG_HOME;
  let configPath: string;

  afterEach(() => {
    if (previousConfig === undefined) delete process.env.BUCK_WORKFLOW_CONFIG;
    else process.env.BUCK_WORKFLOW_CONFIG = previousConfig;
    if (previousXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = previousXdg;
  });

  function configureSqlite(): string {
    const root = mkdtempSync(join(tmpdir(), "consumer-retain-"));
    roots.push(root);
    configPath = join(root, "config.yaml");
    writeFileSync(configPath, `version: 1\nstorage:\n  adapter: sqlite\n  database: ${join(root, "state.sqlite")}\n`);
    process.env.BUCK_WORKFLOW_CONFIG = configPath;
    process.env.XDG_CONFIG_HOME = root;
    return root;
  }

  it("retains attribution rows with a receipt-bearing run and keeps them invisible to another worktree", async () => {
    configureSqlite();
    const bytes = new TextEncoder().encode('{"entryKey":"entry-7","totalTokens":32}');
    const runId = await retainConfiguredArtifact({
      kind: "attribution", subjectId: "token-attribution", logicalName: "rows/entry-7.json",
      bytes, cwd: process.cwd(),
    });
    expect(runId).toBeTruthy();
    const context = await resolveTrustedContext(process.cwd());
    expect(runId).toBe(context.runId);
    const store = SQLiteStorageStore.openSync(join(configPath, "..", "state.sqlite"));
    try {
      const readScope = { projectId: context.projectId, branchId: context.branchId, worktreeId: context.worktreeId!, runId: runId!, publishedRevisionIds: [] };
      await expect(readConsumer(store, readScope, "attribution", "token-attribution", "rows/entry-7.json")).resolves.toMatchObject({ bytes });
      const visible = await readConsumer(store, readScope, "attribution", "token-attribution", "rows/entry-7.json");
      expect(visible?.key.worktreeId).toBe(context.worktreeId);
      const otherWorktree = { ...readScope, worktreeId: "worktree-other", runId: `${runId}-other` };
      await expect(readConsumer(store, otherWorktree, "attribution", "token-attribution", "rows/entry-7.json")).resolves.toBeNull();
    } finally {
      store.close();
    }
  });

  it("keeps a failed retain visible to the drain after a later queued retain succeeds", async () => {
    configureSqlite();
    writeFileSync(configPath, "not: [valid");
    const failed = scheduleConfiguredRetain({
      kind: "audit", subjectId: "memory-import", logicalName: "failed.json",
      bytes: new TextEncoder().encode("{}"), cwd: process.cwd(),
    });
    await expect(failed).rejects.toThrow();
    writeFileSync(configPath, `version: 1\nstorage:\n  adapter: sqlite\n  database: ${join(configPath, "..", "state.sqlite")}\n`);
    process.env.BUCK_WORKFLOW_CONFIG = configPath;
    const succeeded = scheduleConfiguredRetain({
      kind: "audit", subjectId: "memory-import", logicalName: "succeeded.json",
      bytes: new TextEncoder().encode("{}"), cwd: process.cwd(),
    });
    await expect(succeeded).resolves.toBeTruthy();
    await expect(flushConfiguredRetains()).rejects.toThrow();
    await expect(flushConfiguredRetains()).resolves.toBeUndefined();
  });

  it("schedules retains for synchronous writers and drains them through one flush", async () => {
    configureSqlite();
    const retained = scheduleConfiguredRetain({
      kind: "audit", subjectId: "memory-import", logicalName: "manifest.json",
      bytes: new TextEncoder().encode('{"version":1,"files":{}}'), cwd: process.cwd(),
    });
    const runId = await flushConfiguredRetains().then(() => retained);
    expect(runId).toBeTruthy();
    const context = await resolveTrustedContext(process.cwd());
    expect(runId).toBe(context.runId);
    const store = SQLiteStorageStore.openSync(join(configPath, "..", "state.sqlite"));
    try {
      const readScope = { projectId: context.projectId, branchId: context.branchId, worktreeId: context.worktreeId!, runId: runId!, publishedRevisionIds: [] };
      await expect(readConsumer(store, readScope, "audit", "memory-import", "manifest.json")).resolves.toMatchObject({
        key: { logicalName: "manifest.json" },
      });
    } finally {
      store.close();
    }
  });

  it("retains under the configured adapter in a fresh receipt run after the configured run completed", async () => {
    configureSqlite();
    writeFileSync(configPath, "version: 1\nstorage:\n  adapter: repo-files\n");
    await withConfiguredStore(process.cwd(), async (store, context) => {
      if (!context.worktreeId || !context.runId) throw new Error("missing trusted test identity");
      const receipt = {
        projectId: context.projectId,
        branchId: context.branchId,
        worktreeId: context.worktreeId,
        runId: context.runId,
        attemptId: context.runId,
        status: "attempted" as const,
        artifactRevisions: [],
        kind: "no-fact" as const,
        metadataDuties: ["probe"],
      };
      await store.writeReceipt(receipt);
      await store.writeReceipt({ ...receipt, status: "complete" });
    });
    const bytes = new TextEncoder().encode("{}");
    const runId = await retainConfiguredArtifact({
      kind: "audit", subjectId: "memory-import", logicalName: "manifest.json",
      bytes, cwd: process.cwd(),
    });
    expect(runId).toBeTruthy();
    await withConfiguredStore(process.cwd(), async (store, context) => {
      expect(runId).toBe(context.runId);
      const readScope = {
        projectId: context.projectId, branchId: context.branchId,
        worktreeId: context.worktreeId!, runId: runId!, publishedRevisionIds: [],
      };
      await expect(readConsumer(store, readScope, "audit", "memory-import", "manifest.json"))
        .resolves.toMatchObject({ bytes });
    });
  });

  it("pins queued writes to the requested worktree and refuses destination changes", async () => {
    const root = configureSqlite();
    const left = join(root, "left");
    const right = join(root, "right");
    mkdirSync(left);
    execFileSync("git", ["init", "-q", "-b", "left", left]);
    execFileSync("git", ["-C", left, "config", "remote.origin.url", "https://example.test/consumer-binding.git"]);
    execFileSync("git", ["-C", left, "-c", "user.name=fixture", "-c", "user.email=fixture@example.test", "commit", "--allow-empty", "-qm", "fixture"]);
    execFileSync("git", ["-C", left, "worktree", "add", "-q", "-b", "right", right]);
    const write = { kind: "checkpoint" as const, subjectId: "loop", logicalName: "pointer.json", bytes: new TextEncoder().encode('{"state":"saving"}'), cwd: right };
    const retained = scheduleConfiguredRetain(write);
    const original = `version: 1\nstorage:\n  adapter: sqlite\n  database: ${join(root, "state.sqlite")}\n`;
    writeFileSync(configPath, `version: 1\nstorage:\n  adapter: sqlite\n  database: ${join(root, "redirect.sqlite")}\n`);
    const runId = await retained;
    writeFileSync(configPath, original);
    await withConfiguredStore(right, async (store, context) => {
      expect(runId).toBe(context.runId);
      expect(await readConsumer(store, { ...context, worktreeId: context.worktreeId!, runId: context.runId! }, "checkpoint", "loop", "pointer.json")).toMatchObject({ bytes: write.bytes });
    });
    await withConfiguredStore(left, async (store, context) => {
      expect(await readConsumer(store, { ...context, worktreeId: context.worktreeId!, runId: context.runId! }, "checkpoint", "loop", "pointer.json")).toBeNull();
    });
    writeFileSync(configPath, `version: 1\nstorage:\n  adapter: sqlite\n  database: ${join(root, "redirect.sqlite")}\n`);
    await expect(scheduleConfiguredRetain(write)).rejects.toThrow(/destination changed/);
    await expect(flushConfiguredRetains()).rejects.toThrow(/destination changed/);
    writeFileSync(configPath, original);
  });
});

describe("presentation package retention", () => {
  it("round-trips package bytes including binary assets through one receipt-bearing run", async () => {
    const store = await opened();
    const root = mkdtempSync(join(tmpdir(), "present-pkg-"));
    roots.push(root);
    mkdirSync(join(root, "deck", "assets"), { recursive: true });
    mkdirSync(join(root, "deck", "sources"), { recursive: true });
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0xff, 0x00]);
    writeFileSync(join(root, "deck", "index.html"), "<h1>deck</h1>\n");
    writeFileSync(join(root, "deck", "assets", "fig.png"), png);
    writeFileSync(join(root, "deck", "sources", "plan.md"), "# plan\n");
    writeFileSync(join(root, "deck", "manifest.json"), '{"slug":"deck","pages":[{"file":"index.html"}]}\n');
    const retained = await retainPresentationPackage(join(root, "deck"), {
      store,
      context: { projectId: "project-1", branchId: "branch-a", worktreeId: "wt-9" },
    });
    expect(retained.revisions).toHaveLength(4);
    const scope = { projectId: "project-1", branchId: "branch-a", worktreeId: "wt-9", runId: retained.runId, publishedRevisionIds: [] };
    const figure = await readConsumer(store, scope, "attachment", "deck", "presentations/deck/assets/fig.png");
    expect(figure?.bytes).toEqual(png);
    const manifest = await readConsumer(store, scope, "attachment", "deck", "presentations/deck/manifest.json");
    expect(new TextDecoder().decode(manifest!.bytes)).toContain('"slug":"deck"');
    await expect(store.readReceipt("project-1", retained.runId)).resolves.toMatchObject({
      attemptId: retained.runId,
      status: "attempted",
      metadataDuties: ["package"],
      artifactRevisions: expect.arrayContaining([...retained.revisions]),
    });
    store.close();
  });

  it("refuses a package containing a symlink instead of following it", async () => {
    const store = await opened();
    const root = mkdtempSync(join(tmpdir(), "present-slink-"));
    roots.push(root);
    const outside = mkdtempSync(join(tmpdir(), "present-out-"));
    roots.push(outside);
    mkdirSync(join(root, "leaky", "assets"), { recursive: true });
    writeFileSync(join(root, "leaky", "index.html"), "<h1>leak</h1>\n");
    writeFileSync(join(outside, "secret.txt"), "secret");
    symlinkSync(join(outside, "secret.txt"), join(root, "leaky", "assets", "secret.txt"));
    await expect(retainPresentationPackage(join(root, "leaky"), {
      store,
      context: { projectId: "project-1", branchId: "branch-a", worktreeId: "wt-9" },
    })).rejects.toThrow(/symlink/);
    store.close();
  });
});
