import { defineMachine, type MachineFailure } from "../state-machine.js";
import { maxBlockingHardness, type ValidatedFinding } from "./findings.js";
import type { Hardness, Rating } from "./rubric.js";
import type { MinBlocking, PassFixerRecord, PassReviewRecord, RunState, RunStatus } from "./run-state.js";

export type ReviewState =
  | "initializing"
  | "preparingBase"
  | "reviewing"
  | "triaging"
  | "fixing"
  | "clean"
  | "blocked"
  | "exhausted"
  | "failed"
  | "cancelled";

export interface ReviewSummary {
  blocking: number;
  hardness: Hardness | null;
  total: number;
}

export interface FixerSummary {
  checksPassed: boolean;
  command: string;
  exitCode: number | null;
}

export interface ReviewFacts {
  state: ReviewState;
  pass: number;
  maxPasses: number;
  minBlocking: MinBlocking;
  resumedAtPassBound: boolean;
  catalogOk?: boolean;
  catalogError?: string;
  baseReady: boolean;
  baseError?: string;
  review?: ReviewSummary;
  reviewError?: string;
  fixer?: FixerSummary;
}

export type ReviewOutput =
  | { rule: "preflight-pending"; effect: "run-catalog-preflight" }
  | { rule: "preflight-ok"; effect: "prepare-base" }
  | { rule: "base-ready" | "fixer-continue"; effect: "run-reviewer-pass" }
  | { rule: "review-parsed"; effect: "none" }
  | { rule: "triage-to-fixer"; effect: "run-fixer-pass" }
  | {
      rule:
        | "preflight-failed"
        | "base-failed"
        | "review-failed"
        | "triage-clean"
        | "triage-uncomputable"
        | "passes-exhausted"
        | "fixer-blocked";
      effect: "terminal";
      status: RunStatus;
      reason: string;
    };

export interface ReviewProjection {
  state?: ReviewState;
  catalogOk?: boolean;
  catalogError?: string;
  baseReady?: boolean;
  resumedAtPassBound?: boolean;
  baseError?: string;
  review?: PassReviewRecord | null;
  reviewError?: string;
  fixer?: PassFixerRecord | null;
}

const RATING_ORDER: readonly Rating[] = ["advisory", "low", "medium", "high", "critical"];

function findingsAtThreshold(findings: ValidatedFinding[], minBlocking: MinBlocking): ValidatedFinding[] {
  const threshold = RATING_ORDER.indexOf(minBlocking);
  return findings.filter((finding) => RATING_ORDER.indexOf(finding.rating) >= threshold);
}

function derivedState(input: ReviewProjection): ReviewState {
  if (input.catalogOk !== true) return "initializing";
  if (input.baseError || input.baseReady !== true) return "preparingBase";
  if (input.reviewError) return "reviewing";
  if (input.fixer) return "fixing";
  if (input.review) return "triaging";
  return "preparingBase";
}

/** Build pure evaluator facts from durable run state plus already-observed effect results. */
export function project(run: RunState, input: ReviewProjection = {}): ReviewFacts {
  const blocking = input.review ? findingsAtThreshold(input.review.findings, run.min_blocking) : [];
  return {
    state: input.state ?? derivedState(input),
    pass: run.pass,
    maxPasses: run.max_passes,
    minBlocking: run.min_blocking,
    resumedAtPassBound: input.resumedAtPassBound ?? false,
    catalogOk: input.catalogOk,
    catalogError: input.catalogError,
    baseReady: input.baseReady ?? run.base_commit !== null,
    baseError: input.baseError,
    review: input.review
      ? { blocking: blocking.length, hardness: maxBlockingHardness(blocking), total: input.review.findings.length }
      : undefined,
    reviewError: input.reviewError,
    fixer: input.fixer
      ? {
          checksPassed: input.fixer.checks.passed,
          command: input.fixer.checks.command,
          exitCode: input.fixer.checks.exit_code,
        }
      : undefined,
  };
}

function terminal(
  rule: Extract<ReviewOutput, { effect: "terminal" }>["rule"],
  status: RunStatus,
  reason: string,
): Extract<ReviewOutput, { effect: "terminal" }> {
  return { rule, effect: "terminal", status, reason };
}

