/**
 * Closed-set choice: ask Jev for **one** legal continuation, then the
 * configured `choice` stage model if Jev fails.
 *
 * This is not a coding session. Neither caller can edit files or invent an
 * action. `block` is stripped before either call. Machine stops stay in
 * `machine.ts`; the model does not vote to halt.
 *
 * The choice-stage model is resolved before the continuation question.
 * A missing profile, stage, or candidate blocks and names the stage.
 * The tool-less fallback uses that picked id and thinking level. It does
 * not resolve the `smol` role or the host model. A failed fallback call
 * excludes that id before the next attempt. Illegal text is not a failed
 * model call. Two attempts, then the loop blocks. Never default-advance.
 *
 * Every attempt writes `.context/<subject>/transition-audits/<id>.json`.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { jevTool } from "../jev-tool/index.js";
import { runOmpModelSession, type ActivityEvent, type BuckThinking } from "../omp-models.js";
import { createTypeSafeEvaluator } from "../typed-output/evaluator.js";
import type { AcceptedChoice, Choice } from "./types.js";
import { serializeCallError, type CallAgent, type CallFailureDetails } from "./call-failure.js";
import { selectBuckStageModel, type BuckStageModelChoice } from "./run-step.js";

/** Accepted legal choice, or blocked with an optional diagnostic failure. */
export type ChooseResult =
  | { status: "accepted"; accepted: AcceptedChoice }
  | { status: "blocked"; reason: string; failure?: CallFailureDetails };

type ParsedResponse = { choice: string; reason: string };
type AttemptResult = {
  response: ParsedResponse | null;
  reason: string;
  failure?: CallFailureDetails;
  modelFailed: boolean;
};

export type ChoiceModelSelect = (input: {
  exclude: readonly string[];
  context: { continuation: string | null };
}) => Promise<BuckStageModelChoice>;
type JevAttempt = {
  ok: boolean;
  choice?: string;
  reason: string;
  raw: string;
};

const CONTINUATION_RUBRIC: Record<string, string> = {
  retry: "Run the same step again",
  advance: "Treat the step as landed and continue",
  iterate: "Run iterate on in-plan issues",
  document: "Run docs for the flagged impact",
  save: "Treat the review as clean and save",
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
function correctionPrefix(correction: boolean): string {
  if (!correction) return "";
  return "Your previous response was illegal or malformed. ";
}

function decisionPrefix(context: string | undefined): string {
  if (!context) return "";
  return `Decision context: ${context}. `;
}

function promptFor(legalKinds: readonly string[], correction: boolean, context?: string): string {
  const set = legalKinds.map((kind) => JSON.stringify(kind)).join(", ");
  return `${correctionPrefix(correction)}${decisionPrefix(context)}Choose exactly one action from this legal enum: ${set}. Reply only with JSON: { "choice": "<one legal kind>", "reason": "..." }.`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  return record;
}

function jevReason(choice: string, confidence: unknown): string {
  if (typeof confidence !== "number") return `Jev picked ${choice}`;
  return `Jev picked ${choice} (confidence ${confidence})`;
}

function readJevChoice(details: unknown, legalKinds: ReadonlySet<string>): ParsedResponse | null {
  const record = asRecord(details);
  if (!record || record.error === true) return null;
  const action = asRecord(asRecord(record.answers)?.action);
  if (!action) return null;
  const choice = action.choice;
  if (typeof choice !== "string" || !legalKinds.has(choice)) return null;
  return { choice, reason: jevReason(choice, action.confidence) };
}


function jevFailureMessage(details: unknown, raw: string): string {
  if (details && typeof details === "object" && !Array.isArray(details)) {
    const message = (details as Record<string, unknown>).message;
    if (typeof message === "string" && message.length > 0) return message;
  }
  return raw.length > 0 ? raw : "Jev did not return a legal choice.";
}

/** One `jev` tool call. Fewer than two continuations cannot form a choice question. */
async function askJev(
  legal: readonly Choice[],
  context: string | undefined,
  onActivity: ((event: ActivityEvent) => void) | undefined,
): Promise<JevAttempt> {
  const kinds = legal.map((choice) => choice.kind);
  if (kinds.length < 2) {
    return { ok: false, reason: "Jev choice needs at least two continuations.", raw: "" };
  }
  const criteria: Record<string, string> = {};
  for (const kind of kinds) criteria[kind] = CONTINUATION_RUBRIC[kind] ?? kind;
  const params = {
    state: context ?? "",
    questions: {
      action: {
        type: "choice" as const,
        instructions: "Pick exactly one next buck-loop action. The criteria labels are the only legal actions.",
        criteria,
      },
    },
  };
  try {
    const result = await jevTool(createTypeSafeEvaluator()).execute(
      "buck-loop-choice",
      params,
      undefined,
      undefined,
      undefined as never,
    );
    const raw = result.content.map((part) => ("text" in part ? part.text ?? "" : "")).join("");
    const parsed = readJevChoice(result.details, new Set(kinds));
    if (!parsed) return { ok: false, reason: jevFailureMessage(result.details, raw), raw };
    onActivity?.({ kind: "text", delta: parsed.reason });
    return { ok: true, choice: parsed.choice, reason: parsed.reason, raw };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "jev tool threw",
      raw: "",
    };
  }
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
  source: "jev" | "profile";
}): Promise<void> {
  const directory = join(opts.cwd, ".context", opts.subject, "transition-audits");
  await mkdir(directory, { recursive: true });
  const name = `${Date.now()}-${opts.source}-${opts.attempt}-${randomUUID()}.json`;
  await writeFile(join(directory, name), `${JSON.stringify({
    source: opts.source,
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
 * Ask Jev, then the configured choice-stage model, to pick a continuation.
 * `block` is never offered. Two profile attempts after a Jev miss, then
 * block. Never default-advance.
 */
export async function choose(opts: {
  cwd: string;
  subject: string;
  legal: readonly Choice[];
  context?: string;
  onActivity?: (event: ActivityEvent) => void;
  selectModel?: ChoiceModelSelect;
}): Promise<ChooseResult> {
  const offered = opts.legal.filter((choice) => choice.kind !== "block");
  if (offered.length === 0) {
    const reason = opts.legal.length > 0 ? "block is not a model choice." : "No legal choices were supplied.";
    return { status: "blocked", reason };
  }

  const continuation = { continuation: opts.context ?? null };
  const first = await resolveChoiceModel(opts, [], continuation);
  if (!first.ok) return { status: "blocked", reason: first.message };

  const jev = await askJev(offered, opts.context, opts.onActivity);
  try {
    await writeAudit({
      cwd: opts.cwd,
      subject: opts.subject,
      legal: offered,
      context: opts.context,
      raw: jev.raw,
      parsed: jev.ok ? { choice: jev.choice, reason: jev.reason } : null,
      accepted: jev.ok,
      reason: jev.reason,
      attempt: 1,
      source: "jev",
    });
  } catch (error) {
    return {
      status: "blocked",
      reason: `could not write choice audit: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  if (jev.ok && jev.choice) {
    return {
      status: "accepted",
      accepted: { choice: { kind: jev.choice } as Choice, reason: jev.reason },
    };
  }

  const legalKinds = offered.map((choice) => choice.kind);
  const legalSet = new Set(legalKinds);
  let current = first;
  const excluded: string[] = [];
  let lastReason = jev.reason;
  let lastFailure: CallFailureDetails | undefined;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const result = await attemptChoice({ ...opts, legal: offered }, legalSet, current, attempt, lastReason);
    if (result.response) {
      return {
        status: "accepted",
        accepted: { choice: { kind: result.response.choice } as Choice, reason: result.response.reason },
      };
    }
    lastReason = result.reason;
    lastFailure = result.failure;
    if (!result.modelFailed || attempt === 2) continue;
    excluded.push(current.id);
    const next = await resolveChoiceModel(opts, excluded, continuation);
    if (!next.ok) return { status: "blocked", reason: next.message, ...(lastFailure ? { failure: lastFailure } : {}) };
    current = next;
  }
  return { status: "blocked", reason: lastReason, ...(lastFailure ? { failure: lastFailure } : {}) };
}

