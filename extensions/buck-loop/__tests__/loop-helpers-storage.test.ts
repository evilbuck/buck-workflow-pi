import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cleanupRepos, repo, writeTree } from "./fixtures.js";
import { syncCheckedPhasesAt } from "../phase-completion.js";
import { closeSingleUnfinishedIterate, unfinishedIterateReport } from "../ambiguity.js";
import { consumerKey, retainConfiguredArtifact, type ConsumerWrite } from "../../../skills/_shared/storage/consumers.js";
import * as consumers from "../../../skills/_shared/storage/consumers.js";
import { resolveConsumerContext, withBoundStore } from "../../../skills/_shared/scripts/workflow-state.js";
import { FileStorageStore } from "../../../skills/_shared/storage/file-store.js";
import { SQLiteStorageStore } from "../../../skills/_shared/storage/sqlite-store.js";
import { PostgresStorageStore } from "../../../skills/_shared/storage/postgres-store.js";
import type { ArtifactRevision, StorageAdapter, StorageStore } from "../../../skills/_shared/storage/contract.js";

const SUBJECT = "2026-10-15.loop-helpers";
const PLAN = `.context/${SUBJECT}/plan-demo.md`;
const PHASE = `.context/${SUBJECT}/phase-1-demo.md`;
const ITERATE = `.context/${SUBJECT}/iterate-current.md`;
const CHECKED = '---\nstatus: pending\nacceptance_criteria:\n  - "[x] retained acceptance"\n---\n# Retained phase\n';
const ACTIVE = "---\nstatus: active\ncompleted: null\nfrom_review: review-original.md\n---\n# Retained fix\n";
const databaseUrl = process.env.BUCK_WORKFLOW_TEST_DATABASE_URL;
const adapters: StorageAdapter[] = ["repo-files", "external-files", "sqlite", ...(databaseUrl ? ["postgres" as const] : [])];
const temporary: string[] = [];

function configure(adapter: StorageAdapter): void {
  const home = mkdtempSync(join(tmpdir(), "loop-helper-authority-"));
  temporary.push(home);
  const config = join(home, "config.json");
  const storage = { adapter, ...(adapter === "external-files" ? { root: join(home, "external") } : {}),
    ...(adapter === "sqlite" ? { database: join(home, "state.sqlite") } : {}),
    ...(adapter === "postgres" ? { connection_env: "LOOP_HELPERS_TEST_URL" } : {}) };
  writeFileSync(config, JSON.stringify({ version: 1, storage }));
  vi.stubEnv("XDG_CONFIG_HOME", home);
  vi.stubEnv("BUCK_WORKFLOW_CONFIG", config);
  if (databaseUrl) vi.stubEnv("LOOP_HELPERS_TEST_URL", databaseUrl);
}

async function retain(cwd: string, kind: ConsumerWrite["kind"], logicalName: string, text: string, links?: ArtifactRevision["links"]): Promise<void> {
  await retainConfiguredArtifact({ cwd, kind, subjectId: SUBJECT, logicalName, bytes: new TextEncoder().encode(text), links });
}

async function read(cwd: string, kind: ConsumerWrite["kind"], logicalName: string): Promise<ArtifactRevision> {
  const context = await resolveConsumerContext(cwd);
  return withBoundStore(cwd, context, async (store) => {
    const key = consumerKey({ ...context, worktreeId: context.worktreeId!, runId: context.runId! }, kind, SUBJECT, logicalName);
    const current = await store.read(key);
    if (!current) throw new Error(`Missing fixture: ${logicalName}`);
    return current;
  });
}

