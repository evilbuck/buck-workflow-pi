import { describe, test } from "node:test";
import assert from "node:assert";
import {
  hasGoal,
  hasPlan,
  hasPhasesOverview,
  hasActivePhase,
  loopLimitReached,
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
  test("hasGoal returns true when goal is set", () => {
    assert.strictEqual(hasGoal(makeCtx({ goal: "build thing" })), true);
    assert.strictEqual(hasGoal(makeCtx({ goal: "" })), false);
  });

  test("hasPlan returns true when latestPlan exists", () => {
    assert.strictEqual(
      hasPlan(makeCtx({ artifacts: { latestPlan: { path: "plan.md", exists: true }, backlogItems: [], workerResults: [] } })),
      true,
    );
    assert.strictEqual(hasPlan(makeCtx()), false);
  });

  test("hasPhasesOverview returns true when phasesOverview exists", () => {
    assert.strictEqual(
      hasPhasesOverview(makeCtx({ artifacts: { phasesOverview: { path: "phases.md", exists: true }, backlogItems: [], workerResults: [] } })),
      true,
    );
    assert.strictEqual(hasPhasesOverview(makeCtx()), false);
  });

  test("hasActivePhase returns false when status is completed", () => {
    assert.strictEqual(
      hasActivePhase(makeCtx({ artifacts: { activePhase: { path: "phase.md", exists: true, status: "completed" }, backlogItems: [], workerResults: [] } })),
      false,
    );
    assert.strictEqual(
      hasActivePhase(makeCtx({ artifacts: { activePhase: { path: "phase.md", exists: true, status: "pending" }, backlogItems: [], workerResults: [] } })),
      true,
    );
  });

  test("loopLimitReached returns true at max", () => {
    assert.strictEqual(
      loopLimitReached(makeCtx({ safety: { loopCount: 50, maxLoops: 50, workerTasksThisRun: 0, maxWorkerTasksPerRun: 20 } })),
      true,
    );
    assert.strictEqual(
      loopLimitReached(makeCtx({ safety: { loopCount: 49, maxLoops: 50, workerTasksThisRun: 0, maxWorkerTasksPerRun: 20 } })),
      false,
    );
  });

  test("workerLimitReached returns true at max", () => {
    assert.strictEqual(
      workerLimitReached(makeCtx({ safety: { loopCount: 0, maxLoops: 50, workerTasksThisRun: 20, maxWorkerTasksPerRun: 20 } })),
      true,
    );
    assert.strictEqual(workerLimitReached(makeCtx()), false);
  });
});
