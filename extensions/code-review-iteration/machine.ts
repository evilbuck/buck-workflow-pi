import { defineMachine } from "../state_machine/index.js";
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

const CANCEL = { name: "cancelled", manual: true } as const;

export const reviewMachine = defineMachine<ReviewFacts, ReviewOutput>()({
  initial: "initializing",
  states: {
    initializing: {
      targets: [
        {
          guard: (facts) => facts.catalogOk === undefined,
          name: "initializing",
          effect: () => ({ rule: "preflight-pending", effect: "run-catalog-preflight" }),
        },
        {
          guard: (facts) => facts.catalogOk === false,
          name: "failed",
          effect: (facts) => terminal(
            "preflight-failed",
            "failed",
            `model catalog preflight failed (${facts.catalogError ?? "unknown error"})`,
          ),
        },
        {
          guard: (facts) => facts.catalogOk === true,
          name: "preparingBase",
          effect: () => ({ rule: "preflight-ok", effect: "prepare-base" }),
        },
        CANCEL,
      ],
    },
    preparingBase: {
      targets: [
        {
          guard: (facts) => facts.baseError !== undefined,
          name: "failed",
          effect: (facts) => terminal("base-failed", "failed", `base preparation failed: ${facts.baseError}`),
        },
        {
          guard: (facts) => facts.baseError === undefined && facts.baseReady,
          name: "reviewing",
          effect: () => ({ rule: "base-ready", effect: "run-reviewer-pass" }),
        },
        CANCEL,
      ],
    },
    reviewing: {
      targets: [
        {
          guard: (facts) => facts.reviewError !== undefined,
          name: "failed",
          effect: (facts) => terminal("review-failed", "failed", facts.reviewError ?? "review failed"),
        },
        {
          guard: (facts) => facts.reviewError === undefined && facts.review !== undefined,
          name: "triaging",
          effect: () => ({ rule: "review-parsed", effect: "none" }),
        },
        CANCEL,
      ],
    },
    triaging: {
      targets: [
        {
          guard: (facts) => facts.review?.blocking === 0,
          name: "clean",
          effect: (facts) => {
            const total = facts.review?.total ?? 0;
            const reason = total === 0
              ? "reviewer reported no findings"
              : `no ${facts.minBlocking}-or-higher findings remain (${total} report-only)`;
            return terminal("triage-clean", "clean", reason);
          },
        },
        {
          guard: (facts) => (facts.review?.blocking ?? 0) > 0 && facts.review?.hardness === null,
          name: "failed",
          effect: () => terminal(
            "triage-uncomputable",
            "failed",
            "blocking findings present but no fix hardness computable",
          ),
        },
        {
          guard: (facts) => (facts.review?.blocking ?? 0) > 0 && facts.review?.hardness !== null,
          name: "fixing",
          effect: () => ({ rule: "triage-to-fixer", effect: "run-fixer-pass" }),
        },
        CANCEL,
      ],
    },
    fixing: {
      targets: [
        {
          guard: (facts) => !facts.resumedAtPassBound && facts.fixer?.checksPassed === true && facts.pass < facts.maxPasses,
          name: "reviewing",
          effect: () => ({ rule: "fixer-continue", effect: "run-reviewer-pass" }),
        },
        {
          guard: (facts) => facts.resumedAtPassBound || (facts.fixer?.checksPassed === true && facts.pass >= facts.maxPasses),
          name: "exhausted",
          effect: (facts) => terminal(
            "passes-exhausted",
            "exhausted",
            `blocking findings unresolved after ${facts.maxPasses} review passes`,
          ),
        },
        {
          guard: (facts) => !facts.resumedAtPassBound && facts.fixer?.checksPassed === false,
          name: "blocked",
          effect: (facts) => terminal(
            "fixer-blocked",
            "blocked",
            `deterministic checks failed after fixer pass ${facts.pass} (${facts.fixer?.command ?? "unknown"} exit ${facts.fixer?.exitCode ?? "—"}); no checkpoint commit created`,
          ),
        },
        CANCEL,
      ],
    },
    clean: { final: true, targets: [] },
    blocked: { final: true, targets: [] },
    exhausted: { final: true, targets: [] },
    failed: { final: true, targets: [] },
    cancelled: { final: true, targets: [] },
  },
});

export type ReviewMachineErrorCode = "NO_ROUTE" | "AMBIGUOUS_ROUTE";

export class ReviewMachineError extends Error {
  constructor(
    readonly code: ReviewMachineErrorCode,
    readonly context: Readonly<Record<string, unknown>>,
  ) {
    super(`review machine ${code}: ${JSON.stringify(context)}`);
    this.name = "ReviewMachineError";
  }
}

/** The review loop requires exactly one automatic route for each observed result. */
export function decide(facts: ReviewFacts): { to: ReviewState; output: ReviewOutput } {
  const instance = reviewMachine.restore(facts.state);
  const available = instance.available(facts);
  if (available.length !== 1) {
    throw new ReviewMachineError(available.length === 0 ? "NO_ROUTE" : "AMBIGUOUS_ROUTE", {
      state: facts.state,
      available,
    });
  }
  const { to, effect } = instance.transition(available[0]!, facts);
  // Every automatic edge in this consumer declares an output.
  return { to, output: effect! };
}

/** Stable terminal reason for an otherwise-unreachable evaluator failure. */
export function machineFailureReason(error: ReviewMachineError): string {
  return `review machine ${error.code}: ${JSON.stringify(error.context)}`;
}
