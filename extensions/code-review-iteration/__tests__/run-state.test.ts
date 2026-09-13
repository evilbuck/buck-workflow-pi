import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  branchKey,
  createRun,
  saveState,
  loadState,
  listRuns,
  findResumable,
  validateResume,
  writePassReview,
  writePassReviewMarkdown,
  writePassFixer,
  appendCommandRecord,
  readCommandRecords,
  StateError,
  type RunState,
} from "../run-state.js";

function makeState(overrides: Partial<RunState> = {}): Omit<RunState, "schema_version"> {
  return {
    run_id: "20260912T150000-abc123",
    status: "running",
    branch: "feature/x",
    base_branch: "master",
    base_commit: "b".repeat(40),
    start_head: "a".repeat(40),
    last_head: "a".repeat(40),
    checkpoint_commit: null,
    pass: 1,
    persona: "balanced",
    reviewer_model: "zai/glm-5.3",
    fixer_model: null,
    requested_temperature: 0.2,
    min_blocking: "medium",
    max_passes: 3,
    created_worktree: null,
    worktree_fingerprint: "aaa:status",
    started_at: "2026-09-12T15:00:00Z",
    updated_at: "2026-09-12T15:00:00Z",
    terminal: null,
    ...overrides,
  };
}

describe("branchKey", () => {
  it("sanitizes branch names into directory-safe keys", () => {
    expect(branchKey("feature/x")).toBe("feature_x");
    expect(branchKey("release/1.2-hotfix")).toBe("release_1.2-hotfix");
    expect(branchKey(null)).toBe("detached");
    expect(branchKey("///")).toBe("detached");
  });
});

describe("run lifecycle", () => {
  it("creates a run, saves atomically, and loads it back", () => {
    const common = mkdtempSync(join(tmpdir(), "cr-state-"));
    try {
      const { dir, state } = createRun(common, makeState());
      expect(dir).toContain(join("code-review-iteration", "feature_x", "20260912T150000-abc123"));
      expect(state.schema_version).toBe(1);
      const loaded = loadState(dir);
      expect(loaded.run_id).toBe(state.run_id);
      state.status = "clean";
      saveState(dir, state);
      expect(loadState(dir).status).toBe("clean");
      expect(loadState(dir).updated_at >= state.started_at).toBe(true);
    } finally {
      rmSync(common, { recursive: true, force: true });
    }
  });

  it("refuses to create a run over an existing directory", () => {
    const common = mkdtempSync(join(tmpdir(), "cr-state-"));
    try {
      createRun(common, makeState());
      expect(() => createRun(common, makeState())).toThrow(StateError);
    } finally {
      rmSync(common, { recursive: true, force: true });
    }
  });

  it("rejects corrupt or wrong-schema state visibly", () => {
    const common = mkdtempSync(join(tmpdir(), "cr-state-"));
    try {
      const { dir } = createRun(common, makeState());
      writeFileSync(join(dir, "state.json"), "{not json");
      expect(() => loadState(dir)).toThrow(/not valid JSON/);
      writeFileSync(join(dir, "state.json"), '{"schema_version": 99}');
      expect(() => loadState(dir)).toThrow(/schema_version/);
    } finally {
      rmSync(common, { recursive: true, force: true });
    }
  });

  it("lists runs newest-first and finds the newest resumable run", () => {
    const common = mkdtempSync(join(tmpdir(), "cr-state-"));
    try {
      createRun(common, makeState({ run_id: "20260912T100000-old1", status: "blocked" }));
      createRun(common, makeState({ run_id: "20260912T110000-old2", status: "clean" }));
      const newest = createRun(common, makeState({ run_id: "20260912T120000-new", status: "running" }));
      const runs = listRuns(common, "feature/x");
      expect(runs.map((r) => r.state.run_id)).toEqual(["20260912T120000-new", "20260912T110000-old2", "20260912T100000-old1"]);
      const resumable = findResumable(common, "feature/x");
      expect(resumable?.dir).toBe(newest.dir);
      // newest goes clean → falls back to the older blocked run
      saveState(newest.dir, { ...newest.state, status: "clean" });
      const older = findResumable(common, "feature/x");
      expect(older?.state.run_id).toBe("20260912T100000-old1");
      saveState(older!.dir, { ...older!.state, status: "clean" });
      expect(findResumable(common, "feature/x")).toBeNull();
    } finally {
      rmSync(common, { recursive: true, force: true });
    }
  });

  it("preserves unreadable run directories without resuming them", () => {
    const common = mkdtempSync(join(tmpdir(), "cr-state-"));
    try {
      const branchDir = join(common, "code-review-iteration", "feature_x");
      mkdirSync(join(branchDir, "20260912T090000-junk"), { recursive: true });
      writeFileSync(join(branchDir, "20260912T090000-junk", "state.json"), "garbage");
      createRun(common, makeState({ run_id: "20260912T100000-good", status: "failed" }));
      const resumable = findResumable(common, "feature/x");
      expect(resumable?.state.run_id).toBe("20260912T100000-good");
    } finally {
      rmSync(common, { recursive: true, force: true });
    }
  });
});

