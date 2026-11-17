import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertCheckpointBinding,
  CHECKPOINT_LOGICAL_NAME,
  createWorkflowCliCheckpointBackend,
  createWorkflowCliRunStateBackend,
} from "./checkpoint.js";
import {
  createCommitStageAdapter,
  verifySubjectCloseoutWithLifecycle,
} from "./git-commit.js";
import { executeCheckpointLoop } from "./recovery.js";
import { computeWorktreeFingerprint, createDefaultStageAdapters, STAGE_TOOLS } from "./stages.js";
import type {
  CheckpointBackend,
  LoopCheckpoint,
  PinnedPhase,
  PinnedPlan,
  StageContext,
  StoredCheckpointRecord,
  ValidatedBridges,
} from "./types.js";
import { resolveAndPinPlan, runSh } from "./validation.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

function createTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function writeStorageConfig(xdg: string): string {
  const dir = join(xdg, "buck-workflow");
  mkdirSync(dir, { recursive: true });
  const cfgPath = join(dir, "config.yaml");
  writeFileSync(cfgPath, "version: 1\nstorage:\n  adapter: repo-files\n");
  return cfgPath;
}

function makeRealSh(env?: Record<string, string | undefined>): ValidatedBridges["sh"] {
  return async (cmd) => {
    const command = typeof cmd === "string" ? cmd : String(cmd);
    const output = execSync(command, {
      env: env ? { ...process.env, ...env } : process.env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { output, stdout: output, exitCode: 0 };
  };
}

function makeSubjectRepo(options: {
  subjectId?: string;
  twoPhases?: boolean;
  branch?: string;
} = {}) {
  const dir = createTempDir("b-loop-p4-repo-");
  const xdg = createTempDir("b-loop-p4-xdg-");
  const cfgPath = writeStorageConfig(xdg);
  const subjectId = options.subjectId ?? "2026-11-17.phase4-demo";
  const branch = options.branch ?? "feature/phase-4";

  execSync(`git init -b ${branch}`, { cwd: dir, stdio: "ignore" });
  execSync('git config user.name "Test User"', { cwd: dir, stdio: "ignore" });
  execSync('git config user.email "test@example.com"', { cwd: dir, stdio: "ignore" });

  mkdirSync(join(dir, "src"), { recursive: true });
  mkdirSync(join(dir, ".context", subjectId), { recursive: true });
  mkdirSync(join(dir, ".context", "memory"), { recursive: true });

  writeFileSync(join(dir, "src", "first.ts"), "export const first = 0;\n");
  if (options.twoPhases) {
    writeFileSync(join(dir, "src", "second.ts"), "export const second = 0;\n");
  }
  writeFileSync(join(dir, ".context", "memory", "index.md"), "# Memory Index\n");
  writeFileSync(
    join(dir, ".context", subjectId, "index.md"),
    "---\ntitle: Demo\nstatus: active\n---\n# Demo\n",
  );
  writeFileSync(
    join(dir, ".context", subjectId, "plan-demo.md"),
    "---\ntitle: Demo Plan\nstatus: active\n---\n# Plan\n",
  );
  writeFileSync(
    join(dir, ".context", subjectId, "phase-1-first.md"),
    [
      "---",
      "phase: 1",
      "order: 1",
      "status: pending",
      "difficulty: medium",
      "buck_hint: /b-build",
      "plan: plan-demo.md",
      "files:",
      "  - src/first.ts",
      "acceptance_criteria:",
      '  - "[ ] First feature works"',
      "---",
      "# Phase 1",
    ].join("\n") + "\n",
  );
  if (options.twoPhases) {
    writeFileSync(
      join(dir, ".context", subjectId, "phase-2-second.md"),
      [
        "---",
        "phase: 2",
        "order: 2",
        "status: pending",
        "difficulty: hard",
        "buck_hint: /b-build-hard",
        "plan: plan-demo.md",
        "files:",
        "  - src/second.ts",
        "acceptance_criteria:",
        '  - "[ ] Second feature works"',
        "---",
        "# Phase 2",
      ].join("\n") + "\n",
    );
  }

  execSync("git add . && git commit -m init", { cwd: dir, stdio: "ignore" });
  const initHead = execSync("git rev-parse HEAD", { cwd: dir, encoding: "utf8" }).trim();
  return { dir, xdg, cfgPath, subjectId, branch, branchRef: `refs/heads/${branch}`, initHead };
}

interface MemArtifactRecord {
  token: string;
  revision: string;
  sha256: string;
  subjectId: string;
  kind: string;
  logicalName: string;
  text: string;
}

interface MemReceiptRecord {
  projectId: string;
  branchId: string;
  worktreeId: string;
  runId: string;
  attemptId: string;
  status: "attempted" | "complete";
  artifactRevisions: string[];
  metadataDuties: string[];
}

function asToolText(val: unknown) {
  return { content: [{ type: "text", text: JSON.stringify(val) }], details: val };
}

function readMemArtifact(artifacts: Map<string, MemArtifactRecord>, req: Record<string, unknown>) {
  const token = req.token;
  if (typeof token === "string") {
    return asToolText([...artifacts.values()].find((a) => a.token === token) ?? null);
  }
  const hit = artifacts.get(`${req.subjectId}:${req.kind}:${req.logicalName}`) ?? null;
  return asToolText(hit);
}

function writeMemArtifact(
  cwd: string,
  artifacts: Map<string, MemArtifactRecord>,
  register: (sub: string, kind: string, logicalName: string, text: string) => MemArtifactRecord,
  req: Record<string, unknown>,
) {
  const sub = String(req.subjectId);
  const kind = String(req.kind);
  const name = String(req.logicalName);
  const prev = artifacts.get(`${sub}:${kind}:${name}`);
  const expected = req.expectedRevision;
  if (expected !== undefined && (prev?.revision ?? null) !== expected) {
    throw new Error(`CAS mismatch for ${sub}:${kind}:${name}`);
  }
  const saved = register(sub, kind, name, String(req.body ?? ""));
  const folder = sub === "memory" ? "memory" : sub === "backlog" ? "backlog" : sub;
  const targetDir = join(cwd, ".context", folder);
  mkdirSync(targetDir, { recursive: true });
  writeFileSync(join(targetDir, saved.logicalName), saved.text);
  return asToolText(saved);
}

function tryRegisterDiskArtifact(
  cwd: string,
  sub: string,
  kind: string,
  logicalName: string,
  register: (s: string, k: string, l: string, t: string) => MemArtifactRecord,
) {
  try {
    register(sub, kind, logicalName, readFileSync(join(cwd, ".context", sub, logicalName), "utf8"));
  } catch {
    // optional file
  }
}

function makeMemoryWorkflowTool(cwd: string, subjectId: string) {
  let seq = 1;
  const artifacts = new Map<string, MemArtifactRecord>();

  const registerFile = (sub: string, kind: string, logicalName: string, text: string): MemArtifactRecord => {
    seq += 1;
    const sha256 = createHash("sha256").update(text, "utf8").digest("hex");
    const rec: MemArtifactRecord = {
      token: `workflow-artifact:${sub}:${kind}:${logicalName}`,
      revision: `rev-${seq}`,
      sha256,
      subjectId: sub,
      kind,
      logicalName,
      text,
    };
    artifacts.set(`${sub}:${kind}:${logicalName}`, rec);
    return rec;
  };

  tryRegisterDiskArtifact(cwd, subjectId, "subject-index", "index.md", registerFile);
  tryRegisterDiskArtifact(cwd, subjectId, "plan", "plan-demo.md", registerFile);
  tryRegisterDiskArtifact(cwd, subjectId, "plan", "plan-demo-phases.md", registerFile);
  tryRegisterDiskArtifact(cwd, subjectId, "phase", "phase-1-first.md", registerFile);
  tryRegisterDiskArtifact(cwd, subjectId, "phase", "phase-2-second.md", registerFile);

  let receipt: MemReceiptRecord | null = null;
  let writeGuard: ((req: Record<string, unknown>) => void) | null = null;

  const tool = vi.fn(async (req: Record<string, unknown>) => {
    const op = String(req.operation ?? "");
    if (op === "list") return asToolText([...artifacts.values()].filter((a) => a.subjectId === req.subjectId));
    if (op === "read") return readMemArtifact(artifacts, req);
    if (op === "write") {
      if (writeGuard) writeGuard(req);
      return writeMemArtifact(cwd, artifacts, registerFile, req);
    }
    if (op === "write-receipt") {
      receipt = buildMemReceipt(req);
      return asToolText(receipt);
    }
    if (op === "read-receipt") return asToolText(receipt);
    throw new Error(`Unsupported op ${op}`);
  });

  return {
    tool,
    artifacts,
    setWriteGuard: (fn: ((req: Record<string, unknown>) => void) | null) => {
      writeGuard = fn;
    },
  };
}

function buildMemReceipt(req: Record<string, unknown>): MemReceiptRecord {
  const revs = Array.isArray(req.artifactRevisions) ? req.artifactRevisions.map(String) : [];
  const duties = Array.isArray(req.metadataDuties) ? req.metadataDuties.map(String) : [];
  return {
    projectId: "proj-1",
    branchId: "branch-1",
    worktreeId: "wt-1",
    runId: `run-${req.attemptId}`,
    attemptId: String(req.attemptId),
    status: req.status as "attempted" | "complete",
    artifactRevisions: revs,
    metadataDuties: duties,
  };
}

function makeMemoryCkptBackend(): CheckpointBackend {
  const map = new Map<string, StoredCheckpointRecord>();
  let n = 0;
  return {
    async read({ subjectId, branchRef, logicalName }) {
      const hit = map.get(`${subjectId}:${branchRef}:${logicalName}`);
      return hit ? structuredClone(hit) : null;
    },
    async write({ subjectId, branchRef, logicalName, checkpoint, expectedRevision }) {
      const k = `${subjectId}:${branchRef}:${logicalName}`;
      const prev = map.get(k) ?? null;
      if ((prev?.revision ?? null) !== expectedRevision) throw new Error("CAS mismatch");
      n += 1;
      const { createHash } = await import("node:crypto");
      const cloned = structuredClone(checkpoint);
      const sha256 = createHash("sha256").update(JSON.stringify(cloned), "utf8").digest("hex");
      const rec = { revision: `ck-${n}`, sha256, checkpoint: cloned };
      map.set(k, rec);
      return structuredClone(rec);
    },
  };
}

describe("fail-closed sh runner and Git probes", () => {
  it("fails closed on ShellError, non-zero numeric strings, and ok:false / isError:true results", async () => {
    await expect(
      runSh(async () => {
        const err = Object.assign(new Error("fatal: bad revision"), { exitCode: 128, output: "fatal: bad revision" });
        throw err;
      }, "git rev-parse BAD"),
    ).rejects.toThrow(/exit 128: fatal: bad revision/);

    await expect(
      runSh(async () => ({ exitCode: "1", stderr: "not clean" }), "git diff --cached"),
    ).rejects.toThrow(/not clean/);

    await expect(
      runSh(async () => ({ ok: false, output: "probe failed" }), "git status"),
    ).rejects.toThrow(/probe failed/);

    await expect(
      runSh(async () => ({ isError: true, stderr: "tool error" }), "git rev-parse HEAD"),
    ).rejects.toThrow(/tool error/);

    await expect(runSh(async () => ({ exitCode: undefined, stdout: "bad" }), "git status")).rejects.toThrow(
      /missing finite zero exitCode/,
    );
    await expect(runSh(async () => ({ exitCode: null, signal: "SIGTERM" }), "git status")).rejects.toThrow(/SIGTERM/);
    await expect(runSh(async () => ({}), "git status")).rejects.toThrow(/missing finite zero exitCode/);
    await expect(runSh(async () => null, "git status")).rejects.toThrow(/unexpected empty or non-object/);
    await expect(runSh(async () => ({ exitCode: "-1" }), "git status")).rejects.toThrow(/exit -1/);
    await expect(runSh(async () => ({ exitCode: 0, cancelled: true }), "git status")).rejects.toThrow(/exit 0/);
    await expect(runSh(async () => { throw { output: "detailed failure" }; }, "git status")).rejects.toThrow(
      /detailed failure/,
    );
  });
});

async function simulateDemoSave(
  wfTool: ReturnType<typeof makeMemoryWorkflowTool>["tool"],
  label: string,
  prompt: string,
) {
  const idx = label.includes("phase-1") ? 1 : 2;
  const mem = await wfTool({
    operation: "write",
    subjectId: "memory",
    kind: "memory",
    logicalName: `p${idx}-note.md`,
    body: `# Saved P${idx}\n`,
    expectedRevision: null,
  });
  const rev = (mem as { details: { revision: string } }).details.revision;
  const attemptId = /attemptId:\s*([A-Za-z0-9-]+)/.exec(prompt)?.[1] ?? "";
  const duties = ["save-metadata", "readback", "probe"];
  await wfTool({ operation: "write-receipt", attemptId, status: "attempted", artifactRevisions: [rev], receiptKind: "rows", metadataDuties: duties });
  await wfTool({ operation: "write-receipt", attemptId, status: "complete", artifactRevisions: [rev], receiptKind: "rows", metadataDuties: duties });
  return JSON.stringify({
    summary: `saved P${idx}`,
    savedArtifacts: [{ subjectId: "memory", kind: "memory", logicalName: `p${idx}-note.md`, revision: rev }],
  });
}

async function handleDemoAgentCall(
  repoDir: string,
  wfTool: ReturnType<typeof makeMemoryWorkflowTool>["tool"],
  prompt: string,
  options: { label?: unknown; tools?: unknown },
) {
  const label = String(options.label ?? "");
  if (label.startsWith("b-build-hard")) {
    writeFileSync(join(repoDir, "src", "second.ts"), "export const second = 2;\n");
    return { wait: async () => "## Acceptance evidence\n- second done\n" };
  }
  if (label.startsWith("b-build")) {
    writeFileSync(join(repoDir, "src", "first.ts"), "export const first = 1;\n");
    return { wait: async () => "## Acceptance evidence\n- first done\n" };
  }
  if (label.startsWith("b-review")) {
    return { wait: async () => JSON.stringify({ verdict: "clean", criticalCount: 0, warningCount: 0, summary: "clean", findings: [], reportMarkdown: "# Clean\n" }) };
  }
  if (label.startsWith("b-save")) {
    const text = await simulateDemoSave(wfTool, label, prompt);
    return { wait: async () => text };
  }
  if (label.startsWith("b-commit")) {
    expect(options.tools).toEqual([...STAGE_TOOLS.commit]);
    return { wait: async () => JSON.stringify({ title: `feat(demo): complete ${label}`, body: "Verified phase work" }) };
  }
  throw new Error(`Unexpected label ${label}`);
}

function makeDemoBridges(
  repoDir: string,
  wfTool: ReturnType<typeof makeMemoryWorkflowTool>["tool"],
  sh: ValidatedBridges["sh"],
): ValidatedBridges {
  return {
    agent: vi.fn((prompt, options = {}) => handleDemoAgentCall(repoDir, wfTool, prompt, options)),
    wait: vi.fn(async (handles: unknown[]) => Promise.all(handles.map((h) => (h as { wait: () => unknown }).wait()))),
    judge: vi.fn(async (_state, questions) => Object.fromEntries(Object.keys(questions).map((k) => [k, { type: "bool", bool: 0.95 }]))),
    sh,
    phase: vi.fn(),
    log: vi.fn(),
    tool: { workflow_state: wfTool },
  };
}

function buildReadyCommitSeed(
  repo: { dir: string; subjectId: string; branchRef: string; branch: string },
  pinnedPlan: PinnedPlan,
  phase: PinnedPhase,
  fp: string,
): LoopCheckpoint {
  return {
    schemaVersion: 1,
    subjectId: repo.subjectId,
    branchRef: repo.branchRef,
    branchName: repo.branch,
    worktreeRoot: repo.dir,
    planLogicalName: pinnedPlan.planLogicalName,
    planRevision: pinnedPlan.planRevision,
    planSha256: pinnedPlan.planSha256,
    phaseOrder: [{ order: phase.order, logicalName: phase.logicalName, revision: phase.revision, sha256: phase.sha256 }],
    completedPhaseCommits: {},
    currentPhaseOrder: phase.order,
    currentPhaseLogicalName: phase.logicalName,
    currentStage: "commit",
    currentMilestone: "starting",
    attemptId: "att-seed",
    jobHandle: null,
    blocker: null,
    phases: {
      [phase.logicalName]: {
        order: phase.order,
        logicalName: phase.logicalName,
        phaseRevision: phase.revision,
        phaseSha256: phase.sha256,
        build: { phaseRevision: phase.revision, worktreeFingerprint: fp, acceptanceEvidence: ["ok"], verifiedAt: "now" },
        review: { phaseRevision: phase.revision, worktreeFingerprint: fp, verdict: "clean", verifiedAt: "now" },
        save: { attemptId: "att-s", receiptStatus: "complete", artifactRevisions: ["rev-1"], verifiedAt: "now" },
      },
    },
    updatedAt: new Date().toISOString(),
  };
}

describe("scoped Git staging, baseline/tree pinning, and hygiene guards", () => {
  it("refuses unrelated dirty files and pre-existing staged index changes before committing", async () => {
    const repo = makeSubjectRepo();
    const wf = makeMemoryWorkflowTool(repo.dir, repo.subjectId);
    const sh = makeRealSh({ XDG_CONFIG_HOME: repo.xdg });
    const pinnedPlan: PinnedPlan = await resolveAndPinPlan(wf.tool, repo.subjectId, {
      branchRef: repo.branchRef,
      branchName: repo.branch,
      headCommit: repo.initHead,
    });
    const phase = pinnedPlan.phases[0];
    const bridges: ValidatedBridges = {
      agent: vi.fn(async () => ({ wait: async () => "chore(demo): phase 1" })),
      wait: vi.fn(async (h: unknown[]) => h),
      judge: vi.fn(),
      sh,
      phase: vi.fn(),
      log: vi.fn(),
      tool: { workflow_state: wf.tool },
    };

    const commitAdapter = createCommitStageAdapter();
    const baseCtx: StageContext = {
      cwd: repo.dir,
      phase,
      stage: "commit",
      pinnedPlan,
      attemptId: "att-hygiene",
      bridges,
      checkpoint: {
        schemaVersion: 1,
        subjectId: repo.subjectId,
        branchRef: repo.branchRef,
        branchName: repo.branch,
        worktreeRoot: repo.dir,
        planLogicalName: pinnedPlan.planLogicalName,
        planRevision: pinnedPlan.planRevision,
        planSha256: pinnedPlan.planSha256,
        phaseOrder: [{ order: 1, logicalName: phase.logicalName, revision: phase.revision, sha256: phase.sha256 }],
        completedPhaseCommits: {},
        currentPhaseOrder: 1,
        currentPhaseLogicalName: phase.logicalName,
        currentStage: "commit",
        currentMilestone: "starting",
        attemptId: "att-hygiene",
        jobHandle: null,
        blocker: null,
        phases: {
          [phase.logicalName]: {
            order: 1,
            logicalName: phase.logicalName,
            phaseRevision: phase.revision,
            phaseSha256: phase.sha256,
            build: { phaseRevision: phase.revision, worktreeFingerprint: "fp1", acceptanceEvidence: ["ok"], verifiedAt: "now" },
            review: { phaseRevision: phase.revision, worktreeFingerprint: "fp1", verdict: "clean", verifiedAt: "now" },
            save: { attemptId: "att-save", receiptStatus: "complete", artifactRevisions: ["rev-1"], verifiedAt: "now" },
          },
        },
        updatedAt: new Date().toISOString(),
      },
    };

    // 1) Pre-existing staged change in index is refused on fresh commit prep
    writeFileSync(join(repo.dir, "src", "first.ts"), "export const first = 1;\n");
    execSync("git add src/first.ts", { cwd: repo.dir, stdio: "ignore" });
    await expect(commitAdapter.prepareStarting?.(baseCtx)).rejects.toThrow(/pre-existing staged/i);
    execSync("git reset -q", { cwd: repo.dir, stdio: "ignore" });

    // 2) Unrelated dirty working tree file outside phase.files & verified metadata is refused
    writeFileSync(join(repo.dir, "UNRELATED.txt"), "stray change\n");
    await expect(commitAdapter.prepareStarting?.(baseCtx)).rejects.toThrow(/unrelated dirty/i);
    rmSync(join(repo.dir, "UNRELATED.txt"));

    // 3) Unrelated subject dir under .context/ is also refused
    mkdirSync(join(repo.dir, ".context", "2026-11-17.other-subject"), { recursive: true });
    writeFileSync(join(repo.dir, ".context", "2026-11-17.other-subject", "notes.md"), "other\n");
    await expect(commitAdapter.prepareStarting?.(baseCtx)).rejects.toThrow(/unrelated dirty/i);
    rmSync(join(repo.dir, ".context", "2026-11-17.other-subject"), { recursive: true, force: true });
  });

  it("pins baselineHead + write-tree BEFORE commit, folds final close-verified into final commit tree, and recovers cleanly", async () => {
    const repo = makeSubjectRepo({ twoPhases: true });
    const wf = makeMemoryWorkflowTool(repo.dir, repo.subjectId);
    const sh = makeRealSh({ XDG_CONFIG_HOME: repo.xdg });
    const ckptBackend = makeMemoryCkptBackend();
    const pinnedPlan = await resolveAndPinPlan(wf.tool, repo.subjectId, {
      branchRef: repo.branchRef,
      branchName: repo.branch,
      headCommit: repo.initHead,
    });

    const bridges = makeDemoBridges(repo.dir, wf.tool, sh);

    const adapters = createDefaultStageAdapters({
      commitAdapter: createCommitStageAdapter(),
      xdgConfigHome: repo.xdg,
    });

    const doneRes = await executeCheckpointLoop({
      cwd: repo.dir,
      pinnedPlan,
      bridges,
      backend: ckptBackend,
      adapters,
      xdgConfigHome: repo.xdg,
      verifySubjectCloseout: verifySubjectCloseoutWithLifecycle,
    });

    expect(doneRes.ok).toBe(true);
    expect(doneRes.state).toBe("done");
    const c1 = doneRes.completedPhaseCommits?.["phase-1-first.md"];
    const c2 = doneRes.completedPhaseCommits?.["phase-2-second.md"];
    expect(c1).toMatch(/^[a-f0-9]{40}$/);
    expect(c2).toMatch(/^[a-f0-9]{40}$/);
    expect(c1).not.toBe(c2);

    // Final commit contains verified subject closeout in index.md!
    const indexAtC2 = execSync(`git show ${c2}:.context/${repo.subjectId}/index.md`, { cwd: repo.dir, encoding: "utf8" });
    expect(indexAtC2).toMatch(/status:\s*completed/);
    expect(indexAtC2).toMatch(/lifecycle_last_transition:\s*close-verified/);
    // Phase 1 and Phase 2 both marked completed in their respective commits
    expect(execSync(`git show ${c1}:.context/${repo.subjectId}/phase-1-first.md`, { cwd: repo.dir, encoding: "utf8" })).toMatch(/status:\s*completed/);
    expect(execSync(`git show ${c2}:.context/${repo.subjectId}/phase-2-second.md`, { cwd: repo.dir, encoding: "utf8" })).toMatch(/status:\s*completed/);

    // Re-running on finished subject uses refreshed pinnedPlan & makes zero new commits / zero agent calls!
    const headCountBeforeRerun = Number(execSync("git rev-list --count HEAD", { cwd: repo.dir, encoding: "utf8" }).trim());
    const agentCountBeforeRerun = (bridges.agent as ReturnType<typeof vi.fn>).mock.calls.length;
    const pinnedAfter = await resolveAndPinPlan(wf.tool, repo.subjectId, {
      branchRef: repo.branchRef,
      branchName: repo.branch,
      headCommit: c2!,
    });
    const rerunRes = await executeCheckpointLoop({
      cwd: repo.dir,
      pinnedPlan: pinnedAfter,
      bridges,
      backend: ckptBackend,
      adapters,
      xdgConfigHome: repo.xdg,
      verifySubjectCloseout: verifySubjectCloseoutWithLifecycle,
    });
    expect(rerunRes.ok).toBe(true);
    expect(rerunRes.state).toBe("done");
    expect(Number(execSync("git rev-list --count HEAD", { cwd: repo.dir, encoding: "utf8" }).trim())).toBe(headCountBeforeRerun);
    expect((bridges.agent as ReturnType<typeof vi.fn>).mock.calls.length).toBe(agentCountBeforeRerun);
  });

  it("handles commit crash recovery: staged continuation, close-verified recovery, commit adoption without duplicate, mismatched HEAD/tree block, and missing closeout block", async () => {
    const repo = makeSubjectRepo({ twoPhases: false });
    const wf = makeMemoryWorkflowTool(repo.dir, repo.subjectId);
    const sh = makeRealSh({ XDG_CONFIG_HOME: repo.xdg });
    const ckptBackend = createWorkflowCliCheckpointBackend(sh, { xdgConfigHome: repo.xdg, configPath: repo.cfgPath });
    const runStateBackend = createWorkflowCliRunStateBackend(sh, { xdgConfigHome: repo.xdg, configPath: repo.cfgPath });

    const pinnedPlan = await resolveAndPinPlan(wf.tool, repo.subjectId, {
      branchRef: repo.branchRef,
      branchName: repo.branch,
      headCommit: repo.initHead,
    });
    const phase = pinnedPlan.phases[0];
    const bridges: ValidatedBridges = {
      agent: vi.fn(async (_prompt, options = {}) => {
        if (String(options.label).startsWith("b-commit")) {
          return { wait: async () => "feat(demo): recover commit" };
        }
        throw new Error("Should not dispatch non-commit agent on commit recovery");
      }),
      wait: vi.fn(async (h: unknown[]) => Promise.all(h.map((x) => (x as { wait: () => unknown }).wait()))),
      judge: vi.fn(),
      sh,
      phase: vi.fn(),
      log: vi.fn(),
      tool: { workflow_state: wf.tool },
    };

    // Prepare real change + complete save before simulating commit crash
    writeFileSync(join(repo.dir, "src", "first.ts"), "export const first = 42;\n");
    const fp = await computeWorktreeFingerprint(repo.dir, sh);

    // Scenario 1: Crash AFTER commit.prepareStarting (close-verified already updated index.md + staged expectedTree) -> resume lands final commit
    const commitAdapter = createCommitStageAdapter();
    const prepCtx: StageContext = {
      cwd: repo.dir,
      phase,
      stage: "commit",
      pinnedPlan,
      attemptId: "att-crash-c1",
      bridges,
      xdgConfigHome: repo.xdg,
      checkpoint: {
        schemaVersion: 1,
        subjectId: repo.subjectId,
        branchRef: repo.branchRef,
        branchName: repo.branch,
        worktreeRoot: repo.dir,
        planLogicalName: pinnedPlan.planLogicalName,
        planRevision: pinnedPlan.planRevision,
        planSha256: pinnedPlan.planSha256,
        phaseOrder: [{ order: 1, logicalName: phase.logicalName, revision: phase.revision, sha256: phase.sha256 }],
        completedPhaseCommits: {},
        currentPhaseOrder: 1,
        currentPhaseLogicalName: phase.logicalName,
        currentStage: "commit",
        currentMilestone: "starting",
        attemptId: "att-crash-c1",
        jobHandle: null,
        blocker: null,
        phases: {
          [phase.logicalName]: {
            order: 1,
            logicalName: phase.logicalName,
            phaseRevision: phase.revision,
            phaseSha256: phase.sha256,
            build: { phaseRevision: phase.revision, worktreeFingerprint: fp, acceptanceEvidence: ["ok"], verifiedAt: "now" },
            review: { phaseRevision: phase.revision, worktreeFingerprint: fp, verdict: "clean", verifiedAt: "now" },
            save: { attemptId: "att-s1", receiptStatus: "complete", artifactRevisions: ["rev-1"], verifiedAt: "now" },
          },
        },
        updatedAt: new Date().toISOString(),
      },
    };
    const prepResult = await commitAdapter.prepareStarting!(prepCtx);
    const prepProof = (prepResult && typeof prepResult === "object" && "proof" in prepResult ? prepResult.proof : undefined) as {
      baselineHead: string;
      expectedTree: string;
      closeoutApplied?: boolean;
      completedPhaseRevision?: string;
      completedPhaseSha256?: string;
    };
    expect(prepProof.baselineHead).toBe(repo.initHead);
    expect(prepProof.expectedTree).toMatch(/^[a-f0-9]{40}$/);
    expect(prepProof.closeoutApplied).toBe(true);

    // Save crashed checkpoint in `commit · working` with baselineHead + expectedTree pinned
    const crashedCkpt: LoopCheckpoint = {
      ...prepCtx.checkpoint,
      currentMilestone: "working",
      phases: {
        ...prepCtx.checkpoint.phases,
        [phase.logicalName]: {
          ...prepCtx.checkpoint.phases[phase.logicalName],
          commit: prepProof,
        },
      },
    };
    await ckptBackend.write({
      cwd: repo.dir,
      subjectId: repo.subjectId,
      branchRef: repo.branchRef,
      logicalName: CHECKPOINT_LOGICAL_NAME,
      checkpoint: crashedCkpt,
      expectedRevision: null,
      configPath: repo.cfgPath,
    });

    // Scenario 2: Suppose git commit ALREADY landed before crash recovery ran (HEAD^ === baselineHead && HEAD^{tree} === expectedTree)
    execSync('git commit -m "pre-crash commit"', { cwd: repo.dir, stdio: "ignore" });
    const landedSha = execSync("git rev-parse HEAD", { cwd: repo.dir, encoding: "utf8" }).trim();

    const pinnedAfterPrep = await resolveAndPinPlan(wf.tool, repo.subjectId, {
      branchRef: repo.branchRef,
      branchName: repo.branch,
      headCommit: landedSha,
    });
    const adapters = createDefaultStageAdapters({ runStateBackend, commitAdapter, xdgConfigHome: repo.xdg });
    const adoptedRes = await executeCheckpointLoop({
      cwd: repo.dir,
      pinnedPlan: pinnedAfterPrep,
      bridges,
      backend: ckptBackend,
      adapters,
      xdgConfigHome: repo.xdg,
      configPath: repo.cfgPath,
      verifySubjectCloseout: verifySubjectCloseoutWithLifecycle,
    });
    expect(adoptedRes.ok).toBe(true);
    expect(adoptedRes.state).toBe("done");
    expect(adoptedRes.completedPhaseCommits?.[phase.logicalName]).toBe(landedSha);
    // Adopted existing commit WITHOUT creating a second commit or invoking b-commit!
    expect(execSync("git rev-parse HEAD", { cwd: repo.dir, encoding: "utf8" }).trim()).toBe(landedSha);
    expect((bridges.agent as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);

    // Binding still passes after closeout + adoption
    const latest = await ckptBackend.read({
      cwd: repo.dir,
      subjectId: repo.subjectId,
      branchRef: repo.branchRef,
      logicalName: CHECKPOINT_LOGICAL_NAME,
      configPath: repo.cfgPath,
    });
    assertCheckpointBinding(latest!.checkpoint, {
      cwd: repo.dir,
      subjectId: repo.subjectId,
      branchRef: repo.branchRef,
      pinnedPlan: pinnedAfterPrep,
    });

    // Scenario 3: Reverting index.md closeout blocks `done` even if commits exist!
    writeFileSync(
      join(repo.dir, ".context", repo.subjectId, "index.md"),
      "---\ntitle: Demo\nstatus: active\n---\n# Demo\n",
    );
    const missingCloseout = await executeCheckpointLoop({
      cwd: repo.dir,
      pinnedPlan: pinnedAfterPrep,
      bridges,
      backend: ckptBackend,
      adapters,
      xdgConfigHome: repo.xdg,
      configPath: repo.cfgPath,
      verifySubjectCloseout: verifySubjectCloseoutWithLifecycle,
    });
    expect(missingCloseout.ok).toBe(false);
    expect(missingCloseout.state).toBe("blocked");
    expect(missingCloseout.message).toMatch(/closeout|completed/i);

    // Scenario 4: Wrong tree/HEAD mismatch during commit recovery blocks immediately instead of adopting wrong commit
    execSync(`git checkout -B ${repo.branch} ${landedSha}`, { cwd: repo.dir, stdio: "ignore" });
    writeFileSync(join(repo.dir, "src", "first.ts"), "export const wrong = 999;\n");
    execSync('git add src/first.ts && git commit -m "wrong commit"', { cwd: repo.dir, stdio: "ignore" });
    await ckptBackend.write({
      cwd: repo.dir,
      subjectId: repo.subjectId,
      branchRef: repo.branchRef,
      logicalName: CHECKPOINT_LOGICAL_NAME,
      checkpoint: crashedCkpt,
      expectedRevision: missingCloseout.checkpointRevision ?? latest!.revision,
      configPath: repo.cfgPath,
    });
    const wrongCommitRes = await executeCheckpointLoop({
      cwd: repo.dir,
      pinnedPlan: pinnedAfterPrep,
      bridges,
      backend: ckptBackend,
      adapters,
      xdgConfigHome: repo.xdg,
      configPath: repo.cfgPath,
      verifySubjectCloseout: verifySubjectCloseoutWithLifecycle,
    });
    expect(wrongCommitRes.ok).toBe(false);
    expect(wrongCommitRes.state).toBe("blocked");
    expect(wrongCommitRes.message).toMatch(/expectedTree|baselineHead|parent/i);
  });

  it("resumes staged crash at HEAD === baselineHead without rejecting staged index, and blocks if staged tree mutated at HEAD === baselineHead", async () => {
    const repo = makeSubjectRepo({ twoPhases: false });
    const wf = makeMemoryWorkflowTool(repo.dir, repo.subjectId);
    const sh = makeRealSh({ XDG_CONFIG_HOME: repo.xdg });
    const ckptBackend = makeMemoryCkptBackend();
    const pinnedPlan = await resolveAndPinPlan(wf.tool, repo.subjectId, {
      branchRef: repo.branchRef,
      branchName: repo.branch,
      headCommit: repo.initHead,
    });
    const phase = pinnedPlan.phases[0];
    const bridges: ValidatedBridges = {
      agent: vi.fn(async () => ({ wait: async () => JSON.stringify({ title: "feat(demo): resume staged commit" }) })),
      wait: vi.fn(async (h: unknown[]) => Promise.all(h.map((x) => (x as { wait: () => unknown }).wait()))),
      judge: vi.fn(),
      sh,
      phase: vi.fn(),
      log: vi.fn(),
      tool: { workflow_state: wf.tool },
    };

    writeFileSync(join(repo.dir, "src", "first.ts"), "export const first = 7;\n");
    const fp = await computeWorktreeFingerprint(repo.dir, sh);
    const commitAdapter = createCommitStageAdapter();
    const seedCkpt: LoopCheckpoint = {
      schemaVersion: 1,
      subjectId: repo.subjectId,
      branchRef: repo.branchRef,
      branchName: repo.branch,
      worktreeRoot: repo.dir,
      planLogicalName: pinnedPlan.planLogicalName,
      planRevision: pinnedPlan.planRevision,
      planSha256: pinnedPlan.planSha256,
      phaseOrder: [{ order: 1, logicalName: phase.logicalName, revision: phase.revision, sha256: phase.sha256 }],
      completedPhaseCommits: {},
      currentPhaseOrder: 1,
      currentPhaseLogicalName: phase.logicalName,
      currentStage: "commit",
      currentMilestone: "starting",
      attemptId: "att-staged-resume",
      jobHandle: null,
      blocker: null,
      phases: {
        [phase.logicalName]: {
          order: 1,
          logicalName: phase.logicalName,
          phaseRevision: phase.revision,
          phaseSha256: phase.sha256,
          build: { phaseRevision: phase.revision, worktreeFingerprint: fp, acceptanceEvidence: ["ok"], verifiedAt: "now" },
          review: { phaseRevision: phase.revision, worktreeFingerprint: fp, verdict: "clean", verifiedAt: "now" },
          save: { attemptId: "att-s", receiptStatus: "complete", artifactRevisions: ["rev-1"], verifiedAt: "now" },
        },
      },
      updatedAt: new Date().toISOString(),
    };
    const prep = await commitAdapter.prepareStarting!({
      cwd: repo.dir,
      phase,
      stage: "commit",
      pinnedPlan,
      checkpoint: seedCkpt,
      attemptId: "att-staged-resume",
      bridges,
      xdgConfigHome: repo.xdg,
    });
    const prepProof = (prep as { proof: NonNullable<LoopCheckpoint["phases"][string]["commit"]> }).proof;
    const pinnedAfter = await resolveAndPinPlan(wf.tool, repo.subjectId, {
      branchRef: repo.branchRef,
      branchName: repo.branch,
      headCommit: repo.initHead,
    });

    // Mutated staged tree while still at HEAD === baselineHead MUST block!
    const badCkpt: LoopCheckpoint = {
      ...seedCkpt,
      currentMilestone: "working",
      phases: {
        [phase.logicalName]: {
          ...seedCkpt.phases[phase.logicalName],
          commit: prepProof,
        },
      },
    };
    const stored = await ckptBackend.write({
      cwd: repo.dir,
      subjectId: repo.subjectId,
      branchRef: repo.branchRef,
      logicalName: CHECKPOINT_LOGICAL_NAME,
      checkpoint: badCkpt,
      expectedRevision: null,
    });
    writeFileSync(join(repo.dir, "src", "first.ts"), "export const first = 9999;\n");
    execSync("git add src/first.ts", { cwd: repo.dir, stdio: "ignore" });
    const blockedTree = await executeCheckpointLoop({
      cwd: repo.dir,
      pinnedPlan: pinnedAfter,
      bridges,
      backend: ckptBackend,
      adapters: createDefaultStageAdapters({ commitAdapter, xdgConfigHome: repo.xdg }),
      xdgConfigHome: repo.xdg,
      verifySubjectCloseout: verifySubjectCloseoutWithLifecycle,
    });
    expect(blockedTree.ok).toBe(false);
    expect(blockedTree.state).toBe("blocked");
    expect(blockedTree.message).toMatch(/expectedTree/i);

    // Restore pinned tree cleanly and resume from `commit · working` at HEAD === baselineHead -> lands single commit cleanly!
    writeFileSync(join(repo.dir, "src", "first.ts"), "export const first = 7;\n");
    execSync("git add src/first.ts", { cwd: repo.dir, stdio: "ignore" });
    await ckptBackend.write({
      cwd: repo.dir,
      subjectId: repo.subjectId,
      branchRef: repo.branchRef,
      logicalName: CHECKPOINT_LOGICAL_NAME,
      checkpoint: badCkpt,
      expectedRevision: blockedTree.checkpointRevision ?? stored.revision,
    });
    const resumedDone = await executeCheckpointLoop({
      cwd: repo.dir,
      pinnedPlan: pinnedAfter,
      bridges,
      backend: ckptBackend,
      adapters: createDefaultStageAdapters({ commitAdapter, xdgConfigHome: repo.xdg }),
      xdgConfigHome: repo.xdg,
      verifySubjectCloseout: verifySubjectCloseoutWithLifecycle,
    });
    expect(resumedDone.ok).toBe(true);
    expect(resumedDone.state).toBe("done");
    expect(execSync("git rev-parse HEAD^", { cwd: repo.dir, encoding: "utf8" }).trim()).toBe(repo.initHead);
    expect(execSync("git rev-parse HEAD^{tree}", { cwd: repo.dir, encoding: "utf8" }).trim()).toBe(prepProof.expectedTree);
  });

  it("matches trailing-slash directory prefixes (src/), ignores dirty .context/workflow/, refuses staged .context/workflow/, and chunks >40 files", async () => {
    const repo = makeSubjectRepo();
    const phasePath = join(repo.dir, ".context", repo.subjectId, "phase-1-first.md");
    const updatedPhase = readFileSync(phasePath, "utf8").replace("  - src/first.ts", "  - src/");
    writeFileSync(phasePath, updatedPhase);
    execSync("git add . && git commit -m use-dir-prefix", { cwd: repo.dir, stdio: "ignore" });
    repo.initHead = execSync("git rev-parse HEAD", { cwd: repo.dir, encoding: "utf8" }).trim();

    const wf = makeMemoryWorkflowTool(repo.dir, repo.subjectId);
    const sh = makeRealSh({ XDG_CONFIG_HOME: repo.xdg });
    const pinnedPlan = await resolveAndPinPlan(wf.tool, repo.subjectId, {
      branchRef: repo.branchRef,
      branchName: repo.branch,
      headCommit: repo.initHead,
    });
    const phase = pinnedPlan.phases[0];
    const bridges = makeDemoBridges(repo.dir, wf.tool, sh);
    const commitAdapter = createCommitStageAdapter();

    // Dirty .context/workflow/ scratch file is ignored; pre-staged .context/workflow/ MUST be refused!
    mkdirSync(join(repo.dir, ".context", "workflow"), { recursive: true });
    writeFileSync(join(repo.dir, ".context", "workflow", "ckpt.json"), "{}\n");
    execSync("git add -f .context/workflow/ckpt.json", { cwd: repo.dir, stdio: "ignore" });
    const fp = await computeWorktreeFingerprint(repo.dir, sh);
    const seedCkpt = buildReadyCommitSeed(repo, pinnedPlan, phase, fp);
    await expect(
      commitAdapter.prepareStarting!({ cwd: repo.dir, phase, stage: "commit", pinnedPlan, checkpoint: seedCkpt, attemptId: "att-wf", bridges }),
    ).rejects.toThrow(/pre-existing staged/i);
    execSync("git reset -q .context/workflow/ckpt.json", { cwd: repo.dir, stdio: "ignore" });

    // Sibling prefix (src2/) outside declared `src/` MUST be refused, whereas ./src/ and win\ directory prefixes match
    const phaseWithExtra = readFileSync(phasePath, "utf8").replace("  - src/", "  - ./src/\n  - win\\");
    writeFileSync(phasePath, phaseWithExtra);
    execSync("git add . && git commit -m use-alt-prefixes", { cwd: repo.dir, stdio: "ignore" });
    repo.initHead = execSync("git rev-parse HEAD", { cwd: repo.dir, encoding: "utf8" }).trim();
    const wfAlt = makeMemoryWorkflowTool(repo.dir, repo.subjectId);
    const pinnedAlt = await resolveAndPinPlan(wfAlt.tool, repo.subjectId, {
      branchRef: repo.branchRef,
      branchName: repo.branch,
      headCommit: repo.initHead,
    });
    const seedAlt = buildReadyCommitSeed(repo, pinnedAlt, pinnedAlt.phases[0], await computeWorktreeFingerprint(repo.dir, sh));

    mkdirSync(join(repo.dir, "src2"), { recursive: true });
    writeFileSync(join(repo.dir, "src2", "stray.ts"), "export const stray = 1;\n");
    await expect(
      commitAdapter.prepareStarting!({ cwd: repo.dir, phase: pinnedAlt.phases[0], stage: "commit", pinnedPlan: pinnedAlt, checkpoint: seedAlt, attemptId: "att-src2", bridges: makeDemoBridges(repo.dir, wfAlt.tool, sh) }),
    ).rejects.toThrow(/unrelated dirty/i);
    rmSync(join(repo.dir, "src2"), { recursive: true, force: true });

    // Create 45 nested files across ./src/ and win\\ (exercises normalized dir prefixes + >40 chunked `git add`) while keeping dirty scratch file
    mkdirSync(join(repo.dir, "src", "nested"), { recursive: true });
    mkdirSync(join(repo.dir, "win"), { recursive: true });
    writeFileSync(join(repo.dir, "win", "ok.ts"), "export const win = true;\n");
    for (let i = 0; i < 45; i++) {
      writeFileSync(join(repo.dir, "src", "nested", `file-${i}.ts`), `export const n${i} = ${i};\n`);
    }
    const ckptBackend = makeMemoryCkptBackend();
    await ckptBackend.write({ cwd: repo.dir, subjectId: repo.subjectId, branchRef: repo.branchRef, logicalName: CHECKPOINT_LOGICAL_NAME, checkpoint: seedAlt, expectedRevision: null });
    const done = await executeCheckpointLoop({
      cwd: repo.dir,
      pinnedPlan: pinnedAlt,
      bridges: makeDemoBridges(repo.dir, wfAlt.tool, sh),
      backend: ckptBackend,
      adapters: createDefaultStageAdapters({ commitAdapter, xdgConfigHome: repo.xdg }),
      xdgConfigHome: repo.xdg,
      verifySubjectCloseout: verifySubjectCloseoutWithLifecycle,
    });
    expect(done.ok).toBe(true);
    const committedFiles = execSync("git show --name-only --format= HEAD", { cwd: repo.dir, encoding: "utf8" });
    expect(committedFiles).toContain("src/nested/file-44.ts");
    expect(committedFiles).toContain("win/ok.ts");
    expect(committedFiles).not.toContain(".context/workflow/");
  });

  it("handles fenced ```json commit messages and updates plan-*-phases.md overview table with close-verified", async () => {
    const repo = makeSubjectRepo({ twoPhases: false });
    const subDir = join(repo.dir, ".context", repo.subjectId);
    writeFileSync(
      join(subDir, "plan-demo-phases.md"),
      "---\ntitle: Phases\nstatus: active\n---\n| Phase | Status |\n|---|---|\n| [Phase 1](phase-1-first.md) | pending |\n",
    );
    execSync("git add -A && git commit -m add-overview", { cwd: repo.dir, stdio: "ignore" });
    repo.initHead = execSync("git rev-parse HEAD", { cwd: repo.dir, encoding: "utf8" }).trim();

    const wf = makeMemoryWorkflowTool(repo.dir, repo.subjectId);
    const sh = makeRealSh({ XDG_CONFIG_HOME: repo.xdg });
    const pinnedPlan = await resolveAndPinPlan(wf.tool, repo.subjectId, { branchRef: repo.branchRef, branchName: repo.branch, headCommit: repo.initHead });
    expect(pinnedPlan.overviewLogicalName).toBe("plan-demo-phases.md");

    const phase = pinnedPlan.phases[0];
    writeFileSync(join(repo.dir, "src", "first.ts"), "export const first = 5;\n");
    const fp = await computeWorktreeFingerprint(repo.dir, sh);
    const bridges = makeDemoBridges(repo.dir, wf.tool, sh);
    (bridges.agent as ReturnType<typeof vi.fn>).mockImplementationOnce(async () => ({
      wait: async () => "```json\n{\"title\":\"feat(demo): fenced title work\",\"body\":\"Preserved body\"}\n```",
    }));
    const ckptBackend = makeMemoryCkptBackend();
    await ckptBackend.write({ cwd: repo.dir, subjectId: repo.subjectId, branchRef: repo.branchRef, logicalName: CHECKPOINT_LOGICAL_NAME, checkpoint: buildReadyCommitSeed(repo, pinnedPlan, phase, fp), expectedRevision: null });

    const res = await executeCheckpointLoop({
      cwd: repo.dir,
      pinnedPlan,
      bridges,
      backend: ckptBackend,
      adapters: createDefaultStageAdapters({ commitAdapter: createCommitStageAdapter(), xdgConfigHome: repo.xdg }),
      xdgConfigHome: repo.xdg,
      verifySubjectCloseout: verifySubjectCloseoutWithLifecycle,
    });
    expect(res.ok).toBe(true);
    expect(execSync("git log -1 --format=%s", { cwd: repo.dir, encoding: "utf8" }).trim()).toBe("feat(demo): fenced title work");
    expect(execSync("git log -1 --format=%b", { cwd: repo.dir, encoding: "utf8" }).trim()).toBe("Preserved body");
    expect(readFileSync(join(subDir, "plan-demo-phases.md"), "utf8")).toContain("| [Phase 1](phase-1-first.md) | completed |");

    const headAfter = execSync("git rev-parse HEAD", { cwd: repo.dir, encoding: "utf8" }).trim();
    const pinnedReload = await resolveAndPinPlan(wf.tool, repo.subjectId, { branchRef: repo.branchRef, branchName: repo.branch, headCommit: headAfter });
    const rerun = await executeCheckpointLoop({
      cwd: repo.dir,
      pinnedPlan: pinnedReload,
      bridges,
      backend: ckptBackend,
      adapters: createDefaultStageAdapters({ commitAdapter: createCommitStageAdapter(), xdgConfigHome: repo.xdg }),
      xdgConfigHome: repo.xdg,
      verifySubjectCloseout: verifySubjectCloseoutWithLifecycle,
    });
    expect(rerun.ok).toBe(true);
    expect(rerun.state).toBe("done");
    expect(execSync("git rev-parse HEAD", { cwd: repo.dir, encoding: "utf8" }).trim()).toBe(headAfter);
  });

  it("allows commit-authorized overview updates across phase resume when planLogicalName === overviewLogicalName", async () => {
    const repo = makeSubjectRepo({ twoPhases: true });
    const subDir = join(repo.dir, ".context", repo.subjectId);
    rmSync(join(subDir, "plan-demo.md"));
    writeFileSync(
      join(subDir, "plan-demo-phases.md"),
      "---\ntitle: Phases\nstatus: active\n---\n| Phase | Status |\n|---|---|\n| [Phase 1](phase-1-first.md) | pending |\n| [Phase 2](phase-2-second.md) | pending |\n",
    );
    execSync("git add -A && git commit -m solo-2phase-overview", { cwd: repo.dir, stdio: "ignore" });
    repo.initHead = execSync("git rev-parse HEAD", { cwd: repo.dir, encoding: "utf8" }).trim();

    const wf = makeMemoryWorkflowTool(repo.dir, repo.subjectId);
    const sh = makeRealSh({ XDG_CONFIG_HOME: repo.xdg });
    const pinnedPlan = await resolveAndPinPlan(wf.tool, repo.subjectId, { branchRef: repo.branchRef, branchName: repo.branch, headCommit: repo.initHead });
    expect(pinnedPlan.planLogicalName).toBe("plan-demo-phases.md");
    expect(pinnedPlan.overviewLogicalName).toBe("plan-demo-phases.md");

    const p1 = pinnedPlan.phases[0];
    const p2 = pinnedPlan.phases[1];
    writeFileSync(join(repo.dir, "src", "first.ts"), "export const first = 5;\n");
    const fp = await computeWorktreeFingerprint(repo.dir, sh);
    const seed = buildReadyCommitSeed(repo, pinnedPlan, p1, fp);
    seed.phaseOrder.push({ order: p2.order, logicalName: p2.logicalName, revision: p2.revision, sha256: p2.sha256 });
    const ckptBackend = makeMemoryCkptBackend();
    await ckptBackend.write({ cwd: repo.dir, subjectId: repo.subjectId, branchRef: repo.branchRef, logicalName: CHECKPOINT_LOGICAL_NAME, checkpoint: seed, expectedRevision: null });

    // Run phase 1 commit and verify phase 2 stops only at preflight closeout (since solo-overview has no non-phases plan-*.md), proving assertPlanMatches accepts phase 1's overview update!
    const adapters = createDefaultStageAdapters({ commitAdapter: createCommitStageAdapter(), xdgConfigHome: repo.xdg });
    const bridges = makeDemoBridges(repo.dir, wf.tool, sh);
    await expect(
      executeCheckpointLoop({ cwd: repo.dir, pinnedPlan, bridges, backend: ckptBackend, adapters, xdgConfigHome: repo.xdg }),
    ).rejects.toThrow(/no plan provides closeout evidence/);

    const latestCkpt = await ckptBackend.read({ cwd: repo.dir, subjectId: repo.subjectId, branchRef: repo.branchRef, logicalName: CHECKPOINT_LOGICAL_NAME });
    expect(latestCkpt?.checkpoint.completedPhaseCommits[p1.logicalName]).toMatch(/^[a-f0-9]{40}$/);
    const reloaded = await resolveAndPinPlan(wf.tool, repo.subjectId, {
      branchRef: repo.branchRef,
      branchName: repo.branch,
      headCommit: execSync("git rev-parse HEAD", { cwd: repo.dir, encoding: "utf8" }).trim(),
    });
    expect(() =>
      assertCheckpointBinding(latestCkpt!.checkpoint, { cwd: repo.dir, subjectId: repo.subjectId, branchRef: repo.branchRef, pinnedPlan: reloaded }),
    ).not.toThrow();
  });

  it("refuses blocked closeout pre-mutation, keeps disk clean on workflow_state write failure, and recovers crash mid-prep", async () => {
    const repo = makeSubjectRepo({ twoPhases: false });
    const subDir = join(repo.dir, ".context", repo.subjectId);
    writeFileSync(join(subDir, "plan-extra.md"), "---\ntitle: Open Extra\nstatus: pending\n---\n- [ ] Still open\n");
    execSync("git add -A && git commit -m extra-open", { cwd: repo.dir, stdio: "ignore" });
    repo.initHead = execSync("git rev-parse HEAD", { cwd: repo.dir, encoding: "utf8" }).trim();

    const wf = makeMemoryWorkflowTool(repo.dir, repo.subjectId);
    const sh = makeRealSh({ XDG_CONFIG_HOME: repo.xdg });
    const pinnedPlan = await resolveAndPinPlan(wf.tool, repo.subjectId, { branchRef: repo.branchRef, branchName: repo.branch, headCommit: repo.initHead });
    const phase = pinnedPlan.phases[0];
    const phaseDiskBefore = readFileSync(join(subDir, "phase-1-first.md"), "utf8");
    const bridges = makeDemoBridges(repo.dir, wf.tool, sh);
    const seedCkpt = buildReadyCommitSeed(repo, pinnedPlan, phase, await computeWorktreeFingerprint(repo.dir, sh));

    // 1) Final closeout blocker aborts BEFORE mutating phase-1-first.md on disk or in workflow_state
    const adapter = createCommitStageAdapter();
    await expect(
      adapter.prepareStarting!({ cwd: repo.dir, phase, stage: "commit", pinnedPlan, checkpoint: seedCkpt, attemptId: "att-pre" , bridges }),
    ).rejects.toThrow(/closeout blockers/i);
    expect(readFileSync(join(subDir, "phase-1-first.md"), "utf8")).toBe(phaseDiskBefore);

    // 2) verifySubjectCloseoutWithLifecycle rejects canonically completed index.md when blockers remain non-empty (N5)
    writeFileSync(join(subDir, "index.md"), "---\ntitle: Demo\nstatus: completed\nlifecycle_schema: 1\nlifecycle_revision: 1\nlifecycle_last_transition: close-verified\n---\n");
    const n5 = await verifySubjectCloseoutWithLifecycle({ cwd: repo.dir, subjectId: repo.subjectId, sh, xdgConfigHome: repo.xdg });
    expect(n5.ok).toBe(false);

    // Restore active index & remove extra plan so commit can run
    writeFileSync(join(subDir, "index.md"), "---\ntitle: Demo\nstatus: active\n---\n");
    execSync("git rm -q .context/" + repo.subjectId + "/plan-extra.md && git commit -m clean-extra", { cwd: repo.dir, stdio: "ignore" });
    const cleanHead = execSync("git rev-parse HEAD", { cwd: repo.dir, encoding: "utf8" }).trim();
    const pinnedClean = await resolveAndPinPlan(wf.tool, repo.subjectId, { branchRef: repo.branchRef, branchName: repo.branch, headCommit: cleanHead });

    // 3) workflow_state write rejection must NOT touch phase disk file
    const ckptBackend = makeMemoryCkptBackend();
    await ckptBackend.write({ cwd: repo.dir, subjectId: repo.subjectId, branchRef: repo.branchRef, logicalName: CHECKPOINT_LOGICAL_NAME, checkpoint: buildReadyCommitSeed({ ...repo }, pinnedClean, pinnedClean.phases[0], await computeWorktreeFingerprint(repo.dir, sh)), expectedRevision: null });
    wf.setWriteGuard(() => {
      throw new Error("forced CAS failure");
    });
    await expect(
      executeCheckpointLoop({
        cwd: repo.dir,
        pinnedPlan: pinnedClean,
        bridges,
        backend: ckptBackend,
        adapters: createDefaultStageAdapters({ commitAdapter: adapter, xdgConfigHome: repo.xdg }),
        xdgConfigHome: repo.xdg,
        verifySubjectCloseout: verifySubjectCloseoutWithLifecycle,
      }),
    ).rejects.toThrow(/forced CAS failure/);
    expect(readFileSync(join(subDir, "phase-1-first.md"), "utf8")).toBe(phaseDiskBefore);

    // Clear failure guard and recover cleanly using the pre-pinned checkpoint
    wf.setWriteGuard(null);
    const recoveredClean = await executeCheckpointLoop({
      cwd: repo.dir,
      pinnedPlan: pinnedClean,
      bridges,
      backend: ckptBackend,
      adapters: createDefaultStageAdapters({ commitAdapter: adapter, xdgConfigHome: repo.xdg }),
      xdgConfigHome: repo.xdg,
      verifySubjectCloseout: verifySubjectCloseoutWithLifecycle,
    });
    expect(recoveredClean.ok).toBe(true);
    expect(recoveredClean.state).toBe("done");
  });

  it("recovers without drift when commit prep crashes AFTER phase-*.md becomes completed but BEFORE expectedTree is pinned", async () => {
    const repo = makeSubjectRepo({ twoPhases: false });
    const subDir = join(repo.dir, ".context", repo.subjectId);
    writeFileSync(
      join(subDir, "plan-demo-phases.md"),
      "---\ntitle: Phases\nstatus: active\n---\n| Phase | Status |\n|---|---|\n| [Phase 1](phase-1-first.md) | pending |\n",
    );
    execSync("git add -A && git commit -m with-overview", { cwd: repo.dir, stdio: "ignore" });
    repo.initHead = execSync("git rev-parse HEAD", { cwd: repo.dir, encoding: "utf8" }).trim();

    const wf = makeMemoryWorkflowTool(repo.dir, repo.subjectId);
    const sh = makeRealSh({ XDG_CONFIG_HOME: repo.xdg });
    const pinnedInitial = await resolveAndPinPlan(wf.tool, repo.subjectId, { branchRef: repo.branchRef, branchName: repo.branch, headCommit: repo.initHead });
    const ckptBackend = makeMemoryCkptBackend();
    await ckptBackend.write({
      cwd: repo.dir,
      subjectId: repo.subjectId,
      branchRef: repo.branchRef,
      logicalName: CHECKPOINT_LOGICAL_NAME,
      checkpoint: buildReadyCommitSeed(repo, pinnedInitial, pinnedInitial.phases[0], await computeWorktreeFingerprint(repo.dir, sh)),
      expectedRevision: null,
    });

    // Crash right AFTER phase-1-first.md is mutated to `completed` (while failing on overview write before expectedTree is saved)
    wf.setWriteGuard((req) => {
      if (req.kind === "plan") throw new Error("simulated crash after phase update");
    });
    const adapters = createDefaultStageAdapters({ commitAdapter: createCommitStageAdapter(), xdgConfigHome: repo.xdg });
    const bridges = makeDemoBridges(repo.dir, wf.tool, sh);
    await expect(
      executeCheckpointLoop({
        cwd: repo.dir,
        pinnedPlan: pinnedInitial,
        bridges,
        backend: ckptBackend,
        adapters,
        xdgConfigHome: repo.xdg,
        verifySubjectCloseout: verifySubjectCloseoutWithLifecycle,
      }),
    ).rejects.toThrow(/simulated crash after phase update/);

    // Verify phase file on disk & workflow_state IS already `status: completed` while checkpoint has NO expectedTree yet
    expect(readFileSync(join(subDir, "phase-1-first.md"), "utf8")).toContain("status: completed");
    const midCkpt = await ckptBackend.read({ cwd: repo.dir, subjectId: repo.subjectId, branchRef: repo.branchRef, logicalName: CHECKPOINT_LOGICAL_NAME });
    expect(midCkpt?.checkpoint.phases["phase-1-first.md"]?.commit?.expectedTree).toBeUndefined();
    expect(midCkpt?.checkpoint.phases["phase-1-first.md"]?.commit?.expectedPhaseSha256).toBeTruthy();

    // Re-running `/b-loop` with updated phase revision from disk recovers cleanly (no drift error, completes closeout & commits once)
    wf.setWriteGuard(null);
    const pinnedReloaded = await resolveAndPinPlan(wf.tool, repo.subjectId, { branchRef: repo.branchRef, branchName: repo.branch, headCommit: repo.initHead });
    const done = await executeCheckpointLoop({
      cwd: repo.dir,
      pinnedPlan: pinnedReloaded,
      bridges,
      backend: ckptBackend,
      adapters,
      xdgConfigHome: repo.xdg,
      verifySubjectCloseout: verifySubjectCloseoutWithLifecycle,
    });
    expect(done.ok).toBe(true);
    expect(done.state).toBe("done");
    expect(readFileSync(join(subDir, "plan-demo-phases.md"), "utf8")).toContain("| [Phase 1](phase-1-first.md) | completed |");
  });
});
