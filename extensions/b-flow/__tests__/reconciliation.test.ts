import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { rmSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { reconcileProjection, type ReconciliationResult } from "../reconciliation.js";
import type { OrchestrationState, TransitionContext } from "../types.js";

const TEST_ROOT = join("/tmp", "bflow-reconciliation-test-" + Date.now());

function setup() {
  mkdirSync(TEST_ROOT, { recursive: true });
}

function cleanup() {
  try {
    rmSync(TEST_ROOT, { recursive: true });
  } catch { /* ignore */ }
}

beforeEach(() => setup());
afterEach(() => cleanup());

function createMockProjection(overrides: Partial<OrchestrationState> = {}): OrchestrationState {
  return {
    version: 1,
    goal: "Test goal",
    currentState: "planning",
    subject: "2026-05-30.test",
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    history: [],
    queue: [],
    workerAttemptCount: 0,
    ...overrides,
  };
}

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

describe("reconciliation", () => {
  describe("reconcileProjection", () => {
    it("returns ok when no conflicts exist", () => {
      const projection = createMockProjection();
      const ctx = createMockTransitionContext();

      const result = reconcileProjection(projection, ctx);

      expect(result.type).toBe("ok");
      expect(result.conflicts).toHaveLength(0);
    });

    it("detects queue item status conflicts", () => {
      const subjectDir = join(TEST_ROOT, ".context", "2026-05-30.test");
      mkdirSync(subjectDir, { recursive: true });

      const phasePath = join(subjectDir, "phase-1-test.md");
      writeFileSync(phasePath, [
        "---",
        "status: completed",
        "---",
        "",
        "# Phase 1",
      ].join("\n"));

      const projection = createMockProjection({
        queue: [
          {
            id: "phase-1-test",
            type: "phase",
            path: phasePath,
            status: "pending",
            workerAttempts: 0,
          },
        ],
      });

      const ctx = createMockTransitionContext({
        artifacts: {
          latestPlan: undefined,
          phasesOverview: undefined,
          activePhase: { path: phasePath, exists: true, status: "completed" },
          tasksMd: undefined,
          activeIterate: undefined,
          memoryFile: undefined,
          backlogItems: [],
          workerResults: [],
        },
      });

      const result = reconcileProjection(projection, ctx);

      expect(result.type).toBe("conflict");
      expect(result.conflicts).toContainEqual(
        expect.objectContaining({
          field: "queue.phase-1-test.status",
          snapshotValue: "pending",
          diskValue: "completed",
          resolution: "use_disk",
        }),
      );
    });

    it("blocks on unsafe subject mismatch", () => {
      const projection = createMockProjection({
        subject: "2026-05-30.old-subject",
      });

      const ctx = createMockTransitionContext({
        subject: "2026-05-30.new-subject",
      });

      const result = reconcileProjection(projection, ctx);

      expect(result.type).toBe("unsafe");
      expect(result.blocked).toBeDefined();
      expect(result.blocked?.reason).toContain("subject");
    });

    it("allows safe phase completion to advance machine state", () => {
      const projection = createMockProjection({
        currentState: "executingChunks",
      });

      const ctx = createMockTransitionContext({
        current: "executingChunks",
        artifacts: {
          latestPlan: undefined,
          phasesOverview: undefined,
          activePhase: { path: "/path/to/phase.md", exists: true, status: "completed" },
          tasksMd: undefined,
          activeIterate: undefined,
          memoryFile: undefined,
          backlogItems: [],
          workerResults: [],
        },
      });

      const result = reconcileProjection(projection, ctx);

      expect(result.conflicts).toContainEqual(
        expect.objectContaining({
          field: "currentState",
          severity: "safe",
        }),
      );
    });

    it("updates projection with disk truth for queue items", () => {
      const subjectDir = join(TEST_ROOT, ".context", "2026-05-30.test");
      mkdirSync(subjectDir, { recursive: true });

      const phasePath = join(subjectDir, "phase-1-test.md");
      writeFileSync(phasePath, [
        "---",
        "status: completed",
        "---",
        "",
        "# Phase 1",
      ].join("\n"));

      const projection = createMockProjection({
        queue: [
          {
            id: "phase-1-test",
            type: "phase",
            path: phasePath,
            status: "pending",
            workerAttempts: 0,
          },
        ],
      });

      const ctx = createMockTransitionContext();

      const result = reconcileProjection(projection, ctx);

      expect(result.projection.queue[0].status).toBe("completed");
    });
  });
});