describe("validateResume", () => {
  const state = makeState();

  it("accepts matching head, fingerprint, and quiet git state", () => {
    expect(
      validateResume({ ...state, schema_version: 1 }, { head: "a".repeat(40), fingerprint: "aaa:status", gitOperationInProgress: false }),
    ).toEqual({ ok: true, reason: null });
  });

  it("rejects ongoing git operations, fingerprint drift, and head drift", () => {
    const s = { ...state, schema_version: 1 };
    expect(validateResume(s, { head: "a".repeat(40), fingerprint: "aaa:status", gitOperationInProgress: true }).reason).toMatch(/git operation/);
    expect(validateResume(s, { head: "a".repeat(40), fingerprint: "zzz:other", gitOperationInProgress: false }).reason).toMatch(/fingerprint/);
    expect(validateResume(s, { head: "c".repeat(40), fingerprint: "aaa:status", gitOperationInProgress: false }).reason).toMatch(/HEAD/);
  });

  it("validates against last_head once fixer checkpoints moved HEAD", () => {
    const s = { ...state, schema_version: 1, last_head: "d".repeat(40) };
    expect(validateResume(s, { head: "a".repeat(40), fingerprint: "aaa:status", gitOperationInProgress: false }).ok).toBe(false);
    expect(validateResume(s, { head: "d".repeat(40), fingerprint: "aaa:status", gitOperationInProgress: false }).ok).toBe(true);
  });
});

describe("pass artifacts", () => {
  it("writes immutable pass artifacts and refuses overwrites", () => {
    const common = mkdtempSync(join(tmpdir(), "cr-state-"));
    try {
      const { dir } = createRun(common, makeState());
      writePassReview(dir, 1, {
        persona: "balanced",
        requested_model: "zai/glm-5.3",
        effective_model: "zai/glm-5.3",
        requested_temperature: 0.2,
        effective_temperature: null,
        thinking_level: "high",
        reviewed_head: "a".repeat(40),
        findings: [],
        errors: [],
      });
      writePassReviewMarkdown(dir, 1, "# Pass 01 review\n");
      expect(() => writePassReview(dir, 1, {
        persona: "x",
        requested_model: null,
        effective_model: null,
        requested_temperature: null,
        effective_temperature: null,
        thinking_level: null,
        reviewed_head: "",
        findings: [],
        errors: [],
      })).toThrow(/immutable/);
      writePassFixer(dir, 1, {
        model: "openai-codex/gpt-5.6-sol",
        requested_hardness: "hard",
        dispositions: [],
        changed_paths: [],
        checks: { command: "npm test", exit_code: 0, passed: true },
        checkpoint_commit: null,
      }, "# Pass 01 fixer\n");
      expect(() => writePassFixer(dir, 1, {
        model: null,
        requested_hardness: null,
        dispositions: [],
        changed_paths: [],
        checks: { command: "", exit_code: null, passed: false },
        checkpoint_commit: null,
      }, "dup")).toThrow(/immutable/);
    } finally {
      rmSync(common, { recursive: true, force: true });
    }
  });

  it("appends and reads command records as JSONL", () => {
    const common = mkdtempSync(join(tmpdir(), "cr-state-"));
    try {
      const { dir } = createRun(common, makeState());
      appendCommandRecord(dir, 1, {
        command_id: "node-eval",
        argv: ["node", "-e", "1"],
        cwd: ".",
        started_at: "2026-09-12T15:01:00Z",
        ended_at: "2026-09-12T15:01:01Z",
        duration_ms: 1000,
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
      });
      appendCommandRecord(dir, 1, {
        command_id: "git-status",
        argv: ["git", "status"],
        cwd: ".",
        started_at: "2026-09-12T15:01:02Z",
        ended_at: "2026-09-12T15:01:02Z",
        duration_ms: 5,
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
      });
      const records = readCommandRecords(dir, 1);
      expect(records.map((r) => r.command_id)).toEqual(["node-eval", "git-status"]);
      expect(readCommandRecords(dir, 2)).toEqual([]);
    } finally {
      rmSync(common, { recursive: true, force: true });
    }
  });
});
