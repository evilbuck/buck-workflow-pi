import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync, spawn } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  discoverPlanAndPhases,
  parseAcceptanceCriteria,
  parseArgs,
  parseFrontmatter,
  readPhaseFile,
  readStatusSnapshot,
  runBuckLoop,
  writeStatusSnapshot,
  PROJECTION_PATH,
  type EvalBridges,
} from "./eval-buck-loop.js";

const tempDirs: string[] = [];

function createTempProject(): string {
  const dir = mkdtempSync(join(tmpdir(), "buck-loop-test-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
});

function setupSampleSubject(cwd: string) {
  const subjectDir = join(cwd, ".context", "2026-11-17.test-feature");
  mkdirSync(subjectDir, { recursive: true });

  writeFileSync(
    join(subjectDir, "index.md"),
    `---
status: active
subject: 2026-11-17.test-feature
---
# Test Feature
`,
  );

  writeFileSync(
    join(subjectDir, "plan-test-phases.md"),
    `---
status: active
phases: 2
---
# Plan Overview
`,
  );

  writeFileSync(
    join(subjectDir, "phase-1-first-step.md"),
    `---
status: pending
phase: 1
order: 1
difficulty: easy
files:
  - src/first.ts
acceptance_criteria:
  - "[ ] first criterion"
---
# Phase 1
`,
  );

  writeFileSync(
    join(subjectDir, "phase-2-second-step.md"),
    `---
status: pending
phase: 2
order: 2
difficulty: hard
files:
  - src/second.ts
acceptance_criteria:
  - "[ ] second criterion"
---
# Phase 2
`,
  );

  return subjectDir;
}

describe("eval-buck-loop parsing helpers", () => {
  it("parses CLI flags and targets correctly", () => {
    expect(parseArgs("")).toEqual({ target: undefined, statusOnly: false, resume: false, stop: false });
    expect(parseArgs("--status")).toEqual({ target: undefined, statusOnly: true, resume: false, stop: false });
    expect(parseArgs("--stop")).toEqual({ target: undefined, statusOnly: false, resume: false, stop: true });
    expect(parseArgs("--resume")).toEqual({ target: undefined, statusOnly: false, resume: true, stop: false });
    expect(parseArgs("phase-1 --resume")).toEqual({ target: "phase-1", statusOnly: false, resume: true, stop: false });
    expect(parseArgs(".context/2026-11-17.test/")).toEqual({ target: ".context/2026-11-17.test/", statusOnly: false, resume: false, stop: false });
  });

  it("parses YAML frontmatter without bare npm specifiers", () => {
    const content = `---
title: "Sample Task"
status: active
difficulty: hard
files:
  - src/index.ts
  - src/utils.ts
---
# Markdown body
`;
    const fm = parseFrontmatter(content);
    expect(fm.title).toBe("Sample Task");
    expect(fm.status).toBe("active");
    expect(fm.difficulty).toBe("hard");
    expect(fm.files).toEqual(["src/index.ts", "src/utils.ts"]);
  });

  it("parses acceptance criteria checkbox states accurately", () => {
    const content = `---
acceptance_criteria:
  - "[x] already completed criterion"
  - "[ ] pending criterion"
  - "[X] uppercase completed criterion"
---
`;
    const result = parseAcceptanceCriteria(content);
    expect(result.total).toBe(3);
    expect(result.checked).toBe(2);
    expect(result.items).toHaveLength(3);
  });
});

describe("plan and phase discovery (Assumption A-3)", () => {
  it("discovers active subject, plan, and ordered phases without scan.ts", () => {
    const cwd = createTempProject();
    setupSampleSubject(cwd);

    const planInfo = discoverPlanAndPhases(cwd);
    expect(planInfo).not.toBeNull();
    expect(planInfo?.subjectDir).toContain("2026-11-17.test-feature");
    expect(planInfo?.phases).toHaveLength(2);
    expect(planInfo?.phases[0].phaseNum).toBe(1);
    expect(planInfo?.phases[0].slug).toBe("phase-1-first-step");
    expect(planInfo?.phases[0].difficulty).toBe("easy");
    expect(planInfo?.phases[1].phaseNum).toBe(2);
    expect(planInfo?.phases[1].difficulty).toBe("hard");
    expect(planInfo?.status).toBe("active");
  });
});

describe("status snapshot persistence", () => {
  it("writes and reads back status snapshot correctly", () => {
    const cwd = createTempProject();
    const snapshot: any = {
      state: "building",
      subject: "demo-subject",
      planPath: "plan.md",
      phasePath: "phase-1.md",
      loopCount: 2,
      maxLoops: 12,
      iterateCyclesOnPhase: 1,
      lastChoice: null,
      history: [{ from: "resolving", to: "building", effect: { kind: "none" }, why: "start" }],
    };

    writeStatusSnapshot(cwd, snapshot);
    expect(existsSync(join(cwd, PROJECTION_PATH))).toBe(true);

    const read = readStatusSnapshot(cwd);
    expect(read).not.toBeNull();
    expect(read?.state).toBe("building");
    expect(read?.subject).toBe("demo-subject");
    expect(read?.loopCount).toBe(2);
  });
});

describe("runBuckLoop execution and bridge orchestration", () => {
  it("executes happy path through building, reviewing, saving, committing, and closeout", async () => {
    const cwd = createTempProject();
    const subjectDir = setupSampleSubject(cwd);

    const agentCalls: Array<{ prompt: string; label?: string }> = [];
    const waitCalls: any[] = [];
    const judgeCalls: any[] = [];
    const phaseCalls: string[] = [];
    const logCalls: string[] = [];
    const shCalls: string[] = [];

    const mockBridges: EvalBridges = {
      agent: vi.fn(async (prompt: string, options?: any) => {
        agentCalls.push({ prompt, label: options?.label });
        return { ok: true, wait: async () => ({ ok: true }) };
      }),
      wait: vi.fn(async (handles: any[]) => {
        waitCalls.push(handles);
        return { ok: true };
      }),
      judge: vi.fn(async (state: any, questions: any[]) => {
        judgeCalls.push({ state, questions });
        return { ok: true, bool: true, choice: "advance" };
      }),
      judgeBatch: vi.fn(async (items: any[]) => {
        return items.map(() => ({ impact: 0, confidence: 4, effort: 1 }));
      }),
      phase: vi.fn((title: string) => {
        phaseCalls.push(title);
      }),
      log: vi.fn((message: string) => {
        logCalls.push(message);
      }),
      sh: vi.fn(async (cmd: any) => {
        shCalls.push(String(cmd));
        return { stdout: "", stderr: "", exitCode: 0 };
      }),
      budget: {
        remaining: vi.fn(async () => 500_000),
      },
    };

    const result = await runBuckLoop({ cwd, bridges: mockBridges });

    expect(result.ok).toBe(true);
    expect(result.state).toBe("done");

    // Phase 1 difficulty was easy -> b-build; Phase 2 difficulty was hard -> b-build-hard
    const labels = agentCalls.map(c => c.label);
    expect(labels).toContain("b-build-phase-1-first-step");
    expect(labels).toContain("b-review-phase-1-first-step");
    expect(labels).toContain("b-save-phase-1-first-step");
    expect(labels).toContain("b-commit-phase-1-first-step");

    expect(labels).toContain("b-build-hard-phase-2-second-step");
    expect(labels).toContain("b-review-phase-2-second-step");
    expect(labels).toContain("b-save-phase-2-second-step");
    expect(labels).toContain("b-commit-phase-2-second-step");

    // Verified judgments were evaluated
    expect(judgeCalls.length).toBeGreaterThan(0);

    // Verified scoped git staging and subject-lifecycle closeout were invoked via sh
    expect(shCalls.some(cmd => cmd.includes("git add .context/"))).toBe(true);
    expect(shCalls.some(cmd => cmd.includes("subject-lifecycle.ts close-verified"))).toBe(true);

    // Verified TUI updates were emitted
    expect(phaseCalls.length).toBeGreaterThan(0);
    expect(logCalls.length).toBeGreaterThan(0);
  });

  it("handles review findings by triggering ranking and iteration loop", async () => {
    const cwd = createTempProject();
    const subjectDir = setupSampleSubject(cwd);

    // Simulate an iterate finding file present in subject directory
    writeFileSync(join(subjectDir, "iterate-phase-1-first-step-findings.md"), "# Findings\n- Issue 1");

    const agentCalls: Array<{ prompt: string; label?: string }> = [];
    const judgeBatchCalls: any[] = [];

    const mockBridges: EvalBridges = {
      agent: vi.fn(async (prompt: string, options?: any) => {
        agentCalls.push({ prompt, label: options?.label });
        // Clean up findings file after iteration to avoid infinite loop
        if (options?.label?.startsWith("b-iterate")) {
          try {
            rmSync(join(subjectDir, "iterate-phase-1-first-step-findings.md"));
          } catch {}
        }
        return { ok: true, wait: async () => ({ ok: true }) };
      }),
      wait: vi.fn(async () => ({ ok: true })),
      judge: vi.fn(async () => ({ ok: true, bool: true })),
      judgeBatch: vi.fn(async (items: any[]) => {
        judgeBatchCalls.push(items);
        return items.map(() => ({ impact: 3, confidence: 4, effort: 2 }));
      }),
      phase: vi.fn(),
      log: vi.fn(),
      sh: vi.fn(async () => ({ stdout: "", stderr: "", exitCode: 0 })),
      budget: { remaining: async () => 100_000 },
    };

    const result = await runBuckLoop({ cwd, bridges: mockBridges });
    expect(result.ok).toBe(true);

    const labels = agentCalls.map(c => c.label);
    expect(labels).toContain("b-iterate-phase-1-first-step");
    expect(judgeBatchCalls.length).toBeGreaterThan(0);
  });

  it("handles --status flag by reading existing snapshot", async () => {
    const cwd = createTempProject();
    setupSampleSubject(cwd);
    writeStatusSnapshot(cwd, {
      state: "building",
      subject: "test-feature",
      planPath: "plan.md",
      phasePath: "phase-1.md",
      loopCount: 3,
      maxLoops: 12,
      iterateCyclesOnPhase: 0,
      lastChoice: null,
      history: [],
    } as any);

    const logCalls: string[] = [];
    const result = await runBuckLoop({
      cwd,
      args: "--status",
      bridges: { log: (m) => logCalls.push(m) },
    });

    expect(result.ok).toBe(true);
    expect(result.state).toBe("building");
    expect(logCalls.some(m => m.includes("state=building"))).toBe(true);
  });

  it("handles --stop flag by marking loop aborted", async () => {
    const cwd = createTempProject();
    setupSampleSubject(cwd);
    writeStatusSnapshot(cwd, {
      state: "building",
      subject: "test-feature",
      planPath: "plan.md",
      phasePath: "phase-1.md",
      loopCount: 3,
      maxLoops: 12,
      iterateCyclesOnPhase: 0,
      lastChoice: null,
      history: [],
    } as any);

    const result = await runBuckLoop({
      cwd,
      args: "--stop",
      bridges: { log: vi.fn() },
    });

    expect(result.ok).toBe(true);
    expect(result.state).toBe("aborted");

    const read = readStatusSnapshot(cwd);
    expect(read?.state).toBe("aborted");
  });

  it("blocks when budget is exhausted", async () => {
    const cwd = createTempProject();
    setupSampleSubject(cwd);

    const result = await runBuckLoop({
      cwd,
      bridges: {
        budget: { remaining: async () => 0 },
        log: vi.fn(),
        phase: vi.fn(),
      },
    });

    expect(result.ok).toBe(false);
    expect(result.state).toBe("blocked");
    expect(result.message).toContain("Budget exhausted");
  });
});

describe("omp __omp_worker_js_eval_process smoke test", () => {
  it("loads and links eval-buck-loop.ts with zero bare-specifier resolution errors", async () => {
    // Check if omp binary is present
    let hasOmp = false;
    try {
      execSync("which omp", { stdio: "ignore" });
      hasOmp = true;
    } catch {
      hasOmp = false;
    }

    if (!hasOmp) {
      console.log("omp binary not found on PATH; skipping live worker smoke test");
      return;
    }

    // Run Bun smoke test against omp __omp_worker_js_eval_process
    const smokeScript = `
const proc = Bun.spawn({
  cmd: ["omp", "__omp_worker_js_eval_process"],
  ipc(msg) {
    if (msg.type === "result") {
      if (msg.ok) {
        process.stdout.write("LINK_OK\\n");
      } else {
        process.stderr.write("LINK_FAIL: " + JSON.stringify(msg.error) + "\\n");
      }
      proc.kill();
      process.exit(msg.ok ? 0 : 1);
    }
  },
  serialization: "advanced"
});

proc.send({ type: "init", snapshot: { cwd: process.cwd(), sessionId: "smoke-test" } });

setTimeout(() => {
  proc.send({
    type: "run",
    runId: "smoke-1",
    code: 'import { parseFrontmatter, parseAcceptanceCriteria } from "./skills/b-loop/scripts/eval-buck-loop.ts"; 42',
    filename: "smoke.ts",
    snapshot: { cwd: process.cwd(), sessionId: "smoke-test" }
  });
}, 200);

setTimeout(() => {
  proc.kill();
  process.exit(1);
}, 5000);
`;

    const out = execSync(`bun -e '${smokeScript.replace(/'/g, "'\\''")}'`, {
      encoding: "utf8",
      timeout: 10_000,
    });

    expect(out).toContain("LINK_OK");
  });
});
