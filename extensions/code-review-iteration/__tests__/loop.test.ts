import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, appendFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, isAbsolute } from "node:path";
import { execFileSync } from "node:child_process";
import { runReviewLoop, type LoopDeps, type LoopOptions } from "../loop.js";
import { parseModelEntry, type CatalogLoad } from "../catalog.js";
import { resolveHead } from "../git-ops.js";

const USER_ENV = {
  GIT_AUTHOR_NAME: "t",
  GIT_AUTHOR_EMAIL: "t@t",
  GIT_COMMITTER_NAME: "t",
  GIT_COMMITTER_EMAIL: "t@t",
};

function g(dir: string, args: string[]): string {
  return execFileSync("git", args, { cwd: dir, encoding: "utf-8", env: { ...process.env, ...USER_ENV }, stdio: ["pipe", "pipe", "pipe"] }).trim();
}

function commonDirAbsolute(clone: string): string {
  const raw = g(clone, ["rev-parse", "--git-common-dir"]);
  return isAbsolute(raw) ? raw : join(clone, raw);
}

function makeOriginClone(): { origin: string; clone: string } {
  const origin = mkdtempSync(join(tmpdir(), "loop-origin-"));
  const clone = mkdtempSync(join(tmpdir(), "loop-clone-"));
  g(origin, ["init", "-q", "--bare", "-b", "master", "."]);
  g(clone, ["init", "-q", "-b", "master", "."]);
  g(clone, ["config", "user.email", "t@t"]);
  g(clone, ["config", "user.name", "t"]);
  writeFileSync(join(clone, "app.js"), "function login() { return true; }\n");
  writeFileSync(join(clone, ".gitignore"), "coverage/\n");
  g(clone, ["add", "-A"]);
  g(clone, ["commit", "-qm", "init"]);
  g(clone, ["remote", "add", "origin", origin]);
  g(clone, ["push", "-q", "-u", "origin", "master"]);
  g(clone, ["checkout", "-q", "-b", "feature/x"]);
  appendFileSync(join(clone, "app.js"), "function broken() { return null.x; }\n");
  g(clone, ["add", "-A"]);
  g(clone, ["commit", "-qm", "feature work"]);
  return { origin, clone };
}

function catalogEntry(file: string, fields: Record<string, string>) {
  const defaults: Record<string, string> = {
    schema_version: "1",
    family: "f",
    fixer_capability: "medium",
    roles: "[fixer]",
    priority: "100",
    thinking_easy: "minimal",
    thinking_medium: "medium",
    thinking_hard: "high",
    enabled: "true",
    calibration_source: "seeded",
    reviewed_at: "2026-09-01",
  };
  const body = Object.entries({ ...defaults, ...fields }).map(([k, v]) => `${k}: ${v}`).join("\n");
  return parseModelEntry(`---\n${body}\n---\n`, file).entry;
}

function catalogFixture(): CatalogLoad {
  return {
    entries: [
      catalogEntry("glm.md", { selector: "zai/glm-5.3", family: "glm-5.3", fixer_capability: "hard", roles: "[reviewer, fixer]", priority: "100" }),
      catalogEntry("terra.md", { selector: "openai-codex/gpt-5.6-terra", family: "gpt-5.6-terra", fixer_capability: "medium", priority: "50" }),
      catalogEntry("luna.md", { selector: "openai-codex/gpt-5.6-luna", family: "gpt-5.6-luna", fixer_capability: "easy", priority: "10" }),
    ],
    errors: [],
    warnings: [],
  };
}

function findingJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    findings: [{
      id: "F1",
      title: "Null dereference on error path",
      location: "app.js:2",
      observed: "broken() dereferences null",
      expected: "error handled",
      evidence: "return null.x",
      impact: 3,
      likelihood: 3,
      breadth: 1,
      confidence: 1,
      fix_hardness: "medium",
      reproduction: { status: "not_run", note: "static" },
      ...overrides,
    }],
  });
}

