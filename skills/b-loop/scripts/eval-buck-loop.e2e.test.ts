import { execFileSync, execSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  executeWorkflowState,
  rejectCallerScope,
  resolveTrustedContext,
  type ArtifactRef,
  type WorkflowRequest,
} from "../../_shared/scripts/workflow-state.js";
import type { ArtifactKind } from "../../_shared/storage/contract.js";
import {
  acquireWriterLock,
  CHECKPOINT_LOGICAL_NAME,
  createInitialCheckpoint,
  createWorkflowCliCheckpointBackend,
  createWorkflowCliRunStateBackend,
} from "./checkpoint.js";
import { createCommitStageAdapter, verifySubjectCloseoutWithLifecycle } from "./git-commit.js";
import { runBuckLoop } from "./eval-buck-loop.js";
import { computeWorktreeFingerprint, createDefaultStageAdapters } from "./stages.js";
import type { CheckpointBackend, StageAdapters, ValidatedBridges } from "./types.js";
import { resolveAndPinPlan } from "./validation.js";

const REPO_ROOT = resolve(join(__dirname, "../../.."));
const WORKFLOW_STATE_CLI_PATH = join(REPO_ROOT, "skills/_shared/scripts/workflow-state-cli.ts");
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

interface WorktreeFixture {
  mainRepo: string;
  worktreeDir: string;
  home: string;
  xdg: string;
  cfgPath: string;
  subjectId: string;
  branch: string;
  branchRef: string;
  initHead: string;
}

function writeRepoSubjectFiles(
  rootDir: string,
  subjectId: string,
  options: { unphased?: boolean } = {},
): void {
  const subDir = join(rootDir, ".context", subjectId);
  mkdirSync(join(rootDir, "src"), { recursive: true });
  mkdirSync(subDir, { recursive: true });
  mkdirSync(join(rootDir, ".context", "memory"), { recursive: true });
  writeFileSync(join(rootDir, "src", "first.ts"), "export const first = 0;\n");
  writeFileSync(join(rootDir, "src", "second.ts"), "export const second = 0;\n");
  writeFileSync(join(rootDir, ".context", "memory", "index.md"), "# Memory Index\n");
  writeFileSync(join(subDir, "index.md"), "---\ntitle: E2E Fixture\nstatus: active\n---\n# E2E\n");
  writeFileSync(join(subDir, "plan-e2e.md"), "---\ntitle: E2E Plan\nstatus: active\n---\n# Plan\n- [ ] Complete work\n");
  if (options.unphased) return;
  writeFileSync(
    join(subDir, "plan-e2e-phases.md"),
    "---\ntitle: E2E Phases\nstatus: active\n---\n| Phase | Status |\n|---|---|\n| [Phase 1](phase-1-core.md) | pending |\n| [Phase 2](phase-2-finish.md) | pending |\n",
  );
  writeFileSync(
    join(subDir, "phase-1-core.md"),
    "---\nphase: 1\norder: 1\nstatus: pending\ndifficulty: medium\nbuck_hint: /b-build\nplan: plan-e2e.md\nfiles:\n  - src/first.ts\nacceptance_criteria:\n  - \"[ ] First module updated\"\n---\n# Phase 1\n",
  );
  writeFileSync(
    join(subDir, "phase-2-finish.md"),
    "---\nphase: 2\norder: 2\nstatus: pending\ndifficulty: hard\nbuck_hint: /b-build-hard\nplan: plan-e2e.md\nfiles:\n  - src/second.ts\nacceptance_criteria:\n  - \"[ ] Second module finished\"\n---\n# Phase 2\n",
  );
}

function createWorktreeFixture(options: {
  unphased?: boolean;
  storageYaml?: string;
  branch?: string;
} = {}): WorktreeFixture {
  const mainRepo = createTempDir("b-loop-e2e-main-");
  const worktreeParent = createTempDir("b-loop-e2e-wtparent-");
  const worktreeDir = join(worktreeParent, "linked-wt");
  const home = createTempDir("b-loop-e2e-home-");
  const xdg = join(home, ".config");
  const cfgDir = join(xdg, "buck-workflow");
  mkdirSync(cfgDir, { recursive: true });
  const cfgPath = join(cfgDir, "config.yaml");
  writeFileSync(cfgPath, options.storageYaml ?? "version: 1\nstorage:\n  adapter: repo-files\n");

  const pluginModules = join(home, ".omp", "plugins", "node_modules", "@buckleyrobinson");
  mkdirSync(pluginModules, { recursive: true });
  symlinkSync(REPO_ROOT, join(pluginModules, "buck-workflow"));

  const subjectId = "2026-11-17.e2e-subject";
  const branch = options.branch ?? "feature/e2e";
  execSync("git init -b main", { cwd: mainRepo, stdio: "ignore" });
  execSync('git config user.name "E2E User"', { cwd: mainRepo, stdio: "ignore" });
  execSync('git config user.email "e2e@example.com"', { cwd: mainRepo, stdio: "ignore" });
  writeFileSync(join(mainRepo, "README.md"), "# Disposable Repo\n");
  execSync("git add . && git commit -m base", { cwd: mainRepo, stdio: "ignore" });

  execSync(`git worktree add -b ${branch} ${JSON.stringify(worktreeDir)}`, { cwd: mainRepo, stdio: "ignore" });
  writeRepoSubjectFiles(worktreeDir, subjectId, { unphased: options.unphased });
  execSync("git add . && git commit -m init-subject", { cwd: worktreeDir, stdio: "ignore" });
  const initHead = execSync("git rev-parse HEAD", { cwd: worktreeDir, encoding: "utf8" }).trim();

  return {
    mainRepo,
    worktreeDir,
    home,
    xdg,
    cfgPath,
    subjectId,
    branch,
    branchRef: `refs/heads/${branch}`,
    initHead,
  };
}

function extractPromptEvalCode(): string {
  const promptMd = readFileSync(join(REPO_ROOT, "prompts/b-loop.md"), "utf8");
  const codeMatch = promptMd.match(/code:\s*`([\s\S]*?)`\s*\}\s*\)/);
  if (!codeMatch) throw new Error("Missing eval code block in prompts/b-loop.md");
  return codeMatch[1];
}

function buildEvalCell(rawArgs: string): string {
  return extractPromptEvalCode().replace('"__BUCK_LOOP_ARGS__"', JSON.stringify(rawArgs));
}

