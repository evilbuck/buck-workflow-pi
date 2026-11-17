import { execSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { workflowStateTool } from "../../../extensions/workflow-state/index.js";
import { checkpointDigest, createWorkflowCliCheckpointBackend, createWorkflowCliRunStateBackend } from "./checkpoint.js";
import { runBuckLoop } from "./eval-buck-loop.js";
import { executeCheckpointLoop } from "./recovery.js";
import {
  computeWorktreeFingerprint,
  createDefaultStageAdapters,
  STAGE_TOOLS,
} from "./stages.js";
import { resolveAndPinPlan } from "./validation.js";
import type {
  BuildStageProof,
  CheckpointBackend,
  EvalBridges,
  LoopCheckpoint,
  PinnedPhase,
  PinnedPlan,
  RunStateBackend,
  StageContext,
  StoredCheckpointRecord,
  ValidatedBridges,
} from "./types.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()!;
    rmSync(dir, { recursive: true, force: true });
  }
});

function createTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function initGitRepo(branch = "feature/phase-3"): { dir: string; headCommit: string } {
  const dir = createTempDir("b-loop-p3-repo-");
  execSync(`git init -b ${branch}`, { cwd: dir, stdio: "ignore" });
  execSync('git config user.name "Test User"', { cwd: dir, stdio: "ignore" });
  execSync('git config user.email "test@example.com"', { cwd: dir, stdio: "ignore" });
  mkdirSync(join(dir, "src"), { recursive: true });
  writeFileSync(join(dir, "src", "app.ts"), "export const v = 1;\n");
  execSync("git add . && git commit -m initial", { cwd: dir, stdio: "ignore" });
  const headCommit = execSync("git rev-parse HEAD", { cwd: dir, encoding: "utf8" }).trim();
  return { dir, headCommit };
}

function writeStorageConfig(xdgConfigHome: string): string {
  const cfgDir = join(xdgConfigHome, "buck-workflow");
  mkdirSync(cfgDir, { recursive: true });
  const cfgPath = join(cfgDir, "config.yaml");
  writeFileSync(cfgPath, "version: 1\nstorage:\n  adapter: repo-files\n");
  return cfgPath;
}