function text(revision: ArtifactRevision): string { return new TextDecoder().decode(revision.bytes); }
function prototype(adapter: StorageAdapter) {
  return adapter === "sqlite" ? SQLiteStorageStore.prototype : adapter === "postgres" ? PostgresStorageStore.prototype : FileStorageStore.prototype;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  cleanupRepos();
  for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe.each(adapters)("async loop helpers on %s", (adapter) => {
  it("completes retained phases and overview rows without checkout exports, preserving links", async () => {
    configure(adapter);
    const cwd = repo();
    await retain(cwd, "plan", "plan-demo.md", "---\nstatus: active\n---\n# Retained plan\n");
    const plan = await read(cwd, "plan", "plan-demo.md");
    await retain(cwd, "phase", "phase-1-demo.md", CHECKED, [plan.key]);
    await retain(cwd, "phase", "phase-2-next.md", CHECKED.replace("Retained phase", "Second phase"), [plan.key]);
    await retain(cwd, "plan", "plan-demo-phases.md", "---\nstatus: active\n---\n| Phase | Status | File |\n| --- | --- | --- |\n| 1 | pending | phase-1-demo.md |\n| 2 | pending | phase-2-next.md |\n", [plan.key]);
    await retain(cwd, "phase", "nested/phase-3-untouched.md", CHECKED);
    rmSync(join(cwd, ".context"), { recursive: true, force: true });
    expect(await syncCheckedPhasesAt(cwd, PLAN, "2026-10-15")).toEqual([join(cwd, PHASE), join(cwd, `.context/${SUBJECT}/phase-2-next.md`)]);
    const phase = await read(cwd, "phase", "phase-1-demo.md");
    expect(text(phase)).toContain("status: completed\ncompleted_at: 2026-10-15");
    expect(phase.links).toEqual([plan.key]);
    const overview = await read(cwd, "plan", "plan-demo-phases.md");
    expect(text(overview)).toContain("| 1 | completed | phase-1-demo.md |");
    expect(text(overview)).toContain("| 2 | completed | phase-2-next.md |");
    expect(overview.links).toEqual([plan.key]);
    expect(text(await read(cwd, "phase", "nested/phase-3-untouched.md"))).toBe(CHECKED);
    expect(await syncCheckedPhasesAt(cwd, PLAN, "2026-10-16")).toEqual([]);
    expect((await read(cwd, "phase", "phase-1-demo.md")).revision).toBe(phase.revision);
  });

  it("completes an unphased retained plan without requiring a local subject", async () => {
    configure(adapter);
    const cwd = repo();
    await retain(cwd, "spec", "spec-demo.md", "# Linked specification\n");
    const spec = await read(cwd, "spec", "spec-demo.md");
    await retain(cwd, "plan", "plan-demo.md", "---\nstatus: active\n---\n## Acceptance criteria\n- [x] Retained proof\n", [spec.key]);
    rmSync(join(cwd, ".context"), { recursive: true, force: true });
    expect(await syncCheckedPhasesAt(cwd, `.context/${SUBJECT}`, "2026-10-15")).toEqual([join(cwd, PLAN)]);
    const plan = await read(cwd, "plan", "plan-demo.md");
    expect(text(plan)).toContain("status: completed\ncompleted_at: 2026-10-15");
    expect(plan.links).toEqual([spec.key]);
  });

  it("reports and closes exactly one retained active iterate with no checkout exports", async () => {
    configure(adapter);
    const cwd = repo();
    await retain(cwd, "review", "review-original.md", "# Original review\n");
    const review = await read(cwd, "review", "review-original.md");
    await retain(cwd, "iterate", "iterate-current.md", ACTIVE, [review.key]);
    await retain(cwd, "iterate", "iterate-low.md", "---\nstatus: below-waterline\n---\n");
    rmSync(join(cwd, ".context"), { recursive: true, force: true });
    const dir = join(cwd, ".context", SUBJECT);
    expect(await unfinishedIterateReport(dir)).toBe("unfinished iterate artifacts: iterate-current.md (status active)");
    expect(await closeSingleUnfinishedIterate(dir, "2026-10-15T12:00:00.000Z")).toBe(true);
    const current = await read(cwd, "iterate", "iterate-current.md");
    expect(text(current)).toContain("status: completed");
    expect(text(current)).toContain("completed: 2026-10-15");
    expect(text(current)).toContain("updated: 2026-10-15");
    expect(text(current)).toContain("from_review: review-original.md\n---\n# Retained fix\n");
    expect(current.links).toEqual([review.key]);
    expect(await unfinishedIterateReport(dir)).toBe("no unfinished iterate artifact");
    expect(await closeSingleUnfinishedIterate(dir, "2026-10-16")).toBe(false);
  });

  if (adapter !== "repo-files") it("ignores stale and unretained checkout bodies on non-repo adapters", async () => {
    configure(adapter);
    const cwd = repo();
    await retain(cwd, "plan", "plan-demo.md", "---\nstatus: active\n---\n# Plan\n");
    await retain(cwd, "phase", "phase-1-demo.md", CHECKED);
    await retain(cwd, "iterate", "iterate-current.md", ACTIVE);
    writeTree(cwd, { [PHASE]: CHECKED.replace("[x]", "[ ]"), [ITERATE]: "---\nstatus: completed\n---\n# Stale export\n",
      [`.context/${SUBJECT}/iterate-unretained.md`]: ACTIVE });
    expect(await syncCheckedPhasesAt(cwd, PLAN, "2026-10-15")).toEqual([join(cwd, PHASE)]);
    expect(await unfinishedIterateReport(join(cwd, ".context", SUBJECT))).toBe("unfinished iterate artifacts: iterate-current.md (status active)");
    expect(await closeSingleUnfinishedIterate(join(cwd, ".context", SUBJECT), "2026-10-15")).toBe(true);
    expect(text(await read(cwd, "iterate", "iterate-current.md"))).toContain("# Retained fix");
  });

  it.each(["phase", "iterate"] as const)("rejects a concurrent %s revision instead of overwriting it", async (kind) => {
    configure(adapter);
    const cwd = repo();
    await retain(cwd, "plan", "plan-demo.md", "---\nstatus: active\n---\n# Plan\n");
    const name = kind === "phase" ? "phase-1-demo.md" : "iterate-current.md";
    await retain(cwd, kind, name, kind === "phase" ? CHECKED : ACTIVE);
    const originalCommit = consumers.commitConsumerBatch;
    const newer = "---\nstatus: active\n---\n# Concurrent authoritative edit\n";
    vi.spyOn(consumers, "commitConsumerBatch").mockImplementationOnce(async (store, scope, writes, receipt) => {
      const target = await store.read(consumerKey(scope, kind, SUBJECT, name));
      if (!target) throw new Error("Missing concurrent-edit target");
      const bytes = new TextEncoder().encode(newer);
      await store.writeBatch([{ ...target, revision: randomUUID(), bytes,
        sha256: createHash("sha256").update(bytes).digest("hex"), expectedRevision: target.revision }]);
      return originalCommit(store, scope, writes, receipt);
    });
    const action = kind === "phase" ? syncCheckedPhasesAt(cwd, PLAN, "2026-10-15")
      : closeSingleUnfinishedIterate(join(cwd, ".context", SUBJECT), "2026-10-15");
    await expect(action).rejects.toThrow(/stale revision/);
    expect(text(await read(cwd, kind, name))).toBe(newer);
  });

  it.each(["phase", "iterate"] as const)("does not acknowledge %s completion before durable receipt persistence", async (kind) => {
    configure(adapter);
    const cwd = repo();
    await retain(cwd, "plan", "plan-demo.md", "---\nstatus: active\n---\n# Plan\n");
    await retain(cwd, kind, kind === "phase" ? "phase-1-demo.md" : "iterate-current.md", kind === "phase" ? CHECKED : ACTIVE);
    const originalReceipt = prototype(adapter).writeReceipt;
    let entered!: () => void;
    let release!: () => void;
    const waiting = new Promise<void>((resolve) => { entered = resolve; });
    const gate = new Promise<void>((resolve) => { release = resolve; });
    vi.spyOn(prototype(adapter), "writeReceipt").mockImplementationOnce(async function (this: StorageStore, receipt) {
      entered();
      await gate;
      return originalReceipt.call(this, receipt);
    });
    let acknowledged = false;
    const action = kind === "phase" ? syncCheckedPhasesAt(cwd, PLAN, "2026-10-15")
      : closeSingleUnfinishedIterate(join(cwd, ".context", SUBJECT), "2026-10-15");
    const result = action.then((value) => { acknowledged = true; return value; });
    await waiting;
    expect(acknowledged).toBe(false);
    release();
    expect(await result).toEqual(kind === "phase" ? [join(cwd, PHASE)] : true);
  });

  it.each(["phase", "iterate"] as const)("surfaces failed %s receipt persistence rather than acknowledging success", async (kind) => {
    configure(adapter);
    const cwd = repo();
    await retain(cwd, "plan", "plan-demo.md", "---\nstatus: active\n---\n# Plan\n");
    await retain(cwd, kind, kind === "phase" ? "phase-1-demo.md" : "iterate-current.md", kind === "phase" ? CHECKED : ACTIVE);
    vi.spyOn(prototype(adapter), "writeReceipt").mockRejectedValueOnce(new Error("helper receipt storage unavailable"));
    const action = kind === "phase" ? syncCheckedPhasesAt(cwd, PLAN, "2026-10-15")
      : closeSingleUnfinishedIterate(join(cwd, ".context", SUBJECT), "2026-10-15");
    await expect(action).rejects.toThrow("helper receipt storage unavailable");
  });
});
