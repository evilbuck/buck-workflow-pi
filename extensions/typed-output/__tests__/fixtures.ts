import type { BuckReviewControl, ValidationDiagnosticCode } from "../contracts.js";
import type { TypeSafeEvaluation, TypeSafeResult } from "../evaluator.js";

export const validReviewControls: ReadonlyArray<{
  name: string;
  value: BuckReviewControl;
}> = [
  {
    name: "clean pass",
    value: {
      schema: "buck.review/v1",
      verdict: "pass",
      documentation_impact: false,
      how_to_impact: false,
      has_in_plan_issues: false,
      has_out_of_plan_issues: false,
    },
  },
  {
    name: "out-of-plan warning",
    value: {
      schema: "buck.review/v1",
      verdict: "pass_with_warnings",
      documentation_impact: false,
      how_to_impact: false,
      has_in_plan_issues: false,
      has_out_of_plan_issues: true,
    },
  },
  {
    name: "needs work",
    value: {
      schema: "buck.review/v1",
      verdict: "needs_work",
      documentation_impact: false,
      how_to_impact: false,
      has_in_plan_issues: true,
      has_out_of_plan_issues: false,
    },
  },
  {
    name: "documentation impact only",
    value: {
      schema: "buck.review/v1",
      verdict: "pass_with_warnings",
      documentation_impact: true,
      how_to_impact: false,
      has_in_plan_issues: false,
      has_out_of_plan_issues: false,
    },
  },
  {
    name: "how-to impact only",
    value: {
      schema: "buck.review/v1",
      verdict: "pass_with_warnings",
      documentation_impact: false,
      how_to_impact: true,
      has_in_plan_issues: false,
      has_out_of_plan_issues: false,
    },
  },
];

export const invalidReviewControls: ReadonlyArray<{
  name: string;
  value: unknown;
  code: ValidationDiagnosticCode;
}> = [
  {
    name: "missing field",
    value: {
      schema: "buck.review/v1",
      verdict: "pass",
      documentation_impact: false,
      has_in_plan_issues: false,
      has_out_of_plan_issues: false,
    },
    code: "missing_field",
  },
  {
    name: "malformed control",
    value: "not an object",
    code: "not_object",
  },
  {
    name: "wrong schema",
    value: {
      schema: "buck.review/v2",
      verdict: "pass",
      documentation_impact: false,
      how_to_impact: false,
      has_in_plan_issues: false,
      has_out_of_plan_issues: false,
    },
    code: "invalid_schema",
  },
  {
    name: "unknown verdict",
    value: {
      schema: "buck.review/v1",
      verdict: "retry",
      documentation_impact: false,
      how_to_impact: false,
      has_in_plan_issues: false,
      has_out_of_plan_issues: false,
    },
    code: "invalid_enum",
  },
  {
    name: "non-boolean impact flag",
    value: {
      schema: "buck.review/v1",
      verdict: "pass",
      documentation_impact: "false",
      how_to_impact: false,
      has_in_plan_issues: false,
      has_out_of_plan_issues: false,
    },
    code: "invalid_boolean",
  },
  {
    name: "contradictory verdict",
    value: {
      schema: "buck.review/v1",
      verdict: "pass",
      documentation_impact: false,
      how_to_impact: false,
      has_in_plan_issues: true,
      has_out_of_plan_issues: false,
    },
    code: "invariant_violation",
  },
];

function evaluation(answer: TypeSafeResult["answers"][string]): TypeSafeEvaluation {
  return {
    ok: true,
    result: {
      model: "jev-fixture",
      answers: { decision: answer },
      usage: { input_tokens: 1, output_tokens: 1 },
    },
  };
}

export const semanticEvaluationFixtures = {
  verifiedBoundary: evaluation({ type: "noul", noul: 0.8 }),
  disagreement: evaluation({
    type: "choice",
    choice: "continue",
    confidence: 0.9,
    probabilities: { fix: 0.1, continue: 0.9 },
  }),
  lowConfidence: evaluation({ type: "noul", noul: 0.79 }),
  unavailableProvider: {
    ok: false,
    failure: {
      code: "provider_unavailable",
      message: "TypeSafe evaluation is unavailable.",
    },
  } satisfies TypeSafeEvaluation,
} as const;