export const reviewMachine = defineMachine<ReviewState, ReviewFacts, never, never, ReviewOutput>({
  stateOf: (facts) => facts.state,
  choiceKey: (choice) => choice,
  eventKey: (event) => event,
  states: {
    initializing: {
      automatic: [
        {
          id: "preflight-pending",
          when: (facts) => facts.catalogOk === undefined,
          target: "initializing",
          output: () => ({ rule: "preflight-pending", effect: "run-catalog-preflight" }),
        },
        {
          id: "preflight-failed",
          when: (facts) => facts.catalogOk === false,
          target: "failed",
          output: (facts) => terminal(
            "preflight-failed",
            "failed",
            `model catalog preflight failed (${facts.catalogError ?? "unknown error"})`,
          ),
        },
        {
          id: "preflight-ok",
          when: (facts) => facts.catalogOk === true,
          target: "preparingBase",
          output: () => ({ rule: "preflight-ok", effect: "prepare-base" }),
        },
      ],
    },
    preparingBase: {
      automatic: [
        {
          id: "base-failed",
          when: (facts) => facts.baseError !== undefined,
          target: "failed",
          output: (facts) => terminal("base-failed", "failed", `base preparation failed: ${facts.baseError}`),
        },
        {
          id: "base-ready",
          when: (facts) => facts.baseError === undefined && facts.baseReady,
          target: "reviewing",
          output: () => ({ rule: "base-ready", effect: "run-reviewer-pass" }),
        },
      ],
    },
    reviewing: {
      automatic: [
        {
          id: "review-failed",
          when: (facts) => facts.reviewError !== undefined,
          target: "failed",
          output: (facts) => terminal("review-failed", "failed", facts.reviewError ?? "review failed"),
        },
        {
          id: "review-parsed",
          when: (facts) => facts.reviewError === undefined && facts.review !== undefined,
          target: "triaging",
          output: () => ({ rule: "review-parsed", effect: "none" }),
        },
      ],
    },
    triaging: {
      automatic: [
        {
          id: "triage-clean",
          when: (facts) => facts.review?.blocking === 0,
          target: "clean",
          output: (facts) => {
            const total = facts.review?.total ?? 0;
            const reason = total === 0
              ? "reviewer reported no findings"
              : `no ${facts.minBlocking}-or-higher findings remain (${total} report-only)`;
            return terminal("triage-clean", "clean", reason);
          },
        },
        {
          id: "triage-uncomputable",
          when: (facts) => (facts.review?.blocking ?? 0) > 0 && facts.review?.hardness === null,
          target: "failed",
          output: () => terminal(
            "triage-uncomputable",
            "failed",
            "blocking findings present but no fix hardness computable",
          ),
        },
        {
          id: "triage-to-fixer",
          when: (facts) => (facts.review?.blocking ?? 0) > 0 && facts.review?.hardness !== null,
          target: "fixing",
          output: () => ({ rule: "triage-to-fixer", effect: "run-fixer-pass" }),
        },
      ],
    },
    fixing: {
      automatic: [
        {
          id: "fixer-continue",
          when: (facts) => !facts.resumedAtPassBound && facts.fixer?.checksPassed === true && facts.pass < facts.maxPasses,
          target: "reviewing",
          output: () => ({ rule: "fixer-continue", effect: "run-reviewer-pass" }),
        },
        {
          id: "passes-exhausted",
          when: (facts) => facts.resumedAtPassBound || (facts.fixer?.checksPassed === true && facts.pass >= facts.maxPasses),
          target: "exhausted",
          output: (facts) => terminal(
            "passes-exhausted",
            "exhausted",
            `blocking findings unresolved after ${facts.maxPasses} review passes`,
          ),
        },
        {
          id: "fixer-blocked",
          when: (facts) => !facts.resumedAtPassBound && facts.fixer?.checksPassed === false,
          target: "blocked",
          output: (facts) => terminal(
            "fixer-blocked",
            "blocked",
            `deterministic checks failed after fixer pass ${facts.pass} (${facts.fixer?.command ?? "unknown"} exit ${facts.fixer?.exitCode ?? "—"}); no checkpoint commit created`,
          ),
        },
      ],
    },
    clean: { terminal: true },
    blocked: { terminal: true },
    exhausted: { terminal: true },
    failed: { terminal: true },
    cancelled: { terminal: true },
  },
});

/** Stable terminal reason for an otherwise-unreachable evaluator failure. */
export function machineFailureReason(error: MachineFailure): string {
  return `review machine ${error.code}: ${JSON.stringify(error.context)}`;
}
