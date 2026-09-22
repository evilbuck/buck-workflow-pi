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
import { TypeSafeClient } from "@typesafe-ai/sdk";

/** Loose question input: `type` is validated at runtime, criteria left to the SDK. */
export interface JevQuestionInput {
  type: string;
  instructions?: unknown;
  criteria?: unknown;
}

export interface JevRequest {
  state: unknown;
  questions: Record<string, JevQuestionInput>;
  model?: string;
}

/** Structural subset of the SDK's SystemOneResult, generic over answers. */
export interface JevSystemOneResult {
  model: string;
  answers: Record<string, unknown>;
  usage: { input_tokens: number; output_tokens: number };
}

/** Minimal client surface; TypeSafeClient satisfies this. Injectable for tests. */
export interface JevClient {
  systemOne(request: JevRequest): PromiseLike<JevSystemOneResult>;
}

export interface JevToolDeps {
  /** Client factory override for tests. Default constructs the real TypeSafeClient. */
  createClient?: () => JevClient;
}

const KNOWN_QUESTION_TYPES: ReadonlySet<string> = new Set(["noul", "choice", "score"]);

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

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/** Validate tool params before contacting the SDK; returns an error message or null. */
function validateQuestions(questions: Record<string, JevQuestionInput>): string | null {
  const names = Object.keys(questions);
  if (names.length === 0) {
    return "jev requires at least one named question (noul, choice, or score).";
  }
  for (const name of names) {
    const q = questions[name];
    if (!q || typeof q !== "object" || !KNOWN_QUESTION_TYPES.has(q.type)) {
      return `jev question "${name}" has unknown type "${String(q?.type)}"; expected one of noul, choice, score.`;
    }
  }
  return null;
}

export function jevTool(createClient: () => JevClient): ToolDefinition<typeof JevParams> {
  let client: JevClient | null = null;
  return {
    name: "jev",
    label: "jev",
    description:
      "Answer named questions about a state via the TypeSafe API (Jev). " +
      "Provide `state` (text or structured), named `questions` each of type noul (yes/no probability), " +
      "choice (pick a labeled alternative), or score (ordered rubric), and an optional `model`. " +
      "Returns the full result: answers keyed by question name, model, and token usage. " +
      "Fails closed with a single error message on missing credentials or API failure — no fallback.",
    promptSnippet: "jev: calibrated classification via TypeSafe systemOne (state, questions, model?).",
    parameters: JevParams,
    async execute(_toolCallId, params) {
      const validationError = validateQuestions(params.questions);
      if (validationError) return errorResult(validationError);

      try {
        client ??= createClient();
        const request: JevRequest = { state: params.state, questions: params.questions };
        if (params.model !== undefined) request.model = params.model;
        const result = await client.systemOne(request);
        const text = JSON.stringify(result);
        return { content: [{ type: "text", text }], details: result };
      } catch (err) {
        const message = describeError(err);
        if (/api key/i.test(message)) {
          return errorResult(`jev failed closed: ${message}. Set TYPESAFE_API_KEY to use the jev tool.`);
        }
        return errorResult(`jev failed closed (no fallback performed): ${message}`);
      }
    },
  };
}

/** Production client factory. Cast reason: TypeSafeClient's generic systemOne signature exceeds the loose JevClient surface; jevTool validates the tighter runtime contract. */
function defaultCreateClient(): JevClient {
  const client = new TypeSafeClient();
  return client as unknown as JevClient;
}

export function wire(api: ExtensionAPI, deps: JevToolDeps = {}): void {
  api.registerTool(jevTool(deps.createClient ?? defaultCreateClient));
}