interface ScriptedState {
  reviewerOutputs: string[];
  reviewerCalls: number;
  fixerOutputs: string[];
  fixerCalls: number;
  checksPassed: boolean;
  executedCommands: number;
  untrackedAnswer: string[] | null;
  notifyLog: string[];
  contextRoot: string;
  simulateCommand: boolean;
}

function makeDeps(overrides: Partial<ScriptedState> = {}): LoopDeps & ScriptedState {
  const state: ScriptedState = {
    reviewerOutputs: [findingJson()],
    reviewerCalls: 0,
    fixerOutputs: [JSON.stringify({ dispositions: [{ finding_id: "F1", disposition: "valid", note: "verified" }] })],
    fixerCalls: 0,
    checksPassed: true,
    executedCommands: 0,
    untrackedAnswer: null,
    notifyLog: [],
    contextRoot: mkdtempSync(join(tmpdir(), "loop-ctx-")),
    simulateCommand: false,
    ...overrides,
  };
  const deps: LoopDeps = {
    async runReviewerSession(opts) {
      const index = state.reviewerCalls++;
      if (index === 0 && state.simulateCommand) {
        await opts.onCommand({ id: "git-status", argv: ["git", "status"] });
      }
      return state.reviewerOutputs[index] ?? state.reviewerOutputs[state.reviewerOutputs.length - 1];
    },
    async runFixerSession(opts) {
      // A real fixer edits the checkout; simulate a minimal verified fix.
      appendFileSync(join(opts.cwd, "app.js"), `// fixed by fixer pass ${state.fixerCalls + 1}\n`);
      const index = state.fixerCalls++;
      return state.fixerOutputs[index] ?? state.fixerOutputs[state.fixerOutputs.length - 1];
    },
    async execReviewCommand(_root, _request, seq) {
      state.executedCommands++;
      return {
        command_id: `c${seq}`,
        argv: ["git", "status"],
        cwd: ".",
        started_at: new Date().toISOString(),
        ended_at: new Date().toISOString(),
        duration_ms: 1,
        exit_code: 0,
        signal: null,
        timed_out: false,
        stdout_excerpt: "",
        stderr_excerpt: "",
        stdout_sha256: "",
        stderr_sha256: "",
        stdout_truncated: false,
        stderr_truncated: false,
        denied_reason: null,
        network_exposed: false,
      };
    },
    async runChecks() {
      return { command: "npm test", exitCode: state.checksPassed ? 0 : 1, passed: state.checksPassed };
    },
    async availableSelectors() {
      return new Set(["zai/glm-5.3", "openai-codex/gpt-5.6-terra"]);
    },
    loadCatalog: catalogFixture,
    fixerFallbackModel: () => "fallback/model",
    baseGuidance: () => "Review with care.",
    persona: () => ({
      name: "balanced",
      description: "",
      defaultModel: "zai/glm-5.3",
      defaultTemperature: 0.2,
      body: "Focus on correctness.",
      file: "balanced.md",
    }),
    async untrackedSelection(paths) {
      return state.untrackedAnswer ?? paths;
    },
    notify(message) {
      state.notifyLog.push(message);
    },
    contextDir() {
      return state.contextRoot;
    },
  };
  const merged = { ...deps } as LoopDeps & ScriptedState;
  const liveKeys = [
    "reviewerOutputs", "reviewerCalls", "fixerOutputs", "fixerCalls",
    "checksPassed", "executedCommands", "untrackedAnswer", "notifyLog",
    "contextRoot", "simulateCommand",
  ] as const;
  for (const key of liveKeys) {
    Object.defineProperty(merged, key, {
      get: () => state[key],
      enumerable: true,
    });
  }
  return merged;
}

const OPTIONS: LoopOptions = {
  reviewerModel: "zai/glm-5.3",
  personaName: "balanced",
  minBlocking: "medium",
  maxPasses: 3,
  resume: false,
};

