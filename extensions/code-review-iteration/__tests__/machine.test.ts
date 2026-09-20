import { describe, expect, it } from "vitest";
import { defineMachine, MachineFailure, type MachineFailureCode } from "../../state-machine.js";
import {
  machineFailureReason,
  project,
  reviewMachine,
  type ReviewFacts,
  type ReviewOutput,
  type ReviewState,
} from "../machine.js";
import type { PassFixerRecord, PassReviewRecord, RunState } from "../run-state.js";
import type { ValidatedFinding } from "../findings.js";
import type { Hardness, Rating } from "../rubric.js";

function run(overrides: Partial<RunState> = {}): RunState {
  return {
    schema_version: 1,
    run_id: "run-1",
    status: "running",
    branch: "feature/test",
    base_branch: "master",
    base_commit: null,
    start_head: "a".repeat(40),
    checkpoint_commit: null,
    pass: 1,
    persona: "balanced",
    reviewer_model: null,
    fixer_model: null,
    requested_temperature: null,
    last_head: "a".repeat(40),
    min_blocking: "medium",
    max_passes: 3,
    created_worktree: null,
    worktree_fingerprint: "clean",
    started_at: "2026-09-20T00:00:00.000Z",
    updated_at: "2026-09-20T00:00:00.000Z",
    terminal: null,
    ...overrides,
  };
}

function finding(rating: Rating, hardness: Hardness): ValidatedFinding {
  return {
    id: `${rating}-${hardness}`,
    title: "finding",
    location: "src/a.ts:1",
    observed: "broken",
    expected: "works",
    evidence: "evidence",
    confidence: 1,
    floors: {
      securityBoundaryExploitable: false,
      irreversibleDataLoss: false,
      primaryPathBlocker: false,
      styleOnly: false,
    },
    fixHardness: hardness,
    reproduction: { status: "not_run", commandIds: [], note: "" },
    score: rating === "critical" ? 11 : rating === "high" ? 9 : rating === "medium" ? 6 : 3,
    rating,
    blocking: rating === "medium" || rating === "high" || rating === "critical",
  };
}

function review(findings: ValidatedFinding[]): PassReviewRecord {
  return {
    persona: "balanced",
    requested_model: null,
    requested_temperature: null,
    thinking_level: null,
    reviewed_head: "b".repeat(40),
    findings,
    errors: [],
  };
}

function fixer(passed: boolean): PassFixerRecord {
  return {
    model: null,
    requested_hardness: "medium",
    dispositions: [],
    changed_paths: [],
    checks: { command: "npm test", exit_code: passed ? 0 : 1, passed },
    checkpoint_commit: passed ? "c".repeat(40) : null,
  };
}

function facts(state: ReviewState, overrides: Partial<ReviewFacts> = {}): ReviewFacts {
  return {
    state,
    pass: 1,
    maxPasses: 3,
    minBlocking: "medium",
    resumedAtPassBound: false,
    catalogOk: true,
    baseReady: true,
    review: undefined,
    reviewError: undefined,
    fixer: undefined,
    ...overrides,
  };
}

function transition(input: ReviewFacts) {
  const decision = reviewMachine.advance(input);
  expect(decision.kind).toBe("transition");
  if (decision.kind !== "transition") throw new Error("review machine unexpectedly returned choices");
  return decision;
}

