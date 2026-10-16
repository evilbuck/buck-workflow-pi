import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ArtifactRevision, StorageAdapter } from "../../_shared/storage/contract.js";
import { commitConsumerBatch, readConsumer } from "../../_shared/storage/consumers.js";
import { resolveTrustedContext, withBoundStore, withConfiguredStore } from "../../_shared/scripts/workflow-state.js";
import type * as WorkflowState from "../../_shared/scripts/workflow-state.js";
import { parseArgs, runImport, saveManifest, sha256Hex } from "./import-context-memory.js";
import type { Manifest } from "./import-context-memory.js";

// Publication discovery belongs to Phase 6. Supply only its trusted proof here;
// configuration, checkout identities, all four stores, and HTTP remain real.
const { published } = vi.hoisted(() => ({ published: new Map<string, string[]>() }));
vi.mock("../../_shared/scripts/workflow-state.js", async (importOriginal) => {
  const actual = await importOriginal<typeof WorkflowState>();
  return {
    ...actual,
    resolveConsumerContext: async (cwd: string) => ({
      ...await actual.resolveConsumerContext(cwd),
      publishedRevisionIds: published.get(cwd) ?? [],
    }),
  };
});

const cleanup: Array<() => void | Promise<void>> = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
  published.clear();
  vi.unstubAllEnvs();
});

function fixture(adapter: StorageAdapter) {
  const base = mkdtempSync(join(tmpdir(), "importer-storage-"));
  cleanup.push(() => rmSync(base, { recursive: true, force: true }));
  const root = join(base, "checkout");
  mkdirSync(root);
  const config = join(base, "config.yaml");
  const extra = adapter === "external-files" ? `  root: ${join(base, "external", "{project}")}\n`
    : adapter === "sqlite" ? `  database: ${join(base, "state.sqlite")}\n`
    : adapter === "postgres" ? "  connection_env: BUCK_WORKFLOW_TEST_DATABASE_URL\n" : "";
  writeFileSync(config, `version: 1\nstorage:\n  adapter: ${adapter}\n${extra}`);
  vi.stubEnv("BUCK_WORKFLOW_CONFIG", config);
  vi.stubEnv("XDG_CONFIG_HOME", join(base, "machine"));
  return { base, root, config };
}

