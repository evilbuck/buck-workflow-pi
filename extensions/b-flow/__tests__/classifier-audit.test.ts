import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { rmSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { evaluateModelGuard, type ClassifierAudit } from "../classifier.js";
import type { TransitionContext } from "../types.js";

const TEST_ROOT = join("/tmp", "bflow-classifier-audit-test-" + Date.now());

function setup() {
  mkdirSync(TEST_ROOT, { recursive: true });
  // Change to test directory so audit files are written there
  process.chdir(TEST_ROOT);
}

function cleanup() {
  try {
    process.chdir("/");
    rmSync(TEST_ROOT, { recursive: true });
  } catch { /* ignore */ }
}

beforeEach(() => setup());
afterEach(() => cleanup());

function createMockTransitionContext(overrides: Partial<TransitionContext> = {}): TransitionContext {
  return {
    goal: "Test goal",
    current: "planning",
    subject: "2026-05-30.test",
    artifacts: {
      latestPlan: undefined,
      phasesOverview: undefined,
      activePhase: undefined,
      tasksMd: undefined,
      activeIterate: undefined,
      memoryFile: undefined,
      backlogItems: [],
      workerResults: [],
    },
    git: {
      hasDiff: false,
      changedFiles: [],
      sourceFilesChanged: false,
      contextOnlyChanged: false,
    },
    review: {},
    worker: {
      active: false,
    },
    safety: {
      loopCount: 0,
      maxLoops: 100,
      workerTasksThisRun: 0,
      maxWorkerTasksPerRun: 50,
    },
    ...overrides,
  } as TransitionContext;
}

describe("classifier audit", () => {
  it("returns a result with action, confidence, reason, and evidence", () => {
    const ctx = createMockTransitionContext();
    const result = evaluateModelGuard(TEST_ROOT, ctx);

    expect(result).toHaveProperty("action");
    expect(result).toHaveProperty("confidence");
    expect(result).toHaveProperty("reason");
    expect(result).toHaveProperty("evidence");
    expect(Array.isArray(result.evidence)).toBe(true);
  });

  it("writes audit file when subject is provided", () => {
    const ctx = createMockTransitionContext();
    evaluateModelGuard(TEST_ROOT, ctx);

    const auditDir = join(TEST_ROOT, ".context", "2026-05-30.test", "transition-audits");
    expect(existsSync(auditDir)).toBe(true);

    const files = require("fs").readdirSync(auditDir);
    expect(files.length).toBeGreaterThan(0);

    const auditFile = join(auditDir, files[0]);
    const audit: ClassifierAudit = JSON.parse(readFileSync(auditFile, "utf-8"));

    expect(audit).toHaveProperty("id");
    expect(audit).toHaveProperty("timestamp");
    expect(audit).toHaveProperty("goal");
    expect(audit.goal).toBe("Test goal");
    expect(audit).toHaveProperty("currentState");
    expect(audit).toHaveProperty("subject");
    expect(audit).toHaveProperty("context");
    expect(audit).toHaveProperty("decision");
  });

  it("does not write audit file when subject is null", () => {
    const ctx = createMockTransitionContext({ subject: null });
    evaluateModelGuard(TEST_ROOT, ctx);

    const auditDir = join(TEST_ROOT, ".context", "transition-audits");
    expect(existsSync(auditDir)).toBe(false);
  });

  it("includes context snapshot in audit", () => {
    const ctx = createMockTransitionContext({
      artifacts: {
        latestPlan: { path: "/path/to/plan.md", exists: true },
        phasesOverview: undefined,
        activePhase: undefined,
        tasksMd: undefined,
        activeIterate: undefined,
        memoryFile: undefined,
        backlogItems: [],
        workerResults: [],
      },
    });
    evaluateModelGuard(TEST_ROOT, ctx);
    const auditDir = join(TEST_ROOT, ".context", "2026-05-30.test", "transition-audits");
    const files = require("fs").readdirSync(auditDir);
    const audit: ClassifierAudit = JSON.parse(
      readFileSync(join(auditDir, files[0]), "utf-8"),
    );
    expect(audit.context.hasPlan).toBe(true);
  });

  it("includes decision in audit", () => {
    const ctx = createMockTransitionContext();
    evaluateModelGuard(TEST_ROOT, ctx);

    const auditDir = join(TEST_ROOT, ".context", "2026-05-30.test", "transition-audits");
    const files = require("fs").readdirSync(auditDir);
    const audit: ClassifierAudit = JSON.parse(
      readFileSync(join(auditDir, files[0]), "utf-8"),
    );

    expect(audit.decision).toHaveProperty("action");
    expect(audit.decision).toHaveProperty("confidence");
    expect(audit.decision).toHaveProperty("reason");
    expect(audit.decision).toHaveProperty("evidence");
  });

  it("routes to b-plan when no plan exists", () => {
    const ctx = createMockTransitionContext();
    const result = evaluateModelGuard(TEST_ROOT, ctx);

    expect(result.action).toEqual({
      type: "run-command",
      command: "b-plan",
      prompt: expect.stringContaining("Create a plan"),
    });
  });

  it("routes to b-phase when plan exists but no phases overview", () => {
    const ctx = createMockTransitionContext({
      artifacts: {
        latestPlan: { path: "/path/to/plan.md", exists: true },
        phasesOverview: undefined,
        activePhase: undefined,
        tasksMd: undefined,
        activeIterate: undefined,
        memoryFile: undefined,
        backlogItems: [],
        workerResults: [],
      },
    });
    const result = evaluateModelGuard(TEST_ROOT, ctx);
    expect(result.action).toEqual({
      type: "run-command",
      command: "b-phase",
      prompt: expect.stringContaining("Break plan into phases"),
    });
  });
  it("routes to mark-done when all phases completed", () => {
    const ctx = createMockTransitionContext({
      artifacts: {
        latestPlan: { path: "/path/to/plan.md", exists: true },
        phasesOverview: { path: "/path/to/phases.md", exists: true },
        activePhase: { path: "/path/to/phase.md", exists: true, status: "completed" },
        tasksMd: undefined,
        activeIterate: undefined,
        memoryFile: undefined,
        backlogItems: [],
        workerResults: [],
      },
    });
    const result = evaluateModelGuard(TEST_ROOT, ctx);
    expect(result.action).toEqual({ type: "mark-done", reason: "All work completed" });
  });
  it("routes to block when worker is active", () => {
    const ctx = createMockTransitionContext({
      worker: { active: true },
      artifacts: {
        latestPlan: { path: "/path/to/plan.md", exists: true },
        phasesOverview: { path: "/path/to/phases.md", exists: true },
        activePhase: { path: "/path/to/phase.md", exists: true, status: "pending" },
        tasksMd: undefined,
        activeIterate: undefined,
        memoryFile: undefined,
        backlogItems: [],
        workerResults: [],
      },
    });
    const result = evaluateModelGuard(TEST_ROOT, ctx);
    expect(result.action.type).toBe("block");
    expect((result.action as { reason: string }).reason).toContain("active worker");
  });
  it("routes to spawn-worker when phase is ready", () => {
    const ctx = createMockTransitionContext({
      artifacts: {
        latestPlan: { path: "/path/to/plan.md", exists: true },
        phasesOverview: { path: "/path/to/phases.md", exists: true },
        activePhase: { path: "/path/to/phase.md", exists: true, status: "pending" },
        tasksMd: undefined,
        activeIterate: undefined,
        memoryFile: undefined,
        backlogItems: [],
        workerResults: [],
      },
    });
    const result = evaluateModelGuard(TEST_ROOT, ctx);
    expect(result.action.type).toBe("spawn-worker");
    const action = result.action as { state: string; mode: string };
    expect(action.state).toBe("planning");
    expect(action.mode).toBe("build");
  });
});