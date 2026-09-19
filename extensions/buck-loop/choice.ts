/**
 * Closed-set choice: ask a language model to pick **one** legal action.
 *
 * This is not a coding session. The model gets no tools, cannot edit files,
 * and cannot invent a new action name. We send a short prompt listing the
 * legal enum, parse JSON `{ "choice": "...", "reason": "..." }`, and
 * reject anything outside that set.
 *
 * Host API used here: `runOmpModelSession` (from `extensions/omp-models.ts`).
 * That helper starts a tiny nested agent session with an empty tool list,
 * waits up to 60s, and returns the model's text. We do not talk to
 * `ExtensionAPI` ourselves.
 *
 * Contract:
 * 1. Empty legal set → blocked, no model call.
 * 2. First reply illegal / empty / non-JSON → one retry with a correction prefix.
 * 3. Second failure → blocked. Never default-advance.
 * 4. Every attempt writes `.context/<subject>/transition-audits/<id>.json`.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { resolveOmpRole, runOmpModelSession, type ActivityEvent } from "../omp-models.js";
import type { AcceptedChoice, Choice } from "./types.js";
import { serializeCallError, type CallAgent, type CallFailureDetails } from "./call-failure.js";

/** Accepted legal choice, or blocked with an optional diagnostic failure. */
export type ChooseResult =
  | { status: "accepted"; accepted: AcceptedChoice }
  | { status: "blocked"; reason: string; failure?: CallFailureDetails };

type ParsedResponse = { choice: string; reason: string };
type AttemptResult = {
  response: ParsedResponse | null;
  reason: string;
  failure?: CallFailureDetails;
};

/** Pull the first `{...}` out of a model reply, including fenced ```json blocks. */
function extractJsonObject(raw: string): unknown | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const stripped = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const firstBrace = stripped.indexOf("{");
  const lastBrace = stripped.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace < firstBrace) return null;
  try {
    return JSON.parse(stripped.slice(firstBrace, lastBrace + 1));
  } catch {
    return null;
  }
}

/** Require `{ choice, reason }` strings where `choice` is in the legal set. */
function parseChoice(raw: string, legalKinds: ReadonlySet<string>): ParsedResponse | null {
  const parsed = extractJsonObject(raw);
  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed) ||
    typeof (parsed as Record<string, unknown>).choice !== "string" ||
    typeof (parsed as Record<string, unknown>).reason !== "string"
  ) {
    return null;
  }
  const response = parsed as ParsedResponse;
  return legalKinds.has(response.choice) ? response : null;
}

/**
 * Prompt listing only the legal enum. `correction` prefixes the retry so
 * the model knows the previous reply was rejected.
 */
function promptFor(legalKinds: readonly string[], correction: boolean, context?: string): string {
  const set = legalKinds.map((kind) => JSON.stringify(kind)).join(", ");
  const prefix = correction ? "Your previous response was illegal or malformed. " : "";
  return `${prefix}${context ? `Decision context: ${context}. ` : ""}Choose exactly one action from this legal enum: ${set}. Reply only with JSON: { "choice": "<one legal kind>", "reason": "..." }.`;
}

/** Append one attempt to `.context/<subject>/transition-audits/` (legal set, raw text, accepted). */
async function writeAudit(opts: {
  cwd: string;
  subject: string;
  legal: readonly Choice[];
  raw: string;
  parsed: unknown | null;
  accepted: boolean;
  reason: string;
  context?: string;
  attempt: number;
}): Promise<void> {
  const directory = join(opts.cwd, ".context", opts.subject, "transition-audits");
  await mkdir(directory, { recursive: true });
  const name = `${Date.now()}-${opts.attempt}-${randomUUID()}.json`;
  await writeFile(join(directory, name), `${JSON.stringify({
    legal: opts.legal,
    raw: opts.raw,
    parsed: opts.parsed,
    accepted: opts.accepted,
    reason: opts.reason,
    context: opts.context,
    attempt: opts.attempt,
  }, null, 2)}\n`);
}

