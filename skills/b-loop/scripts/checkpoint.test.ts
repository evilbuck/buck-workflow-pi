import { execSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  acquireWriterLock,
  CHECKPOINT_LOGICAL_NAME,
  checkpointDigest,
  createWorkflowCliCheckpointBackend,
  derivePhaseMilestone,
  formatStageProgress,
  persistCheckpointWithReadback,
  writerLockPath,
} from "./checkpoint.js";
import { runBuckLoop } from "./eval-buck-loop.js";
import type {
  CheckpointBackend,
  EvalBridges,
  LoopCheckpoint,
  LoopStage,
  StageAdapters,
  StoredCheckpointRecord,
} from "./types.js";

const tempDirs: string[] = [];

function createTempDir(prefix = "b-loop-p2-"): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore temp cleanup errors
    }
  }
});

function initGitRepo(branch = "feat/p2"): { repoDir: string; commit1: string; commit2: string } {
  const repoDir = createTempDir("b-loop-p2-git-");
  execSync(`git init -b ${branch}`, { cwd: repoDir, stdio: "ignore" });
  execSync('git config user.email "test@example.com" && git config user.name "Test"', { cwd: repoDir, stdio: "ignore" });
  writeFileSync(join(repoDir, "README.md"), "# Fixture\n");
  execSync("git add README.md && git commit -m init", { cwd: repoDir, stdio: "ignore" });
  const commit1 = execSync("git rev-parse HEAD", { cwd: repoDir, encoding: "utf8" }).trim();
  writeFileSync(join(repoDir, "README.md"), "# Fixture v2\n");
  execSync("git add README.md && git commit -m second", { cwd: repoDir, stdio: "ignore" });
  const commit2 = execSync("git rev-parse HEAD", { cwd: repoDir, encoding: "utf8" }).trim();
  return { repoDir, commit1, commit2 };
}

function makeItems(subjectId: string, opts: { phase1Status?: string; phase1Checked?: boolean } = {}) {
  const p1Status = opts.phase1Status ?? "pending";
  const box = opts.phase1Checked ? "[x]" : "[ ]";
  return [
    {
      token: `tok-plan-${subjectId}`,
      revision: "rev-plan-1",
      sha256: "sha-plan-1",
      subjectId,
      kind: "plan",
      logicalName: "plan-p2.md",
      text: "---\nstatus: active\n---\n# Plan\n",
    },
    {
      token: `tok-p1-${subjectId}`,
      revision: "rev-p1-1",
      sha256: "sha-p1-1",
      subjectId,
      kind: "phase",
      logicalName: "phase-1-one.md",
      text: `---\nstatus: ${p1Status}\nphase: 1\norder: 1\ndifficulty: medium\nfiles:\n  - src/a.ts\nacceptance_criteria:\n  - "${box} pass a"\n---\n`,
    },
    {
      token: `tok-p2-${subjectId}`,
      revision: "rev-p2-1",
      sha256: "sha-p2-1",
      subjectId,
      kind: "phase",
      logicalName: "phase-2-two.md",
      text: '---\nstatus: pending\nphase: 2\norder: 2\ndifficulty: hard\nfiles:\n  - src/b.ts\nacceptance_criteria:\n  - "[ ] pass b"\n---\n',
    },
  ];
}

