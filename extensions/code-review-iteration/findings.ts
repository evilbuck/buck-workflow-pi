/**
 * findings — validate the Reviewer's structured finding payload and compute
 * deterministic criticality ratings from the fixed rubric.
 *
 * The Reviewer reports raw rubric inputs; the extension (never the model)
 * computes score/rating/blocking. Reproduction claims citing command ids are
 * cross-checked against the recorded command evidence for the pass.
 */

import {
  computeCriticality,
  isHardness,
  validateCriticalityInputs,
  type Hardness,
  type Rating,
} from "./rubric.js";

export const REPRODUCTION_STATUSES: readonly string[] = [
  "reproduced",
  "not_reproduced",
  "not_run",
  "not_applicable",
];

/** Expected per-finding shape; every field arrives unvalidated. */
export interface FindingPayload {
  id: unknown;
  title: unknown;
  location: unknown;
  observed: unknown;
  expected: unknown;
  evidence: unknown;
  impact: unknown;
  likelihood: unknown;
  breadth: unknown;
  confidence: unknown;
  security_boundary_exploitable?: unknown;
  irreversible_data_loss?: unknown;
  primary_path_blocker?: unknown;
  style_only?: unknown;
  fix_hardness: unknown;
  reproduction: unknown;
}

export interface ValidatedFinding {
  id: string;
  title: string;
  location: string;
  observed: string;
  expected: string;
  evidence: string;
  confidence: number;
  floors: {
    securityBoundaryExploitable: boolean;
    irreversibleDataLoss: boolean;
    primaryPathBlocker: boolean;
    styleOnly: boolean;
  };
  fixHardness: Hardness;
  reproduction: { status: string; commandIds: string[]; note: string };
  score: number;
  rating: Rating;
  blocking: boolean;
}

export interface FindingsValidation {
  findings: ValidatedFinding[];
  errors: string[];
}

/** Extract a JSON payload from model text: bare, fenced, or embedded object. */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(trimmed);
  const candidates = [trimmed, fenced ? fenced[1].trim() : ""].filter(Boolean);
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // try next strategy
    }
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }
  throw new Error("no JSON payload found in reviewer output");
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function asIntInRange(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : null;
}

interface Reproduction {
  status: unknown;
  commandIdsRaw: unknown;
  note: unknown;
}

function readReproduction(raw: unknown, ctx: string, errors: string[]): Reproduction | null {
  if (typeof raw !== "object" || raw === null) {
    errors.push(`${ctx}: reproduction must be an object`);
    return null;
  }
  if (!("status" in raw)) {
    errors.push(`${ctx}: reproduction.status is required`);
    return null;
  }
  return {
    status: raw.status,
    commandIdsRaw: "command_ids" in raw ? raw.command_ids : undefined,
    note: "note" in raw ? raw.note : undefined,
  };
}

function validateReproduction(
  raw: unknown,
  knownCommandIds: ReadonlySet<string>,
  ctx: string,
  errors: string[],
): { status: string; commandIds: string[]; note: string } | null {
  const repro = readReproduction(raw, ctx, errors);
  if (repro === null) return null;
  if (typeof repro.status !== "string" || !REPRODUCTION_STATUSES.includes(repro.status)) {
    errors.push(`${ctx}: reproduction.status must be one of ${REPRODUCTION_STATUSES.join(", ")}`);
    return null;
  }
  const note = typeof repro.note === "string" ? repro.note : "";
  const commandIds = Array.isArray(repro.commandIdsRaw) ? repro.commandIdsRaw.map((id) => String(id)) : [];
  if (repro.status === "reproduced") {
    let invalid = false;
    if (commandIds.length === 0) {
      errors.push(`${ctx}: reproduction status "reproduced" requires at least one command_id`);
      invalid = true;
    }
    for (const id of commandIds) {
      if (!knownCommandIds.has(id)) {
        errors.push(`${ctx}: reproduction cites unknown command_id ${id}`);
        invalid = true;
      }
    }
    if (invalid) return null;
  }
  return { status: repro.status, commandIds, note };
}

const STRING_FIELDS = ["title", "location", "observed", "expected", "evidence"] as const;

/**
 * Validate a parsed reviewer payload (`{ findings: [...] }`).
 * Rubric computation happens here; the model never reports its own rating.
 */
export function validateFindingsPayload(
  payload: unknown,
  knownCommandIds: ReadonlySet<string> = new Set(),
): FindingsValidation {
  const errors: string[] = [];
  const findings: ValidatedFinding[] = [];
  if (typeof payload !== "object" || payload === null || !("findings" in payload) || !Array.isArray(payload.findings)) {
    return { findings, errors: ["payload must be an object with a findings array"] };
  }
  const seen = new Set<string>();
  for (const item of payload.findings) {
    const raw = (item ?? {}) as FindingPayload;
    const id = asString(raw.id);
    const ctx = `finding ${id ?? "<missing id>"}`;
    if (!id) {
      errors.push(`${ctx}: id must be a non-empty string`);
      continue;
    }
    if (seen.has(id)) {
      errors.push(`${ctx}: duplicate id`);
      continue;
    }
    seen.add(id);
    const missing = STRING_FIELDS.filter((key) => asString(raw[key]) === null);
    if (missing.length > 0) {
      errors.push(`${ctx}: ${missing.join(", ")} must be non-empty strings`);
      continue;
    }
    const confidence = asIntInRange(raw.confidence, 0, 1);
    if (confidence === null) {
      errors.push(`${ctx}: confidence must be an integer 0 or 1`);
      continue;
    }
    if (!isHardness(raw.fix_hardness)) {
      errors.push(`${ctx}: fix_hardness must be easy, medium, or hard`);
      continue;
    }
    const inputs = { impact: raw.impact, likelihood: raw.likelihood, breadth: raw.breadth };
    const inputErrors = validateCriticalityInputs(inputs as { impact: number; likelihood: number; breadth: number });
    if (inputErrors.length > 0) {
      errors.push(`${ctx}: ${inputErrors.join("; ")}`);
      continue;
    }
    const reproduction = validateReproduction(raw.reproduction, knownCommandIds, ctx, errors);
    if (!reproduction) continue;
    const floors = {
      securityBoundaryExploitable: raw.security_boundary_exploitable === true,
      irreversibleDataLoss: raw.irreversible_data_loss === true,
      primaryPathBlocker: raw.primary_path_blocker === true,
      styleOnly: raw.style_only === true,
    };
    const { score, rating } = computeCriticality(inputs as { impact: number; likelihood: number; breadth: number }, floors);
    findings.push({
      id,
      title: raw.title as string,
      location: raw.location as string,
      observed: raw.observed as string,
      expected: raw.expected as string,
      evidence: raw.evidence as string,
      confidence,
      floors,
      fixHardness: raw.fix_hardness,
      reproduction,
      score,
      rating,
      blocking: rating === "medium" || rating === "high" || rating === "critical",
    });
  }
  return { findings, errors };
}

/** Maximum fix hardness among a pass's blocking findings (routing input). */
export function maxBlockingHardness(findings: ValidatedFinding[]): Hardness | null {
  const tiers: Hardness[] = ["hard", "medium", "easy"];
  for (const tier of tiers) {
    if (findings.some((f) => f.blocking && f.fixHardness === tier)) return tier;
  }
  return null;
}