/**
 * Ask the model to pick from `legal`. Two attempts, then block.
 *
 * `resolveOmpRole` reads the operator's OMP model-role mapping (`smol`,
 * then `default`) so we use the cheap/fast model for this tiny JSON call.
 */
export async function choose(opts: {
  cwd: string;
  subject: string;
  legal: readonly Choice[];
  context?: string;
  onActivity?: (event: ActivityEvent) => void;
}): Promise<ChooseResult> {
  if (opts.legal.length === 0) {
    return { status: "blocked", reason: "No legal choices were supplied." };
  }

  const legalKinds = opts.legal.map((choice) => choice.kind);
  const legalSet = new Set(legalKinds);
  const model = resolveOmpRole(opts.cwd, "smol") ?? resolveOmpRole(opts.cwd, "default");
  let lastReason = "The model did not return a valid legal choice.";
  let lastFailure: CallFailureDetails | undefined;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const result = await attemptChoice(opts, legalSet, model, attempt, lastReason);
    if (result.response) {
      return {
        status: "accepted",
        accepted: { choice: { kind: result.response.choice } as Choice, reason: result.response.reason },
      };
    }
    lastReason = result.reason;
    lastFailure = result.failure;
  }

  return { status: "blocked", reason: lastReason, ...(lastFailure ? { failure: lastFailure } : {}) };
}

async function attemptChoice(
  opts: { cwd: string; subject: string; legal: readonly Choice[]; context?: string; onActivity?: (event: ActivityEvent) => void },
  legalSet: ReadonlySet<string>,
  model: string | undefined,
  attempt: number,
  fallbackReason: string,
): Promise<AttemptResult> {
  const prompt = promptFor([...legalSet], attempt === 2, opts.context);
  const agent: CallAgent = {
    kind: "choice-session",
    id: "buck-loop-choice-" + randomUUID(),
    role: "closed-set-choice",
    ...(model ? { model } : {}),
  };
  const called = await callChoiceModel(opts.cwd, prompt, agent, model, opts.onActivity);
  const response = parseChoice(called.raw, legalSet);
  const reason = response?.reason ?? called.reason ?? fallbackReason;
  const failure = response ? undefined : invalidChoiceFailure(prompt, agent, called.raw, reason, called.error);
  try {
    await writeAudit({
      cwd: opts.cwd, subject: opts.subject, legal: opts.legal, context: opts.context, raw: called.raw,
      parsed: extractJsonObject(called.raw), accepted: response !== null, reason, attempt,
    });
  } catch (error) {
    return { response: null, reason: `could not write choice audit: ${error instanceof Error ? error.message : String(error)}` };
  }
  return { response, reason, ...(failure ? { failure } : {}) };
}

/**
 * One tool-less model call. Empty `tools` means the model cannot read or
 * edit the repo — it can only return text. `onActivity` forwards streaming
 * tokens into the live progress widget.
 */
async function callChoiceModel(
  cwd: string,
  prompt: string,
  agent: CallAgent,
  model: string | undefined,
  onActivity: ((event: ActivityEvent) => void) | undefined,
): Promise<{ raw: string; reason?: string; error?: unknown }> {
  try {
    const raw = await runOmpModelSession({
      cwd,
      tools: [],
      prompt,
      modelOverride: model,
      timeoutMs: 60_000,
      agentPrefix: "buck-loop-choice",
      agentId: agent.id,
      onActivity,
    });
    return { raw };
  } catch (error) {
    return {
      raw: "",
      reason: error instanceof Error ? error.message : "Model session failed.",
      error,
    };
  }
}

function invalidChoiceFailure(
  prompt: string,
  agent: CallAgent,
  raw: string,
  reason: string,
  callError: unknown,
): CallFailureDetails {
  const error = callError ?? {
    name: "InvalidChoiceResponseError",
    message: reason,
    rawResponse: raw,
  };
  return { prompt, agent, error: serializeCallError(error) };
}
