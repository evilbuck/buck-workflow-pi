import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { cleanupRepos, git, phaseMd, planMd, repo, writeTree } from "./fixtures.js";
import { readProjection, resume, writeProjection, PROJECTION_RELPATH, type Projection } from "../persist.js";
import { scan } from "../scan.js";
import { handleLoop } from "../loop.js";
import { consumerKey, retainConfiguredArtifact, scheduleConfiguredRetain } from "../../../skills/_shared/storage/consumers.js";
import { resolveConsumerContext, withBoundStore } from "../../../skills/_shared/scripts/workflow-state.js";
import type { StorageAdapter } from "../../../skills/_shared/storage/contract.js";

const SUBJECT = "2026-10-15.loop-authority";
const PLAN = `.context/${SUBJECT}/plan-demo.md`;
const PHASE = `.context/${SUBJECT}/phase-1-demo.md`;
const databaseUrl = process.env.BUCK_WORKFLOW_TEST_DATABASE_URL;
const adapters: StorageAdapter[] = ["repo-files", "external-files", "sqlite", ...(databaseUrl ? ["postgres" as const] : [])];
const temporary: string[] = [];

function configure(adapter: StorageAdapter): { config: string; home: string; storage: Record<string, string> } {
  const home = mkdtempSync(join(tmpdir(), "loop-authority-"));
  temporary.push(home);
  const config = join(home, "config.json");
  const storage = { adapter, ...(adapter === "external-files" ? { root: join(home, "external") } : {}),
    ...(adapter === "sqlite" ? { database: join(home, "state.sqlite") } : {}),
    ...(adapter === "postgres" ? { connection_env: "LOOP_STORAGE_TEST_URL" } : {}) };
  writeFileSync(config, JSON.stringify({ version: 1, storage }));
  vi.stubEnv("XDG_CONFIG_HOME", home);
  vi.stubEnv("BUCK_WORKFLOW_CONFIG", config);
  if (databaseUrl) vi.stubEnv("LOOP_STORAGE_TEST_URL", databaseUrl);
  return { home, config, storage };
}

function bookmark(overrides: Partial<Projection> = {}): Projection {
  return { version: 1, state: "reviewing", subject: SUBJECT, planPath: PLAN, phasePath: PHASE,
    loopCount: 7, iterateCyclesOnPhase: 2, maxLoops: 15, lastChoice: null, history: [],
    saveAttemptId: "exact-save-attempt", commitCheckpoint: null, ...overrides };
}

async function seed(cwd: string): Promise<void> {
  await retainConfiguredArtifact({ cwd, kind: "plan", subjectId: SUBJECT, logicalName: "plan-demo.md", bytes: new TextEncoder().encode(planMd()) });
  await retainConfiguredArtifact({ cwd, kind: "phase", subjectId: SUBJECT, logicalName: "phase-1-demo.md", bytes: new TextEncoder().encode(phaseMd(1, "completed")) });
  await retainConfiguredArtifact({ cwd, kind: "phase", subjectId: SUBJECT, logicalName: "phase-2-next.md", bytes: new TextEncoder().encode(phaseMd(2, "pending", [1])) });
  await retainConfiguredArtifact({ cwd, kind: "iterate", subjectId: SUBJECT, logicalName: "iterate-current.md", bytes: new TextEncoder().encode("---\nstatus: active\n---\n# Fix\n") });
}