function expectCode(fn: () => unknown, code: MachineFailureCode): void {
  try {
    fn();
    throw new Error(`expected ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(MachineFailure);
    expect((error as MachineFailure).code).toBe(code);
  }
}

const ROWS: readonly {
  name: string;
  facts: ReviewFacts;
  rule: string;
  to: ReviewState;
  effect: ReviewOutput["effect"];
}[] = [
  {
    name: "catalog preflight failure",
    facts: facts("initializing", { catalogOk: false, catalogError: "2 error(s)" }),
    rule: "preflight-failed",
    to: "failed",
    effect: "terminal",
  },
  {
    name: "catalog preflight success",
    facts: facts("initializing", { catalogOk: true }),
    rule: "preflight-ok",
    to: "preparingBase",
    effect: "prepare-base",
  },
  {
    name: "base preparation failure",
    facts: facts("preparingBase", { baseReady: false, baseError: "failed" }),
    rule: "base-failed",
    to: "failed",
    effect: "terminal",
  },
  {
    name: "base preparation success",
    facts: facts("preparingBase", { baseReady: true }),
    rule: "base-ready",
    to: "reviewing",
    effect: "run-reviewer-pass",
  },
  {
    name: "reviewer failure",
    facts: facts("reviewing", { reviewError: "reviewer failed" }),
    rule: "review-failed",
    to: "failed",
    effect: "terminal",
  },
  {
    name: "review parsed",
    facts: facts("reviewing", { review: { blocking: 0, hardness: null, total: 0 } }),
    rule: "review-parsed",
    to: "triaging",
    effect: "none",
  },
  {
    name: "clean triage",
    facts: facts("triaging", { review: { blocking: 0, hardness: null, total: 0 } }),
    rule: "triage-clean",
    to: "clean",
    effect: "terminal",
  },
  {
    name: "uncomputable triage hardness",
    facts: facts("triaging", { review: { blocking: 1, hardness: null, total: 1 } }),
    rule: "triage-uncomputable",
    to: "failed",
    effect: "terminal",
  },
  {
    name: "blocking triage",
    facts: facts("triaging", { review: { blocking: 1, hardness: "medium", total: 1 } }),
    rule: "triage-to-fixer",
    to: "fixing",
    effect: "run-fixer-pass",
  },
  {
    name: "verified fixer with passes remaining",
    facts: facts("fixing", { fixer: { checksPassed: true, command: "npm test", exitCode: 0 } }),
    rule: "fixer-continue",
    to: "reviewing",
    effect: "run-reviewer-pass",
  },
  {
    name: "verified fixer on final pass",
    facts: facts("fixing", {
      pass: 3,
      maxPasses: 3,
      fixer: { checksPassed: true, command: "npm test", exitCode: 0 },
    }),
    rule: "passes-exhausted",
    to: "exhausted",
    effect: "terminal",
  },
  {
    name: "failed deterministic checks",
    facts: facts("fixing", { fixer: { checksPassed: false, command: "npm test", exitCode: 1 } }),
    rule: "fixer-blocked",
    to: "blocked",
    effect: "terminal",
  },
];

describe("reviewMachine truth table", () => {
  it("requests catalog preflight before the report rows become decidable", () => {
    const decision = transition(facts("initializing", { catalogOk: undefined }));
    expect(decision).toMatchObject({
      from: "initializing",
      to: "initializing",
      output: { rule: "preflight-pending", effect: "run-catalog-preflight" },
    });
  });

  it.each(ROWS)("routes $name through $rule", ({ facts: input, rule, to, effect }) => {
    expect(transition(input)).toMatchObject({ to, output: { rule, effect } });
  });

  it("runs the fixer on the final review pass before declaring exhaustion", () => {
    const triaged = transition(facts("triaging", {
      pass: 3,
      maxPasses: 3,
      review: { blocking: 1, hardness: "hard", total: 1 },
    }));
    expect(triaged).toMatchObject({ to: "fixing", output: { rule: "triage-to-fixer", effect: "run-fixer-pass" } });

    const exhausted = transition(facts("fixing", {
      pass: 3,
      maxPasses: 3,
      fixer: { checksPassed: true, command: "npm test", exitCode: 0 },
    }));
    expect(exhausted).toMatchObject({ to: "exhausted", output: { rule: "passes-exhausted", effect: "terminal" } });
  });
});

describe("project", () => {
  it("derives blocking count and maximum hardness at the configured threshold", () => {
    const projected = project(run({ min_blocking: "high" }), {
      state: "reviewing",
      catalogOk: true,
      baseReady: true,
      review: review([finding("medium", "hard"), finding("high", "easy"), finding("critical", "medium")]),
    });
    expect(projected.review).toEqual({ blocking: 2, hardness: "medium", total: 3 });
  });

  it("projects an incomplete persisted fixer pass directly to triage", () => {
    const projected = project(run(), {
      catalogOk: true,
      baseReady: true,
      review: review([finding("high", "medium")]),
      fixer: null,
    });
    expect(projected.state).toBe("triaging");
  });

  it("projects a completed persisted fixer pass to fixing", () => {
    const projected = project(run(), {
      catalogOk: true,
      baseReady: true,
      review: review([finding("high", "medium")]),
      fixer: fixer(true),
    });
    expect(projected.state).toBe("fixing");
    expect(projected.fixer).toEqual({ checksPassed: true, command: "npm test", exitCode: 0 });
  });
});

describe("resume pass bound", () => {
  it("preserves while-fallthrough exhaustion when a pass-bound run resumes", () => {
    const decision = transition(facts("fixing", {
      pass: 3,
      maxPasses: 3,
      resumedAtPassBound: true,
      fixer: undefined,
    }));
    expect(decision).toMatchObject({
      to: "exhausted",
      output: { rule: "passes-exhausted", effect: "terminal" },
    });
  });
});

const UNREACHABLE_FACT_COMBINATIONS: readonly {
  state: ReviewState;
  description: string;
  matches: (facts: ReviewFacts) => boolean;
}[] = [
  { state: "preparingBase", description: "base effect has no result", matches: (f) => !f.baseReady && !f.baseError },
  { state: "reviewing", description: "reviewer effect has no result", matches: (f) => !f.review && !f.reviewError },
  { state: "triaging", description: "triage has no parsed review", matches: (f) => !f.review },
  {
    state: "fixing",
    description: "fixer effect has no result",
    matches: (f) => !f.fixer && !f.resumedAtPassBound,
  },
];

function explicitlyUnreachable(input: ReviewFacts): boolean {
  return UNREACHABLE_FACT_COMBINATIONS.some((entry) => entry.state === input.state && entry.matches(input));
}

describe("reviewMachine exclusivity", () => {
  it("routes every finite fact combination once or rejects an explicitly unreachable combination", () => {
    const states: readonly ReviewState[] = ["initializing", "preparingBase", "reviewing", "triaging", "fixing"];
    const passes = [1, 2, 3] as const;
    const catalogValues = [undefined, false, true] as const;
    const bases = [
      { baseReady: false, baseError: undefined },
      { baseReady: false, baseError: "failed" },
      { baseReady: true, baseError: undefined },
    ] as const;
    const reviews = [
      undefined,
      { blocking: 0, hardness: null, total: 0 },
      { blocking: 1, hardness: "medium" as const, total: 1 },
      { blocking: 1, hardness: null, total: 1 },
    ] as const;
    const reviewErrors = [undefined, "review failed"] as const;
    const fixers = [
      undefined,
      { checksPassed: true, command: "npm test", exitCode: 0 },
      { checksPassed: false, command: "npm test", exitCode: 1 },
    ] as const;

    for (const state of states) {
      for (const pass of passes) {
        for (const catalogOk of catalogValues) {
          for (const base of bases) {
            for (const reviewValue of reviews) {
              for (const reviewError of reviewErrors) {
                for (const fixerValue of fixers) {
                  const input = facts(state, {
                    pass,
                    maxPasses: 3,
                    catalogOk,
                    ...base,
                    review: reviewValue,
                    reviewError,
                    fixer: fixerValue,
                  });
                  try {
                    expect(reviewMachine.advance(input).kind).toBe("transition");
                    expect(explicitlyUnreachable(input)).toBe(false);
                  } catch (error) {
                    expect(error).toBeInstanceOf(MachineFailure);
                    expect((error as MachineFailure).code).toBe("NO_ROUTE");
                    expect(explicitlyUnreachable(input)).toBe(true);
                  }
                }
              }
            }
          }
        }
      }
    }
  });
});

describe("fail-closed evaluator pins", () => {
  it("pins ambiguity, no-route, terminal, and invalid-target failures by code", () => {
    type State = "open" | "done";
    type FixtureFacts = { state: State; left: boolean; right: boolean };
    const machine = defineMachine<State, FixtureFacts, never, never, null>({
      stateOf: (value) => value.state,
      choiceKey: (value) => value,
      eventKey: (value) => value,
      states: {
        open: {
          automatic: [
            { id: "left", when: (value) => value.left, target: "done", output: () => null },
            { id: "right", when: (value) => value.right, target: "done", output: () => null },
          ],
        },
        done: { terminal: true },
      },
    });
    expectCode(() => machine.advance({ state: "open", left: true, right: true }), "AMBIGUOUS_AUTOMATIC");
    expectCode(() => machine.advance({ state: "open", left: false, right: false }), "NO_ROUTE");
    expectCode(() => machine.advance({ state: "done", left: false, right: false }), "TERMINAL_STATE");

    const invalid = defineMachine<"open", { state: "open" }, never, never, null>({
      stateOf: (value) => value.state,
      choiceKey: (value) => value,
      eventKey: (value) => value,
      states: {
        open: { automatic: [{ id: "bad-target", when: () => true, target: "missing" as "open", output: () => null }] },
      },
    });
    expectCode(() => invalid.advance({ state: "open" }), "INVALID_TARGET");
  });

  it("formats machine failures with their code and structured context", () => {
    const failure = new MachineFailure("NO_ROUTE", { state: "reviewing", operation: "advance" });
    expect(machineFailureReason(failure)).toContain("NO_ROUTE");
    expect(machineFailureReason(failure)).toContain('"state":"reviewing"');
  });
});
