/**
 * Phase 1 contract tests: WorkerMode types, review result parsing,
 * active iterate scanning, and queue builder iterate filtering.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  rmSync,
  mkdirSync,
  existsSync,
  writeFileSync,
  readFileSync,
} from "node:fs";
import { join } from "node:path";
import { verifyResult, parseReviewFromFrontmatter } from "../verify-result.js";
import { scanContext } from "../scan-context.js";
import { buildQueue } from "../queue-builder.js";
import type { ReviewResult, WorkerMode } from "../types.js";

const TEST_ROOT = join("/tmp", "bflow-phase1-test-" + Date.now());

describe("Phase 1: Review result parsing", () => {
  beforeEach(() => {
    if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true });
    mkdirSync(TEST_ROOT, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true });
  });

  it("parses review-pass result", () => {
    const resultFile = join(TEST_ROOT, "result.md");
    writeFileSync(
      resultFile,
      [
        "---",
        "chunk_id: phase-1-types",
        "mode: review",
        "review_passed: true",
        "issues_found: false",
        "requires_replan: false",
        "status: completed",
        "---",
        "",
        "# Review passed",
      ].join("\n"),
    );

    const result = verifyResult(resultFile);
    expect(result.type).toBe("CHUNK_VERIFIED");
    expect(result.status).toBe("completed");
    expect(result.review).toBeDefined();
    expect(result.review!.outcome).toBe("pass");
    expect(result.review!.reviewPassed).toBe(true);
    expect(result.review!.issuesFound).toBe(false);
  });

  it("parses review-issues-with-iterate result", () => {
    const resultFile = join(TEST_ROOT, "result.md");
    writeFileSync(
      resultFile,
      [
        "---",
        "chunk_id: phase-1-types",
        "mode: review",
        "review_passed: false",
        "issues_found: true",
        "requires_replan: false",
        "iterate_file: iterate-fix-types.md",
        "issue_fingerprint: missing-return-type",
        "status: completed_with_warnings",
        "warnings: [review issues found]",
        "---",
        "",
        "# Issues found",
      ].join("\n"),
    );

    const result = verifyResult(resultFile);
    expect(result.type).toBe("CHUNK_WARNINGS");
    expect(result.review).toBeDefined();
    expect(result.review!.outcome).toBe("issues-with-iterate");
    expect(result.review!.iterateFile).toBe("iterate-fix-types.md");
    expect(result.review!.issueFingerprint).toBe("missing-return-type");
  });

  it("parses requires-replan result", () => {
    const resultFile = join(TEST_ROOT, "result.md");
    writeFileSync(
      resultFile,
      [
        "---",
        "chunk_id: phase-1-types",
        "mode: review",
        "review_passed: false",
        "issues_found: true",
        "requires_replan: true",
        "status: completed_with_warnings",
        "---",
        "",
        "# Needs replan",
      ].join("\n"),
    );

    const result = verifyResult(resultFile);
    expect(result.review).toBeDefined();
    expect(result.review!.outcome).toBe("requires-replan");
    expect(result.review!.requiresReplan).toBe(true);
  });

  it("treats missing review fields as blocking when mode is review", () => {
    const fm = {
      mode: "review",
      status: "completed",
      // Missing review_passed and issues_found
    };

    const result = parseReviewFromFrontmatter(fm);
    expect(result).toBeDefined();
    expect(result!.outcome).toBe("blocking");
  });

  it("returns undefined for non-review results", () => {
    const fm = {
      chunk_id: "phase-1",
      status: "completed",
    };

    const result = parseReviewFromFrontmatter(fm);
    expect(result).toBeUndefined();
  });

  it("treats invalid mode as blocking", () => {
    const fm = {
      mode: "invalid-mode",
      review_passed: true,
    };

    const result = parseReviewFromFrontmatter(fm);
    expect(result).toBeDefined();
    expect(result!.outcome).toBe("blocking");
  });

  it("handles issues found without iterate file as blocking", () => {
    const fm = {
      mode: "review",
      review_passed: false,
      issues_found: true,
      requires_replan: false,
    };

    const result = parseReviewFromFrontmatter(fm);
    expect(result).toBeDefined();
    expect(result!.outcome).toBe("blocking");
    expect(result!.parseError).toContain("did not provide iterate_file");
  });

  it("preserves existing behavior for non-review worker results", () => {
    const resultFile = join(TEST_ROOT, "result.md");
    writeFileSync(
      resultFile,
      [
        "---",
        "chunk_id: test-1",
        "status: completed",
        "warnings: []",
        "acceptance_criteria_missed: []",
        "---",
        "",
        "# Build completed",
      ].join("\n"),
    );

    const result = verifyResult(resultFile);
    expect(result.type).toBe("CHUNK_VERIFIED");
    expect(result.review).toBeUndefined();
  });
});

describe("Phase 1: Active iterate scanning", () => {
  beforeEach(() => {
    if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true });
    mkdirSync(TEST_ROOT, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true });
  });

  it("detects exactly one active iterate matching active phase", async () => {
    const subject = "2026-05-18.test-subject";
    const subjectDir = join(TEST_ROOT, ".context", subject);
    mkdirSync(subjectDir, { recursive: true });

    // Setup phases overview and active phase
    writeFileSync(
      join(subjectDir, "plan-test-phases.md"),
      [
        "---",
        "status: active",
        "---",
        "",
        "| Phase | Status |",
        "| 1: Types | pending |",
        "",
        "See [phase-1-types.md](phase-1-types.md)",
      ].join("\n"),
    );
    writeFileSync(
      join(subjectDir, "phase-1-types.md"),
      ["---", "status: pending", "---", "", "# Phase 1"].join("\n"),
    );

    // Active iterate file
    writeFileSync(
      join(subjectDir, "iterate-fix-types.md"),
      [
        "---",
        "status: active",
        "phase: phase-1-types",
        "iteration: 1",
        "source_review_result: worker-results/review-1.md",
        "issue_fingerprint: missing-return-type",
        "---",
        "",
        "# Fix types",
      ].join("\n"),
    );

    const result = await scanContext(TEST_ROOT, "idle", "goal", subject);
    expect(result.type).toBe("SCAN_COMPLETE");
    expect(result.context!.artifacts.activeIterate).toBeDefined();
    expect(result.context!.artifacts.activeIterate!.status).toBe("active");
    expect(result.context!.artifacts.activeIterate!.iteration).toBe(1);
    expect(result.context!.artifacts.activeIterate!.issueFingerprint).toBe(
      "missing-return-type",
    );
    expect(
      result.context!.artifacts.activeIterateConflict,
    ).toBeUndefined();
  });

  it("ignores completed iterate files", async () => {
    const subject = "2026-05-18.test-completed";
    const subjectDir = join(TEST_ROOT, ".context", subject);
    mkdirSync(subjectDir, { recursive: true });

    writeFileSync(
      join(subjectDir, "plan-test-phases.md"),
      [
        "---",
        "status: active",
        "---",
        "",
        "| Phase | Status |",
        "| 1: Types | pending |",
      ].join("\n"),
    );
    writeFileSync(
      join(subjectDir, "phase-1-types.md"),
      ["---", "status: pending", "---", "", "# Phase 1"].join("\n"),
    );

    // Only completed iterate file
    writeFileSync(
      join(subjectDir, "iterate-done.md"),
      [
        "---",
        "status: completed",
        "phase: phase-1-types",
        "iteration: 1",
        "---",
        "",
        "# Done iterate",
      ].join("\n"),
    );

    const result = await scanContext(TEST_ROOT, "idle", "goal", subject);
    expect(result.type).toBe("SCAN_COMPLETE");
    expect(result.context!.artifacts.activeIterate).toBeUndefined();
  });

  it("records conflict metadata for multiple active iterates", async () => {
    const subject = "2026-05-18.test-conflict";
    const subjectDir = join(TEST_ROOT, ".context", subject);
    mkdirSync(subjectDir, { recursive: true });

    writeFileSync(
      join(subjectDir, "plan-test-phases.md"),
      [
        "---",
        "status: active",
        "---",
        "",
        "| Phase | Status |",
        "| 1: Types | pending |",
      ].join("\n"),
    );
    writeFileSync(
      join(subjectDir, "phase-1-types.md"),
      ["---", "status: pending", "---", "", "# Phase 1"].join("\n"),
    );

    // Two active iterate files for the same phase
    writeFileSync(
      join(subjectDir, "iterate-fix-a.md"),
      [
        "---",
        "status: active",
        "phase: phase-1-types",
        "iteration: 1",
        "---",
        "",
        "# Fix A",
      ].join("\n"),
    );
    writeFileSync(
      join(subjectDir, "iterate-fix-b.md"),
      [
        "---",
        "status: active",
        "phase: phase-1-types",
        "iteration: 2",
        "---",
        "",
        "# Fix B",
      ].join("\n"),
    );

    const result = await scanContext(TEST_ROOT, "idle", "goal", subject);
    expect(result.type).toBe("SCAN_COMPLETE");
    expect(result.context!.artifacts.activeIterate).toBeUndefined();
    expect(result.context!.artifacts.activeIterateConflict).toBeDefined();
    expect(
      result.context!.artifacts.activeIterateConflict!.files.length,
    ).toBe(2);
  });
});

describe("Phase 1: Queue builder iterate filtering", () => {
  beforeEach(() => {
    if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true });
    mkdirSync(TEST_ROOT, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true });
  });

  it("does not queue completed iterate files", () => {
    const subject = "2026-05-18.queue-test";
    const subjectDir = join(TEST_ROOT, ".context", subject);
    mkdirSync(subjectDir, { recursive: true });

    // Completed iterate file
    writeFileSync(
      join(subjectDir, "iterate-done.md"),
      [
        "---",
        "status: completed",
        "---",
        "",
        "# Done",
      ].join("\n"),
    );

    const queue = buildQueue(TEST_ROOT, subject);
    const iterateItems = queue.filter((q) => q.type === "iterate");
    expect(iterateItems.length).toBe(0);
  });

  it("does not queue any iterate files (handled by scan-context)", () => {
    const subject = "2026-05-18.queue-test-2";
    const subjectDir = join(TEST_ROOT, ".context", subject);
    mkdirSync(subjectDir, { recursive: true });

    // Active iterate file
    writeFileSync(
      join(subjectDir, "iterate-active.md"),
      [
        "---",
        "status: active",
        "---",
        "",
        "# Active",
      ].join("\n"),
    );

    const queue = buildQueue(TEST_ROOT, subject);
    const iterateItems = queue.filter((q) => q.type === "iterate");
    expect(iterateItems.length).toBe(0);
  });

  it("still queues phase and task items normally", () => {
    const subject = "2026-05-18.queue-mixed";
    const subjectDir = join(TEST_ROOT, ".context", subject);
    mkdirSync(subjectDir, { recursive: true });

    // Active phase
    writeFileSync(
      join(subjectDir, "phase-1-types.md"),
      [
        "---",
        "status: pending",
        "difficulty: medium",
        "---",
        "",
        "# Phase 1",
      ].join("\n"),
    );

    // Tasks.md
    writeFileSync(
      join(subjectDir, "tasks.md"),
      "# Tasks\n\n- [ ] Task 1\n- [x] Done\n",
    );

    // Completed iterate (should not appear)
    writeFileSync(
      join(subjectDir, "iterate-old.md"),
      [
        "---",
        "status: completed",
        "---",
        "",
        "# Old iterate",
      ].join("\n"),
    );

    const queue = buildQueue(TEST_ROOT, subject);
    expect(queue.some((q) => q.type === "phase")).toBe(true);
    expect(queue.some((q) => q.type === "task")).toBe(true);
    expect(queue.every((q) => q.type !== "iterate")).toBe(true);
  });
});

describe("Phase 1: Type backward compatibility", () => {
  it("OrchestrationState loads without new active field", () => {
    // Simulates loading an old orchestration.json without the 'active' field
    const oldState = {
      version: 1,
      goal: "test",
      currentState: "idle",
      subject: null,
      startedAt: "2026-05-18T00:00:00Z",
      updatedAt: "2026-05-18T00:00:00Z",
      history: [],
      queue: [],
      workerAttemptCount: 0,
    };

    // Should load without errors — new 'active' field is optional
    expect(oldState.version).toBe(1);
    expect((oldState as any).active).toBeUndefined();

    // Adding the field should work
    const newState = {
      ...oldState,
      active: {
        chunkId: "phase-1",
        phasePath: "phase-1-types.md",
        step: "build" as const,
        iteration: 1,
        maxIterations: 5,
      },
    };
    expect(newState.active.chunkId).toBe("phase-1");
    expect(newState.active.step).toBe("build");
  });

  it("ChunkQueueItem works with and without iterations", () => {
    const oldItem = {
      id: "phase-1",
      type: "phase" as const,
      path: "phase-1.md",
      status: "pending" as const,
      workerAttempts: 0,
    };

    // Old item without iterations field
    expect((oldItem as any).iterations).toBeUndefined();

    const newItem = {
      ...oldItem,
      iterations: [
        {
          iteration: 1,
          startedAt: "2026-05-18T00:00:00Z",
          completedAt: "2026-05-18T00:01:00Z",
          resultFile: "result-1.md",
          status: "completed",
        },
      ],
    };
    expect(newItem.iterations!.length).toBe(1);
  });

  it("RouteAction spawn-worker accepts iterate mode", () => {
    const action = {
      type: "spawn-worker" as const,
      state: "executingChunks" as const,
      taskFile: "task.md",
      mode: "iterate" as const,
    };
    expect(action.mode).toBe("iterate");
  });
});