function makeRealSh(): ValidatedBridges["sh"] {
  return async (cmd) => {
    const command = typeof cmd === "string" ? cmd : String(cmd);
    const output = execSync(command, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { output, stdout: output, exitCode: 0 };
  };
}

function makeMemoryRunStateBackend(): RunStateBackend {
  const store = new Map<string, { revision: string; sha256: string; data: unknown }>();
  let seq = 0;
  return {
    async readRunState<T>({ subjectId, branchRef, logicalName }: {
      subjectId: string;
      branchRef: string;
      logicalName: string;
    }) {
      const hit = store.get(`${subjectId}:${branchRef}:${logicalName}`);
      return hit ? ({ ...hit, data: structuredClone(hit.data) as T }) : null;
    },
    async writeRunState<T>({ subjectId, branchRef, logicalName, data, expectedRevision }: {
      subjectId: string;
      branchRef: string;
      logicalName: string;
      data: T;
      expectedRevision: string | null;
    }) {
      const k = `${subjectId}:${branchRef}:${logicalName}`;
      const prev = store.get(k) ?? null;
      if ((prev?.revision ?? null) !== expectedRevision) {
        throw new Error(`CAS mismatch on run-state ${logicalName}`);
      }
      seq += 1;
      const saved = {
        revision: `rs-rev-${seq}`,
        sha256: `sha-${seq}`,
        data: structuredClone(data),
      };
      store.set(k, saved);
      return { ...saved, data: structuredClone(data) };
    },
  };
}

function makeMemoryCheckpointBackend(): CheckpointBackend {
  const records = new Map<string, StoredCheckpointRecord>();
  let seq = 0;
  return {
    async read({ subjectId, branchRef, logicalName }) {
      const hit = records.get(`${subjectId}:${branchRef}:${logicalName}`);
      return hit ? structuredClone(hit) : null;
    },
    async write({ subjectId, branchRef, logicalName, checkpoint, expectedRevision }) {
      const k = `${subjectId}:${branchRef}:${logicalName}`;
      const prev = records.get(k) ?? null;
      if ((prev?.revision ?? null) !== expectedRevision) {
        throw new Error("CAS mismatch");
      }
      seq += 1;
      const savedCheckpoint = structuredClone(checkpoint);
      const next: StoredCheckpointRecord = {
        revision: `ckpt-rev-${seq}`,
        sha256: checkpointDigest(savedCheckpoint),
        checkpoint: savedCheckpoint,
      };
      records.set(k, next);
      return structuredClone(next);
    },
  };
}

interface FakeArtifact {
  token: string;
  revision: string;
  sha256: string;
  subjectId: string;
  logicalName: string;
  kind: string;
  text: string;
}

function makeWorkflowStateDouble(options: {
  subjectId: string;
  phase: PinnedPhase;
  planLogicalName?: string;
  denyWriteReceiptRole?: boolean;
}) {
  let seq = 10;
  const artifacts = new Map<string, FakeArtifact>();
  const keyOf = (subjectId: string, kind: string, logicalName: string) => `${subjectId}:${kind}:${logicalName}`;

  const seed = (a: Omit<FakeArtifact, "token" | "sha256"> & { sha256?: string }) => {
    const rec: FakeArtifact = {
      ...a,
      sha256: a.sha256 ?? `sha-${a.revision}`,
      token: `workflow-artifact:${Buffer.from(`${a.subjectId}:${a.kind}:${a.logicalName}`).toString("base64url")}`,
    };
    artifacts.set(keyOf(a.subjectId, a.kind, a.logicalName), rec);
    return rec;
  };

  seed({
    subjectId: options.subjectId,
    kind: "plan",
    logicalName: options.planLogicalName ?? "plan-demo.md",
    revision: "plan-rev-1",
    sha256: "plan-sha-1",
    text: "---\ntitle: Demo\nstatus: active\n---\n# Plan\n",
  });
  seed({
    subjectId: options.subjectId,
    kind: "phase",
    logicalName: options.phase.logicalName,
    revision: options.phase.revision,
    sha256: options.phase.sha256,
    text: `---\nphase: ${options.phase.phaseNum}\norder: ${options.phase.order}\nstatus: ${options.phase.status}\ndifficulty: ${options.phase.difficulty}\nacceptance_criteria:\n${options.phase.acceptanceCriteria.map((c) => `  - ${JSON.stringify(c)}`).join("\n")}\nfiles:\n${options.phase.files.map((f) => `  - ${f}`).join("\n")}\n---\n# Phase\n`,
  });

  let receipt: {
    projectId: string;
    branchId: string;
    worktreeId: string;
    runId: string;
    attemptId: string;
    status: "attempted" | "complete";
    artifactRevisions: string[];
    metadataDuties?: string[];
    kind?: string;
  } | null = null;
  let globalListCalled = false;

  const tool = vi.fn(async (req: Record<string, unknown>) => {
    const op = String(req.operation ?? "");
    if (op === "list") {
      if (typeof req.subjectId !== "string" || !req.subjectId) {
        globalListCalled = true;
        throw new Error("Unfiltered global list forbidden");
      }
      const list = [...artifacts.values()].filter(
        (item) => item.subjectId === req.subjectId && (typeof req.kind !== "string" || item.kind === req.kind),
      );
      return { content: [{ type: "text", text: JSON.stringify(list) }], details: list };
    }
    if (op === "read") {
      if (typeof req.token === "string") {
        const hit = [...artifacts.values()].find((item) => item.token === req.token);
        if (!hit) return { content: [{ type: "text", text: "null" }], details: null };
        if (typeof req.revision === "string" && hit.revision !== req.revision) {
          return { content: [{ type: "text", text: "null" }], details: null };
        }
        return { content: [{ type: "text", text: JSON.stringify(hit) }], details: hit };
      }
      const hit = artifacts.get(keyOf(String(req.subjectId), String(req.kind), String(req.logicalName)));
      if (!hit || (typeof req.revision === "string" && hit.revision !== req.revision)) {
        return { content: [{ type: "text", text: "null" }], details: null };
      }
      return { content: [{ type: "text", text: JSON.stringify(hit) }], details: hit };
    }
    if (op === "write") {
      const k = keyOf(String(req.subjectId), String(req.kind), String(req.logicalName));
      const existing = artifacts.get(k);
      if ("expectedRevision" in req && req.expectedRevision !== (existing?.revision ?? null)) {
        throw new Error(`CAS conflict writing ${k}`);
      }
      seq += 1;
      const rev = `art-rev-${seq}`;
      const saved = seed({
        subjectId: String(req.subjectId),
        kind: String(req.kind),
        logicalName: String(req.logicalName),
        revision: rev,
        text: String(req.body ?? ""),
      });
      return { content: [{ type: "text", text: JSON.stringify(saved) }], details: saved };
    }
    if (op === "write-receipt") {
      if (options.denyWriteReceiptRole) {
        throw new Error("workflow_state failed: write role cannot execute write-receipt");
      }
      const status = String(req.status) as "attempted" | "complete";
      const attemptId = String(req.attemptId);
      const artifactRevisions = Array.isArray(req.artifactRevisions) ? req.artifactRevisions.map(String) : [];
      const duties = Array.isArray(req.metadataDuties) ? req.metadataDuties.map(String) : [];
      const sorted = (arr: readonly string[]) => [...arr].sort().join("\0");
      if (status === "attempted" && receipt && receipt.attemptId === attemptId && receipt.status === "attempted") {
        if (sorted(receipt.metadataDuties ?? []) !== sorted(duties)) {
          throw new Error("receipt required metadata duties cannot change");
        }
      }
      if (status === "complete") {
        if (receipt?.status !== "attempted" || receipt?.attemptId !== attemptId) {
          throw new Error("complete receipt requires matching attempted identity");
        }
        if (sorted(receipt.artifactRevisions) !== sorted(artifactRevisions)) {
          throw new Error("receipt revision set does not match the attempt");
        }
        const missingDuty = (receipt.metadataDuties ?? []).filter((d) => !duties.includes(d));
        if (missingDuty.length > 0) {
          throw new Error(`receipt complete requires successful metadata duties: ${missingDuty.join(", ")}`);
        }
      }
      receipt = {
        projectId: "proj-1",
        branchId: "branch-1",
        worktreeId: "wt-1",
        runId: receipt?.attemptId === attemptId ? receipt.runId : `run-${attemptId}`,
        attemptId,
        status,
        artifactRevisions,
        metadataDuties: duties,
        kind: typeof req.receiptKind === "string" ? req.receiptKind : typeof req.kind === "string" ? req.kind : undefined,
      };
      return { content: [{ type: "text", text: JSON.stringify(receipt) }], details: receipt };
    }
    if (op === "read-receipt") {
      return { content: [{ type: "text", text: JSON.stringify(receipt) }], details: receipt };
    }
    throw new Error(`Unsupported workflow_state op in test: ${op}`);
  });

  return {
    tool,
    artifacts,
    seed,
    setReceipt: (next: typeof receipt) => {
      receipt = next;
    },
    getReceipt: () => receipt,
    wasGlobalListCalled: () => globalListCalled,
  };
}

function makeFixture(opts?: { difficulty?: "easy" | "medium" | "hard"; criteria?: string[]; denyWriteReceiptRole?: boolean }) {
  const { dir, headCommit } = initGitRepo("feature/phase-3");
  const subjectId = "2026-11-17.phase3-demo";
  const phase: PinnedPhase = {
    phaseNum: 1,
    order: 1,
    logicalName: "phase-1-core.md",
    slug: "phase-1-core",
    token: "workflow-artifact:phase1",
    revision: "phase-rev-1",
    sha256: "phase-sha-1",
    status: "pending",
    difficulty: opts?.difficulty ?? "medium",
    buckHint: (opts?.difficulty ?? "medium") === "hard" ? "/b-build-hard" : "/b-build",
    files: ["src/app.ts", "src/app.test.ts"],
    acceptanceCriteria: opts?.criteria ?? [
      "[ ] Implements feature cleanly",
      "[ ] Unit tests pass",
    ],
  };
  const pinnedPlan: PinnedPlan = {
    subjectId,
    branchRef: "refs/heads/feature/phase-3",
    branchName: "feature/phase-3",
    headCommit,
    adapter: "repo-files",
    planLogicalName: "plan-demo.md",
    planRevision: "plan-rev-1",
    planSha256: "plan-sha-1",
    phases: [phase],
  };
  const wf = makeWorkflowStateDouble({
    subjectId,
    phase,
    denyWriteReceiptRole: opts?.denyWriteReceiptRole,
  });
  const checkpoint: LoopCheckpoint = {
    schemaVersion: 1,
    subjectId,
    branchRef: pinnedPlan.branchRef,
    branchName: pinnedPlan.branchName,
    worktreeRoot: dir,
    planLogicalName: pinnedPlan.planLogicalName,
    planRevision: pinnedPlan.planRevision,
    planSha256: pinnedPlan.planSha256,
    phaseOrder: [{ order: 1, logicalName: phase.logicalName, revision: phase.revision, sha256: phase.sha256 }],
    completedPhaseCommits: {},
    currentPhaseOrder: 1,
    currentPhaseLogicalName: phase.logicalName,
    currentStage: "build",
    currentMilestone: "starting",
    attemptId: null,
    jobHandle: null,
    blocker: null,
    phases: {},
    updatedAt: new Date().toISOString(),
  };

  return { dir, headCommit, subjectId, phase, pinnedPlan, wf, checkpoint };
}

function makeBridges(
  wfTool: ValidatedBridges["tool"]["workflow_state"],
  overrides?: Partial<ValidatedBridges & { judgeBatch?: unknown }>,
): ValidatedBridges & Record<string, unknown> {
  return {
    agent: vi.fn(async () => ({ handle: "agent://1", wait: async () => "ok" })),
    wait: vi.fn(async (handles: unknown[]) =>
      Promise.all(handles.map((h) => (h && typeof (h as { wait?: () => unknown }).wait === "function" ? (h as { wait: () => unknown }).wait() : h))),
    ),
    judge: vi.fn(async (_state: unknown, questions: Record<string, unknown>) => ({
      answers: Object.fromEntries(Object.keys(questions).map((id) => [id, { type: "bool", bool: 0.95 }])),
      model: "typesafe/jev-latest",
    })),
    sh: makeRealSh(),
    phase: vi.fn(),
    log: vi.fn(),
    tool: { workflow_state: wfTool },
    ...overrides,
  };
}

describe("worktree fingerprinting", () => {
  it("computes deterministic fingerprints and ignores review/iterate reports and workflow temp files", async () => {
    const { dir } = initGitRepo();
    const sh = makeRealSh();

    const fp1 = await computeWorktreeFingerprint(dir, sh);
    const fp2 = await computeWorktreeFingerprint(dir, sh);
    expect(fp1).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(fp1).toBe(fp2);

    // Review reports, iterate reports, and workflow scratch files do not invalidate build fingerprint
    mkdirSync(join(dir, ".context", "2026-11-17.demo"), { recursive: true });
    mkdirSync(join(dir, ".context", "workflow"), { recursive: true });
    writeFileSync(join(dir, ".context", "2026-11-17.demo", "review-phase-1.md"), "clean\n");
    writeFileSync(join(dir, ".context", "2026-11-17.demo", "iterate-phase-1.md"), "findings\n");
    writeFileSync(join(dir, ".context", "workflow", "tmp.json"), "{}\n");
    expect(await computeWorktreeFingerprint(dir, sh)).toBe(fp1);

    // Source file edit immediately changes fingerprint
    writeFileSync(join(dir, "src", "app.ts"), "export const v = 2;\n");
    const fpChanged = await computeWorktreeFingerprint(dir, sh);
    expect(fpChanged).not.toBe(fp1);

    // Untracked file addition also changes fingerprint
    writeFileSync(join(dir, "src", "extra.ts"), "export const x = 1;\n");
    const fpUntracked = await computeWorktreeFingerprint(dir, sh);
    expect(fpUntracked).not.toBe(fpChanged);
  });
});

describe("restricted stage tools and dispatch boundaries", () => {
  it("passes restricted tool allowlists per stage and keeps review read-only without judgeBatch or auto-iterate", async () => {
    expect(STAGE_TOOLS.review).not.toContain("edit");
    expect(STAGE_TOOLS.review).not.toContain("write");
    expect(STAGE_TOOLS.review).not.toContain("bash");
    expect(STAGE_TOOLS.save).not.toContain("bash");
    expect(STAGE_TOOLS.commit).not.toContain("edit");
    expect(STAGE_TOOLS.commit).not.toContain("write");
    expect(STAGE_TOOLS.commit).not.toContain("bash");

    const fix = makeFixture({ difficulty: "hard" });
    const runState = makeMemoryRunStateBackend();
    const agentCalls: Array<{ prompt: string; options: Record<string, unknown> }> = [];
    const judgeBatch = vi.fn(() => {
      throw new Error("judgeBatch must never be called");
    });

    const bridges = makeBridges(fix.wf.tool, {
      judgeBatch,
      agent: vi.fn(async (prompt, options = {}) => {
        agentCalls.push({ prompt, options });
        const label = String(options.label ?? "");
        if (label.startsWith("b-build")) {
          writeFileSync(join(fix.dir, "src", "app.ts"), "export const v = 2;\n");
          return {
            wait: async () =>
              [
                "Done.",
                "## Acceptance evidence",
                "- `[ ] Implements feature cleanly`: edited src/app.ts cleanly",
                "- `[ ] Unit tests pass`: npx vitest run -> 2 passed",
              ].join("\n"),
          };
        }
        if (label.startsWith("b-review")) {
          return {
            wait: async () =>
              JSON.stringify({
                verdict: "clean",
                criticalCount: 0,
                warningCount: 0,
                summary: "Standards and Spec clean.",
                findings: [],
                reportMarkdown: "# Review\nClean.\n",
              }),
          };
        }
        if (label.startsWith("b-save")) {
          const saved = await fix.wf.tool({
            operation: "write",
            subjectId: "memory",
            kind: "memory",
            logicalName: "phase-1-2026-11-17.md",
            body: "# Saved\n",
            expectedRevision: null,
          });
          const rev = (saved as { details: { revision: string } }).details.revision;
          const attemptId = /attemptId[:\s]+([a-f0-9-]+)/i.exec(prompt)?.[1] ?? "";
          const metadataDuties = ["save-metadata", "readback", "probe"];
          await fix.wf.tool({ operation: "write-receipt", attemptId, status: "attempted", artifactRevisions: [rev], receiptKind: "rows", metadataDuties });
          await fix.wf.tool({ operation: "write-receipt", attemptId, status: "complete", artifactRevisions: [rev], receiptKind: "rows", metadataDuties });
          return {
            wait: async () =>
              JSON.stringify({
                summary: "Saved phase 1 memory",
                savedArtifacts: [{ subjectId: "memory", kind: "memory", logicalName: "phase-1-2026-11-17.md", revision: rev }],
              }),
          };
        }
        throw new Error(`Unexpected stage label: ${label}`);
      }),
    });

    const ckptBackend = makeMemoryCheckpointBackend();
    const adapters = createDefaultStageAdapters({ runStateBackend: runState });

    const res = await executeCheckpointLoop({
      cwd: fix.dir,
      pinnedPlan: fix.pinnedPlan,
      bridges,
      backend: ckptBackend,
      adapters,
    });

    expect(judgeBatch).not.toHaveBeenCalled();
    expect(fix.wf.wasGlobalListCalled()).toBe(false);
    // Reaches Phase 3 commit boundary cleanly after build -> review -> save verified
    expect(res.state).toBe("blocked");
    expect(res.stage).toBe("commit");

    expect(agentCalls.map((c) => String(c.options.label))).toEqual([
      "b-build-hard:phase-1-core",
      "b-review:phase-1-core",
      "b-save:phase-1-core",
    ]);
    expect(agentCalls[0].options.tools).toEqual([...STAGE_TOOLS.build]);
    expect(agentCalls[1].options.tools).toEqual([...STAGE_TOOLS.review]);
    expect(agentCalls[2].options.tools).toEqual([...STAGE_TOOLS.save]);
    // Ensure b-iterate was never invoked
    expect(agentCalls.some((c) => String(c.options.label).includes("iterate"))).toBe(false);
  });
});

describe("build stage acceptance and recovery", () => {
  it("evaluates acceptance criteria with keyed-object judge(), blocks on score < 0.7, and preserves partial edits", async () => {
    const fix = makeFixture({ difficulty: "easy" });
    const runState = makeMemoryRunStateBackend();
    const adapters = createDefaultStageAdapters({ runStateBackend: runState });

    const capturedJudgeInputs: Array<{ state: unknown; questions: Record<string, unknown> }> = [];
    const bridges = makeBridges(fix.wf.tool, {
      agent: vi.fn(async () => ({
        wait: async () => {
          writeFileSync(join(fix.dir, "src", "app.ts"), "export const partial = true;\n");
          return "## Acceptance evidence\n- `[ ] Implements feature cleanly`: partial work\n";
        },
      })),
      judge: vi.fn(async (state, questions) => {
        capturedJudgeInputs.push({ state, questions });
        const keys = Object.keys(questions);
        return {
          answers: {
            [keys[0]]: { type: "bool", bool: 0.9 },
            [keys[1]]: { type: "bool", bool: 0.4 },
          },
          model: "typesafe/jev-latest",
        };
      }),
    });

    const ctx: StageContext = {
      cwd: fix.dir,
      phase: fix.phase,
      stage: "build",
      pinnedPlan: fix.pinnedPlan,
      checkpoint: fix.checkpoint,
      attemptId: "att-build-1",
      bridges,
    };

    await adapters.build.prepareStarting?.(ctx);
    const disp = await adapters.build.dispatchWorking(ctx);
    await adapters.build.awaitFinished?.(ctx, disp);
    const verdict = await adapters.build.verifyResult(ctx);

    expect(verdict.status).toBe("blocked");
    // Keyed object (never array) passed to OMP 18.22.0 judge()
    expect(Array.isArray(capturedJudgeInputs[0].questions)).toBe(false);
    expect(Object.keys(capturedJudgeInputs[0].questions)).toEqual(["criterion_1", "criterion_2"]);
    // Partial edit preserved on disk
    expect(readFileSync(join(fix.dir, "src", "app.ts"), "utf8")).toContain("partial = true");

    // Interrupted during build -> recoverWorking preserves partial file and asks to retry
    const retry = await adapters.build.recoverWorking?.({
      ...ctx,
      attemptId: "att-build-interrupted",
    });
    expect(retry).toEqual({ status: "retry" });
    expect(readFileSync(join(fix.dir, "src", "app.ts"), "utf8")).toContain("partial = true");
  });

  it("detects stale build proof when worktree changes after build finished", async () => {
    const fix = makeFixture();
    const runState = makeMemoryRunStateBackend();
    const adapters = createDefaultStageAdapters({ runStateBackend: runState });
    const bridges = makeBridges(fix.wf.tool, {
      agent: vi.fn(async () => ({
        wait: async () => "## Acceptance evidence\n- ok\n",
      })),
    });

    const ctx: StageContext = {
      cwd: fix.dir,
      phase: fix.phase,
      stage: "build",
      pinnedPlan: fix.pinnedPlan,
      checkpoint: fix.checkpoint,
      attemptId: "att-build-stale",
      bridges,
    };
    const disp = await adapters.build.dispatchWorking(ctx);
    await adapters.build.awaitFinished?.(ctx, disp);

    // Mutate worktree between finished & verified
    writeFileSync(join(fix.dir, "src", "app.ts"), "export const mutated = 99;\n");
    const verdict = await adapters.build.verifyResult(ctx);
    expect(verdict.status).toBe("stale_or_missing");
  });
});

describe("review stage binding, reuse, blocking, and stale detection", () => {
  it("records b-review finished · blocked on actionable findings, preserves report, blocks save, and rewinds to rebuild after code fixes", async () => {
    const fix = makeFixture();
    const runState = makeMemoryRunStateBackend();
    const ckptBackend = makeMemoryCheckpointBackend();
    const adapters = createDefaultStageAdapters({ runStateBackend: runState });

    let buildCount = 0;
    let reviewCount = 0;
    let saveCount = 0;
    let reviewShouldBeClean = false;

    const bridges = makeBridges(fix.wf.tool, {
      agent: vi.fn(async (prompt, options = {}) => {
        const label = String(options.label ?? "");
        if (label.startsWith("b-build")) {
          buildCount += 1;
          return { wait: async () => "## Acceptance evidence\n- built\n" };
        }
        if (label.startsWith("b-review")) {
          reviewCount += 1;
          return {
            wait: async () =>
              JSON.stringify(
                reviewShouldBeClean
                  ? {
                      verdict: "clean",
                      criticalCount: 0,
                      warningCount: 0,
                      summary: "Clean after fix",
                      findings: [],
                      reportMarkdown: "# Review\nClean.\n",
                    }
                  : {
                      verdict: "actionable",
                      criticalCount: 1,
                      warningCount: 0,
                      summary: "Missing null check",
                      findings: [{ severity: "Critical", file: "src/app.ts", detail: "Missing guard" }],
                      reportMarkdown: "# Iterate\n- [Critical] Missing guard in src/app.ts\n",
                    },
              ),
          };
        }
        if (label.startsWith("b-save")) {
          saveCount += 1;
          const mem = await fix.wf.tool({
            operation: "write",
            subjectId: "memory",
            kind: "memory",
            logicalName: "saved.md",
            body: "# mem\n",
            expectedRevision: null,
          });
          const rev = (mem as { details: { revision: string } }).details.revision;
          const attemptId = /attemptId[:\s]+([a-f0-9-]+)/i.exec(prompt)?.[1] ?? "";
          const metadataDuties = ["save-metadata", "readback", "probe"];
          await fix.wf.tool({ operation: "write-receipt", attemptId, status: "attempted", artifactRevisions: [rev], receiptKind: "rows", metadataDuties });
          await fix.wf.tool({ operation: "write-receipt", attemptId, status: "complete", artifactRevisions: [rev], receiptKind: "rows", metadataDuties });
          return {
            wait: async () =>
              JSON.stringify({ savedArtifacts: [{ subjectId: "memory", kind: "memory", logicalName: "saved.md", revision: rev }] }),
          };
        }
        throw new Error(`Unexpected ${label}`);
      }),
    });

    const r1 = await executeCheckpointLoop({
      cwd: fix.dir,
      pinnedPlan: fix.pinnedPlan,
      bridges,
      backend: ckptBackend,
      adapters,
    });

    expect(r1.ok).toBe(false);
    expect(r1.state).toBe("blocked");
    expect(r1.stage).toBe("review");
    expect(r1.milestone).toBe("finished");
    expect(saveCount).toBe(0);
    // Iterate report kept in workflow_state
    expect(fix.wf.artifacts.has(`${fix.subjectId}:iterate:phase-1-core-iterate.md`) || fix.wf.artifacts.has(`${fix.subjectId}:iterate:iterate-phase-1-core.md`)).toBe(true);

    // Re-running with unchanged worktree keeps review finished · blocked without re-calling b-review
    const rUnchanged = await executeCheckpointLoop({
      cwd: fix.dir,
      pinnedPlan: fix.pinnedPlan,
      bridges,
      backend: ckptBackend,
      adapters,
    });
    expect(rUnchanged.stage).toBe("review");
    expect(rUnchanged.milestone).toBe("finished");
    expect(reviewCount).toBe(1);
    expect(saveCount).toBe(0);

    // Developer edits src/app.ts to fix finding -> build proof becomes stale -> rebuild -> clean review -> save!
    writeFileSync(join(fix.dir, "src", "app.ts"), "export const fixed = true;\n");
    reviewShouldBeClean = true;
    const rAfterFix = await executeCheckpointLoop({
      cwd: fix.dir,
      pinnedPlan: fix.pinnedPlan,
      bridges,
      backend: ckptBackend,
      adapters,
    });
    expect(buildCount).toBe(2);
    expect(reviewCount).toBe(2);
    expect(saveCount).toBe(1);
    expect(rAfterFix.stage).toBe("commit");
  });

  it("reuses matching clean review across restarts and detects stale review on build/worktree drift", async () => {
    const fix = makeFixture();
    const runState = makeMemoryRunStateBackend();
    const adapters = createDefaultStageAdapters({ runStateBackend: runState });
    const fp1 = await computeWorktreeFingerprint(fix.dir, makeRealSh());

    const revArt = fix.wf.seed({
      subjectId: fix.subjectId,
      kind: "review",
      logicalName: "review-phase-1-core.md",
      revision: "rev-clean-1",
      text: "# Clean Review\n",
    });

    const buildProof: BuildStageProof = {
      phaseRevision: fix.phase.revision,
      worktreeFingerprint: fp1,
      acceptanceEvidence: ["ok"],
      verifiedAt: "now",
    };

    const reviewAgent = vi.fn();
    const bridges = makeBridges(fix.wf.tool, { agent: reviewAgent });

    const ctxClean: StageContext = {
      cwd: fix.dir,
      phase: fix.phase,
      stage: "review",
      pinnedPlan: fix.pinnedPlan,
      attemptId: "att-rev-reuse",
      bridges,
      checkpoint: {
        ...fix.checkpoint,
        currentStage: "review",
        currentMilestone: "starting",
        phases: {
          [fix.phase.logicalName]: {
            order: 1,
            logicalName: fix.phase.logicalName,
            phaseRevision: fix.phase.revision,
            phaseSha256: fix.phase.sha256,
            build: buildProof,
            review: {
              phaseRevision: fix.phase.revision,
              worktreeFingerprint: fp1,
              reportLogicalName: "review-phase-1-core.md",
              reportRevision: revArt.revision,
              verdict: "clean",
              verifiedAt: "now",
            },
          },
        },
      },
    };

    const startReuse = await adapters.review.checkStarting?.(ctxClean);
    expect(startReuse).toEqual({ status: "already-finished" });
    const verifyReuse = await adapters.review.verifyResult(ctxClean);
    expect(verifyReuse.status).toBe("verified");
    expect(reviewAgent).not.toHaveBeenCalled();

    // Mutate worktree -> review becomes stale
    writeFileSync(join(fix.dir, "src", "app.ts"), "export const drifted = true;\n");
    const staleRes = await adapters.review.verifyResult(ctxClean);
    expect(staleRes.status).toBe("stale_or_missing");
  });
});

describe("save stage journal, receipt readback, and recovery", () => {
  it("adopts completed save apply without re-running agent and blocks with attemptId on ambiguous receipts", async () => {
    const fix = makeFixture();
    const runState = makeMemoryRunStateBackend();
    const adapters = createDefaultStageAdapters({ runStateBackend: runState });
    const fp = await computeWorktreeFingerprint(fix.dir, makeRealSh());

    const mem = fix.wf.seed({
      subjectId: "memory",
      kind: "memory",
      logicalName: "done-note.md",
      revision: "rev-mem-1",
      text: "# Saved\n",
    });

    const ckptWithReview: LoopCheckpoint = {
      ...fix.checkpoint,
      currentStage: "save",
      currentMilestone: "working",
      attemptId: "att-save-1",
      phases: {
        [fix.phase.logicalName]: {
          order: 1,
          logicalName: fix.phase.logicalName,
          phaseRevision: fix.phase.revision,
          phaseSha256: fix.phase.sha256,
          build: { phaseRevision: fix.phase.revision, worktreeFingerprint: fp, acceptanceEvidence: ["ok"], verifiedAt: "now" },
          review: { phaseRevision: fix.phase.revision, worktreeFingerprint: fp, verdict: "clean", verifiedAt: "now" },
        },
      },
    };

    fix.wf.setReceipt({
      projectId: "proj-1",
      branchId: "branch-1",
      worktreeId: "wt-1",
      runId: "run-att-save-1",
      attemptId: "att-save-1",
      status: "complete",
      artifactRevisions: [mem.token],
    });

    const saveAgent = vi.fn();
    const bridges = makeBridges(fix.wf.tool, { agent: saveAgent });
    const ctx: StageContext = {
      cwd: fix.dir,
      phase: fix.phase,
      stage: "save",
      pinnedPlan: fix.pinnedPlan,
      checkpoint: ckptWithReview,
      attemptId: "att-save-1",
      bridges,
    };

    expect(await adapters.save.recoverWorking?.(ctx)).toEqual({ status: "finished" });
    const verified = await adapters.save.verifyResult(ctx);
    expect(verified.status).toBe("verified");
    expect(saveAgent).not.toHaveBeenCalled();

    // Ambiguous outcome: conflicting attemptId in receipt blocks and surfaces attemptId
    fix.wf.setReceipt({
      projectId: "proj-1",
      branchId: "branch-1",
      worktreeId: "wt-1",
      runId: "run-other",
      attemptId: "att-foreign",
      status: "complete",
      artifactRevisions: [mem.token],
    });
    const uncertain = await adapters.save.recoverWorking?.(ctx);
    expect(uncertain?.status).toBe("uncertain");
    const blocked = await adapters.save.verifyResult(ctx);
    expect(blocked.status).toBe("blocked");
    if (blocked.status === "blocked") {
      expect(blocked.reason).toContain("att-save-1");
    }

    // Missing artifact readback blocks save instead of forging verified
    fix.wf.setReceipt({
      projectId: "proj-1",
      branchId: "branch-1",
      worktreeId: "wt-1",
      runId: "run-att-save-1",
      attemptId: "att-save-1",
      status: "complete",
      artifactRevisions: ["workflow-artifact:missing"],
    });
    const badReadback = await adapters.save.verifyResult(ctx);
    expect(badReadback.status).toBe("blocked");
  });

  it("handles real workflow_state write-role fallback via workflow-state-cli and sql-save-attempt recovery", async () => {
    const { dir, headCommit } = initGitRepo("feature/cli-save");
    const xdg = createTempDir("b-loop-xdg-");
    const cfgPath = writeStorageConfig(xdg);
    const sh = makeRealSh();

    const subjectId = "2026-11-17.cli-save";
    mkdirSync(join(dir, ".context", subjectId), { recursive: true });
    writeFileSync(join(dir, ".context", subjectId, "index.md"), "---\nstatus: active\n---\n# Subject\n");
    writeFileSync(join(dir, ".context", subjectId, "plan-cli.md"), "---\ntitle: CLI\nstatus: active\n---\n# Plan\n");
    writeFileSync(
      join(dir, ".context", subjectId, "phase-1-save.md"),
      "---\nphase: 1\norder: 1\nstatus: pending\ndifficulty: easy\nacceptance_criteria:\n  - \"[ ] Save works\"\nfiles:\n  - src/app.ts\n---\n# P1\n",
    );

    const prevXdg = process.env.XDG_CONFIG_HOME;
    process.env.XDG_CONFIG_HOME = xdg;
    try {
      const wfDef = workflowStateTool({ cwd: dir, role: "write" });
      const realWfTool: ValidatedBridges["tool"]["workflow_state"] = (params) =>
        wfDef.execute("test-call", params as never, undefined as never, undefined as never, {} as never);

      const pinnedPlan = await resolveAndPinPlan(realWfTool, subjectId, {
        branchRef: "refs/heads/feature/cli-save",
        branchName: "feature/cli-save",
        headCommit,
      });
      const phase = pinnedPlan.phases[0];

      const runState = createWorkflowCliRunStateBackend(sh, { xdgConfigHome: xdg, configPath: cfgPath });
      const ckptBackend = createWorkflowCliCheckpointBackend(sh, { xdgConfigHome: xdg, configPath: cfgPath });
      const adapters = createDefaultStageAdapters({ runStateBackend: runState, xdgConfigHome: xdg });

      const bridges = makeBridges(realWfTool, {
        agent: vi.fn(async (_prompt, options = {}) => {
          const label = String(options.label ?? "");
          if (label.startsWith("b-build")) {
            return { wait: async () => "## Acceptance evidence\n- `[ ] Save works`: verified\n" };
          }
          if (label.startsWith("b-review")) {
            return {
              wait: async () =>
                JSON.stringify({
                  verdict: "clean",
                  criticalCount: 0,
                  warningCount: 0,
                  summary: "Clean",
                  findings: [],
                  reportMarkdown: "# Clean\n",
                }),
            };
          }
          if (label.startsWith("b-save")) {
            // Child has write role only; writes memory via real workflow_state and lets coordinator seal receipt via CLI
            const saved = await realWfTool({
              operation: "write",
              subjectId: "memory",
              kind: "memory",
              logicalName: "cli-save-note.md",
              body: "# Note\n",
              expectedRevision: null,
            });
            const details = (saved as { details: { token: string; revision: string } }).details;
            return {
              wait: async () =>
                JSON.stringify({
                  summary: "Saved memory artifact",
                  savedArtifacts: [
                    { subjectId: "memory", kind: "memory", logicalName: "cli-save-note.md", revision: details.revision, token: details.token },
                  ],
                }),
            };
          }
          throw new Error(`Unexpected ${label}`);
        }),
      });

      const res = await executeCheckpointLoop({
        cwd: dir,
        pinnedPlan,
        bridges,
        backend: ckptBackend,
        adapters,
        xdgConfigHome: xdg,
        configPath: cfgPath,
      });

      // Stopped at commit (Phase 4 stub), after sealing save receipt via CLI despite write-role restriction!
      expect(res.stage).toBe("commit");
      const savedCkpt = await ckptBackend.read({
        cwd: dir,
        subjectId,
        branchRef: pinnedPlan.branchRef,
        logicalName: "b-loop/checkpoint.json",
        configPath: cfgPath,
      });
      expect(savedCkpt?.checkpoint.phases[phase.logicalName]?.save?.receiptStatus).toBe("complete");
      expect(savedCkpt?.checkpoint.phases[phase.logicalName]?.save?.artifactRevisions.length).toBeGreaterThan(0);

      // Foreign sql-save-attempt.json blocks prepareStarting and verifyResult with attemptId
      mkdirSync(join(dir, ".context", "workflow"), { recursive: true });
      writeFileSync(
        join(dir, ".context", "workflow", "sql-save-attempt.json"),
        JSON.stringify({ attemptId: "foreign-id", subject: "2026-11-17.other", phase: "phase-1-save.md" }),
      );
      const conflictCtx: StageContext = {
        cwd: dir,
        phase,
        stage: "save",
        pinnedPlan,
        checkpoint: savedCkpt!.checkpoint,
        attemptId: "att-conflict-check",
        bridges,
        xdgConfigHome: xdg,
      };
      await expect(adapters.save.prepareStarting?.(conflictCtx)).rejects.toThrow(/att-conflict-check/);
      const conflictVerify = await adapters.save.verifyResult(conflictCtx);
      expect(conflictVerify.status).toBe("blocked");
      if (conflictVerify.status === "blocked") {
        expect(conflictVerify.reason).toContain("att-conflict-check");
      }
    } finally {
      if (prevXdg === undefined) delete process.env.XDG_CONFIG_HOME;
      else process.env.XDG_CONFIG_HOME = prevXdg;
    }
  });
});

describe("phase 3 review & edge-case regressions", () => {
  it("tracks dangling symlinks, valid symlinks, chmod +x, staged changes, and deleted tracked files in worktree fingerprint", async () => {
    const { dir } = initGitRepo();
    const sh = makeRealSh();
    const fpBase = await computeWorktreeFingerprint(dir, sh);

    // chmod +x updates fingerprint
    chmodSync(join(dir, "src", "app.ts"), 0o755);
    const fpChmod = await computeWorktreeFingerprint(dir, sh);
    expect(fpChmod).not.toBe(fpBase);

    // Dangling symlink change updates fingerprint
    symlinkSync("/nonexistent/target-a", join(dir, "dangling-link"));
    const fpDanglingA = await computeWorktreeFingerprint(dir, sh);
    expect(fpDanglingA).not.toBe(fpChmod);

    unlinkSync(join(dir, "dangling-link"));
    symlinkSync("/nonexistent/target-b", join(dir, "dangling-link"));
    const fpDanglingB = await computeWorktreeFingerprint(dir, sh);
    expect(fpDanglingB).not.toBe(fpDanglingA);

    // Valid symlink, staged edit, and deleted tracked file
    unlinkSync(join(dir, "dangling-link"));
    symlinkSync("src/app.ts", join(dir, "valid-link"));
    execSync("git add valid-link", { cwd: dir, stdio: "ignore" });
    const fpStagedLink = await computeWorktreeFingerprint(dir, sh);
    expect(fpStagedLink).not.toBe(fpDanglingB);

    unlinkSync(join(dir, "src", "app.ts"));
    const fpDeleted = await computeWorktreeFingerprint(dir, sh);
    expect(fpDeleted).not.toBe(fpStagedLink);
  });

  it("supports direct OMP judge answers, 0.7 threshold boundary, thrown judge, build recoverWorking finished, and fail-closed missing phase", async () => {
    const fix = makeFixture({ criteria: ["[ ] Exact threshold check"] });
    const runState = makeMemoryRunStateBackend();
    const adapters = createDefaultStageAdapters({ runStateBackend: runState });

    // Direct answers shape (exact 0.7 passes, 0.699 fails)
    let score = 0.7;
    const bridges = makeBridges(fix.wf.tool, {
      agent: vi.fn(async () => ({ wait: async () => "## Acceptance evidence\n- verified\n" })),
      judge: vi.fn(async (_state, questions) => {
        const key = Object.keys(questions)[0];
        return { [key]: { type: "bool", bool: score } };
      }),
    });

    const ctx: StageContext = {
      cwd: fix.dir,
      phase: fix.phase,
      stage: "build",
      pinnedPlan: fix.pinnedPlan,
      checkpoint: fix.checkpoint,
      attemptId: "att-direct-judge",
      bridges,
    };
    const disp = await adapters.build.dispatchWorking(ctx);
    await adapters.build.awaitFinished?.(ctx, disp);
    expect(await adapters.build.recoverWorking?.(ctx)).toEqual({ status: "finished" });
    expect((await adapters.build.verifyResult(ctx)).status).toBe("verified");

    score = 0.699;
    expect((await adapters.build.verifyResult(ctx)).status).toBe("blocked");

    // Thrown judge error fails closed
    const errBridges = makeBridges(fix.wf.tool, {
      judge: vi.fn(async () => {
        throw new Error("judge service unavailable");
      }),
    });
    const blockedErr = await adapters.build.verifyResult({ ...ctx, bridges: errBridges });
    expect(blockedErr.status).toBe("blocked");

    // Missing/deleted phase artifact fails closed (never silent pass)
    fix.wf.artifacts.delete(`${fix.subjectId}:phase:${fix.phase.logicalName}`);
    expect((await adapters.build.verifyResult(ctx)).status).toBe("stale_or_missing");
  });

  it("recovers from interrupted review working + worktree edit by rewinding to build without deadlocking, overrides fake clean when findings exist, and rejects deleted report", async () => {
    const fix = makeFixture();
    const runState = makeMemoryRunStateBackend();
    const ckptBackend = makeMemoryCheckpointBackend();
    const adapters = createDefaultStageAdapters({ runStateBackend: runState });

    let buildRuns = 0;
    let reviewVerdictPayload = {
      verdict: "clean",
      criticalCount: 0,
      warningCount: 0,
      summary: "Pretend clean with critical finding",
      findings: [{ severity: "Critical", file: "src/app.ts", detail: "Bug" }],
      reportMarkdown: "# Review\nCritical bug\n",
    };

    const fpOld = await computeWorktreeFingerprint(fix.dir, makeRealSh());
    const interruptedCkpt: LoopCheckpoint = {
      ...fix.checkpoint,
      currentStage: "review",
      currentMilestone: "working",
      attemptId: "att-rev-crash",
      phases: {
        [fix.phase.logicalName]: {
          order: 1,
          logicalName: fix.phase.logicalName,
          phaseRevision: fix.phase.revision,
          phaseSha256: fix.phase.sha256,
          build: { phaseRevision: fix.phase.revision, worktreeFingerprint: fpOld, acceptanceEvidence: ["ok"], verifiedAt: "now" },
        },
      },
    };
    const sha = checkpointDigest(interruptedCkpt);
    await ckptBackend.write({
      cwd: fix.dir,
      subjectId: fix.subjectId,
      branchRef: fix.pinnedPlan.branchRef,
      logicalName: "b-loop/checkpoint.json",
      checkpoint: interruptedCkpt,
      expectedRevision: null,
    });
    expect(sha).toMatch(/^[a-f0-9]{64}$/);

    // Edit file while review was interrupted in `working`
    writeFileSync(join(fix.dir, "src", "app.ts"), "export const editedDuringCrash = 1;\n");

    const bridges = makeBridges(fix.wf.tool, {
      agent: vi.fn(async (prompt, options = {}) => {
        const label = String(options.label ?? "");
        if (label.startsWith("b-build")) {
          buildRuns += 1;
          return { wait: async () => "## Acceptance evidence\n- built\n" };
        }
        if (label.startsWith("b-review")) {
          return { wait: async () => JSON.stringify(reviewVerdictPayload) };
        }
        throw new Error(`Unexpected stage ${label} (${prompt.slice(0, 20)})`);
      }),
    });

    // Must rewind to build -> rebuild -> review -> block on findings overridden to actionable!
    const res = await executeCheckpointLoop({
      cwd: fix.dir,
      pinnedPlan: fix.pinnedPlan,
      bridges,
      backend: ckptBackend,
      adapters,
    });
    expect(buildRuns).toBe(1);
    expect(res.stage).toBe("review");
    expect(res.milestone).toBe("finished");
    expect(res.blocker?.reason).toContain("iterate");

    // Deleted report artifact invalidates review verification
    fix.wf.artifacts.delete(`${fix.subjectId}:iterate:iterate-phase-1-core.md`);
    reviewVerdictPayload = { ...reviewVerdictPayload, findings: [], summary: "Clean", reportMarkdown: "# Clean\n" };
    const fpNow = await computeWorktreeFingerprint(fix.dir, makeRealSh());
    const afterDelete = await adapters.review.verifyResult({
      cwd: fix.dir,
      phase: fix.phase,
      stage: "review",
      pinnedPlan: fix.pinnedPlan,
      checkpoint: {
        ...fix.checkpoint,
        phases: {
          [fix.phase.logicalName]: {
            order: 1,
            logicalName: fix.phase.logicalName,
            phaseRevision: fix.phase.revision,
            phaseSha256: fix.phase.sha256,
            build: { phaseRevision: fix.phase.revision, worktreeFingerprint: fpNow, acceptanceEvidence: ["ok"], verifiedAt: "now" },
            review: {
              phaseRevision: fix.phase.revision,
              worktreeFingerprint: fpNow,
              reportLogicalName: "iterate-phase-1-core.md",
              verdict: "actionable",
              verifiedAt: "now",
            },
          },
        },
      },
      attemptId: "att-del-check",
      bridges,
    });
    expect(afterDelete.status).toBe("stale_or_missing");
  });

  it("enforces RunStateBackend durability, rejects malformed sql-save-attempt, routes applied empty save without retry, and fails closed on mismatched readback", async () => {
    const fix = makeFixture();
    const emptyBackend: RunStateBackend = {
      async readRunState() { return null; },
      async writeRunState({ logicalName, data }) {
        return { revision: "r1", sha256: "s1", data };
      },
    };
    const adapters = createDefaultStageAdapters({ runStateBackend: emptyBackend });
    const fp = await computeWorktreeFingerprint(fix.dir, makeRealSh());

    const baseCtx: StageContext = {
      cwd: fix.dir,
      phase: fix.phase,
      stage: "save",
      pinnedPlan: fix.pinnedPlan,
      checkpoint: {
        ...fix.checkpoint,
        currentStage: "save",
        currentMilestone: "working",
        attemptId: "att-empty-rs",
        phases: {
          [fix.phase.logicalName]: {
            order: 1,
            logicalName: fix.phase.logicalName,
            phaseRevision: fix.phase.revision,
            phaseSha256: fix.phase.sha256,
            build: { phaseRevision: fix.phase.revision, worktreeFingerprint: fp, acceptanceEvidence: ["ok"], verifiedAt: "now" },
            review: { phaseRevision: fix.phase.revision, worktreeFingerprint: fp, verdict: "clean", verifiedAt: "now" },
          },
        },
      },
      attemptId: "att-empty-rs",
      bridges: makeBridges(fix.wf.tool, { agent: vi.fn(async () => ({ wait: async () => "no json" })) }),
    };

    // awaitFinished writes via emptyBackend (which drops on read), so recoverWorking sees missing journal (no in-memory bypass!)
    await adapters.save.awaitFinished?.(baseCtx, { handle: { wait: async () => "no json" } });
    expect((await adapters.save.recoverWorking?.(baseCtx))?.status).toBe("uncertain");
    expect((await adapters.save.verifyResult(baseCtx)).status).toBe("blocked");

    // Real RunStateBackend with applied status + empty savedRefs -> recoverWorking returns "finished" (blocks, never re-dispatches!)
    const rsReal = makeMemoryRunStateBackend();
    const adReal = createDefaultStageAdapters({ runStateBackend: rsReal });
    await adReal.save.prepareStarting?.(baseCtx);
    await adReal.save.awaitFinished?.(baseCtx, { handle: { wait: async () => "non-json prose output" } });
    expect(await adReal.save.recoverWorking?.(baseCtx)).toEqual({ status: "finished" });
    expect((await adReal.save.verifyResult(baseCtx)).status).toBe("blocked");

    // Failed/mismatched read-receipt after sealing fails closed (does not adopt sealed write result)
    const memArt = fix.wf.seed({ subjectId: "memory", kind: "memory", logicalName: "m.md", revision: "rev-m1", text: "# M\n" });
    const badRereadTool = vi.fn(async (req: Record<string, unknown>) => {
      if (req.operation === "read-receipt" && fix.wf.getReceipt()?.status === "complete") {
        return { content: [{ type: "text", text: "null" }], details: null };
      }
      return fix.wf.tool(req);
    });
    const ctxBadReread: StageContext = { ...baseCtx, attemptId: "att-bad-reread", bridges: makeBridges(badRereadTool) };
    await adReal.save.prepareStarting?.(ctxBadReread);
    await adReal.save.awaitFinished?.(ctxBadReread, {
      handle: {
        wait: async () => JSON.stringify({
          savedArtifacts: [{ subjectId: "memory", kind: "memory", logicalName: "m.md", revision: memArt.revision, token: memArt.token }],
        }),
      },
    });
    const resBadReread = await adReal.save.verifyResult(ctxBadReread);
    expect(resBadReread.status).toBe("blocked");
    if (resBadReread.status === "blocked") {
      expect(resBadReread.reason).toContain("readback failed or mismatched");
    }

    // Malformed sql-save-attempt.json blocks cleanly with attemptId
    mkdirSync(join(fix.dir, ".context", "workflow"), { recursive: true });
    writeFileSync(join(fix.dir, ".context", "workflow", "sql-save-attempt.json"), "{ not json");
    const malformedRes = await adReal.save.verifyResult(baseCtx);
    expect(malformedRes.status).toBe("blocked");
    if (malformedRes.status === "blocked") {
      expect(malformedRes.reason).toContain("Malformed sql-save-attempt.json");
      expect(malformedRes.reason).toContain(baseCtx.attemptId);
    }
  });
});