afterEach(() => {
  vi.unstubAllEnvs();
  cleanupRepos();
  for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe.each(adapters)("buck-loop %s authority", (adapter) => {
  it("restores exact bookmark and artifact-over-bookmark facts with all checkout exports absent", async () => {
    configure(adapter);
    const cwd = repo();
    await seed(cwd);
    const saved = bookmark();
    await writeProjection(cwd, saved);
    rmSync(join(cwd, ".context"), { recursive: true, force: true });
    expect(await readProjection(cwd)).toEqual(saved);
    const resumed = await resume({ projectRoot: cwd });
    expect(resumed).toMatchObject({ state: "reviewing", subject: SUBJECT, phasePath: PHASE,
      loopCount: 7, iterateCyclesOnPhase: 2, saveAttemptId: "exact-save-attempt",
      workFacts: { postcondition: "confirmed" }, reviewFacts: { kind: "report", iterateArtifact: true } });
    expect(await scan({ projectRoot: cwd, path: PLAN })).toMatchObject({ subject: SUBJECT,
      phasePath: `.context/${SUBJECT}/phase-2-next.md`, planFacts: { kind: "phased-incomplete" } });
    expect((await handleLoop({ cwd, command: "status" })).state).toBe("reviewing");
  });

  it("does not treat a planted local bookmark as an adapter row", async () => {
    configure(adapter);
    const cwd = repo();
    writeTree(cwd, { [PROJECTION_RELPATH]: JSON.stringify(bookmark()) });
    expect(await readProjection(cwd)).toBeNull();
    expect((await resume({ projectRoot: cwd })).state).toBe("idle");
    expect((await handleLoop({ cwd, command: "status" })).state).toBe("idle");
  });

  it("keeps the workspace checkpoint readable after its first commit", async () => {
    configure(adapter);
    const cwd = repo();
    const saved = bookmark();
    await writeProjection(cwd, saved);
    writeTree(cwd, { "seed.txt": "first commit\n" });
    git(cwd, ["add", "seed.txt"]);
    git(cwd, ["commit", "-qm", "initial"]);
    rmSync(join(cwd, ".context"), { recursive: true, force: true });
    expect(await readProjection(cwd)).toEqual(saved);
  });

  it("isolates real worktree pointers when the target checkout differs from process cwd", async () => {
    configure(adapter);
    const left = repo();
    writeTree(left, { "seed.txt": "baseline\n" });
    git(left, ["add", "seed.txt"]);
    git(left, ["commit", "-qm", "baseline"]);
    const right = join(dirname(left), `${left.split("/").at(-1)}-right`);
    temporary.push(right);
    git(left, ["worktree", "add", "-q", "-b", "right", right]);
    await writeProjection(left, bookmark({ loopCount: 1 }));
    await writeProjection(right, bookmark({ state: "iterating", loopCount: 9 }));
    rmSync(join(left, ".context"), { recursive: true, force: true });
    rmSync(join(right, ".context"), { recursive: true, force: true });
    expect(await readProjection(left)).toMatchObject({ state: "reviewing", loopCount: 1 });
    expect(await readProjection(right)).toMatchObject({ state: "iterating", loopCount: 9 });
    const leftScope = await resolveConsumerContext(left);
    const rightScope = await resolveConsumerContext(right);
    expect(leftScope.projectId).toBe(rightScope.projectId);
    expect(leftScope.worktreeId).not.toBe(rightScope.worktreeId);
    expect(leftScope.runId).not.toBe(rightScope.runId);
  });

  it("pins queued writes and refuses a destination change rather than reading a stale export", async () => {
    const { config } = configure(adapter);
    const cwd = repo();
    const context = await resolveConsumerContext(cwd);
    const bytes = new TextEncoder().encode(JSON.stringify(bookmark()));
    const pending = scheduleConfiguredRetain({ cwd, kind: "checkpoint", subjectId: "buck-loop", logicalName: "workflow/buck-loop.json", bytes });
    writeFileSync(config, JSON.stringify({ version: 1, storage: { adapter: "external-files", root: join(dirname(config), "redirected") } }));
    await pending;
    await withBoundStore(cwd, context, async (store) => {
      const scope = { ...context, worktreeId: context.worktreeId!, runId: context.runId! };
      expect((await store.read(consumerKey(scope, "checkpoint", "buck-loop", "workflow/buck-loop.json")))?.bytes).toEqual(bytes);
    });
    writeTree(cwd, { [PROJECTION_RELPATH]: JSON.stringify(bookmark({ state: "done" })) });
    await expect(readProjection(cwd)).rejects.toThrow(/destination changed/);
    await expect(scan({ projectRoot: cwd, path: PLAN })).rejects.toThrow(/destination changed/);
  });

  it("surfaces selected-store outages without using existing subject/bookmark exports", async () => {
    const { home, storage } = configure(adapter);
    const cwd = repo();
    await seed(cwd);
    await writeProjection(cwd, bookmark());
    const context = await resolveConsumerContext(cwd);
    if (adapter === "postgres") vi.stubEnv("LOOP_STORAGE_TEST_URL", "postgres://loop:unused@127.0.0.1:1/absent?connect_timeout=1");
    else if (adapter === "sqlite") writeFileSync(storage.database!, "not a sqlite database");
    else {
      const root = adapter === "repo-files" ? context.manifestRoot! : join(home, "external");
      mkdirSync(root, { recursive: true });
      writeFileSync(join(root, "manifest.json"), "{invalid");
    }
    expect(readFileSync(join(cwd, PROJECTION_RELPATH), "utf8")).toContain('"reviewing"');
    await expect(readProjection(cwd)).rejects.toThrow();
    await expect(scan({ projectRoot: cwd, path: PLAN })).rejects.toThrow();
    await expect(resume({ projectRoot: cwd })).rejects.toThrow();
  });
});
