import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderPassReviewMarkdown, renderFinalReport, resolveReportSubject, writeFinalReport } from "../report.js";
import type { PassFixerRecord, PassReviewRecord, RunState } from "../run-state.js";
import type { ValidatedFinding } from "../findings.js";
import { flushConfiguredRetains } from "../../../skills/_shared/storage/consumers.js";
import { withConfiguredStore } from "../../../skills/_shared/scripts/workflow-state.js";

const finding: ValidatedFinding = {
  id: "F1",
  title: "Expired token accepted",
  location: "src/auth.ts:120",
  observed: "expired refresh tokens validate",
  expected: "expired tokens rejected",
  evidence: "readToken compares issuance only",
  confidence: 1,
  floors: { securityBoundaryExploitable: false, irreversibleDataLoss: false, primaryPathBlocker: true, styleOnly: false },
  fixHardness: "medium",
  reproduction: { status: "not_run", commandIds: [], note: "" },
  score: 10,
  rating: "high",
  blocking: true,
};

const review: PassReviewRecord = {
  persona: "balanced",
  requested_model: "zai/glm-5.3",
  requested_temperature: 0.2,
  thinking_level: "high",
  reviewed_head: "a".repeat(40),
  findings: [finding],
  errors: [],
};

const fixer: PassFixerRecord = {
  model: "openai-codex/gpt-5.6-sol",
  requested_hardness: "medium",
  dispositions: [{ finding_id: "F1", disposition: "valid", note: "verified expiry path" }],
  changed_paths: ["src/auth.ts"],
  checks: { command: "npm test", exit_code: 0, passed: true },
  checkpoint_commit: "c".repeat(40),
};

const state: RunState = {
  schema_version: 1,
  run_id: "20260912T150000-abc123",
  status: "clean",
  branch: "feature/x",
  base_branch: "master",
  base_commit: "b".repeat(40),
  start_head: "a".repeat(40),
  last_head: "c".repeat(40),
  checkpoint_commit: "z".repeat(40),
  pass: 2,
  persona: "balanced",
  reviewer_model: "zai/glm-5.3",
  fixer_model: "openai-codex/gpt-5.6-sol",
  requested_temperature: 0.2,
  min_blocking: "medium",
  max_passes: 3,
  created_worktree: null,
  worktree_fingerprint: "x",
  started_at: "2026-09-12T15:00:00Z",
  updated_at: "2026-09-12T15:20:00Z",
  terminal: { reason: "no blocking findings remain", at: "2026-09-12T15:20:00Z" },
};

describe("renderPassReviewMarkdown", () => {
  it("renders findings non-prescriptively with rating inputs and reproduction", () => {
    const md = renderPassReviewMarkdown({ ...review, errors: ["finding F9: bad"] }, 1);
    expect(md).toContain("## F1: Expired token accepted");
    expect(md).toContain("**high** · score 10");
    expect(md).toContain("src/auth.ts:120");
    expect(md).toContain("**Observed**");
    expect(md).toContain("**Expected**");
    expect(md).toContain("not_run");
    expect(md).toContain("finding F9: bad");
    expect(md).not.toMatch(/suggest|you should|fix by|remediation/i);
  });
});

describe("renderFinalReport", () => {
  it("summarizes outcome, models, passes, dispositions, and checkpoints", () => {
    const md = renderFinalReport({
      state,
      passes: [
        { pass: 1, review, fixer },
        { pass: 2, review: { ...review, findings: [] }, fixer: null },
      ],
      runDir: "/gcd/code-review-iteration/feature_x/20260912T150000-abc123",
      finalHead: "c".repeat(40),
    });
    expect(md).toContain("**Outcome: CLEAN**");
    expect(md).toContain("no blocking findings remain");
    expect(md).toContain("origin/master");
    expect(md).toContain("zai/glm-5.3");
    expect(md).toContain("openai-codex/gpt-5.6-sol");
    expect(md).toContain("F1: valid — verified expiry path");
    expect(md).toContain("npm test exit 0 (passed)");
    expect(md).toContain("max 3 review passes");
    expect(md).not.toContain("Resume");
  });

  it("includes a resume pointer for retained outcomes", () => {
    const md = renderFinalReport({
      state: { ...state, status: "blocked" },
      passes: [{ pass: 1, review, fixer: null }],
      runDir: "/gcd/run",
      finalHead: "a".repeat(40),
    });
    expect(md).toContain("**Outcome: BLOCKED**");
    expect(md).toContain("## Resume");
    expect(md).toContain("/gcd/run");
  });
});