describe("runReviewLoop", () => {
  let cleanup: string[] = [];

  beforeEach(() => {
    cleanup = [];
  });

  afterEach(() => {
    for (const dir of cleanup) {
      try {
        execFileSync("git", ["worktree", "prune"], { cwd: dir, stdio: "ignore" });
      } catch {
        // gone
      }
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fails fast outside a git checkout", async () => {
    const deps = makeDeps();
    const nowhere = mkdtempSync(join(tmpdir(), "loop-nowhere-"));
    cleanup.push(nowhere);
    const result = await runReviewLoop(deps, nowhere, OPTIONS);
    expect(result.status).toBe("failed");
    expect(deps.notifyLog.join("\n")).toMatch(/non-bare git checkout/);
  });

  it("ends clean on a zero-finding first pass and writes the report", async () => {
    const { origin, clone } = makeOriginClone();
    cleanup.push(origin, clone);
    const deps = makeDeps({
      reviewerOutputs: [JSON.stringify({ findings: [] })],
      contextRoot: join(clone, ".context"),
    });
    const result = await runReviewLoop(deps, clone, OPTIONS);
    expect(result.status).toBe("clean");
    expect(result.reportPath).toBeTruthy();
    const report = readFileSync(result.reportPath!, "utf-8");
    expect(report).toContain("**Outcome: CLEAN**");
    expect(report).toContain("no findings");
    expect(existsSync(join(dirname(result.reportPath!), `review-iteration-${result.runId}.md`))).toBe(true);
    expect(deps.reviewerCalls).toBe(1);
    expect(deps.fixerCalls).toBe(0);
    expect(g(clone, ["log", "--oneline"])).toMatch(/docs\(code-review\): record review-iteration report/);
  });

  it("fixes blocking findings, checkpoints, re-reviews, then ends clean", async () => {
    const { origin, clone } = makeOriginClone();
    cleanup.push(origin, clone);
    const deps = makeDeps({
      reviewerOutputs: [findingJson(), JSON.stringify({ findings: [] })],
    });
    const headBefore = resolveHead(clone);
    const result = await runReviewLoop(deps, clone, OPTIONS);
    expect(result.status).toBe("clean");
    expect(deps.reviewerCalls).toBe(2);
    expect(deps.fixerCalls).toBe(1);
    const runDir = join(commonDirAbsolute(clone), "code-review-iteration", "feature_x", result.runId);
    const fixerRecord = JSON.parse(readFileSync(join(runDir, "passes", "01", "fixer.json"), "utf-8"));
    expect(fixerRecord.model).toBe("openai-codex/gpt-5.6-terra");
    expect(fixerRecord.checkpoint_commit).toBeTruthy();
    const reviewRecord = JSON.parse(readFileSync(join(runDir, "passes", "01", "review.json"), "utf-8"));
    expect(reviewRecord.thinking_level).toBe("medium");
    expect(resolveHead(clone)).not.toBe(headBefore);
    expect(g(clone, ["log", "--oneline"])).toMatch(/fix\(code-review\): pass 1 verified fixes/);
    const report = readFileSync(result.reportPath!, "utf-8");
    expect(report).toContain("F1: valid — verified");
    expect(report).toContain("npm test exit 0 (passed)");
  });

  it("blocks when deterministic checks fail after a fixer pass", async () => {
    const { origin, clone } = makeOriginClone();
    cleanup.push(origin, clone);
    const deps = makeDeps({ checksPassed: false });
    const result = await runReviewLoop(deps, clone, OPTIONS);
    expect(result.status).toBe("blocked");
    const report = readFileSync(result.reportPath!, "utf-8");
    expect(report).toContain("**Outcome: BLOCKED**");
    expect(report).toMatch(/deterministic checks failed/);
    expect(g(clone, ["log", "--oneline"])).not.toMatch(/fix\(code-review\)/);
  });

  it("ends exhausted when blocking findings persist to the pass bound", async () => {
    const { origin, clone } = makeOriginClone();
    cleanup.push(origin, clone);
    const deps = makeDeps();
    const result = await runReviewLoop(deps, clone, { ...OPTIONS, maxPasses: 2 });
    expect(result.status).toBe("exhausted");
    expect(deps.reviewerCalls).toBe(2);
    expect(deps.fixerCalls).toBe(2);
    const report = readFileSync(result.reportPath!, "utf-8");
    expect(report).toContain("**Outcome: EXHAUSTED**");
    expect(report).toContain("after 2 review passes");
  });

  it("checkpoints a dirty start including selected untracked files", async () => {
    const { origin, clone } = makeOriginClone();
    cleanup.push(origin, clone);
    writeFileSync(join(clone, "scratch.txt"), "wip\n");
    writeFileSync(join(clone, "notes.md"), "keep out\n");
    const deps = makeDeps({
      reviewerOutputs: [JSON.stringify({ findings: [] })],
      untrackedAnswer: ["scratch.txt"],
    });
    const result = await runReviewLoop(deps, clone, OPTIONS);
    expect(result.status).toBe("clean");
    expect(g(clone, ["log", "--oneline"])).toMatch(/chore\(code-review\): pre-review checkpoint/);
    expect(g(clone, ["show", "--name-only", "--format=", "HEAD"])).toContain("scratch.txt");
    expect(g(clone, ["show", "--name-only", "--format=", "HEAD"])).not.toContain("notes.md");
    expect(deps.notifyLog.join("\n")).toMatch(/1\/2 untracked path/);
  });

  it("plumbs review_exec evidence ids into reproduction validation", async () => {
    const { origin, clone } = makeOriginClone();
    cleanup.push(origin, clone);
    const deps = makeDeps({
      simulateCommand: true,
      reviewerOutputs: [
        findingJson({ reproduction: { status: "reproduced", command_ids: ["c1"], note: "status shows failure" } }),
        JSON.stringify({ findings: [] }),
      ],
    });
    const result = await runReviewLoop(deps, clone, OPTIONS);
    expect(result.status).toBe("clean");
    expect(deps.executedCommands).toBe(1);
    const runDir = join(commonDirAbsolute(clone), "code-review-iteration", "feature_x", result.runId);
    const commands = readFileSync(join(runDir, "passes", "01", "commands.jsonl"), "utf-8").trim().split("\n");
    expect(commands).toHaveLength(1);
    expect(JSON.parse(commands[0]).command_id).toBe("c1");
  });

  it("resumes a retained run at the next pass", async () => {
    const { origin, clone } = makeOriginClone();
    cleanup.push(origin, clone);
    const deps = makeDeps({ checksPassed: false });
    const blocked = await runReviewLoop(deps, clone, OPTIONS);
    expect(blocked.status).toBe("blocked");
    const deps2 = makeDeps({ reviewerOutputs: [JSON.stringify({ findings: [] })] });
    const resumed = await runReviewLoop(deps2, clone, { ...OPTIONS, resume: true });
    expect(resumed.status).toBe("clean");
    expect(deps2.notifyLog.join("\n")).toMatch(/Resuming run/);
    expect(deps2.reviewerCalls).toBe(1);
    const report = readFileSync(resumed.reportPath!, "utf-8");
    expect(report).toContain("Pass 01");
    expect(report).toContain("Pass 02");
  });

  it("refuses to resume when the worktree fingerprint drifted and starts a new run", async () => {
    const { origin, clone } = makeOriginClone();
    cleanup.push(origin, clone);
    const deps = makeDeps({ checksPassed: false });
    const first = await runReviewLoop(deps, clone, OPTIONS);
    expect(first.status).toBe("blocked");
    appendFileSync(join(clone, "app.js"), "// drift\n");
    const deps2 = makeDeps({ reviewerOutputs: [JSON.stringify({ findings: [] })] });
    const second = await runReviewLoop(deps2, clone, { ...OPTIONS, resume: true });
    expect(deps2.notifyLog.join("\n")).toMatch(/will not resume/);
    expect(second.status).toBe("clean");
    expect(second.runId).not.toBe(first.runId);
  });

  it("fails visibly with no origin instead of reviewing a stale base", async () => {
    const clone = mkdtempSync(join(tmpdir(), "loop-noremote-"));
    cleanup.push(clone);
    g(clone, ["init", "-q", "-b", "master", "."]);
    g(clone, ["config", "user.email", "t@t"]);
    g(clone, ["config", "user.name", "t"]);
    writeFileSync(join(clone, "a.txt"), "a\n");
    g(clone, ["add", "-A"]);
    g(clone, ["commit", "-qm", "init"]);
    const deps = makeDeps();
    const result = await runReviewLoop(deps, clone, OPTIONS);
    expect(result.status).toBe("failed");
    expect(deps.notifyLog.join("\n")).toMatch(/No origin default branch detected/);
  });

  it("writes immutable pass artifacts under the git common dir", async () => {
    const { origin, clone } = makeOriginClone();
    cleanup.push(origin, clone);
    const deps = makeDeps({ reviewerOutputs: [findingJson(), JSON.stringify({ findings: [] })] });
    const result = await runReviewLoop(deps, clone, OPTIONS);
    expect(result.status).toBe("clean");
    const runDir = join(commonDirAbsolute(clone), "code-review-iteration", "feature_x", result.runId);
    expect(existsSync(join(runDir, "state.json"))).toBe(true);
    expect(existsSync(join(runDir, "passes", "01", "review.json"))).toBe(true);
    expect(existsSync(join(runDir, "passes", "01", "review.md"))).toBe(true);
    expect(existsSync(join(runDir, "passes", "01", "fixer.json"))).toBe(true);
    expect(existsSync(join(runDir, "passes", "02", "review.json"))).toBe(true);
    expect(existsSync(join(runDir, "passes", "02", "fixer.json"))).toBe(false);
    const state = JSON.parse(readFileSync(join(runDir, "state.json"), "utf-8"));
    expect(state.status).toBe("clean");
    expect(state.pass).toBe(2);
  });

  it("resumes an incomplete fixer pass instead of skipping it", async () => {
    const { origin, clone } = makeOriginClone();
    cleanup.push(origin, clone);
    const deps = makeDeps({ checksPassed: false });
    const blocked = await runReviewLoop(deps, clone, OPTIONS);
    expect(blocked.status).toBe("blocked");
    const runDir = join(commonDirAbsolute(clone), "code-review-iteration", "feature_x", blocked.runId);
    rmSync(join(runDir, "passes", "01", "fixer.json"));
    rmSync(join(runDir, "passes", "01", "fixer.md"));
    const state = JSON.parse(readFileSync(join(runDir, "state.json"), "utf-8"));
    state.status = "running";
    state.terminal = null;
    writeFileSync(join(runDir, "state.json"), JSON.stringify(state));
    const deps2 = makeDeps({ reviewerOutputs: [JSON.stringify({ findings: [] })] });
    const resumed = await runReviewLoop(deps2, clone, { ...OPTIONS, resume: true });
    expect(deps2.notifyLog.join("\n")).toMatch(/incomplete fixer/);
    expect(deps2.fixerCalls).toBe(1);
    expect(resumed.status).toBe("clean");
  });

  it("warns when an explicit fixer is catalogued below required hardness", async () => {
    const { origin, clone } = makeOriginClone();
    cleanup.push(origin, clone);
    const deps = makeDeps({
      reviewerOutputs: [findingJson(), JSON.stringify({ findings: [] })],
    });
    const result = await runReviewLoop(deps, clone, { ...OPTIONS, fixerModel: "openai-codex/gpt-5.6-luna" });
    expect(result.status).toBe("clean");
    expect(deps.notifyLog.join("\n")).toMatch(/below the required medium hardness/);
  });
});