async function resolveChoiceModel(
  opts: { cwd: string; selectModel?: ChoiceModelSelect },
  exclude: readonly string[],
  context: { continuation: string | null },
): Promise<BuckStageModelChoice> {
  if (opts.selectModel) return opts.selectModel({ exclude, context });
  return selectBuckStageModel({
    cwd: opts.cwd,
    stage: "choice",
    skill: "choice",
    context,
    exclude,
  });
}

async function attemptChoice(
  opts: { cwd: string; subject: string; legal: readonly Choice[]; context?: string; onActivity?: (event: ActivityEvent) => void },
  legalSet: ReadonlySet<string>,
  model: { id: string; thinking: BuckThinking },
  attempt: number,
  fallbackReason: string,
): Promise<AttemptResult> {
  const prompt = promptFor([...legalSet], attempt === 2, opts.context);
  const agent: CallAgent = {
    kind: "choice-session",
    id: "buck-loop-choice-" + randomUUID(),
    role: "closed-set-choice",
    model: model.id,
  };
  const called = await callChoiceModel(opts.cwd, prompt, agent, model, opts.onActivity);
  const response = parseChoice(called.raw, legalSet);
  const reason = response?.reason ?? called.reason ?? fallbackReason;
  const failure = response ? undefined : invalidChoiceFailure(prompt, agent, called.raw, reason, called.error);
  try {
    await writeAudit({
      cwd: opts.cwd,
      subject: opts.subject,
      legal: opts.legal,
      context: opts.context,
      raw: called.raw,
      parsed: extractJsonObject(called.raw),
      accepted: response !== null,
      reason,
      attempt,
      source: "profile",
    });
  } catch (error) {
    return { response: null, reason: `could not write choice audit: ${error instanceof Error ? error.message : String(error)}`, modelFailed: false };
  }
  return { response, reason, modelFailed: called.error !== undefined, ...(failure ? { failure } : {}) };
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
  model: { id: string; thinking: BuckThinking },
  onActivity: ((event: ActivityEvent) => void) | undefined,
): Promise<{ raw: string; reason?: string; error?: unknown }> {
  try {
    const raw = await runOmpModelSession({
      cwd,
      tools: [],
      prompt,
      modelOverride: model.id,
      thinkingLevel: model.thinking,
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
