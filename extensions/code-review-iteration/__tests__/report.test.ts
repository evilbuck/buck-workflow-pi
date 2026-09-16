import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderPassReviewMarkdown, renderFinalReport, resolveReportSubject, writeFinalReport } from "../report.js";
import type { PassFixerRecord, PassReviewRecord, RunState } from "../run-state.js";
import type { ValidatedFinding } from "../findings.js";

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
  it("prefers the newest active subject", () => {
    const ctx = mkdtempSync(join(tmpdir(), "cr-ctx-"));
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
      const subject = resolveReportSubject(ctx);
      expect(subject.dir).toBe(join(ctx, "2026-09-10.newer"));
      expect(subject.created).toBe(false);
    } finally {
      rmSync(ctx, { recursive: true, force: true });
    }
  });

  it("creates a fresh review subject when none is active", () => {
    const ctx = mkdtempSync(join(tmpdir(), "cr-ctx-"));
    try {
      const subject = resolveReportSubject(ctx, new Date("2026-09-12T12:00:00Z"));
      expect(subject.created).toBe(true);
      expect(subject.dir).toBe(join(ctx, "2026-09-12.code-review-iteration"));
      expect(readFileSync(join(subject.dir, "index.md"), "utf-8")).toMatch(/status: active/);
      const path = writeFinalReport(subject.dir, "run-1", "# report");
      expect(path).toBe(join(subject.dir, "review-iteration-run-1.md"));
      expect(existsSync(path)).toBe(true);
    } finally {
      rmSync(ctx, { recursive: true, force: true });
    }
  });
});