function buildBunDriverSource(params: {
  fixture: WorktreeFixture;
  unphased: { wt: string; cfgPath: string };
  nonRepo: { wt: string; cfgPath: string };
  integRef: { wt: string; cfgPath: string };
  detachedWt: string;
}): string {
  const wfImport = join(REPO_ROOT, "skills/_shared/scripts/workflow-state.ts");
  const cells = {
    status: buildEvalCell("--status"),
    resume: buildEvalCell("--resume"),
    stop: buildEvalCell("--stop"),
    wrongSub: buildEvalCell("2026-11-17.missing"),
    empty: buildEvalCell(""),
    valid: buildEvalCell(params.fixture.subjectId),
  };

  return `
import { execFileSync, execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { executeWorkflowState, rejectCallerScope, resolveTrustedContext } from ${JSON.stringify(wfImport)};

const WF_CLI = ${JSON.stringify(WORKFLOW_STATE_CLI_PATH)};

function wfRequest(p) {
  rejectCallerScope(p);
  const op = String(p.operation);
  const ref = (typeof p.subjectId === "string" && typeof p.kind === "string" && typeof p.logicalName === "string")
    ? { subjectId: p.subjectId, kind: p.kind, logicalName: p.logicalName, ...(typeof p.revision === "string" ? { revision: p.revision } : {}) }
    : undefined;
  if (op === "write-receipt") return { ...p, operation: op, kind: p.receiptKind };
  if (op === "read" || op === "write" || op === "correct") return { operation: op, ...p, ...(ref ? { ref } : {}) };
  return { operation: op, ...p };
}

function handleAgentResponse(label, cwd, env) {
  if (label.startsWith("b-build-hard")) {
    writeFileSync(join(cwd, "src", "second.ts"), "export const second = 2;\\n");
    return { status: "completed", text: "## Acceptance evidence\\n- Second module finished\\n" };
  }
  if (label.startsWith("b-build")) {
    writeFileSync(join(cwd, "src", "first.ts"), "export const first = 1;\\n");
    return { status: "completed", text: "## Acceptance evidence\\n- First module updated\\n" };
  }
  if (label.startsWith("b-review")) {
    return { status: "completed", text: JSON.stringify({ verdict: "clean", criticalCount: 0, warningCount: 0, summary: "clean", findings: [], reportMarkdown: "# Clean Review\\n" }) };
  }
  if (label.startsWith("b-save")) {
    const idx = label.includes("phase-1") ? 1 : 2;
    const memName = "e2e-p" + idx + ".md";
    const payload = JSON.stringify({ kind: "memory", logicalName: memName, body: "# Note " + idx + "\\n", expectedRevision: null });
    const written = JSON.parse(execFileSync("bun", [WF_CLI, "write", "--subject", "memory", payload], { cwd, env: { ...process.env, ...env }, encoding: "utf8" }));
    return { status: "completed", text: JSON.stringify({ summary: "saved p" + idx, savedArtifacts: [{ subjectId: "memory", kind: "memory", logicalName: memName, revision: written.revision }] }) };
  }
  if (label.startsWith("b-commit")) {
    return { status: "completed", text: JSON.stringify({ title: "feat(e2e): complete " + label, body: "E2E verified" }) };
  }
  return { status: "completed", text: "ok" };
}

function runCell(env, repoDir, code) {
  return new Promise((resolveRun, rejectRun) => {
    let out = "";
    const phases = [];
    const logs = [];
    let seq = 0;
    const agentLabels = [];
    const agentMap = new Map();
    const childEnv = { ...process.env, ...env };

    const proc = Bun.spawn({
      cmd: ["omp", "__omp_worker_js_eval_process"],
      env: childEnv,
      serialization: "advanced",
      async ipc(msg) {
        if (msg.type === "text") out += msg.chunk;
        if (msg.type === "display" && msg.output?.type === "status") {
          const ev = msg.output.event;
          if (ev?.op === "phase") phases.push(ev.title);
          if (ev?.op === "log") logs.push(ev.message);
        }
        if (msg.type === "tool-call") {
          if (msg.name === "__shell__") {
            try {
              const stdout = execSync(msg.args.command, { cwd: msg.args.cwd || repoDir, env: childEnv, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
              proc.send({ type: "tool-reply", id: msg.id, reply: { ok: true, value: { output: stdout, exitCode: 0 } } });
            } catch (err) {
              proc.send({ type: "tool-reply", id: msg.id, reply: { ok: true, value: { output: String(err.stderr || err.stdout || ""), exitCode: err.status ?? 1 } } });
            }
            return;
          }
          if (msg.name === "__agent__") {
            seq += 1;
            const id = "e2e-agent-" + seq;
            const label = String(msg.args?.label ?? "");
            agentLabels.push(label);
            agentMap.set(id, label);
            proc.send({ type: "tool-reply", id: msg.id, reply: { ok: true, value: { id, agent: "task" } } });
            return;
          }
          if (msg.name === "__wait__") {
            const items = Array.isArray(msg.args?.items) ? msg.args.items : [];
            const res = items.map((e) => handleAgentResponse(agentMap.get(e.id) ?? "", repoDir, env));
            proc.send({ type: "tool-reply", id: msg.id, reply: { ok: true, value: { items: res } } });
            return;
          }
          if (msg.name === "__judge__") {
            const q = (msg.args?.questions && typeof msg.args.questions === "object") ? msg.args.questions : {};
            const answers = Object.fromEntries(Object.keys(q).map((k) => [k, { type: "bool", bool: 0.96 }]));
            proc.send({ type: "tool-reply", id: msg.id, reply: { ok: true, value: { answers, model: "e2e-judge" } } });
            return;
          }
          if (msg.name === "workflow_state") {
            const prevXdg = process.env.XDG_CONFIG_HOME;
            const prevCfg = process.env.BUCK_WORKFLOW_CONFIG;
            const prevHome = process.env.HOME;
            process.env.XDG_CONFIG_HOME = env.XDG_CONFIG_HOME;
            process.env.BUCK_WORKFLOW_CONFIG = env.BUCK_WORKFLOW_CONFIG;
            process.env.HOME = env.HOME;
            try {
              const context = await resolveTrustedContext(repoDir);
              const val = await executeWorkflowState({ cwd: repoDir, request: wfRequest(msg.args ?? {}), context, role: "write" });
              proc.send({ type: "tool-reply", id: msg.id, reply: { ok: true, value: { content: [{ type: "text", text: JSON.stringify(val) }], details: val } } });
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              proc.send({ type: "tool-reply", id: msg.id, reply: { ok: false, error: { message, isToolError: true } } });
            } finally {
              if (prevXdg === undefined) delete process.env.XDG_CONFIG_HOME; else process.env.XDG_CONFIG_HOME = prevXdg;
              if (prevCfg === undefined) delete process.env.BUCK_WORKFLOW_CONFIG; else process.env.BUCK_WORKFLOW_CONFIG = prevCfg;
              if (prevHome === undefined) delete process.env.HOME; else process.env.HOME = prevHome;
            }
            return;
          }
          proc.send({ type: "tool-reply", id: msg.id, reply: { ok: true, value: {} } });
          return;
        }
        if (msg.type === "result") {
          clearTimeout(timer);
          proc.kill();
          const m = out.match(/RES=(.+)/);
          resolveRun({ ok: msg.ok, error: msg.error, parsed: m ? JSON.parse(m[1]) : null, phases, logs, agentLabels });
        }
      },
    });
    proc.send({ type: "init", snapshot: { cwd: repoDir, sessionId: "e2e" } });
    setTimeout(() => proc.send({ type: "run", runId: "r1", code, filename: "entry.ts", snapshot: { cwd: repoDir, sessionId: "e2e" } }), 120);
    const timer = setTimeout(() => { proc.kill(); rejectRun(new Error("omp cell timeout")); }, 40_000);
  });
}

const wrap = (c) => "const __r = await (async () => {" + c + "})(); console.log('RES=' + JSON.stringify(__r));";
const baseEnv = { HOME: ${JSON.stringify(params.fixture.home)}, XDG_CONFIG_HOME: ${JSON.stringify(params.fixture.xdg)}, BUCK_WORKFLOW_CONFIG: ${JSON.stringify(params.fixture.cfgPath)} };
const wt = ${JSON.stringify(params.fixture.worktreeDir)};

const rejStatus = await runCell(baseEnv, wt, wrap(${JSON.stringify(cells.status)}));
const rejResume = await runCell(baseEnv, wt, wrap(${JSON.stringify(cells.resume)}));
const rejStop = await runCell(baseEnv, wt, wrap(${JSON.stringify(cells.stop)}));
const rejWrong = await runCell(baseEnv, wt, wrap(${JSON.stringify(cells.wrongSub)}));
const rejEmpty = await runCell(baseEnv, wt, wrap(${JSON.stringify(cells.empty)}));

const happy = await runCell(baseEnv, wt, wrap(${JSON.stringify(cells.valid)}));
const headAfterHappy = execSync("git rev-parse HEAD", { cwd: wt, encoding: "utf8" }).trim();
const rerun = await runCell(baseEnv, wt, wrap(${JSON.stringify(cells.valid)}));
const headAfterRerun = execSync("git rev-parse HEAD", { cwd: wt, encoding: "utf8" }).trim();

const unphased = await runCell({ ...baseEnv, BUCK_WORKFLOW_CONFIG: ${JSON.stringify(params.unphased.cfgPath)} }, ${JSON.stringify(params.unphased.wt)}, wrap(${JSON.stringify(cells.valid)}));
const nonRepo = await runCell({ ...baseEnv, BUCK_WORKFLOW_CONFIG: ${JSON.stringify(params.nonRepo.cfgPath)} }, ${JSON.stringify(params.nonRepo.wt)}, wrap(${JSON.stringify(cells.valid)}));
const integRef = await runCell({ ...baseEnv, BUCK_WORKFLOW_CONFIG: ${JSON.stringify(params.integRef.cfgPath)} }, ${JSON.stringify(params.integRef.wt)}, wrap(${JSON.stringify(cells.valid)}));
const detached = await runCell(baseEnv, ${JSON.stringify(params.detachedWt)}, wrap(${JSON.stringify(cells.valid)}));

console.log("E2E=" + JSON.stringify({
  rejStatus, rejResume, rejStop, rejWrong, rejEmpty,
  happy, headAfterHappy, rerun, headAfterRerun,
  unphased, nonRepo, integRef, detached,
}));
`;
}

