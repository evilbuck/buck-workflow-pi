import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { resolveOmpRole, runOmpModelSession } from "../omp-models.js";
import type { AcceptedChoice, Choice } from "./types.js";

export type ChooseResult =
  | { status: "accepted"; accepted: AcceptedChoice }
  | { status: "blocked"; reason: string };

type ParsedResponse = { choice: string; reason: string };

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

function promptFor(legalKinds: readonly string[], correction: boolean): string {
  const set = legalKinds.map((kind) => JSON.stringify(kind)).join(", ");
  const prefix = correction ? "Your previous response was illegal or malformed. " : "";
  return `${prefix}Choose exactly one action from this legal enum: ${set}. Reply only with JSON: { "choice": "<one legal kind>", "reason": "..." }.`;
}

async function writeAudit(opts: {
  cwd: string;
  subject: string;
  legal: readonly Choice[];
  raw: string;
  parsed: unknown | null;
  accepted: boolean;
  reason: string;
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
    attempt: opts.attempt,
  }, null, 2)}\n`);
}

export async function choose(opts: {
  cwd: string;
  subject: string;
  legal: readonly Choice[];
}): Promise<ChooseResult> {
  if (opts.legal.length === 0) {
    return { status: "blocked", reason: "No legal choices were supplied." };
  }

  const legalKinds = opts.legal.map((choice) => choice.kind);
  const legalSet = new Set(legalKinds);
  let lastReason = "The model did not return a valid legal choice.";

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    let raw = "";
    try {
      raw = await runOmpModelSession({
        cwd: opts.cwd,
        tools: [],
        prompt: promptFor(legalKinds, attempt === 2),
        modelOverride: resolveOmpRole(opts.cwd, "smol") ?? resolveOmpRole(opts.cwd, "default"),
        timeoutMs: 60_000,
        agentPrefix: "buck-loop-choice",
      });
    } catch (error) {
      lastReason = error instanceof Error ? error.message : "Model session failed.";
    }

    const parsed = extractJsonObject(raw);
    const response = parseChoice(raw, legalSet);
    const reason = response?.reason ?? lastReason;
    try {
      await writeAudit({
        cwd: opts.cwd,
        subject: opts.subject,
        legal: opts.legal,
        raw,
        parsed,
        accepted: response !== null,
        reason,
        attempt,
      });
    } catch (error) {
      return {
        status: "blocked",
        reason: `Failed to write transition audit: ${error instanceof Error ? error.message : String(error)}`,
      };
    }

    if (response) {
      return {
        status: "accepted",
        accepted: { choice: { kind: response.choice } as Choice, reason: response.reason },
      };
    }
    lastReason = reason;
  }

  return { status: "blocked", reason: lastReason };
}
