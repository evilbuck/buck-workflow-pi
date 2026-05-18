import { describe, it, expect } from "vitest";
import {
  countConsecutiveBlockReasons,
  countConsecutiveIssueFingerprints,
  countConsecutiveNoSourceChangeIterations,
  hasActivePhase,
  hasGoal,
  hasPhasesOverview,
  hasPlan,
  loopLimitReached,
  sourceChangedFiles,
  workerLimitReached,
} from "../guards.js";
import type { TransitionContext } from "../types.js";

function makeCtx(overrides: Partial<TransitionContext> = {}): TransitionContext {
  return {
    goal: "test",
    current: "idle",
    subject: null,
    artifacts: {
      backlogItems: [],
      workerResults: [],
      ...overrides.artifacts,
    },
    git: {
      hasDiff: false,
      changedFiles: [],
      sourceFilesChanged: false,
      contextOnlyChanged: false,
      ...overrides.git,
    },
    review: {},
    worker: { active: false, ...overrides.worker },
    safety: {
      loopCount: 0,
      maxLoops: 50,
      workerTasksThisRun: 0,
      maxWorkerTasksPerRun: 20,
      ...overrides.safety,
    },
    ...overrides,
  };
}

describe("guards", () => {
  it("hasGoal returns true when goal is set", () => {
    expect(hasGoal(makeCtx({ goal: "build thing" }))).toBe(true);
    expect(hasGoal(makeCtx({ goal: "" }))).toBe(false);
  });

  it("hasPlan returns true when latestPlan exists", () => {
    expect(
      hasPlan(makeCtx({ artifacts: { latestPlan: { path: "plan.md", exists: true }, backlogItems: [], workerResults: [] } })),
    ).toBe(true);
    expect(hasPlan(makeCtx())).toBe(false);
  });

  it("hasPhasesOverview returns true when phasesOverview exists", () => {
    expect(
      hasPhasesOverview(makeCtx({ artifacts: { phasesOverview: { path: "phases.md", exists: true }, backlogItems: [], workerResults: [] } })),
    ).toBe(true);
    expect(hasPhasesOverview(makeCtx())).toBe(false);
  });

  it("hasActivePhase returns false when status is completed", () => {
    expect(
      hasActivePhase(makeCtx({ artifacts: { activePhase: { path: "phase.md", exists: true, status: "completed" }, backlogItems: [], workerResults: [] } })),
    ).toBe(false);
    expect(
      hasActivePhase(makeCtx({ artifacts: { activePhase: { path: "phase.md", exists: true, status: "pending" }, backlogItems: [], workerResults: [] } })),
    ).toBe(true);
  });

  it("loopLimitReached returns true at max", () => {
    expect(
      loopLimitReached(makeCtx({ safety: { loopCount: 50, maxLoops: 50, workerTasksThisRun: 0, maxWorkerTasksPerRun: 20 } })),
    ).toBe(true);
    expect(
      loopLimitReached(makeCtx({ safety: { loopCount: 49, maxLoops: 50, workerTasksThisRun: 0, maxWorkerTasksPerRun: 20 } })),
    ).toBe(false);
  });

  it("workerLimitReached returns true at max", () => {
    expect(
      workerLimitReached(makeCtx({ safety: { loopCount: 0, maxLoops: 50, workerTasksThisRun: 20, maxWorkerTasksPerRun: 20 } })),
    ).toBe(true);
    expect(workerLimitReached(makeCtx())).toBe(false);
  });

  it("sourceChangedFiles ignores .context and docs paths", () => {
    expect(sourceChangedFiles([".context/a.md", "docs/readme.md", "src/app.ts"])).toEqual(["src/app.ts"]);
  });

  it("counts consecutive issue fingerprints from the tail", () => {
    expect(countConsecutiveIssueFingerprints([
      { iteration: 1, startedAt: "a", status: "completed", issueFingerprint: "x" },
      { iteration: 2, startedAt: "b", status: "completed", issueFingerprint: "x" },
      { iteration: 3, startedAt: "c", status: "completed", issueFingerprint: "x" },
    ], "x")).toBe(3);
    expect(countConsecutiveIssueFingerprints([
      { iteration: 1, startedAt: "a", status: "completed", issueFingerprint: "x" },
      { iteration: 2, startedAt: "b", status: "completed", issueFingerprint: "y" },
    ], "x")).toBe(0);
  });

  it("counts consecutive no-source-change iterations only when changedFiles are known", () => {
    expect(countConsecutiveNoSourceChangeIterations([
      { iteration: 1, startedAt: "a", completedAt: "a", status: "completed", changedFiles: [] },
      { iteration: 2, startedAt: "b", completedAt: "b", status: "completed", changedFiles: [] },
    ])).toBe(2);
    expect(countConsecutiveNoSourceChangeIterations([
      { iteration: 1, startedAt: "a", completedAt: "a", status: "completed" },
      { iteration: 2, startedAt: "b", completedAt: "b", status: "completed", changedFiles: [] },
    ])).toBe(1);
  });

  it("counts consecutive repeated block reasons from the tail", () => {
    expect(countConsecutiveBlockReasons(["a", "b", "b"], "b")).toBe(2);
    expect(countConsecutiveBlockReasons(["a", "b", "c"], "b")).toBe(0);
  });
});