async function hindsight(onRetain?: () => Promise<void>) {
  const requests: Array<{ items: Array<{ content: string; document_id: string }> }> = [];
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    if (req.method === "POST") {
      requests.push(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      await onRetain?.();
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end("{}");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  cleanup.push(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No HTTP port");
  return { requests, url: `http://127.0.0.1:${address.port}` };
}

function args(root: string, url: string) {
  return parseArgs(["--root", root, "--api-url", url, "--scoping", "global", "--bank-id", "importer-test", "--source-dirs", ".context/memory,.context/backlog/items"]);
}

const memory = "---\ndate: 2026-10-15\n---\n# Canonical memory\nPublished adapter bytes.\n";
const backlog = "---\ntitle: Published task\nstatus: active\n---\n# Published task\n";

async function seed(root: string) {
  const revisions = await withConfiguredStore(root, async (store, context) => {
    const revision = (kind: "memory" | "backlog", logicalName: string, text: string): ArtifactRevision => {
      const bytes = new TextEncoder().encode(text);
      return {
        key: { projectId: context.projectId, branchId: context.branchId, subjectId: kind, kind, logicalName },
        revision: randomUUID(), bytes, sha256: sha256Hex(bytes), createdAt: "2026-10-15T00:00:00.000Z",
        author: "fixture", source: "fixture", links: [], expectedRevision: null,
      };
    };
    const records = [
      revision("memory", "nested/fact.md", memory),
      revision("backlog", "items/task.md", backlog),
      revision("memory", "draft.md", "---\ndate: 2026-10-15\n---\nPrivate draft"),
      revision("memory", "index.md", "---\ndate: 2026-10-15\n---\nIndex"),
      revision("backlog", "archive/task.md", backlog),
    ];
    await store.writeBatch(records);
    return records;
  });
  published.set(root, revisions.filter((r) => r.key.logicalName !== "draft.md").map((r) => r.revision));
  return revisions;
}

async function cursor(root: string) {
  return withConfiguredStore(root, async (store, context) => {
    if (!context.runId || !context.worktreeId) throw new Error("Missing workspace identity");
    return readConsumer(store, { ...context, runId: context.runId, worktreeId: context.worktreeId }, "audit", "memory-import", "manifest.json");
  });
}

for (const adapter of ["repo-files", "external-files", "sqlite", "postgres"] as const) {
  describe.skipIf(adapter === "postgres" && !process.env.BUCK_WORKFLOW_TEST_DATABASE_URL)(`importer ${adapter}`, () => {
    it("imports published adapter bytes without exports and resumes from its retained cursor", async () => {
      const { root } = fixture(adapter);
      const revisions = await seed(root);
      rmSync(join(root, ".context"), { recursive: true, force: true });
      const http = await hindsight();
      const first = await runImport(args(root, http.url));
      expect(first).toMatchObject({ code: 0, scanned: 2, imported: 2, skipped_unchanged: 0 });
      const sent = http.requests.flatMap((request) => request.items);
      expect(sent.map((item) => item.content)).toEqual([
        expect.stringContaining("# Published task"), expect.stringContaining("Published adapter bytes."),
      ]);
      expect(JSON.stringify(sent)).not.toContain("Private draft");
      const retained = await cursor(root);
      const manifest = JSON.parse(new TextDecoder().decode(retained!.bytes)) as Manifest;
      expect(manifest.files[".context/memory/nested/fact.md"].sha256).toBe(revisions[0].sha256);
      expect(Object.keys(manifest.files).sort()).toEqual([".context/backlog/items/task.md", ".context/memory/nested/fact.md"]);
      // Remove both source projections and the cursor export before a restart.
      rmSync(join(root, ".context"), { recursive: true, force: true });
      const second = await runImport(args(root, http.url));
      expect(second).toMatchObject({ code: 0, scanned: 2, imported: 0, skipped_unchanged: 2 });
      expect(http.requests).toHaveLength(1);
      expect((await cursor(root))?.revision).toBe(retained?.revision);
      // Repo-files may seal a direct user edit as an unpublished revision.
      // It must never import that edit or trust the fake local skip manifest.
      mkdirSync(join(root, ".context", "memory", "nested"), { recursive: true });
      writeFileSync(join(root, ".context", "memory", "nested", "fact.md"), "Unsealed local secret");
      writeFileSync(join(root, ".context", "memory", ".omp-hindsight-import-manifest.json"), "{}");
      expect(await runImport(args(root, http.url))).toMatchObject({ imported: 0 });
      expect(http.requests).toHaveLength(1);
      expect((await cursor(root))?.revision).toBe(retained?.revision);
    });

    it("withholds drafts when no trusted published revision is supplied", async () => {
      const { root } = fixture(adapter);
      await seed(root);
      published.delete(root);
      const http = await hindsight();
      expect(await runImport(args(root, http.url))).toMatchObject({ code: 0, scanned: 0, imported: 0 });
      expect(http.requests).toEqual([]);
      expect(await cursor(root)).toBeNull();
    });

    it("refuses a real adapter outage despite valid local source and cursor exports", async () => {
      const { base, root } = fixture(adapter);
      await seed(root);
      const http = await hindsight();
      await runImport(args(root, http.url));
      mkdirSync(join(root, ".context", "memory"), { recursive: true });
      writeFileSync(join(root, ".context", "memory", "local.md"), memory);
      if (adapter === "postgres") {
        vi.stubEnv("BUCK_WORKFLOW_TEST_DATABASE_URL", "postgres://postgres:unused@127.0.0.1:1/unavailable");
      } else if (adapter === "sqlite") {
        rmSync(join(base, "state.sqlite"));
        mkdirSync(join(base, "state.sqlite"));
      } else {
        const broken = adapter === "repo-files" ? (await resolveTrustedContext(root)).manifestRoot! : join(base, "external");
        rmSync(broken, { recursive: true, force: true });
        writeFileSync(broken, "not a storage directory");
      }
      await expect(runImport(args(root, http.url))).rejects.toThrow();
      expect(http.requests).toHaveLength(1);
    });

    it("updates cursor bytes without reusing a completed workspace receipt or dropping links", async () => {
      const { root } = fixture(adapter);
      const revisions = await seed(root);
      const context = await resolveTrustedContext(root);
      const manifest: Manifest = { version: 1, bank_id: "importer-test", project_label: "checkout", scoping: "global", files: {} };
      await withBoundStore(root, context, async (store) => {
        await store.writeReceipt({
          projectId: context.projectId, branchId: context.branchId, worktreeId: context.worktreeId!, runId: context.runId!,
          attemptId: "workspace-completed", status: "attempted", artifactRevisions: [], kind: "no-fact", metadataDuties: ["probe"],
        });
        await store.writeReceipt({
          projectId: context.projectId, branchId: context.branchId, worktreeId: context.worktreeId!, runId: context.runId!,
          attemptId: "workspace-completed", status: "complete", artifactRevisions: [], kind: "no-fact", metadataDuties: ["probe"],
        });
        await commitConsumerBatch(store, { ...context, worktreeId: context.worktreeId!, runId: context.runId! }, [{
          kind: "audit", subjectId: "memory-import", logicalName: "manifest.json",
          bytes: new TextEncoder().encode(JSON.stringify(manifest)), links: [revisions[0].key],
        }], { attemptId: "initial-cursor", runId: "initial-cursor-receipt", status: "attempted" });
      });
      const path = join(root, ".context", "memory", ".omp-hindsight-import-manifest.json");
      const initial = await cursor(root);
      await saveManifest(path, manifest, root);
      const next = { ...manifest, bank_id: "updated-bank" };
      await saveManifest(path, next, root);
      const retained = await cursor(root);
      expect(retained?.key).toEqual(initial?.key);
      expect(retained?.revision).not.toBe(initial?.revision);
      expect(retained?.links).toEqual([revisions[0].key]);
      expect(JSON.parse(new TextDecoder().decode(retained!.bytes))).toEqual(next);
      await withBoundStore(root, context, async (store) => {
        expect(await store.readReceipt(context.projectId, context.runId!)).toMatchObject({
          attemptId: "workspace-completed", status: "complete", artifactRevisions: [],
        });
        expect((await store.read(initial!.key, initial!.revision))?.bytes).toEqual(initial!.bytes);
      });
    });

    it("pins the pre-HTTP destination and refuses a changed selection on restart", async () => {
      const { base, root, config } = fixture(adapter);
      await seed(root);
      const bound = await resolveTrustedContext(root);
      const http = await hindsight(async () => {
        writeFileSync(config, `version: 1\nstorage:\n  adapter: external-files\n  root: ${join(base, "redirected", "{project}")}\n`);
      });
      expect(await runImport(args(root, http.url))).toMatchObject({ code: 0, imported: 2 });
      const retained = await withBoundStore(root, bound, async (store, context) => readConsumer(store, {
        ...context, worktreeId: context.worktreeId!, runId: context.runId!,
      }, "audit", "memory-import", "manifest.json"));
      expect(JSON.parse(new TextDecoder().decode(retained!.bytes)).files[".context/memory/nested/fact.md"].sha256).toBe(sha256Hex(memory));
      await expect(runImport(args(root, http.url))).rejects.toThrow(/destination changed/i);
      expect(existsSync(join(base, "redirected"))).toBe(false);
    });
  });
}

describe("importer cursor failures and checkout binding", () => {

  it("rejects corrupt authoritative cursor instead of silently reimporting", async () => {
    const { root } = fixture("sqlite");
    await seed(root);
    await withConfiguredStore(root, async (store, context) => {
      await commitConsumerBatch(store, { ...context, runId: context.runId!, worktreeId: context.worktreeId! }, [{
        kind: "audit", subjectId: "memory-import", logicalName: "manifest.json", bytes: new TextEncoder().encode("{bad json"),
      }], { attemptId: "corrupt-cursor", runId: "corrupt-receipt", status: "attempted" });
    });
    const http = await hindsight();
    await expect(runImport(args(root, http.url))).rejects.toThrow(/manifest|JSON/i);
    expect(http.requests).toEqual([]);
  });

  it("targets checkout B from process A and keeps same-branch worktree cursors separate", async () => {
    const { base, root } = fixture("sqlite");
    const git = (...argv: string[]) => execFileSync("git", argv, { cwd: root, stdio: "pipe", encoding: "utf8" });
    git("init", "-b", "main");
    git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.test", "commit", "--allow-empty", "-m", "fixture");
    const right = join(base, "right");
    git("worktree", "add", "--force", right, "main");
    await seed(root);
    // Same branch and project, distinct trusted checkout/workspace run.
    published.set(right, published.get(root)!);
    const http = await hindsight();
    expect(await runImport(args(right, http.url))).toMatchObject({ imported: 2 });
    const rightCursor = await cursor(right);
    const rightContext = await resolveTrustedContext(right);
    expect(rightCursor?.key).toMatchObject({ worktreeId: rightContext.worktreeId, runId: rightContext.runId });
    expect(await cursor(root)).toBeNull();
    expect(await runImport(args(root, http.url))).toMatchObject({ imported: 2 });
    expect((await cursor(root))?.key.runId).not.toBe(rightCursor?.key.runId);
    expect(await runImport(args(right, http.url))).toMatchObject({ imported: 0, skipped_unchanged: 2 });
  });

  it("refuses a stale importer cursor after a competing import advances it", async () => {
    const { root } = fixture("sqlite");
    await seed(root);
    const manifest: Manifest = { version: 1, bank_id: "other", project_label: "checkout", scoping: "global", files: {} };
    const path = join(root, ".context", "memory", ".omp-hindsight-import-manifest.json");
    const http = await hindsight(async () => { await saveManifest(path, manifest, root); });
    await expect(runImport(args(root, http.url))).rejects.toThrow(/stale|conflict|revision/i);
    expect(JSON.parse(new TextDecoder().decode((await cursor(root))!.bytes))).toEqual(manifest);
  });
});
