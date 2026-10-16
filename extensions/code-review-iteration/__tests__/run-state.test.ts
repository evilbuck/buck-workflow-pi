import { describe, it, expect, afterEach, vi } from "vitest";
import { readConsumer } from "../../../skills/_shared/storage/consumers.js";
import { SQLiteStorageStore } from "../../../skills/_shared/storage/sqlite-store.js";
import * as workflowState from "../../../skills/_shared/scripts/workflow-state.js";
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
  readPassArtifact,
  flushConfiguredRetains,
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
  it("creates a run, saves atomically, and loads it back", async () => {
    const common = mkdtempSync(join(tmpdir(), "cr-state-"));
    try {
      const { dir, state } = await createRun(common, makeState(), common);
      expect(dir).toContain(join("code-review-iteration", "feature_x", "20260912T150000-abc123"));
      expect(state.schema_version).toBe(1);
      const loaded = await loadState(dir);
      expect(loaded.run_id).toBe(state.run_id);
      state.status = "clean";
      await saveState(dir, state);
      expect((await loadState(dir)).status).toBe("clean");
      expect((await loadState(dir)).updated_at >= state.started_at).toBe(true);
    } finally {
      rmSync(common, { recursive: true, force: true });
    }
  });

  it("refuses to replace an existing retained run even without its export directory", async () => {
    const common = mkdtempSync(join(tmpdir(), "cr-state-"));
    try {
      const created = await createRun(common, makeState(), common);
      rmSync(created.dir, { recursive: true, force: true });
      await expect(createRun(common, makeState({ status: "clean" }), common)).rejects.toThrow();
      await expect(flushConfiguredRetains()).rejects.toThrow();
      expect((await loadState(created.dir)).status).toBe("running");
    } finally {
      rmSync(common, { recursive: true, force: true });
    }
  });

  it("ignores corrupt local exports and resumes retained state", async () => {
    const common = mkdtempSync(join(tmpdir(), "cr-state-"));
    try {
      const { dir } = await createRun(common, makeState(), common);
      writeFileSync(join(dir, "state.json"), "{not json");
      expect((await loadState(dir)).run_id).toBe("20260912T150000-abc123");
      writeFileSync(join(dir, "state.json"), '{"schema_version": 99}');
      expect((await loadState(dir)).schema_version).toBe(1);
    } finally {
      rmSync(common, { recursive: true, force: true });
    }
  });

  it("lists runs newest-first and finds the newest resumable run", async () => {
    const common = mkdtempSync(join(tmpdir(), "cr-state-"));
    try {
      await createRun(common, makeState({ run_id: "20260912T100000-old1", status: "blocked" }), common);
      await createRun(common, makeState({ run_id: "20260912T110000-old2", status: "clean" }), common);
      const newest = await createRun(common, makeState({ run_id: "20260912T120000-new", status: "running" }), common);
      const runs = await listRuns(common, "feature/x", common);
      expect(runs.map((r) => r.state.run_id)).toEqual(["20260912T120000-new", "20260912T110000-old2", "20260912T100000-old1"]);
      const resumable = await findResumable(common, "feature/x", common);
      expect(resumable?.dir).toBe(newest.dir);
      // newest goes clean → falls back to the older blocked run
      await saveState(newest.dir, { ...newest.state, status: "clean" });
      const older = await findResumable(common, "feature/x", common);
      expect(older?.state.run_id).toBe("20260912T100000-old1");
      await saveState(older!.dir, { ...older!.state, status: "clean" });
      expect(await findResumable(common, "feature/x", common)).toBeNull();
    } finally {
      rmSync(common, { recursive: true, force: true });
    }
  });

  it("preserves unreadable run directories without resuming them", async () => {
    const common = mkdtempSync(join(tmpdir(), "cr-state-"));
    try {
      const branchDir = join(common, "code-review-iteration", "feature_x");
      mkdirSync(join(branchDir, "20260912T090000-junk"), { recursive: true });
      writeFileSync(join(branchDir, "20260912T090000-junk", "state.json"), "garbage");
      await createRun(common, makeState({ run_id: "20260912T100000-good", status: "failed" }), common);
      const resumable = await findResumable(common, "feature/x", common);
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
  it("writes immutable pass artifacts and refuses overwrites", async () => {
    const common = mkdtempSync(join(tmpdir(), "cr-state-"));
    try {
      const { dir } = await createRun(common, makeState(), common);
      await writePassReview(dir, 1, {
        persona: "balanced",
        requested_model: "zai/glm-5.3",
        requested_temperature: 0.2,
        thinking_level: "high",
        reviewed_head: "a".repeat(40),
        findings: [],
        errors: [],
      });
      await writePassReviewMarkdown(dir, 1, "# Pass 01 review\n");
      await expect(writePassReview(dir, 1, {
        persona: "x",
        requested_model: null,
        requested_temperature: null,
        thinking_level: null,
        reviewed_head: "",
        findings: [],
        errors: [],
      })).rejects.toThrow();
      await writePassFixer(dir, 1, {
        model: "openai-codex/gpt-5.6-sol",
        requested_hardness: "hard",
        dispositions: [],
        changed_paths: [],
        checks: { command: "npm test", exit_code: 0, passed: true },
        checkpoint_commit: null,
      }, "# Pass 01 fixer\n");
      await expect(writePassFixer(dir, 1, {
        model: null,
        requested_hardness: null,
        dispositions: [],
        changed_paths: [],
        checks: { command: "", exit_code: null, passed: false },
        checkpoint_commit: null,
      }, "dup")).rejects.toThrow();
      await expect(flushConfiguredRetains()).rejects.toThrow();
      expect(JSON.parse((await readPassArtifact(dir, 1, "review.json"))!).persona).toBe("balanced");
    } finally {
      rmSync(common, { recursive: true, force: true });
    }
  });

  it("retains concurrent command appends in order even when the JSONL export is removed", async () => {
    const common = mkdtempSync(join(tmpdir(), "cr-state-"));
    const previous = process.env.BUCK_WORKFLOW_CONFIG;
    const config = join(common, "storage.yaml");
    writeFileSync(config, `version: 1\nstorage:\n  adapter: sqlite\n  database: ${join(common, "records.sqlite")}\n`);
    process.env.BUCK_WORKFLOW_CONFIG = config;
    let store: SQLiteStorageStore | undefined;
    try {
      const { dir } = await createRun(common, makeState(), common);
      store = SQLiteStorageStore.openSync(join(common, "records.sqlite"));
      vi.spyOn(workflowState, "withBoundStore").mockImplementation((_cwd, context, run) => run(store!, context));
      const resolveContext = workflowState.resolveConsumerContext;
      const ready = Promise.withResolvers<void>();
      let bindings = 0;
      vi.spyOn(workflowState, "resolveConsumerContext").mockImplementation(async cwd => {
        const context = await resolveContext(cwd);
        if (++bindings === 2) ready.resolve();
        await ready.promise;
        return context;
      });
      const first = appendCommandRecord(dir, 1, {
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
      const second = appendCommandRecord(dir, 1, {
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
      await Promise.all([first, second]);
      rmSync(dir, { recursive: true, force: true });
      const records = await readCommandRecords(dir, 1);
      expect(records.map((r) => r.command_id)).toEqual(["node-eval", "git-status"]);
      expect(await readCommandRecords(dir, 2)).toEqual([]);
    } finally {
      vi.restoreAllMocks();
      store?.close();
      if (previous === undefined) delete process.env.BUCK_WORKFLOW_CONFIG;
      else process.env.BUCK_WORKFLOW_CONFIG = previous;
      rmSync(common, { recursive: true, force: true });
    }
  });
});

describe("pass artifact retention on the configured store", () => {
  const previousConfig = process.env.BUCK_WORKFLOW_CONFIG;

  afterEach(() => {
    if (previousConfig === undefined) delete process.env.BUCK_WORKFLOW_CONFIG;
    else process.env.BUCK_WORKFLOW_CONFIG = previousConfig;
  });

  it("retains immutable pass bytes and state through one storage contract without loosening overwrite refusal", async () => {
    const common = mkdtempSync(join(tmpdir(), "cr-state-"));
    const configRoot = mkdtempSync(join(tmpdir(), "cr-retain-"));
    const database = join(configRoot, "state.sqlite");
    writeFileSync(join(configRoot, "config.yaml"), `version: 1\nstorage:\n  adapter: sqlite\n  database: ${database}\n`);
    process.env.BUCK_WORKFLOW_CONFIG = join(configRoot, "config.yaml");
    try {
      const { dir } = await createRun(common, makeState(), common);
      const reviewBody = {
        persona: "balanced",
        requested_model: "zai/glm-5.3",
        requested_temperature: 0.2,
        thinking_level: "high",
        reviewed_head: "a".repeat(40),
        findings: [],
        errors: [],
      };
      const runId = await writePassReview(dir, 1, reviewBody);
      expect(runId).toBeTruthy();
      const markdownRunId = await writePassReviewMarkdown(dir, 1, "# Pass 01 review\n");
      expect(markdownRunId).toBeTruthy();
      const store = SQLiteStorageStore.openSync(database);
      try {
        const context = await workflowState.resolveConsumerContext(common);
        const scope = { ...context, worktreeId: context.worktreeId!, runId: context.runId! };
        const retained = await readConsumer(store, scope, "audit", "code-review", "20260912T150000-abc123/passes/01/review.json");
        expect(new TextDecoder().decode(retained!.bytes)).toBe(`${JSON.stringify(reviewBody, null, 2)}\n`);
        const stranger = { ...scope, runId: `${runId}-stranger` };
        await expect(readConsumer(store, stranger, "audit", "code-review", "20260912T150000-abc123/passes/01/review.json")).resolves.toBeNull();
      } finally {
        store.close();
      }
      await expect(writePassReview(dir, 1, { ...reviewBody, persona: "x" })).rejects.toThrow();
      rmSync(dir, { recursive: true, force: true });
      const resumed = await findResumable(common, "feature/x", common);
      expect(resumed?.state.run_id).toBe("20260912T150000-abc123");
      expect(await readPassArtifact(dir, 1, "review.json")).toBe(`${JSON.stringify(reviewBody, null, 2)}\n`);
      await expect(writePassReview(dir, 1, { ...reviewBody, persona: "x" })).rejects.toThrow(/revision|conditional|conflict|stale/i);
      await expect(flushConfiguredRetains()).rejects.toThrow();
    } finally {
      rmSync(common, { recursive: true, force: true });
      rmSync(configRoot, { recursive: true, force: true });
    }
  });
});
