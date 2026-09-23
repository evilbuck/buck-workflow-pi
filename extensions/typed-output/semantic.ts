import type {
  SemanticComparison,
  SemanticVerificationResult,
} from "./contracts.js";
import type { TypeSafeEvaluation } from "./evaluator.js";

/** Calibrated against the Phase 1 fixture corpus; lower support requires repair. */
export const SEMANTIC_VERIFICATION_MIN_SUPPORT = 0.8;

export type SemanticExpectation =
  | { question: string; type: "choice"; declared: string }
  | { question: string; type: "noul"; declared: boolean };

function validProbability(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function compare(
  expectation: SemanticExpectation,
  answer: unknown,
): SemanticComparison {
  const unavailable: SemanticComparison = {
    question: expectation.question,
    declared: expectation.declared,
    observed: null,
    support: null,
    matches: false,
  };

  if (typeof answer !== "object" || answer === null || Array.isArray(answer)) {
    return unavailable;
  }

  const value = answer as Record<string, unknown>;
  if (expectation.type === "choice") {
    if (
      value.type !== "choice" ||
      typeof value.choice !== "string" ||
      !validProbability(value.confidence)
    ) {
      return unavailable;
    }
    return {
      question: expectation.question,
      declared: expectation.declared,
      observed: value.choice,
      support: value.confidence,
      matches: value.choice === expectation.declared,
    };
  }

  if (value.type !== "noul" || !validProbability(value.noul)) return unavailable;
  const observed = value.noul >= 0.5;
  return {
    question: expectation.question,
    declared: expectation.declared,
    observed,
    support: Math.max(value.noul, 1 - value.noul),
    matches: observed === expectation.declared,
  };
}

export function assessSemanticVerification(
  expectations: readonly SemanticExpectation[],
  evaluation: TypeSafeEvaluation,
): SemanticVerificationResult {
  if (expectations.length === 0) {
    return {
      status: "unavailable",
      comparisons: [],
      message: "Semantic verification requires at least one expectation.",
    };
  }

  if (!evaluation.ok) {
    return {
      status: "unavailable",
      comparisons: [],
      message: evaluation.failure.message,
    };
  }

  const comparisons = expectations.map((expectation) =>
    compare(expectation, evaluation.result.answers[expectation.question]),
  );
  const base = { comparisons, model: evaluation.result.model };

  if (comparisons.some((comparison) => comparison.support === null)) {
    return {
      ...base,
      status: "unavailable",
      message: "TypeSafe returned a missing or malformed semantic answer.",
    };
  }
  if (
    comparisons.some((comparison) => comparison.support !== null && comparison.support < SEMANTIC_VERIFICATION_MIN_SUPPORT)
  ) {
    return { ...base, status: "low_confidence" };
  }
  if (comparisons.some((comparison) => !comparison.matches)) {
    return { ...base, status: "disagreed" };
  }
  return { ...base, status: "verified" };
}
