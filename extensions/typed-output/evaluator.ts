import { TypeSafeClient } from "@typesafe-ai/sdk";

export interface TypeSafeQuestionInput {
  type: string;
  instructions?: unknown;
  criteria?: unknown;
}

export interface TypeSafeRequest {
  state: unknown;
  questions: Record<string, TypeSafeQuestionInput>;
  model?: string;
}

export interface TypeSafeResult {
  model: string;
  answers: Record<string, unknown>;
  usage: { input_tokens: number; output_tokens: number };
}

export interface TypeSafeClientLike {
  systemOne(request: TypeSafeRequest): PromiseLike<TypeSafeResult>;
}

export type TypeSafeEvaluationFailureCode =
  | "invalid_request"
  | "missing_credentials"
  | "provider_unavailable";

export interface TypeSafeEvaluationFailure {
  code: TypeSafeEvaluationFailureCode;
  message: string;
}

export type TypeSafeEvaluation =
  | { ok: true; result: TypeSafeResult }
  | { ok: false; failure: TypeSafeEvaluationFailure };

export interface TypeSafeEvaluatorDeps {
  createClient?: () => TypeSafeClientLike;
}

export type TypeSafeEvaluator = (request: TypeSafeRequest) => Promise<TypeSafeEvaluation>;

function invalid(message: string): TypeSafeEvaluation {
  return { ok: false, failure: { code: "invalid_request", message } };
}

function validateNoulCriteria(name: string, criteria: unknown): string | null {
  if (criteria === undefined || criteria === null) return null;
  if (typeof criteria === "object" && !Array.isArray(criteria)) return null;
  return `TypeSafe noul question "${name}" criteria must be an object or null.`;
}

function validateChoiceCriteria(name: string, criteria: unknown): string | null {
  if (
    typeof criteria === "object" &&
    criteria !== null &&
    !Array.isArray(criteria) &&
    Object.keys(criteria).length >= 2
  ) {
    return null;
  }
  return `TypeSafe choice question "${name}" requires at least two criteria labels.`;
}

function validateScoreCriteria(name: string, criteria: unknown): string | null {
  if (Array.isArray(criteria) && criteria.length >= 2) return null;
  return `TypeSafe score question "${name}" requires at least two ordered criteria.`;
}

function validateQuestion(name: string, question: unknown): string | null {
  if (!name.trim()) return "TypeSafe question names must not be empty.";
  if (typeof question !== "object" || question === null || Array.isArray(question)) {
    return `TypeSafe question "${name}" must be an object.`;
  }

  const value = question as TypeSafeQuestionInput;
  switch (value.type) {
    case "noul":
      return validateNoulCriteria(name, value.criteria);
    case "choice":
      return validateChoiceCriteria(name, value.criteria);
    case "score":
      return validateScoreCriteria(name, value.criteria);
    default:
      return `TypeSafe question "${name}" has unknown type "${String(value.type)}"; expected noul, choice, or score.`;
  }
}

function validateQuestions(questions: unknown): string | null {
  if (
    typeof questions !== "object" ||
    questions === null ||
    Array.isArray(questions) ||
    Object.keys(questions).length === 0
  ) {
    return "TypeSafe evaluation requires at least one named question.";
  }
  return null;
}

function validateModel(model: unknown): string | null {
  if (model === undefined || (typeof model === "string" && model.trim() !== "")) return null;
  return "TypeSafe model override must be a non-empty string.";
}

function validateRequest(request: TypeSafeRequest): string | null {
  if (!Object.prototype.hasOwnProperty.call(request, "state")) {
    return "TypeSafe evaluation requires state; use null for an intentionally empty state.";
  }
  const questionsError = validateQuestions(request.questions);
  if (questionsError) return questionsError;
  const modelError = validateModel(request.model);
  if (modelError) return modelError;
  for (const [name, question] of Object.entries(request.questions)) {
    const questionError = validateQuestion(name, question);
    if (questionError) return questionError;
  }
  return null;
}

function providerUnavailableMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const status = raw.match(/\b([45]\d{2})\b/)?.[1];
  return status
    ? `TypeSafe evaluation is unavailable (HTTP ${status}).`
    : "TypeSafe evaluation is unavailable.";
}

function defaultCreateClient(): TypeSafeClientLike {
  return new TypeSafeClient() as unknown as TypeSafeClientLike;
}

export function createTypeSafeEvaluator(
  deps: TypeSafeEvaluatorDeps = {},
): TypeSafeEvaluator {
  const createClient = deps.createClient ?? defaultCreateClient;
  let client: TypeSafeClientLike | null = null;

  return async (request) => {
    const validationError = validateRequest(request);
    if (validationError) return invalid(validationError);

    try {
      client ??= createClient();
      return { ok: true, result: await client.systemOne(request) };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/api key/i.test(message)) {
        return {
          ok: false,
          failure: {
            code: "missing_credentials",
            message: "TypeSafe API key is unavailable.",
          },
        };
      }
      return {
        ok: false,
        failure: {
          code: "provider_unavailable",
          message: providerUnavailableMessage(error),
        },
      };
    }
  };
}
