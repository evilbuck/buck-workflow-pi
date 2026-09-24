/**
 * jev-tool — generic TypeSafe `systemOne` tool for OMP.
 *
 * Registers a `jev` tool that forwards `state` + named `questions`
 * (noul / choice / score) to the TypeSafe API and returns the full
 * SystemOneResult passthrough (`answers`, `model`, `usage`).
 *
 * Fail-closed contract: missing `TYPESAFE_API_KEY`, empty or malformed
 * questions, and SDK failures each produce ONE actionable error result.
 * There is no fallback model, session, or heuristic — ever. The tool is
 * generic: thresholds and consumers (e.g. b-phase's `noul >= 0.7`) live
 * outside it.
 */
import type { ExtensionAPI, ToolDefinition } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import {
  createTypeSafeEvaluator,
  type TypeSafeClientLike,
  type TypeSafeEvaluationFailure,
  type TypeSafeEvaluator,
  type TypeSafeRequest,
} from "../typed-output/evaluator.js";

export interface JevToolDeps {
  /** Client factory override for tests. Default constructs the real TypeSafeClient. */
  createClient?: () => TypeSafeClientLike;
  /** Whole evaluator override for adapter tests or runtime composition. */
  evaluate?: TypeSafeEvaluator;
}

const QuestionSchema = Type.Union([
  Type.Object({
    type: Type.Literal("noul"),
    instructions: Type.Optional(Type.Unknown()),
    criteria: Type.Optional(Type.Unknown()),
  }),
  Type.Object({
    type: Type.Literal("choice"),
    instructions: Type.Optional(Type.Unknown()),
    criteria: Type.Optional(Type.Unknown()),
  }),
  Type.Object({
    type: Type.Literal("score"),
    instructions: Type.Optional(Type.Unknown()),
    criteria: Type.Optional(Type.Unknown()),
  }),
]);

const JevParams = Type.Object({
  state: Type.Unknown(),
  questions: Type.Record(Type.String(), QuestionSchema),
  model: Type.Optional(Type.String({ description: "Optional model override, e.g. jev-2" })),
});

interface JevError {
  error: true;
  message: string;
}

function errorResult(message: string): { content: Array<{ type: "text"; text: string }>; details: JevError } {
  const payload: JevError = { error: true, message };
  return { content: [{ type: "text", text: JSON.stringify(payload) }], details: payload };
}

function evaluationErrorResult(failure: TypeSafeEvaluationFailure) {
  if (failure.code === "missing_credentials") {
    return errorResult(
      "jev failed closed: " + failure.message + " Set TYPESAFE_API_KEY to use the jev tool.",
    );
  }
  if (failure.code === "provider_unavailable") {
    return errorResult("jev failed closed (no fallback performed): " + failure.message);
  }
  return errorResult("jev failed closed: " + failure.message);
}

export function jevTool(evaluate: TypeSafeEvaluator): ToolDefinition<typeof JevParams> {
  return {
    name: "jev",
    label: "jev",
    description:
      "Answer named questions about a state via the TypeSafe API (Jev). " +
      "Provide 'state' (text or structured), named 'questions' each of type noul (yes/no probability), " +
      "choice (pick a labeled alternative), or score (ordered rubric), and an optional 'model'. " +
      "Returns the full result: answers keyed by question name, model, and token usage. " +
      "Fails closed with a single error message on missing credentials or API failure — no fallback.",
    promptSnippet: "jev: calibrated classification via TypeSafe systemOne (state, questions, model?).",
    parameters: JevParams,
    async execute(_toolCallId, params) {
      const request: TypeSafeRequest = { state: params.state, questions: params.questions };
      if (params.model !== undefined) request.model = params.model;
      const { raw, details } = await runJev(evaluate, request);
      return { content: [{ type: "text", text: raw }], details };
    },
  };
}

/**
 * Typed evaluation core shared by the `jev` tool and direct callers.
 * Library callers have no ExtensionContext; the tool wrapper ignores it too.
 */
export async function runJev(
  evaluate: TypeSafeEvaluator,
  request: TypeSafeRequest,
): Promise<{ raw: string; details: unknown }> {
  const evaluation = await evaluate(request);
  if (!evaluation.ok) {
    const failed = evaluationErrorResult(evaluation.failure);
    return { raw: failed.content.map((part) => part.text).join(""), details: failed.details };
  }
  const text = JSON.stringify(evaluation.result);
  return { raw: text, details: evaluation.result };
}

export function wire(api: ExtensionAPI, deps: JevToolDeps = {}): void {
  const evaluate = deps.evaluate ?? createTypeSafeEvaluator({ createClient: deps.createClient });
  api.registerTool(jevTool(evaluate));
}