describe("resolveReportSubject", () => {
  it("prefers the newest active subject", async () => {
    const root = mkdtempSync(join(tmpdir(), "cr-ctx-"));
    const ctx = join(root, ".context");
    try {
      for (const [name, status] of [
        ["2026-09-01.older", "active"],
        ["2026-09-10.newer", "active"],
        ["2026-09-11.completed", "completed"],
        ["not-a-subject", "active"],
      ] as const) {
        mkdirSync(join(ctx, name), { recursive: true });
        writeFileSync(join(ctx, name, "index.md"), `---\nstatus: ${status}\n---\n`);
      }
      const subject = await resolveReportSubject(ctx, root);
      expect(subject.dir).toBe(join(ctx, "2026-09-10.newer"));
      expect(subject.created).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("creates a fresh review subject when none is active", async () => {
    const root = mkdtempSync(join(tmpdir(), "cr-ctx-"));
    const ctx = join(root, ".context");
    try {
      const subject = await resolveReportSubject(ctx, root, new Date("2026-09-12T12:00:00Z"));
      expect(subject.created).toBe(true);
      expect(subject.dir).toBe(join(ctx, "2026-09-12.code-review-iteration"));
      const index = readFileSync(join(subject.dir, "index.md"), "utf-8");
      expect(index).toMatch(/status: active/);
      expect(index).toMatch(/lifecycle_schema: 1/);
      const path = await writeFinalReport(subject.dir, "run-1", "# report", root);
      expect(path).toBe(join(subject.dir, "review-iteration-run-1.md"));
      expect(existsSync(path)).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("creates a distinct subject instead of reusing a completed same-day report subject", async () => {
    const root = mkdtempSync(join(tmpdir(), "cr-ctx-"));
    const ctx = join(root, ".context");
    try {
      const completed = join(ctx, "2026-09-12.code-review-iteration");
      mkdirSync(completed, { recursive: true });
      writeFileSync(
        join(completed, "index.md"),
        "---\nstatus: completed\nlifecycle_schema: 1\nlifecycle_revision: 2\nlifecycle_last_transition: close-verified\n---\n",
      );

      const subject = await resolveReportSubject(ctx, root, new Date("2026-09-12T12:00:00Z"));

      expect(subject.created).toBe(true);
      expect(subject.dir).toBe(join(ctx, "2026-09-12.code-review-iteration-2"));
      expect(readFileSync(join(completed, "index.md"), "utf8")).not.toContain("status: active");
      expect(readFileSync(join(subject.dir, "index.md"), "utf8")).toContain("status: active");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("ignores malformed active-looking subjects", async () => {
    const root = mkdtempSync(join(tmpdir(), "cr-ctx-"));
    const ctx = join(root, ".context");
    try {
      const malformed = join(ctx, "2026-09-11.malformed");
      mkdirSync(malformed, { recursive: true });
      writeFileSync(
        join(malformed, "index.md"),
        "---\nstatus: active\nlifecycle_schema: 1\nlifecycle_revision: nope\nlifecycle_last_transition: activate\n---\n",
      );

      const subject = await resolveReportSubject(ctx, root, new Date("2026-09-12T12:00:00Z"));

      expect(subject.created).toBe(true);
      expect(subject.dir).toBe(join(ctx, "2026-09-12.code-review-iteration"));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("selects an adapter-only active subject instead of inventing a new local subject", async () => {
    const root = mkdtempSync(join(tmpdir(), "report-adapter-"));
    const previous = process.env.BUCK_WORKFLOW_CONFIG;
    const config = join(root, "storage.yaml");
    writeFileSync(config, `version: 1\nstorage:\n  adapter: sqlite\n  database: ${join(root, "records.sqlite")}\n`);
    process.env.BUCK_WORKFLOW_CONFIG = config;
    const subjectId = "2026-09-12.retained";
    try {
      await withConfiguredStore(root, async (store, context) => {
        const scope = { projectId: context.projectId, branchId: context.branchId, subjectId };
        const draft = await store.transition({ ...scope, fromRevision: null, expectedState: "missing", intent: { kind: "initialize" }, evidence: [] });
        await store.transition({ ...scope, fromRevision: draft, expectedState: "draft", intent: { kind: "activate" }, evidence: [draft] });
      });
      expect(existsSync(join(root, ".context"))).toBe(false);
      expect(await resolveReportSubject(join(root, ".context"), root)).toEqual({ dir: join(root, ".context", subjectId), created: false });
    } finally {
      if (previous === undefined) delete process.env.BUCK_WORKFLOW_CONFIG;
      else process.env.BUCK_WORKFLOW_CONFIG = previous;
      rmSync(root, { recursive: true, force: true });
    }
  });
});

it("refuses terminal report success when the selected store cannot retain it", async () => {
  const root = mkdtempSync(join(tmpdir(), "report-fault-"));
  const previous = process.env.BUCK_WORKFLOW_CONFIG;
  const config = join(root, "invalid.yaml");
  writeFileSync(config, "storage: [invalid");
  process.env.BUCK_WORKFLOW_CONFIG = config;
  try {
    const local = join(root, ".context", "2026-09-12.local");
    mkdirSync(local, { recursive: true });
    writeFileSync(join(local, "index.md"), "---\nstatus: active\n---\n");
    await expect(resolveReportSubject(join(root, ".context"), root)).rejects.toThrow(/config/);
    await expect(writeFinalReport(root, "failed-retain", "# report", root)).rejects.toThrow(/config/);
    await expect(flushConfiguredRetains()).rejects.toThrow(/config/);
  } finally {
    if (previous === undefined) delete process.env.BUCK_WORKFLOW_CONFIG;
    else process.env.BUCK_WORKFLOW_CONFIG = previous;
    rmSync(root, { recursive: true, force: true });
  }
});
