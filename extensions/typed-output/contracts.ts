export const BUCK_REVIEW_SCHEMA = "buck.review/v1" as const;

export const REVIEW_VERDICTS = ["pass", "pass_with_warnings", "needs_work"] as const;
export type ReviewVerdict = (typeof REVIEW_VERDICTS)[number];

export interface BuckReviewControl {
  schema: typeof BUCK_REVIEW_SCHEMA;
  verdict: ReviewVerdict;
  documentation_impact: boolean;
  how_to_impact: boolean;
  has_in_plan_issues: boolean;
  has_out_of_plan_issues: boolean;
}

export const RECOVERY_ACTIONS = ["fix", "continue"] as const;
export type RecoveryAction = (typeof RECOVERY_ACTIONS)[number];

export type ValidationDiagnosticCode =
  | "not_object"
  | "missing_field"
  | "invalid_schema"
  | "invalid_enum"
  | "invalid_boolean"
  | "invariant_violation";

export interface ValidationDiagnostic {
  code: ValidationDiagnosticCode;
  path: string;
  message: string;
}

export type ValidationResult<T> =
  | { ok: true; value: T; diagnostics: [] }
  | { ok: false; diagnostics: ValidationDiagnostic[] };

export type SemanticVerificationStatus =
  | "verified"
  | "disagreed"
  | "low_confidence"
  | "unavailable";

export interface SemanticComparison {
  question: string;
  declared: string | boolean;
  observed: string | boolean | null;
  support: number | null;
  matches: boolean;
}

export interface SemanticVerificationResult {
  status: SemanticVerificationStatus;
  comparisons: SemanticComparison[];
  model?: string;
  message?: string;
}

export interface TypedOutputAudit<T> {
  schema: string;
  source_artifact: string;
  declared: T;
  validation: ValidationDiagnostic[];
  semantic_verification: SemanticVerificationResult;
  recovery_action?: RecoveryAction;
  attempt: number;
}

const BOOLEAN_FIELDS = [
  "documentation_impact",
  "how_to_impact",
  "has_in_plan_issues",
  "has_out_of_plan_issues",
] as const;

function diagnostic(
  code: ValidationDiagnosticCode,
  path: string,
  message: string,
): ValidationDiagnostic {
  return { code, path, message };
}

export function validateRecoveryAction(input: unknown): ValidationResult<RecoveryAction> {
  if (typeof input === "string" && RECOVERY_ACTIONS.includes(input as RecoveryAction)) {
    return { ok: true, value: input as RecoveryAction, diagnostics: [] };
  }
  return {
    ok: false,
    diagnostics: [
      diagnostic("invalid_enum", "action", "action must be fix or continue."),
    ],
  };
}

function verdictMatchesFacts(control: BuckReviewControl): boolean {
  if (control.verdict === "needs_work") return control.has_in_plan_issues;
  if (control.verdict === "pass") {
    return !control.has_in_plan_issues && !control.has_out_of_plan_issues;
  }
  return (
    !control.has_in_plan_issues &&
    (control.has_out_of_plan_issues || control.documentation_impact || control.how_to_impact)
  );
}

function collectSchemaDiagnostic(
  record: Record<string, unknown>,
  diagnostics: ValidationDiagnostic[],
): void {
  if (!("schema" in record)) {
    diagnostics.push(diagnostic("missing_field", "schema", "schema is required."));
    return;
  }
  if (record.schema !== BUCK_REVIEW_SCHEMA) {
    diagnostics.push(
      diagnostic("invalid_schema", "schema", `schema must be ${BUCK_REVIEW_SCHEMA}.`),
    );
  }
}

function collectVerdictDiagnostic(
  record: Record<string, unknown>,
  diagnostics: ValidationDiagnostic[],
): void {
  if (!("verdict" in record)) {
    diagnostics.push(diagnostic("missing_field", "verdict", "verdict is required."));
    return;
  }
  if (!REVIEW_VERDICTS.includes(record.verdict as ReviewVerdict)) {
    diagnostics.push(
      diagnostic(
        "invalid_enum",
        "verdict",
        "verdict must be pass, pass_with_warnings, or needs_work.",
      ),
    );
  }
}

function collectBooleanDiagnostic(
  record: Record<string, unknown>,
  field: (typeof BOOLEAN_FIELDS)[number],
  diagnostics: ValidationDiagnostic[],
): void {
  if (!(field in record)) {
    diagnostics.push(diagnostic("missing_field", field, `${field} is required.`));
    return;
  }
  if (typeof record[field] !== "boolean") {
    diagnostics.push(diagnostic("invalid_boolean", field, `${field} must be a boolean.`));
  }
}

export function validateBuckReviewControl(input: unknown): ValidationResult<BuckReviewControl> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return {
      ok: false,
      diagnostics: [diagnostic("not_object", "$", "Review control block must be an object.")],
    };
  }

  const record = input as Record<string, unknown>;
  const diagnostics: ValidationDiagnostic[] = [];
  collectSchemaDiagnostic(record, diagnostics);
  collectVerdictDiagnostic(record, diagnostics);
  for (const field of BOOLEAN_FIELDS) {
    collectBooleanDiagnostic(record, field, diagnostics);
  }
  if (diagnostics.length > 0) return { ok: false, diagnostics };

  const value = record as unknown as BuckReviewControl;
  if (verdictMatchesFacts(value)) return { ok: true, value, diagnostics: [] };
  return {
    ok: false,
    diagnostics: [
      diagnostic(
        "invariant_violation",
        "verdict",
        "verdict does not match the declared issue and impact facts.",
      ),
    ],
  };
}