function makeRealSh(env: Record<string, string | undefined>): ValidatedBridges["sh"] {
  return async (cmd) => {
    const command = typeof cmd === "string" ? cmd : String(cmd);
    const output = execSync(command, {
      env: { ...process.env, ...env },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { output, stdout: output, exitCode: 0 };
  };
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

function buildWorkflowReqFromParams(params: Record<string, unknown>): WorkflowRequest {
  rejectCallerScope(params);
  const op = String(params.operation ?? "");
  const hasRef =
    typeof params.subjectId === "string" &&
    typeof params.kind === "string" &&
    typeof params.logicalName === "string";
  const ref: ArtifactRef | undefined = hasRef
    ? {
        subjectId: String(params.subjectId),
        kind: params.kind as ArtifactKind,
        logicalName: String(params.logicalName),
        ...(typeof params.revision === "string" ? { revision: params.revision } : {}),
      }
    : undefined;
  if (op === "write-receipt") return { ...params, operation: op, kind: params.receiptKind } as WorkflowRequest;
  if (op === "read" || op === "write" || op === "correct") return { operation: op, ...params, ...(ref ? { ref } : {}) } as WorkflowRequest;
  return { operation: op, ...params } as WorkflowRequest;
}

function makeScopedWorkflowTool(cwd: string, xdg: string, home: string, cfgPath: string) {
  return async (params: Record<string, unknown>) => {
    const prevXdg = process.env.XDG_CONFIG_HOME;
    const prevHome = process.env.HOME;
    const prevCfg = process.env.BUCK_WORKFLOW_CONFIG;
    process.env.XDG_CONFIG_HOME = xdg;
    process.env.HOME = home;
    process.env.BUCK_WORKFLOW_CONFIG = cfgPath;
    try {
      const req = buildWorkflowReqFromParams(params);
      const context = await resolveTrustedContext(cwd);
      const val = await executeWorkflowState({ cwd, request: req, context, role: "write" });
      return { content: [{ type: "text", text: JSON.stringify(val) }], details: val };
    } finally {
      restoreEnv("XDG_CONFIG_HOME", prevXdg);
      restoreEnv("HOME", prevHome);
      restoreEnv("BUCK_WORKFLOW_CONFIG", prevCfg);
    }
  };
}

function writeMemoryNoteCli(fixture: WorktreeFixture, memName: string, body: string): string {
  const payload = JSON.stringify({ kind: "memory", logicalName: memName, body, expectedRevision: null });
  const raw = execFileSync("bun", [WORKFLOW_STATE_CLI_PATH, "write", "--subject", "memory", payload], {
    cwd: fixture.worktreeDir,
    env: { ...process.env, HOME: fixture.home, XDG_CONFIG_HOME: fixture.xdg, BUCK_WORKFLOW_CONFIG: fixture.cfgPath },
    encoding: "utf8",
  });
  return (JSON.parse(raw) as { revision: string }).revision;
}

function handleMatrixAgent(
  label: string,
  fixture: WorktreeFixture,
  reviewVerdict: "clean" | "actionable",
  nextSeq: () => number,
) {
  if (label.startsWith("b-build-hard")) {
    writeFileSync(join(fixture.worktreeDir, "src", "second.ts"), "export const second = 2;\n");
    return { wait: async () => "## Acceptance evidence\n- Second module finished\n" };
  }
  if (label.startsWith("b-build")) {
    writeFileSync(join(fixture.worktreeDir, "src", "first.ts"), "export const first = 1;\n");
    return { wait: async () => "## Acceptance evidence\n- First module updated\n" };
  }
  if (label.startsWith("b-review")) {
    const payload =
      reviewVerdict === "actionable"
        ? { verdict: "actionable", criticalCount: 1, warningCount: 0, summary: "broken edge case", findings: [{ severity: "Critical", file: "src/first.ts", line: 1, detail: "Missing check" }], reportMarkdown: "# Review\n- Critical in first.ts\n" }
        : { verdict: "clean", criticalCount: 0, warningCount: 0, summary: "clean", findings: [], reportMarkdown: "# Review\nClean.\n" };
    return { wait: async () => JSON.stringify(payload) };
  }
  if (label.startsWith("b-save")) {
    const seq = nextSeq();
    const memName = `matrix-note-${seq}.md`;
    const rev = writeMemoryNoteCli(fixture, memName, `# Matrix Save ${seq}\n`);
    return { wait: async () => JSON.stringify({ summary: "saved", savedArtifacts: [{ subjectId: "memory", kind: "memory", logicalName: memName, revision: rev }] }) };
  }
  if (label.startsWith("b-commit")) {
    return { wait: async () => JSON.stringify({ title: `feat(e2e): ${label}`, body: "Verified" }) };
  }
  return { wait: async () => "ok" };
}

function buildMatrixBridges(
  fixture: WorktreeFixture,
  options: { judgePass?: boolean; reviewVerdict?: "clean" | "actionable" } = {},
): ValidatedBridges {
  const env = { HOME: fixture.home, XDG_CONFIG_HOME: fixture.xdg, BUCK_WORKFLOW_CONFIG: fixture.cfgPath };
  const sh = makeRealSh(env);
  const wfTool = makeScopedWorkflowTool(fixture.worktreeDir, fixture.xdg, fixture.home, fixture.cfgPath);
  let memSeq = 0;

  return {
    agent: vi.fn(async (_prompt, opts = {}) => handleMatrixAgent(String(opts.label ?? ""), fixture, options.reviewVerdict ?? "clean", () => ++memSeq)),
    wait: vi.fn(async (h: unknown[]) => Promise.all(h.map((x) => (x as { wait: () => unknown }).wait()))),
    judge: vi.fn(async (_state, q) =>
      Object.fromEntries(Object.keys(q).map((k) => [k, { type: "bool", bool: options.judgePass === false ? 0.25 : 0.95 }])),
    ),
    sh,
    phase: vi.fn(),
    log: vi.fn(),
    tool: { workflow_state: wfTool },
  };
}

function createFixtureBackends(f: WorktreeFixture): {
  ckptBackend: CheckpointBackend;
  runStateBackend: ReturnType<typeof createWorkflowCliRunStateBackend>;
  adapters: StageAdapters;
} {
  const sh = makeRealSh({ HOME: f.home, XDG_CONFIG_HOME: f.xdg, BUCK_WORKFLOW_CONFIG: f.cfgPath });
  const ckptBackend = createWorkflowCliCheckpointBackend(sh, { xdgConfigHome: f.xdg, configPath: f.cfgPath });
  const runStateBackend = createWorkflowCliRunStateBackend(sh, { xdgConfigHome: f.xdg, configPath: f.cfgPath });
  const adapters = createDefaultStageAdapters({
    runStateBackend,
    commitAdapter: createCommitStageAdapter({ xdgConfigHome: f.xdg }),
    xdgConfigHome: f.xdg,
  });
  return { ckptBackend, runStateBackend, adapters };
}

function assertStageProgressLogs(logs: string[], phaseOrder: number, stageLabel: string): void {
  const prefix = `Phase ${phaseOrder} · ${stageLabel} `;
  const idx = (m: string) => logs.findIndex((line) => line === `${prefix}${m}` || line.startsWith(`${prefix}${m} ·`));
  const s = idx("starting");
  const w = idx("working");
  const f = idx("finished");
  const v = idx("verified");
  expect(s, `missing ${prefix}starting in ${JSON.stringify(logs)}`).toBeGreaterThanOrEqual(0);
  expect(w).toBeGreaterThan(s);
  expect(f).toBeGreaterThan(w);
  expect(v).toBeGreaterThan(f);
}

function assertDerivedPhaseMilestones(phasesSeen: string[]): void {
  const idx = (label: string) => phasesSeen.indexOf(label);
  expect(idx("Phase 1 · starting")).toBeGreaterThanOrEqual(0);
  expect(idx("Phase 1 · working")).toBeGreaterThan(idx("Phase 1 · starting"));
  expect(idx("Phase 1 · finished")).toBeGreaterThan(idx("Phase 1 · working"));
  expect(idx("Phase 1 · verified")).toBeGreaterThan(idx("Phase 1 · finished"));
  expect(idx("Phase 2 · starting")).toBeGreaterThan(idx("Phase 1 · verified"));
  expect(idx("Phase 2 · working")).toBeGreaterThan(idx("Phase 2 · starting"));
  expect(idx("Phase 2 · finished")).toBeGreaterThan(idx("Phase 2 · working"));
  expect(idx("Phase 2 · verified")).toBeGreaterThan(idx("Phase 2 · finished"));
}

async function runYieldCheckInSubprocess(f: WorktreeFixture): Promise<string> {
  const lock = acquireWriterLock({
    cwd: f.worktreeDir,
    subjectId: f.subjectId,
    branchRef: f.branchRef,
    xdgConfigHome: f.xdg,
  });
  if (!lock.acquired) {
    throw new Error("Expected initial writer lock to be acquired before testing yield.");
  }
  try {
    const out = execFileSync(
      "bun",
      [
        "-e",
        `import { runBuckLoop } from ${JSON.stringify(join(REPO_ROOT, "skills/b-loop/scripts/eval-buck-loop.ts"))};
         import { resolveTrustedContext, executeWorkflowState, rejectCallerScope } from ${JSON.stringify(join(REPO_ROOT, "skills/_shared/scripts/workflow-state.ts"))};
         import { execSync } from "node:child_process";
         const cwd = ${JSON.stringify(f.worktreeDir)};
         const wf = async (p) => {
           rejectCallerScope(p);
           const ctx = await resolveTrustedContext(cwd);
           const val = await executeWorkflowState({ cwd, request: { ...p, operation: p.operation }, context: ctx, role: "write" });
           return { content: [{ type: "text", text: JSON.stringify(val) }], details: val };
         };
         const res = await runBuckLoop({
           cwd, args: ${JSON.stringify(f.subjectId)}, xdgConfigHome: ${JSON.stringify(f.xdg)}, configPath: ${JSON.stringify(f.cfgPath)},
           bridges: { agent: async () => ({}), wait: async () => [], judge: async () => ({}), phase: () => {}, log: () => {},
             sh: async (c) => ({ output: execSync(String(c), { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }), exitCode: 0 }),
             tool: { workflow_state: wf } }
         });
         console.log("YIELD=" + JSON.stringify(res));`,
      ],
      { env: { ...process.env, HOME: f.home, XDG_CONFIG_HOME: f.xdg, BUCK_WORKFLOW_CONFIG: f.cfgPath }, encoding: "utf8" },
    );
    const line = out.split(/\r?\n/).find((l) => l.startsWith("YIELD="));
    return (JSON.parse(line!.slice(6)) as { state: string }).state;
  } finally {
    lock.release();
  }
}

describe("real OMP command-path E2E suite for /b-loop", () => {
  it(
    "executes packaged /b-loop <subject> in OMP on a separate worktree (no skills/ dir) across rejections, 2-phase milestones, closeout, idempotent re-run, and live-writer yield",
    { timeout: 150_000 },
    async () => {
      const main = createWorktreeFixture();
      expect(existsSync(join(main.worktreeDir, "skills"))).toBe(false);

      const unphased = createWorktreeFixture({ unphased: true });
      const nonRepo = createWorktreeFixture({ storageYaml: "version: 1\nstorage:\n  adapter: sqlite\n" });
      const integRef = createWorktreeFixture({
        storageYaml:
          "version: 1\nstorage:\n  adapter: repo-files\nprojects:\n  e2e:\n    origins:\n      - https://example.com/e2e/repo.git\n    integration_ref: refs/heads/main\n",
      });
      execSync("git remote add origin https://example.com/e2e/repo.git", { cwd: integRef.worktreeDir, stdio: "ignore" });
      const detached = createWorktreeFixture();
      execSync("git checkout --detach HEAD", { cwd: detached.worktreeDir, stdio: "ignore" });

      const driverDir = createTempDir("b-loop-e2e-driver-");
      const driverPath = join(driverDir, "driver.ts");
      writeFileSync(
        driverPath,
        buildBunDriverSource({
          fixture: main,
          unphased: { wt: unphased.worktreeDir, cfgPath: unphased.cfgPath },
          nonRepo: { wt: nonRepo.worktreeDir, cfgPath: nonRepo.cfgPath },
          integRef: { wt: integRef.worktreeDir, cfgPath: integRef.cfgPath },
          detachedWt: detached.worktreeDir,
        }),
      );

      const raw = execFileSync("bun", [driverPath], { encoding: "utf8", timeout: 140_000 });
      const summary = JSON.parse(raw.split(/\r?\n/).find((l) => l.startsWith("E2E="))!.slice(4));

      const rejectionCases: Array<[keyof typeof summary, RegExp]> = [
        ["rejStatus", /unsupported flag --status/i],
        ["rejResume", /unsupported flag --resume/i],
        ["rejStop", /unsupported flag --stop/i],
        ["rejWrong", /no workflow artifacts found/i],
        ["rejEmpty", /subject id is required/i],
        ["unphased", /unphased plans/i],
        ["nonRepo", /unsupported storage adapter/i],
        ["integRef", /Configured integration_ref \(refs\/heads\/main\) is outside/i],
        ["detached", /detached head/i],
      ];
      for (const [key, pattern] of rejectionCases) {
        const bad = summary[key];
        expect(bad.ok).toBe(true);
        expect(bad.parsed.ok).toBe(false);
        expect(bad.parsed.state).toBe("blocked");
        expect(bad.parsed.message).toMatch(pattern);
        expect(bad.agentLabels).toEqual([]);
      }

      expect(summary.happy.ok).toBe(true);
      expect(summary.happy.parsed.ok, JSON.stringify(summary.happy)).toBe(true);
      expect(summary.happy.parsed.state).toBe("done");
      expect(Object.keys(summary.happy.parsed.completedPhaseCommits ?? {})).toEqual(["phase-1-core.md", "phase-2-finish.md"]);
      assertDerivedPhaseMilestones(summary.happy.phases);
      for (const stage of ["b-build", "b-review", "b-save", "b-commit"]) {
        assertStageProgressLogs(summary.happy.logs, 1, stage);
        assertStageProgressLogs(summary.happy.logs, 2, stage);
      }
      expect(readFileSync(join(main.worktreeDir, ".context", main.subjectId, "index.md"), "utf8")).toContain("lifecycle_last_transition: close-verified");
      expect(readFileSync(join(main.worktreeDir, ".context", main.subjectId, "plan-e2e-phases.md"), "utf8")).toContain("| [Phase 2](phase-2-finish.md) | completed |");
      expect(summary.rerun.parsed.state).toBe("done");
      expect(summary.headAfterRerun).toBe(summary.headAfterHappy);
      expect(summary.rerun.agentLabels).toEqual([]);
      expect(await runYieldCheckInSubprocess(main)).toBe("yielded");
    },
  );

  it(
    "recovers crashes before dispatch, mid-working with partial edits, between finished and verified, after durable save without duplicate, and after commit/close-verified without duplicating commits",
    { timeout: 120_000 },
    async () => {
      const f = createWorktreeFixture();
      const bridges = buildMatrixBridges(f);
      const { ckptBackend, runStateBackend, adapters } = createFixtureBackends(f);

      // 1) Crash BEFORE dispatch (`starting` on Phase 1) persists `starting`; next run genuinely resumes `starting` -> `working` and crashes mid-working with partial edit preserved on disk
      const startCrashAdapters: StageAdapters = {
        ...adapters,
        build: {
          ...adapters.build,
          dispatchWorking: async () => {
            throw new Error("simulated crash before dispatch at starting");
          },
        },
      };
      const errStart = await runBuckLoop({ cwd: f.worktreeDir, args: f.subjectId, bridges, checkpointBackend: ckptBackend, runStateBackend, stageAdapters: startCrashAdapters, verifySubjectCloseout: verifySubjectCloseoutWithLifecycle, xdgConfigHome: f.xdg, configPath: f.cfgPath });
      expect(errStart.ok).toBe(false);
      expect(errStart.message).toMatch(/simulated crash before dispatch at starting/);

      const afterStartStored = await ckptBackend.read({ cwd: f.worktreeDir, subjectId: f.subjectId, branchRef: f.branchRef, logicalName: CHECKPOINT_LOGICAL_NAME, configPath: f.cfgPath });
      expect(afterStartStored?.checkpoint.currentStage).toBe("build");
      expect(afterStartStored?.checkpoint.currentMilestone).toBe("starting");

      // Resume genuinely from `build · starting` (NO manual checkpoint rewrite), write partial edit during dispatch, then crash in `awaitFinished` so `build · working` is persisted naturally.
      const workingCrashAdapters: StageAdapters = {
        ...adapters,
        build: {
          ...adapters.build,
          dispatchWorking: async () => {
            writeFileSync(join(f.worktreeDir, "src", "first.ts"), "// partial edit before crash\nexport const first = 99;\n");
            return { jobHandle: "job-build-partial" };
          },
          awaitFinished: async () => {
            throw new Error("simulated crash mid-working before finished");
          },
        },
      };
      const errWorking = await runBuckLoop({ cwd: f.worktreeDir, args: f.subjectId, bridges, checkpointBackend: ckptBackend, runStateBackend, stageAdapters: workingCrashAdapters, verifySubjectCloseout: verifySubjectCloseoutWithLifecycle, xdgConfigHome: f.xdg, configPath: f.cfgPath });
      expect(errWorking.ok).toBe(false);
      expect(errWorking.message).toMatch(/simulated crash mid-working before finished/);

      const afterWorkingStored = await ckptBackend.read({ cwd: f.worktreeDir, subjectId: f.subjectId, branchRef: f.branchRef, logicalName: CHECKPOINT_LOGICAL_NAME, configPath: f.cfgPath });
      expect(afterWorkingStored?.checkpoint.currentStage).toBe("build");
      expect(afterWorkingStored?.checkpoint.currentMilestone).toBe("working");

      let sawPartialOnResume = false;
      const origAgent = bridges.agent;
      bridges.agent = vi.fn(async (prompt, opts = {}) => {
        if (String(opts.label ?? "") === "b-build:phase-1-core" && readFileSync(join(f.worktreeDir, "src", "first.ts"), "utf8").includes("partial edit before crash")) {
          sawPartialOnResume = true;
        }
        return origAgent(prompt, opts);
      });

      // 2) Simulated crashes: between build `finished` & `verified`, right after durable `save` apply, and right after Phase 2 close-verified commit before checkpoint writeback
      let buildVerifyCrash = 0;
      let saveCrashCount = 0;
      let commitCrashCount = 0;
      const crashAdapters: StageAdapters = {
        ...adapters,
        build: {
          ...adapters.build,
          verifyResult: async (ctx) => {
            if (ctx.phase.order === 1 && ++buildVerifyCrash === 1) throw new Error("simulated crash between build finished and verified");
            return adapters.build.verifyResult(ctx);
          },
        },
        save: {
          ...adapters.save,
          verifyResult: async (ctx) => {
            if (++saveCrashCount === 1) throw new Error("simulated crash after save apply before checkpoint writeback");
            return adapters.save.verifyResult(ctx);
          },
        },
        commit: {
          ...adapters.commit,
          awaitFinished: async (ctx, dispatched) => {
            await adapters.commit.awaitFinished!(ctx, dispatched);
            if (ctx.phase.order === 2 && ++commitCrashCount === 1) {
              throw new Error("simulated crash after final close-verified git commit before checkpoint writeback");
            }
          },
        },
      };

      const errBuildFinish = await runBuckLoop({ cwd: f.worktreeDir, args: f.subjectId, bridges, checkpointBackend: ckptBackend, runStateBackend, stageAdapters: crashAdapters, verifySubjectCloseout: verifySubjectCloseoutWithLifecycle, xdgConfigHome: f.xdg, configPath: f.cfgPath });
      expect(errBuildFinish.ok).toBe(false);
      expect(errBuildFinish.message).toMatch(/simulated crash between build finished and verified/);
      const buildCallsAfterFinishCrash = (bridges.agent as ReturnType<typeof vi.fn>).mock.calls.filter(([, o]) => String((o as { label?: string })?.label) === "b-build:phase-1-core").length;

      const errSave = await runBuckLoop({ cwd: f.worktreeDir, args: f.subjectId, bridges, checkpointBackend: ckptBackend, runStateBackend, stageAdapters: crashAdapters, verifySubjectCloseout: verifySubjectCloseoutWithLifecycle, xdgConfigHome: f.xdg, configPath: f.cfgPath });
      expect(errSave.ok).toBe(false);
      expect(errSave.message).toMatch(/simulated crash after save apply/);
      expect((bridges.agent as ReturnType<typeof vi.fn>).mock.calls.filter(([, o]) => String((o as { label?: string })?.label) === "b-build:phase-1-core").length).toBe(buildCallsAfterFinishCrash);

      const saveP1CountAtCrash = (bridges.agent as ReturnType<typeof vi.fn>).mock.calls.filter(([, o]) => String((o as { label?: string })?.label).startsWith("b-save:phase-1")).length;
      const errCommit = await runBuckLoop({ cwd: f.worktreeDir, args: f.subjectId, bridges, checkpointBackend: ckptBackend, runStateBackend, stageAdapters: crashAdapters, verifySubjectCloseout: verifySubjectCloseoutWithLifecycle, xdgConfigHome: f.xdg, configPath: f.cfgPath });
      expect(errCommit.ok).toBe(false);
      expect(errCommit.message).toMatch(/simulated crash after final close-verified git commit/);

      // Re-run cleanly -> adopts landed Phase 2 final commit WITHOUT creating duplicate commit or calling b-save(phase-1)/b-commit(phase-2) again!
      const headBeforeAdopt = execSync("git rev-parse HEAD", { cwd: f.worktreeDir, encoding: "utf8" }).trim();
      const bCommitP2Before = (bridges.agent as ReturnType<typeof vi.fn>).mock.calls.filter(([, o]) => String((o as { label?: string })?.label).startsWith("b-commit:phase-2")).length;
      const done = await runBuckLoop({ cwd: f.worktreeDir, args: f.subjectId, bridges, checkpointBackend: ckptBackend, runStateBackend, stageAdapters: adapters, verifySubjectCloseout: verifySubjectCloseoutWithLifecycle, xdgConfigHome: f.xdg, configPath: f.cfgPath });
      expect(done.ok, JSON.stringify(done)).toBe(true);
      expect(done.state).toBe("done");
      expect(sawPartialOnResume).toBe(true);
      expect(execSync("git rev-parse HEAD", { cwd: f.worktreeDir, encoding: "utf8" }).trim()).toBe(headBeforeAdopt);
      expect((bridges.agent as ReturnType<typeof vi.fn>).mock.calls.filter(([, o]) => String((o as { label?: string })?.label).startsWith("b-save:phase-1")).length).toBe(saveP1CountAtCrash);
      expect((bridges.agent as ReturnType<typeof vi.fn>).mock.calls.filter(([, o]) => String((o as { label?: string })?.label).startsWith("b-commit:phase-2")).length).toBe(bCommitP2Before);
    },
  );

  it(
    "blocks and preserves state on failed build judge, actionable b-review, stale worktree mutation, and ambiguous save",
    { timeout: 120_000 },
    async () => {
      // 1) Failed build judge preserves partial edits & records b-build finished blocked
      const fBuild = createWorktreeFixture();
      const resBuild = await runBuckLoop({ cwd: fBuild.worktreeDir, args: fBuild.subjectId, bridges: buildMatrixBridges(fBuild, { judgePass: false }), xdgConfigHome: fBuild.xdg, configPath: fBuild.cfgPath });
      expect(resBuild.ok).toBe(false);
      expect(resBuild.stage).toBe("build");
      expect(resBuild.milestone).toBe("finished");
      expect(readFileSync(join(fBuild.worktreeDir, "src", "first.ts"), "utf8")).toContain("first = 1");

      // 2) Actionable review findings block save & preserve b-review finished blocked
      const fRev = createWorktreeFixture();
      const bridgesRev = buildMatrixBridges(fRev, { reviewVerdict: "actionable" });
      const resRev = await runBuckLoop({ cwd: fRev.worktreeDir, args: fRev.subjectId, bridges: bridgesRev, xdgConfigHome: fRev.xdg, configPath: fRev.cfgPath });
      expect(resRev.ok).toBe(false);
      expect(resRev.stage).toBe("review");
      expect(resRev.milestone).toBe("finished");
      expect((bridgesRev.agent as ReturnType<typeof vi.fn>).mock.calls.some(([, o]) => String((o as { label?: string })?.label).startsWith("b-save"))).toBe(false);

      // 3) Ambiguous save journal without matching receipt blocks retry naming attemptId
      const fAmb = createWorktreeFixture();
      const { ckptBackend, runStateBackend, adapters } = createFixtureBackends(fAmb);
      const pinnedAmb = await resolveAndPinPlan(buildMatrixBridges(fAmb).tool.workflow_state, fAmb.subjectId, { branchRef: fAmb.branchRef, branchName: fAmb.branch, headCommit: fAmb.initHead });
      const p1 = pinnedAmb.phases[0];
      const fpAmb = await computeWorktreeFingerprint(fAmb.worktreeDir, makeRealSh({ HOME: fAmb.home, XDG_CONFIG_HOME: fAmb.xdg }));
      const ambCkpt = createInitialCheckpoint(fAmb.worktreeDir, pinnedAmb);
      ambCkpt.currentStage = "save";
      ambCkpt.currentMilestone = "working";
      ambCkpt.attemptId = "att-amb-e2e";
      ambCkpt.phases[p1.logicalName] = {
        ...ambCkpt.phases[p1.logicalName],
        build: { phaseRevision: p1.revision, worktreeFingerprint: fpAmb, acceptanceEvidence: ["ok"], verifiedAt: "now" },
        review: { phaseRevision: p1.revision, worktreeFingerprint: fpAmb, verdict: "clean", verifiedAt: "now" },
      };
      await ckptBackend.write({ cwd: fAmb.worktreeDir, subjectId: fAmb.subjectId, branchRef: fAmb.branchRef, logicalName: CHECKPOINT_LOGICAL_NAME, checkpoint: ambCkpt, expectedRevision: null, configPath: fAmb.cfgPath });
      await runStateBackend.writeRunState({ cwd: fAmb.worktreeDir, subjectId: fAmb.subjectId, branchRef: fAmb.branchRef, logicalName: "b-loop/save-att-amb-e2e.json", data: { attemptId: "att-amb-e2e", status: "applying", startedAt: "now" }, expectedRevision: null, configPath: fAmb.cfgPath });
      const resAmb = await runBuckLoop({ cwd: fAmb.worktreeDir, args: fAmb.subjectId, bridges: buildMatrixBridges(fAmb), checkpointBackend: ckptBackend, runStateBackend, stageAdapters: adapters, xdgConfigHome: fAmb.xdg, configPath: fAmb.cfgPath });
      expect(resAmb.ok).toBe(false);
      expect(resAmb.stage).toBe("save");
      expect(resAmb.message).toContain("att-amb-e2e");

      // 4) Stale review after worktree mutation right before save blocks save, and re-running rewinds cleanly to rebuild -> re-review -> done
      const fStale = createWorktreeFixture();
      const bridgesStale = buildMatrixBridges(fStale);
      const staleBackends = createFixtureBackends(fStale);
      let mutatedAfterReview = false;
      const staleAdapters: StageAdapters = {
        ...staleBackends.adapters,
        save: {
          ...staleBackends.adapters.save,
          prepareStarting: async (ctx) => {
            if (!mutatedAfterReview) {
              mutatedAfterReview = true;
              writeFileSync(join(fStale.worktreeDir, "src", "first.ts"), "export const first = 777;\n");
            }
            return staleBackends.adapters.save.prepareStarting!(ctx);
          },
        },
      };
      const blockedStale = await runBuckLoop({ cwd: fStale.worktreeDir, args: fStale.subjectId, bridges: bridgesStale, checkpointBackend: staleBackends.ckptBackend, runStateBackend: staleBackends.runStateBackend, stageAdapters: staleAdapters, verifySubjectCloseout: verifySubjectCloseoutWithLifecycle, xdgConfigHome: fStale.xdg, configPath: fStale.cfgPath });
      expect(blockedStale.ok).toBe(false);
      expect(blockedStale.stage).toBe("save");
      expect(blockedStale.milestone).toBe("starting");
      expect(blockedStale.message).toMatch(/changed since clean review/i);
      expect((bridgesStale.agent as ReturnType<typeof vi.fn>).mock.calls.some(([, o]) => String((o as { label?: string })?.label).startsWith("b-save"))).toBe(false);

      const resRewound = await runBuckLoop({ cwd: fStale.worktreeDir, args: fStale.subjectId, bridges: bridgesStale, checkpointBackend: staleBackends.ckptBackend, runStateBackend: staleBackends.runStateBackend, stageAdapters: staleBackends.adapters, verifySubjectCloseout: verifySubjectCloseoutWithLifecycle, xdgConfigHome: fStale.xdg, configPath: fStale.cfgPath });
      expect(resRewound.ok).toBe(true);
      expect(resRewound.state).toBe("done");
      expect((bridgesStale.agent as ReturnType<typeof vi.fn>).mock.calls.filter(([, o]) => String((o as { label?: string })?.label) === "b-build:phase-1-core").length).toBeGreaterThanOrEqual(2);
    },
  );

  it(
    "blocks on unrelated dirty index/tree, pre-staged index, mutated ref/tree, failed close-verified, and reverted closeout",
    { timeout: 120_000 },
    async () => {
      // 1) Pre-existing staged index & unrelated dirty working tree block commit before staging
      const fDirty = createWorktreeFixture();
      writeFileSync(join(fDirty.worktreeDir, "UNRELATED.txt"), "dirty\n");
      execSync("git add UNRELATED.txt", { cwd: fDirty.worktreeDir, stdio: "ignore" });
      const resStaged = await runBuckLoop({ cwd: fDirty.worktreeDir, args: fDirty.subjectId, bridges: buildMatrixBridges(fDirty), xdgConfigHome: fDirty.xdg, configPath: fDirty.cfgPath });
      expect(resStaged.ok).toBe(false);
      expect(resStaged.message).toMatch(/pre-existing staged/i);
      execSync("git reset -q", { cwd: fDirty.worktreeDir, stdio: "ignore" });
      const resDirty = await runBuckLoop({ cwd: fDirty.worktreeDir, args: fDirty.subjectId, bridges: buildMatrixBridges(fDirty), xdgConfigHome: fDirty.xdg, configPath: fDirty.cfgPath });
      expect(resDirty.ok).toBe(false);
      expect(resDirty.state).toBe("blocked");
      expect(resDirty.message).toMatch(/unrelated dirty/i);

      // 2) Failed close-verified (extra open plan) blocks final commit BEFORE mutating phase-2 status
      const fCloseFail = createWorktreeFixture();
      writeFileSync(join(fCloseFail.worktreeDir, ".context", fCloseFail.subjectId, "plan-extra.md"), "---\ntitle: Extra\nstatus: pending\n---\n- [ ] Still open\n");
      execSync("git add . && git commit -m extra-plan", { cwd: fCloseFail.worktreeDir, stdio: "ignore" });
      fCloseFail.initHead = execSync("git rev-parse HEAD", { cwd: fCloseFail.worktreeDir, encoding: "utf8" }).trim();
      const resCloseFail = await runBuckLoop({ cwd: fCloseFail.worktreeDir, args: fCloseFail.subjectId, bridges: buildMatrixBridges(fCloseFail), xdgConfigHome: fCloseFail.xdg, configPath: fCloseFail.cfgPath });
      expect(resCloseFail.ok).toBe(false);
      expect(resCloseFail.message).toMatch(/closeout blockers/i);
      expect(readFileSync(join(fCloseFail.worktreeDir, ".context", fCloseFail.subjectId, "phase-2-finish.md"), "utf8")).toContain("status: pending");

      // 3) Reverted closeout blocks done even when commits exist, and mutated HEAD blocks divergent history
      const fClose = createWorktreeFixture();
      const bridgesClose = buildMatrixBridges(fClose);
      const okDone = await runBuckLoop({ cwd: fClose.worktreeDir, args: fClose.subjectId, bridges: bridgesClose, xdgConfigHome: fClose.xdg, configPath: fClose.cfgPath });
      expect(okDone.ok).toBe(true);
      writeFileSync(join(fClose.worktreeDir, ".context", fClose.subjectId, "index.md"), "---\ntitle: Reverted\nstatus: active\n---\n");
      const blockedReverted = await runBuckLoop({ cwd: fClose.worktreeDir, args: fClose.subjectId, bridges: bridgesClose, xdgConfigHome: fClose.xdg, configPath: fClose.cfgPath });
      expect(blockedReverted.ok).toBe(false);
      expect(blockedReverted.state).toBe("blocked");

      // Mutated HEAD (soft-reset away from committed phases, leaving .context/ intact) blocks done invariants via unreachable commit check
      execSync(`git reset --soft ${fClose.initHead}`, { cwd: fClose.worktreeDir, stdio: "ignore" });
      const blockedUnreachable = await runBuckLoop({ cwd: fClose.worktreeDir, args: fClose.subjectId, bridges: bridgesClose, xdgConfigHome: fClose.xdg, configPath: fClose.cfgPath });
      expect(blockedUnreachable.ok).toBe(false);
      expect(blockedUnreachable.message).toMatch(/missing or unreachable|lacks a verified reachable commit/i);
    },
  );
});