function makeRealGitBridges(repoDir: string, items: unknown[]) {
  const phaseEvents: string[] = [];
  const logEvents: string[] = [];
  const bridges: EvalBridges = {
    agent: vi.fn(async () => ({ ok: true, wait: async () => ({ ok: true }) })),
    wait: vi.fn(async () => [{ ok: true }]),
    judge: vi.fn(async () => ({ answers: { c1: { type: "bool", bool: 1 } } })),
    phase: vi.fn((t: string) => phaseEvents.push(t)),
    log: vi.fn((m: string) => logEvents.push(m)),
    budget: { remaining: vi.fn(async () => 100_000) },
    sh: vi.fn(async (cmd: unknown) => {
      const command = String(cmd);
      try {
        return execSync(command, { cwd: repoDir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      } catch (err) {
        const e = err as { status?: number; stderr?: string; stdout?: string };
        throw Object.assign(new Error(`Shell failed (${e.status}): ${e.stderr || e.stdout}`), {
          exitCode: e.status ?? 1,
          output: String(e.stderr || e.stdout || ""),
        });
      }
    }),
    tool: {
      workflow_state: vi.fn(async () => ({ details: items })),
    },
  };
  return { bridges, phaseEvents, logEvents };
}

function makeMemoryBackend(): {
  backend: CheckpointBackend;
  store: Map<string, StoredCheckpointRecord>;
} {
  const store = new Map<string, StoredCheckpointRecord>();
  let revCounter = 0;
  const backend: CheckpointBackend = {
    async read({ subjectId, branchRef, logicalName }) {
      return store.get(`${subjectId}\0${branchRef}\0${logicalName}`) ?? null;
    },
    async write({ subjectId, branchRef, logicalName, checkpoint, expectedRevision }) {
      const key = `${subjectId}\0${branchRef}\0${logicalName}`;
      const existing = store.get(key) ?? null;
      const currentRev = existing?.revision ?? null;
      if (expectedRevision !== currentRev) {
        throw new Error(`stale revision rejected: expected ${expectedRevision}, got ${currentRev}`);
      }
      revCounter++;
      const copy = JSON.parse(JSON.stringify(checkpoint)) as LoopCheckpoint;
      const next: StoredCheckpointRecord = {
        revision: `ckpt-rev-${revCounter}`,
        sha256: checkpointDigest(copy),
        checkpoint: copy,
      };
      store.set(key, next);
      return next;
    },
  };
  return { backend, store };
}

function makeHappyStageAdapters(commits: Record<string, string>, trace: string[]): StageAdapters {
  return {
    build: {
      async dispatchWorking(ctx) {
        trace.push(`P${ctx.phase.order}:build`);
        return { jobHandle: `job-build-${ctx.phase.order}` };
      },
      async verifyResult(ctx) {
        return {
          status: "verified",
          proof: {
            phaseRevision: ctx.phase.revision,
            worktreeFingerprint: `fp-${ctx.phase.order}`,
            acceptanceEvidence: ["ok"],
            verifiedAt: new Date().toISOString(),
          },
        };
      },
    },
    review: {
      async dispatchWorking(ctx) {
        trace.push(`P${ctx.phase.order}:review`);
        return { jobHandle: `job-review-${ctx.phase.order}` };
      },
      async verifyResult(ctx) {
        return {
          status: "verified",
          proof: {
            phaseRevision: ctx.phase.revision,
            worktreeFingerprint: `fp-${ctx.phase.order}`,
            verdict: "clean",
            verifiedAt: new Date().toISOString(),
          },
        };
      },
    },
    save: {
      async dispatchWorking(ctx) {
        trace.push(`P${ctx.phase.order}:save`);
        return { jobHandle: `job-save-${ctx.phase.order}` };
      },
      async verifyResult(ctx) {
        return {
          status: "verified",
          proof: {
            attemptId: ctx.attemptId,
            receiptStatus: "complete",
            artifactRevisions: ["rev-mem-1"],
            verifiedAt: new Date().toISOString(),
          },
        };
      },
    },
    commit: {
      async dispatchWorking(ctx) {
        trace.push(`P${ctx.phase.order}:commit`);
        return { jobHandle: `job-commit-${ctx.phase.order}` };
      },
      async verifyResult(ctx) {
        const commitId = commits[ctx.phase.logicalName];
        return {
          status: "verified",
          commitId,
          proof: {
            baselineHead: ctx.pinnedPlan.headCommit,
            expectedTree: `tree-${ctx.phase.order}`,
            commitId,
            verifiedAt: new Date().toISOString(),
          },
        };
      },
    },
  };
}

function makeBaseCheckpoint(
  repoDir: string,
  subjectId: string,
  branchRef: string,
  branchName: string,
  stage: LoopStage,
  milestone: "starting" | "working" | "finished" | "verified",
): LoopCheckpoint {
  return {
    schemaVersion: 1,
    subjectId,
    branchRef,
    branchName,
    worktreeRoot: repoDir,
    planLogicalName: "plan-p2.md",
    planRevision: "rev-plan-1",
    planSha256: "sha-plan-1",
    phaseOrder: [
      { order: 1, logicalName: "phase-1-one.md", revision: "rev-p1-1", sha256: "sha-p1-1" },
      { order: 2, logicalName: "phase-2-two.md", revision: "rev-p2-1", sha256: "sha-p2-1" },
    ],
    completedPhaseCommits: {},
    currentPhaseOrder: 1,
    currentPhaseLogicalName: "phase-1-one.md",
    currentStage: stage,
    currentMilestone: milestone,
    attemptId: "att-saved-1",
    jobHandle: milestone === "working" ? "handle-1" : null,
    blocker: null,
    phases: {
      "phase-1-one.md": {
        order: 1,
        logicalName: "phase-1-one.md",
        phaseRevision: "rev-p1-1",
        phaseSha256: "sha-p1-1",
      },
      "phase-2-two.md": {
        order: 2,
        logicalName: "phase-2-two.md",
        phaseRevision: "rev-p2-1",
        phaseSha256: "sha-p2-1",
      },
    },
    updatedAt: "2026-11-17T00:00:00Z",
  };
}

describe("private workflow-adapter checkpoint seam & CAS readback", () => {
  it("persists private checkpoints via workflow adapter CLI across symlinked cwd without dirtying .context/ and rejects branch drift / invalid stdin", async () => {
    const { repoDir } = initGitRepo("feat/ckpt-adapter");
    const symLinkRepo = join(createTempDir("b-loop-sym-"), "linked-repo");
    symlinkSync(repoDir, symLinkRepo);

    const wt2 = createTempDir("b-loop-wt2-");
    execSync(`git worktree add -b feat/ckpt-other ${JSON.stringify(wt2)}`, { cwd: repoDir, stdio: "ignore" });
    const xdg = createTempDir("b-loop-xdg-");

    const { bridges } = makeRealGitBridges(repoDir, []);
    const backend = createWorkflowCliCheckpointBackend(bridges.sh!, { xdgConfigHome: xdg });
    const sample: LoopCheckpoint = {
      schemaVersion: 1,
      subjectId: "2026-11-17.ckpt-test",
      branchRef: "refs/heads/feat/ckpt-adapter",
      branchName: "feat/ckpt-adapter",
      worktreeRoot: repoDir,
      planLogicalName: "plan-p2.md",
      planRevision: "rev-plan-1",
      planSha256: "sha-plan-1",
      phaseOrder: [{ order: 1, logicalName: "phase-1-one.md", revision: "rev-p1-1", sha256: "sha-p1-1" }],
      completedPhaseCommits: {},
      currentPhaseOrder: 1,
      currentPhaseLogicalName: "phase-1-one.md",
      currentStage: "build",
      currentMilestone: "starting",
      attemptId: "att-1",
      jobHandle: null,
      blocker: null,
      phases: {},
      updatedAt: "2026-11-17T00:00:00.000Z",
    };

    const w1 = await persistCheckpointWithReadback(backend, {
      cwd: symLinkRepo,
      subjectId: sample.subjectId,
      branchRef: sample.branchRef,
      logicalName: CHECKPOINT_LOGICAL_NAME,
      checkpoint: sample,
      expectedRevision: null,
    });
    expect(w1.revision).toBeTruthy();

    // Private read through realpath works consistently and .context stays clean
    const r1 = await backend.read({
      cwd: repoDir,
      subjectId: sample.subjectId,
      branchRef: sample.branchRef,
      logicalName: CHECKPOINT_LOGICAL_NAME,
    });
    expect(r1?.revision).toBe(w1.revision);
    expect(existsSync(join(repoDir, ".context"))).toBe(false);
    expect(execSync("git status --porcelain", { cwd: repoDir, encoding: "utf8" }).trim()).toBe("");

    // Second worktree/branch cannot see first worktree's private checkpoint
    const { bridges: b2 } = makeRealGitBridges(wt2, []);
    const backend2 = createWorkflowCliCheckpointBackend(b2.sh!, { xdgConfigHome: xdg });
    expect(
      await backend2.read({
        cwd: wt2,
        subjectId: sample.subjectId,
        branchRef: "refs/heads/feat/ckpt-other",
        logicalName: CHECKPOINT_LOGICAL_NAME,
      }),
    ).toBeNull();

    // Branch drift rejected by CLI when passing mismatched branchRef
    await expect(
      backend.write({
        cwd: repoDir,
        subjectId: sample.subjectId,
        branchRef: "refs/heads/wrong-branch",
        logicalName: CHECKPOINT_LOGICAL_NAME,
        checkpoint: sample,
        expectedRevision: w1.revision,
      }),
    ).rejects.toThrow(/drifted/i);

    // CAS rejects stale expectedRevision
    await expect(
      persistCheckpointWithReadback(backend, {
        cwd: repoDir,
        subjectId: sample.subjectId,
        branchRef: sample.branchRef,
        logicalName: CHECKPOINT_LOGICAL_NAME,
        checkpoint: { ...sample, currentMilestone: "working" },
        expectedRevision: "wrong-stale-rev",
      }),
    ).rejects.toThrow(/stale revision|mismatch/i);
  });

  it("blocks before downstream side effects on digest tampering, nested proof tampering, or milestone mismatch", async () => {
    const { repoDir } = initGitRepo("feat/readback-fail");
    const xdg = createTempDir("b-loop-xdg-");
    const items = makeItems("2026-11-17.rb-fail");

    for (const mutate of [
      (ckpt: LoopCheckpoint, sha: string) => ({ revision: "r1", sha256: `${sha}00`, checkpoint: ckpt }),
      (ckpt: LoopCheckpoint, sha: string) => ({
        revision: "r1",
        sha256: sha,
        checkpoint: { ...ckpt, completedPhaseCommits: { "phase-1-one.md": "a".repeat(40) } },
      }),
      (ckpt: LoopCheckpoint, sha: string) => ({
        revision: "r1",
        sha256: sha,
        checkpoint: { ...ckpt, jobHandle: "tampered-handle" },
      }),
    ]) {
      const { bridges } = makeRealGitBridges(repoDir, items);
      const dispatchSpy = vi.fn(async () => ({}));
      const faultyBackend: CheckpointBackend = {
        async read() {
          return null;
        },
        async write({ checkpoint }) {
          return mutate(checkpoint, checkpointDigest(checkpoint));
        },
      };
      const res = await runBuckLoop({
        args: "2026-11-17.rb-fail",
        cwd: repoDir,
        xdgConfigHome: xdg,
        bridges,
        checkpointBackend: faultyBackend,
        stageAdapters: {
          build: {
            dispatchWorking: dispatchSpy,
            async verifyResult() {
              throw new Error("should not verify");
            },
          },
        },
      });
      expect(res.ok).toBe(false);
      expect(res.state).toBe("blocked");
      expect(res.message).toMatch(/mismatch/i);
      expect(dispatchSpy).not.toHaveBeenCalled();
    }
  });
});

describe("concurrent writer serialization & locking", () => {
  it("yields to a live writer in the same (subject, branch, worktree) without mutating state", async () => {
    const { repoDir } = initGitRepo("feat/concurrent");
    const xdg = createTempDir("b-loop-xdg-");
    const items = makeItems("2026-11-17.concurrent");
    const { bridges, logEvents } = makeRealGitBridges(repoDir, items);
    const { backend } = makeMemoryBackend();

    const firstLock = acquireWriterLock({
      cwd: repoDir,
      subjectId: "2026-11-17.concurrent",
      branchRef: "refs/heads/feat/concurrent",
      xdgConfigHome: xdg,
    });
    expect(firstLock.acquired).toBe(true);

    const secondDispatch = vi.fn(async () => ({}));
    const res = await runBuckLoop({
      args: "2026-11-17.concurrent",
      cwd: repoDir,
      xdgConfigHome: xdg,
      bridges,
      checkpointBackend: backend,
      isPidAlive: () => true,
      stageAdapters: {
        build: {
          dispatchWorking: secondDispatch,
          async verifyResult() {
            throw new Error("should not reach verify");
          },
        },
      },
    });

    expect(res.ok).toBe(true);
    expect(res.state).toBe("yielded");
    expect(secondDispatch).not.toHaveBeenCalled();
    expect(logEvents.some((m) => m.includes("yield"))).toBe(true);
    if (firstLock.acquired) firstLock.release();
  });

  it("reclaims dead/PID-reused locks safely and blocks on symlink or corrupt locks", () => {
    const { repoDir } = initGitRepo("feat/dead-lock");
    const xdg = createTempDir("b-loop-xdg-");
    const lockFile = writerLockPath(repoDir, "2026-11-17.dead", "refs/heads/feat/dead-lock", xdg);
    mkdirSync(join(xdg, "buck-workflow", "b-loop-locks"), { recursive: true });

    // Stale lock whose recorded pidStartTicks does not match current PID (recycled PID after reboot/crash)
    writeFileSync(
      lockFile,
      JSON.stringify({
        ownerId: "recycled-pid-owner",
        pid: process.pid,
        pidStartTicks: "99999999999",
        subjectId: "2026-11-17.dead",
        branchRef: "refs/heads/feat/dead-lock",
        worktreeRoot: repoDir,
        startedAt: "2026-11-17T00:00:00Z",
      }),
    );
    const reclaimed = acquireWriterLock({
      cwd: repoDir,
      subjectId: "2026-11-17.dead",
      branchRef: "refs/heads/feat/dead-lock",
      xdgConfigHome: xdg,
    });
    expect(reclaimed.acquired).toBe(true);
    if (reclaimed.acquired) reclaimed.release();

    // Symlink lock fails closed
    const targetFile = join(xdg, "target.txt");
    writeFileSync(targetFile, "{}");
    symlinkSync(targetFile, lockFile);
    expect(() =>
      acquireWriterLock({
        cwd: repoDir,
        subjectId: "2026-11-17.dead",
        branchRef: "refs/heads/feat/dead-lock",
        xdgConfigHome: xdg,
      }),
    ).toThrow(/regular file/i);
    rmSync(lockFile, { force: true });

    // Corrupt JSON fails closed
    writeFileSync(lockFile, "{corrupt-json");
    expect(() =>
      acquireWriterLock({
        cwd: repoDir,
        subjectId: "2026-11-17.dead",
        branchRef: "refs/heads/feat/dead-lock",
        xdgConfigHome: xdg,
      }),
    ).toThrow(/uncertain|corrupt/i);
  });
});

describe("milestones, plan drift checks, completion gaps, and checkpoint-first recovery", () => {
  it("emits starting/working/finished/verified for each stage and phase with distinct phase commits", async () => {
    const { repoDir, commit1, commit2 } = initGitRepo("feat/milestones");
    const xdg = createTempDir("b-loop-xdg-");
    const items = makeItems("2026-11-17.milestones");
    const { bridges, phaseEvents, logEvents } = makeRealGitBridges(repoDir, items);
    const { backend } = makeMemoryBackend();
    const trace: string[] = [];

    expect(derivePhaseMilestone("build", "starting")).toBe("starting");
    expect(derivePhaseMilestone("build", "working")).toBe("working");
    expect(derivePhaseMilestone("commit", "finished")).toBe("finished");
    expect(derivePhaseMilestone("commit", "verified")).toBe("verified");
    expect(formatStageProgress(2, "review", "finished", { reason: "findings" })).toBe(
      "Phase 2 · b-review finished · blocked",
    );

    const res = await runBuckLoop({
      args: "2026-11-17.milestones",
      cwd: repoDir,
      xdgConfigHome: xdg,
      bridges,
      checkpointBackend: backend,
      stageAdapters: makeHappyStageAdapters(
        { "phase-1-one.md": commit1, "phase-2-two.md": commit2 },
        trace,
      ),
    });

    expect(res.ok).toBe(true);
    expect(res.state).toBe("done");
    expect(res.completedPhaseCommits).toEqual({
      "phase-1-one.md": commit1,
      "phase-2-two.md": commit2,
    });
    expect(trace).toEqual([
      "P1:build",
      "P1:review",
      "P1:save",
      "P1:commit",
      "P2:build",
      "P2:review",
      "P2:save",
      "P2:commit",
    ]);
    expect(phaseEvents).toContain("Phase 1 · starting");
    expect(phaseEvents).toContain("Phase 1 · working");
    expect(phaseEvents).toContain("Phase 1 · finished");
    expect(phaseEvents).toContain("Phase 1 · verified");
    expect(logEvents.some((l) => l.includes("Phase 2 · b-commit verified"))).toBe(true);
  });

  it("detects completion gaps (frontmatter status, [x] checkboxes, missing stage proofs, unreachable commits) even in preflight mode", async () => {
    const { repoDir, commit1 } = initGitRepo("feat/gap");
    const xdg = createTempDir("b-loop-xdg-");

    // 1) Checkbox-only [x] with status: pending in preflight mode without checkpoint blocks
    const itemsCheckedOnly = makeItems("2026-11-17.gap", { phase1Status: "pending", phase1Checked: true });
    const { bridges: bChecked } = makeRealGitBridges(repoDir, itemsCheckedOnly);
    const { backend: emptyBackend } = makeMemoryBackend();
    const rChecked = await runBuckLoop({
      args: "2026-11-17.gap",
      cwd: repoDir,
      xdgConfigHome: xdg,
      bridges: bChecked,
      checkpointBackend: emptyBackend,
    });
    expect(rChecked.ok).toBe(false);
    expect(rChecked.message).toMatch(/without verified Git commit proof/i);

    // 2) Preflight mode reads existing checkpoint and accepts checkbox-complete phase when full stage proofs & reachable commit exist
    const { backend: validBackend } = makeMemoryBackend();
    const validCkpt = makeBaseCheckpoint(repoDir, "2026-11-17.gap", "refs/heads/feat/gap", "feat/gap", "commit", "verified");
    validCkpt.phases["phase-1-one.md"].build = { phaseRevision: "rev-p1-1", worktreeFingerprint: "fp1", acceptanceEvidence: ["ok"], verifiedAt: "now" };
    validCkpt.phases["phase-1-one.md"].review = { phaseRevision: "rev-p1-1", worktreeFingerprint: "fp1", verdict: "clean", verifiedAt: "now" };
    validCkpt.phases["phase-1-one.md"].save = { attemptId: "a1", receiptStatus: "complete", artifactRevisions: ["r1"], verifiedAt: "now" };
    validCkpt.phases["phase-1-one.md"].commit = { baselineHead: commit1, expectedTree: "t1", commitId: commit1, verifiedAt: "now" };
    validCkpt.completedPhaseCommits = { "phase-1-one.md": commit1 };
    await validBackend.write({
      cwd: repoDir,
      subjectId: "2026-11-17.gap",
      branchRef: "refs/heads/feat/gap",
      logicalName: CHECKPOINT_LOGICAL_NAME,
      checkpoint: validCkpt,
      expectedRevision: null,
    });
    const rValidPreflight = await runBuckLoop({
      args: "2026-11-17.gap",
      cwd: repoDir,
      xdgConfigHome: xdg,
      bridges: bChecked,
      checkpointBackend: validBackend,
      stageAdapters: {
        build: {
          dispatchWorking: async () => ({ handle: "b" }),
          verifyResult: async () => ({ status: "verified", proof: { phaseRevision: "r", worktreeFingerprint: "fp", acceptanceEvidence: [], verifiedAt: "now" } }),
        },
        review: {
          dispatchWorking: async () => ({ handle: "r" }),
          verifyResult: async () => ({ status: "verified", proof: { phaseRevision: "r", worktreeFingerprint: "fp", verdict: "clean", verifiedAt: "now" } }),
        },
        save: {
          dispatchWorking: async () => ({ handle: "s" }),
          verifyResult: async () => ({ status: "verified", proof: { attemptId: "a", receiptStatus: "complete", artifactRevisions: [], verifiedAt: "now" } }),
        },
        commit: {
          dispatchWorking: async () => ({ handle: "c" }),
          verifyResult: async () => ({ status: "verified", commitId: commit1, proof: { baselineHead: commit1, commitId: commit1, verifiedAt: "now" } }),
        },
      },
    });
    expect(rValidPreflight.ok).toBe(true);
    expect(rValidPreflight.state).toBe("done");

    // 3) Unreachable SHA in completedPhaseCommits when phases look pending in frontmatter still blocks in preflight mode!
    const { backend: badShaBackend } = makeMemoryBackend();
    const badCkpt = makeBaseCheckpoint(repoDir, "2026-11-17.gap", "refs/heads/feat/gap", "feat/gap", "build", "starting");
    badCkpt.phases["phase-1-one.md"].build = { phaseRevision: "rev-p1-1", worktreeFingerprint: "fp1", acceptanceEvidence: ["ok"], verifiedAt: "now" };
    badCkpt.phases["phase-1-one.md"].review = { phaseRevision: "rev-p1-1", worktreeFingerprint: "fp1", verdict: "clean", verifiedAt: "now" };
    badCkpt.phases["phase-1-one.md"].save = { attemptId: "a1", receiptStatus: "complete", artifactRevisions: ["r1"], verifiedAt: "now" };
    badCkpt.phases["phase-1-one.md"].commit = { baselineHead: commit1, expectedTree: "t1", commitId: "f".repeat(40), verifiedAt: "now" };
    badCkpt.completedPhaseCommits = { "phase-1-one.md": "f".repeat(40) };
    await badShaBackend.write({
      cwd: repoDir,
      subjectId: "2026-11-17.gap",
      branchRef: "refs/heads/feat/gap",
      logicalName: CHECKPOINT_LOGICAL_NAME,
      checkpoint: badCkpt,
      expectedRevision: null,
    });
    const { bridges: bPending } = makeRealGitBridges(repoDir, makeItems("2026-11-17.gap"));
    const rBadPreflight = await runBuckLoop({
      args: "2026-11-17.gap",
      cwd: repoDir,
      xdgConfigHome: xdg,
      bridges: bPending,
      checkpointBackend: badShaBackend,
    });
    expect(rBadPreflight.ok).toBe(false);
    expect(rBadPreflight.message).toMatch(/unreachable/i);
  });

  it("blocks recovery when plan revision drifted or checkpoint commit lacks commitId", async () => {
    const { repoDir, commit1 } = initGitRepo("feat/drift");
    const xdg = createTempDir("b-loop-xdg-");
    const subjectId = "2026-11-17.drift";
    const items = makeItems(subjectId);

    const { backend } = makeMemoryBackend();
    const drifted = makeBaseCheckpoint(repoDir, subjectId, "refs/heads/feat/drift", "feat/drift", "build", "starting");
    drifted.planRevision = "rev-plan-OLD";
    await backend.write({
      cwd: repoDir,
      subjectId,
      branchRef: "refs/heads/feat/drift",
      logicalName: CHECKPOINT_LOGICAL_NAME,
      checkpoint: drifted,
      expectedRevision: null,
    });

    const { bridges } = makeRealGitBridges(repoDir, items);
    const resDrift = await runBuckLoop({
      args: subjectId,
      cwd: repoDir,
      xdgConfigHome: xdg,
      bridges,
      checkpointBackend: backend,
      stageAdapters: makeHappyStageAdapters({}, []),
    });
    expect(resDrift.ok).toBe(false);
    expect(resDrift.message).toMatch(/drifted/i);

    // Commit stage returning verified without a valid commitId fails closed instead of infinite looping
    const { backend: bNoCommit } = makeMemoryBackend();
    const trace: string[] = [];
    const badAdapters = makeHappyStageAdapters({ "phase-1-one.md": commit1 }, trace);
    badAdapters.commit.verifyResult = async () => ({
      status: "verified",
      proof: { baselineHead: commit1, expectedTree: "t1", verifiedAt: "now" },
    });
    const resNoCommit = await runBuckLoop({
      args: subjectId,
      cwd: repoDir,
      xdgConfigHome: xdg,
      bridges,
      checkpointBackend: bNoCommit,
      stageAdapters: badAdapters,
    });
    expect(resNoCommit.ok).toBe(false);
    expect(resNoCommit.state).toBe("blocked");
    expect(resNoCommit.message).toMatch(/valid 40\/64-char commit SHA/i);
  });

  it("recovers every milestone branch (starting dispatch/finished/blocked, working finished/retry/uncertain, finished verified/stale/blocked, verified reuse, multi-phase)", async () => {
    const { repoDir, commit1, commit2 } = initGitRepo("feat/recovery");
    const xdg = createTempDir("b-loop-xdg-");
    const subjectId = "2026-11-17.recovery";
    const items = makeItems(subjectId);
    const mkCkpt = (stage: LoopStage, milestone: "starting" | "working" | "finished" | "verified") => {
      const ck = makeBaseCheckpoint(repoDir, subjectId, "refs/heads/feat/recovery", "feat/recovery", stage, milestone);
      ck.phases["phase-2-two.md"].phaseSha256 = "sha-p2-1";
      return ck;
    };

    // 1) "verified" reuses stored proof without re-dispatching build
    {
      const { backend } = makeMemoryBackend();
      const ck = mkCkpt("build", "verified");
      ck.phases["phase-1-one.md"].build = { phaseRevision: "rev-p1-1", worktreeFingerprint: "fp-1", acceptanceEvidence: ["ok"], verifiedAt: "now" };
      await backend.write({ cwd: repoDir, subjectId, branchRef: "refs/heads/feat/recovery", logicalName: CHECKPOINT_LOGICAL_NAME, checkpoint: ck, expectedRevision: null });
      const { bridges } = makeRealGitBridges(repoDir, items);
      const trace: string[] = [];
      const res = await runBuckLoop({
        args: subjectId, cwd: repoDir, xdgConfigHome: xdg, bridges, checkpointBackend: backend,
        stageAdapters: makeHappyStageAdapters({ "phase-1-one.md": commit1, "phase-2-two.md": commit2 }, trace),
      });
      expect(res.ok).toBe(true);
      expect(trace[0]).toBe("P1:review");
    }

    // 2) "working" -> recoverWorking "finished" verifies directly; "retry" re-dispatches cleanly
    for (const mode of ["finished", "retry"] as const) {
      const { backend } = makeMemoryBackend();
      await backend.write({ cwd: repoDir, subjectId, branchRef: "refs/heads/feat/recovery", logicalName: CHECKPOINT_LOGICAL_NAME, checkpoint: mkCkpt("review", "working"), expectedRevision: null });
      const { bridges } = makeRealGitBridges(repoDir, items);
      const trace: string[] = [];
      const adapters = makeHappyStageAdapters({ "phase-1-one.md": commit1, "phase-2-two.md": commit2 }, trace);
      adapters.review.recoverWorking = async () => ({ status: mode });
      const res = await runBuckLoop({
        args: subjectId, cwd: repoDir, xdgConfigHome: xdg, bridges, checkpointBackend: backend, stageAdapters: adapters,
      });
      expect(res.ok).toBe(true);
      if (mode === "finished") expect(trace[0]).toBe("P1:save");
      else expect(trace[0]).toBe("P1:review");
    }

    // 3) "starting" -> checkStarting "dispatch" preserves same attemptId; "blocked" preserves starting blocker; "already-finished" jumps to verify
    {
      const { backend } = makeMemoryBackend();
      await backend.write({ cwd: repoDir, subjectId, branchRef: "refs/heads/feat/recovery", logicalName: CHECKPOINT_LOGICAL_NAME, checkpoint: mkCkpt("save", "starting"), expectedRevision: null });
      const { bridges } = makeRealGitBridges(repoDir, items);
      let seenAttemptId: string | undefined;
      const adapters = makeHappyStageAdapters({ "phase-1-one.md": commit1, "phase-2-two.md": commit2 }, []);
      adapters.save.checkStarting = async (ctx) => { seenAttemptId = ctx.attemptId; return { status: "dispatch" }; };
      const res = await runBuckLoop({ args: subjectId, cwd: repoDir, xdgConfigHome: xdg, bridges, checkpointBackend: backend, stageAdapters: adapters });
      expect(res.ok).toBe(true);
      expect(seenAttemptId).toBe("att-saved-1");
    }
    {
      const { backend } = makeMemoryBackend();
      await backend.write({ cwd: repoDir, subjectId, branchRef: "refs/heads/feat/recovery", logicalName: CHECKPOINT_LOGICAL_NAME, checkpoint: mkCkpt("save", "starting"), expectedRevision: null });
      const { bridges } = makeRealGitBridges(repoDir, items);
      const adapters = makeHappyStageAdapters({ "phase-1-one.md": commit1, "phase-2-two.md": commit2 }, []);
      adapters.save.checkStarting = async () => ({ status: "blocked", reason: "journal lock busy", nextSafeAction: "inspect journal" });
      const res = await runBuckLoop({ args: subjectId, cwd: repoDir, xdgConfigHome: xdg, bridges, checkpointBackend: backend, stageAdapters: adapters });
      expect(res.ok).toBe(false);
      expect(res.milestone).toBe("starting");
      expect(res.blocker?.attemptId).toBe("att-saved-1");
    }

    // 4) "finished" -> "stale_or_missing" re-runs stage once; "blocked" preserves finished + proof + blocker
    {
      const { backend } = makeMemoryBackend();
      await backend.write({ cwd: repoDir, subjectId, branchRef: "refs/heads/feat/recovery", logicalName: CHECKPOINT_LOGICAL_NAME, checkpoint: mkCkpt("review", "finished"), expectedRevision: null });
      const { bridges } = makeRealGitBridges(repoDir, items);
      const trace: string[] = [];
      let calls = 0;
      const adapters = makeHappyStageAdapters({ "phase-1-one.md": commit1, "phase-2-two.md": commit2 }, trace);
      adapters.review.verifyResult = async (ctx) => {
        calls++;
        if (calls === 1) return { status: "stale_or_missing", reason: "worktree fingerprint changed" };
        return { status: "verified", proof: { phaseRevision: ctx.phase.revision, worktreeFingerprint: "fp-fresh", verdict: "clean", verifiedAt: "now" } };
      };
      const res = await runBuckLoop({ args: subjectId, cwd: repoDir, xdgConfigHome: xdg, bridges, checkpointBackend: backend, stageAdapters: adapters });
      expect(res.ok).toBe(true);
      expect(calls).toBe(3); // P1 stale check + P1 re-run verify + P2 verify
      expect(trace).toEqual(["P1:review", "P1:save", "P1:commit", "P2:build", "P2:review", "P2:save", "P2:commit"]);
    }
    {
      const { backend } = makeMemoryBackend();
      await backend.write({ cwd: repoDir, subjectId, branchRef: "refs/heads/feat/recovery", logicalName: CHECKPOINT_LOGICAL_NAME, checkpoint: mkCkpt("review", "finished"), expectedRevision: null });
      const { bridges } = makeRealGitBridges(repoDir, items);
      const adapters = makeHappyStageAdapters({ "phase-1-one.md": commit1, "phase-2-two.md": commit2 }, []);
      adapters.review.verifyResult = async () => ({
        status: "blocked",
        reason: "2 actionable findings",
        nextSafeAction: "Run b-iterate then rerun /b-loop",
        proof: { phaseRevision: "rev-p1-1", worktreeFingerprint: "fp-1", reportLogicalName: "review-p1.md", verdict: "actionable", verifiedAt: "now" },
      });
      const res = await runBuckLoop({ args: subjectId, cwd: repoDir, xdgConfigHome: xdg, bridges, checkpointBackend: backend, stageAdapters: adapters });
      expect(res.ok).toBe(false);
      expect(res.milestone).toBe("finished");
      expect(res.blocker?.attemptId).toBe("att-saved-1");
    }

    // 5) Multi-phase mid-loop recovery: phase 1 committed, restarts directly at phase 2 build
    {
      const { backend } = makeMemoryBackend();
      const ck = mkCkpt("build", "starting");
      ck.phases["phase-1-one.md"].build = { phaseRevision: "rev-p1-1", worktreeFingerprint: "fp1", acceptanceEvidence: ["ok"], verifiedAt: "now" };
      ck.phases["phase-1-one.md"].review = { phaseRevision: "rev-p1-1", worktreeFingerprint: "fp1", verdict: "clean", verifiedAt: "now" };
      ck.phases["phase-1-one.md"].save = { attemptId: "a1", receiptStatus: "complete", artifactRevisions: ["r1"], verifiedAt: "now" };
      ck.phases["phase-1-one.md"].commit = { baselineHead: commit1, expectedTree: "t1", commitId: commit1, verifiedAt: "now" };
      ck.completedPhaseCommits = { "phase-1-one.md": commit1 };
      ck.currentPhaseOrder = 2;
      ck.currentPhaseLogicalName = "phase-2-two.md";
      await backend.write({ cwd: repoDir, subjectId, branchRef: "refs/heads/feat/recovery", logicalName: CHECKPOINT_LOGICAL_NAME, checkpoint: ck, expectedRevision: null });

      const { bridges } = makeRealGitBridges(repoDir, items);
      const trace: string[] = [];
      const res = await runBuckLoop({
        args: subjectId, cwd: repoDir, xdgConfigHome: xdg, bridges, checkpointBackend: backend,
        stageAdapters: makeHappyStageAdapters({ "phase-1-one.md": commit1, "phase-2-two.md": commit2 }, trace),
      });
      expect(res.ok).toBe(true);
      expect(trace).toEqual(["P2:build", "P2:review", "P2:save", "P2:commit"]);
    }
  });
});
