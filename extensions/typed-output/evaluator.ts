import {
  TypeSafeClient,
  type EntryType,
  type JsonValue,
  type Questions,
  type SystemOneRequest,
  type SystemOneResult,
} from "@typesafe-ai/sdk";

export interface TypeSafeQuestionInput {
  type: string;
  instructions?: unknown;
  criteria?: unknown;
}

/** Untrusted tool input; validation narrows it to the SDK contract before dispatch. */
export interface TypeSafeRequest {
  state: unknown;
  questions: Record<string, TypeSafeQuestionInput>;
  model?: string;
}

export type TypeSafeResult = SystemOneResult<Questions>;
type ValidatedTypeSafeRequest = SystemOneRequest<Questions>;

export interface TypeSafeClientLike {
  systemOne(request: ValidatedTypeSafeRequest): PromiseLike<TypeSafeResult>;
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

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function isJsonValue(value: unknown, ancestors = new Set<object>()): value is JsonValue {
  switch (typeof value) {
    case "string":
    case "boolean":
      return true;
    case "number":
      return Number.isFinite(value);
    case "object": {
      if (value === null) return true;
      try {
        if (ancestors.has(value)) return false;
        const isArray = Array.isArray(value);
        if (!isArray) {
          const prototype = Object.getPrototypeOf(value);
          if (prototype !== Object.prototype && prototype !== null) return false;
        }
        ancestors.add(value);
        const valid = isArray
          ? value.every((item) => isJsonValue(item, ancestors))
          : Object.values(value).every((item) => isJsonValue(item, ancestors));
        ancestors.delete(value);
        return valid;
      } catch {
        return false;
      }
    }
    default:
      return false;
  }
}

function isEntryType(value: unknown): value is EntryType {
  return value === null || typeof value === "string" || (typeof value === "object" && isJsonValue(value));
}

function criteriaEntriesAreValid(criteria: Record<string, unknown>): boolean {
  try {
    return Object.values(criteria).every(isEntryType);
  } catch {
    return false;
  }
}

function validateNoulCriteria(name: string, criteria: unknown): string | null {
  if (criteria === undefined || criteria === null) return null;
  const value = asRecord(criteria);
  if (value !== null && isJsonValue(criteria) && criteriaEntriesAreValid(value)) return null;
  return 'TypeSafe noul question "' + name + '" criteria must be an object or null.';
}

function validateChoiceCriteria(name: string, criteria: unknown): string | null {
  const value = asRecord(criteria);
  if (
    value !== null &&
    Object.keys(value).length >= 2 &&
    isJsonValue(criteria) &&
    criteriaEntriesAreValid(value)
  ) {
    return null;
  }
  return 'TypeSafe choice question "' + name + '" requires at least two JSON-compatible criteria labels.';
}

function validateScoreCriteria(name: string, criteria: unknown): string | null {
  if (Array.isArray(criteria) && criteria.length >= 2 && criteria.every(isEntryType)) {
    return null;
  }
  return 'TypeSafe score question "' + name + '" requires at least two JSON-compatible ordered criteria.';
}

function validateInstructions(name: string, instructions: unknown): string | null {
  if (instructions === undefined || isEntryType(instructions)) return null;
  return 'TypeSafe question "' + name + '" instructions must be JSON-compatible.';
}

function validateQuestion(name: string, question: unknown): string | null {
  if (!name.trim()) return "TypeSafe question names must not be empty.";
  const value = asRecord(question);
  if (value === null) return 'TypeSafe question "' + name + '" must be an object.';

  const instructionsError = validateInstructions(name, value.instructions);
  if (instructionsError) return instructionsError;
  switch (value.type) {
    case "noul":
      return validateNoulCriteria(name, value.criteria);
    case "choice":
      return validateChoiceCriteria(name, value.criteria);
    case "score":
      return validateScoreCriteria(name, value.criteria);
    default:
      return 'TypeSafe question "' + name + '" has unknown type "' + String(value.type) + '"; expected noul, choice, or score.';
  }
}

function validateQuestions(questions: unknown): Record<string, unknown> | string {
  const value = asRecord(questions);
  if (value === null || Object.keys(value).length === 0) {
    return "TypeSafe evaluation requires at least one named question.";
  }
  return value;
}

function validateModel(model: unknown): string | null {
  if (model === undefined || (typeof model === "string" && model.trim() !== "")) return null;
  return "TypeSafe model override must be a non-empty string.";
}

function validateRequest(request: unknown): ValidatedTypeSafeRequest | string {
  const value = asRecord(request);
  if (value === null) return "TypeSafe evaluation request must be an object.";
  if (!Object.prototype.hasOwnProperty.call(value, "state")) {
    return "TypeSafe evaluation requires state; use null for an intentionally empty state.";
  }
  if (!isEntryType(value.state)) {
    return "TypeSafe evaluation state must be a string, JSON object, JSON array, or null.";
  }
  const questions = validateQuestions(value.questions);
  if (typeof questions === "string") return questions;
  const modelError = validateModel(value.model);
  if (modelError) return modelError;
  for (const [name, question] of Object.entries(questions)) {
    const questionError = validateQuestion(name, question);
    if (questionError) return questionError;
  }
  const validated: ValidatedTypeSafeRequest = {
    state: value.state,
    questions: questions as Questions,
  };
  if (typeof value.model === "string") validated.model = value.model;
  return validated;
}

function providerUnavailableMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const status = raw.match(/\b([45]\d{2})\b/)?.[1];
  return status
    ? `TypeSafe evaluation is unavailable (HTTP ${status}).`
    : "TypeSafe evaluation is unavailable.";
}

function defaultCreateClient(): TypeSafeClientLike {
  return new TypeSafeClient();
}

export function createTypeSafeEvaluator(
  deps: TypeSafeEvaluatorDeps = {},
): TypeSafeEvaluator {
  const createClient = deps.createClient ?? defaultCreateClient;
  let client: TypeSafeClientLike | null = null;

  return async (request) => {
    const validatedRequest = validateRequest(request);
    if (typeof validatedRequest === "string") return invalid(validatedRequest);

    try {
      client ??= createClient();
      return { ok: true, result: await client.systemOne(validatedRequest) };
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
