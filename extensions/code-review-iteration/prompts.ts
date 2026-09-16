/**
 * prompts — reviewer persona parsing and invariant prompt assembly.
 *
 * The reviewer prompt is layered: an invariant envelope (target identity,
 * read-only boundary, output schema, criticality math, hardness vocabulary,
 * pass id) is always retained; `prompts/reviewer.md` and the selected
 * persona are the editable guidance layers. `--replace-reviewer-prompt`
 * replaces exactly those two layers — never the envelope, never the Fixer
 * prompt.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseFrontmatter, FrontmatterParseError } from "./frontmatter.js";

export interface Persona {
  name: string;
  description: string;
  defaultModel: string | null;
  defaultTemperature: number | null;
  body: string;
  file: string;
}

export class PersonaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PersonaError";
  }
}

/** Parse one persona file: small frontmatter + prompt body. */
export function parsePersona(text: string, file: string): Persona {
  let data;
  let body: string;
  try {
    const parsed = parseFrontmatter(text);
    data = parsed.data;
    body = parsed.body.trim();
  } catch (e: unknown) {
    const message = e instanceof FrontmatterParseError ? e.message : String(e);
    throw new PersonaError(`${file}: parse failed — ${message}`);
  }
  const str = (key: string): string | null => {
    const value = data[key];
    return typeof value === "string" && value !== "" ? value : null;
  };
  const name = str("name");
  if (!name) throw new PersonaError(`${file}: missing \`name\``);
  const temp = str("default_temperature");
  if (temp !== null && !/^\d(\.\d+)?$/.test(temp)) {
    throw new PersonaError(`${file}: default_temperature must be a number 0–2`);
  }
  if (body === "") throw new PersonaError(`${file}: persona body is empty`);
  return {
    name,
    description: str("description") ?? "",
    defaultModel: str("default_model"),
    defaultTemperature: temp !== null ? Number(temp) : null,
    body,
    file,
  };
}

export interface PersonaLoad {
  personas: Map<string, Persona>;
  errors: string[];
}

/** Load every persona in a directory, keyed by persona name. */
export function loadPersonas(dir: string): PersonaLoad {
  const result: PersonaLoad = { personas: new Map(), errors: [] };
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".md")).sort();
  } catch {
    result.errors.push(`persona directory not readable: ${dir}`);
    return result;
  }
  for (const file of files) {
    try {
      const persona = parsePersona(readFileSync(join(dir, file), "utf-8"), file);
      if (result.personas.has(persona.name)) {
        result.errors.push(`duplicate persona name ${persona.name} (${file})`);
        continue;
      }
      result.personas.set(persona.name, persona);
    } catch (e: unknown) {
      result.errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  return result;
}

export interface ModelResolution {
  model: string | null;
  source: string;
}

/**
 * Reviewer model precedence: explicit provider/model → explicit OMP role →
 * persona default → `modelRoles.reviewer` → OMP default.
 */
export function resolveReviewerModel(opts: {
  explicitModel?: string;
  explicitRole?: string;
  personaDefault?: string | null;
  ompRoles: Record<string, string>;
}): ModelResolution {
  if (opts.explicitModel) return { model: opts.explicitModel, source: "explicit --reviewer-model" };
  if (opts.explicitRole) {
    const model = opts.ompRoles[opts.explicitRole];
    if (model) return { model, source: `role --reviewer-role=${opts.explicitRole}` };
  }
  if (opts.personaDefault) return { model: opts.personaDefault, source: "persona default_model" };
  const reviewerRole = opts.ompRoles.reviewer;
  if (reviewerRole) return { model: reviewerRole, source: "modelRoles.reviewer" };
  const fallback = opts.ompRoles.default;
  if (fallback) return { model: fallback, source: "OMP default" };
  return { model: null, source: "unresolved (session default)" };
}

/** Temperature precedence: explicit flag → persona default → provider default. */
export function resolveTemperature(explicit: number | undefined, persona: Persona | null): number | null {
  if (explicit !== undefined) return explicit;
  return persona?.defaultTemperature ?? null;
}

/** The invariant output contract every reviewer must satisfy. */
export function findingsSchemaContract(): string {
  return [
    "Return your complete result as a single JSON object of the form:",
    '{"findings": [',
    "  {",
    '    "id": "F1",  "title": "short defect name",',
    '    "location": "path/to/file.ts:120 or symbol",',
    '    "observed": "what the code does today",',
    '    "expected": "what it should do",',
    '    "evidence": "concrete code/test evidence, non-prescriptive",',
    '    "impact": 0-4,  "likelihood": 0-3,  "breadth": 0-2,  "confidence": 0|1,',
    '    "security_boundary_exploitable": false, "irreversible_data_loss": false,',
    '    "primary_path_blocker": false, "style_only": false,',
    '    "fix_hardness": "easy" | "medium" | "hard",',
    '    "reproduction": {"status": "reproduced" | "not_reproduced" | "not_run" | "not_applicable", "command_ids": ["<review_exec id>"], "note": "..."}',
    "  }",
    "]}",
    "impact 0-4: 0 none · 1 local inconvenience · 2 secondary behavior wrong/recoverable · 3 primary behavior or meaningful integrity/security failure · 4 authorization/privacy breach, irreversible data loss, or systemic outage.",
    "likelihood 0-3: 0 no concrete trigger · 1 rare prerequisites · 2 plausible real path · 3 deterministic or common.",
    "breadth 0-2: 0 one narrow path · 1 shared component/multiple users · 2 system-wide or externally exposed.",
    "Criticality score 2·impact + likelihood + breadth (0-13); the extension computes the rating — never self-assign severity labels.",
    "fix_hardness is the capability needed to verify and repair, independent of impact.",
    '"reproduced" requires at least one command_id from a review_exec call you actually made.',
  ].join("\n");
}

export interface ReviewerPromptInput {
  branch: string | null;
  reviewedHead: string;
  baseBranch: string;
  baseCommit: string | null;
  pass: number;
  baseGuidance: string;
  personaBody: string | null;
  appendContext: string | null;
  replacementGuidance: string | null;
}

/**
 * Assemble the reviewer prompt. Appends supplied context after base guidance
 * and persona; replacement omits exactly those editable layers.
 */
export function assembleReviewerPrompt(input: ReviewerPromptInput): string {
  const lines: string[] = [
    "You are an isolated, read-only code reviewer.",
    `Review target: branch ${input.branch ?? "(detached)"} at ${input.reviewedHead}.`,
    `Fresh base: origin/${input.baseBranch}${input.baseCommit ? ` at ${input.baseCommit}` : ""}.`,
    `Review pass #${input.pass}.`,
    "",
    "## Boundaries (invariant)",
    "- You have read, search, and list tools plus `review_exec` for reproduction.",
    "- You have NO edit, write, or general shell tool. Never attempt to modify anything.",
    "- review_exec takes a command id, a full argv array, and an optional repo-relative cwd. Denied commands return a policy reason; there is no fallback.",
    "- Commands run with host network access but a sanitized, credential-free environment. Reproduction is optional; a finding may be valid without it.",
    "",
    "## Output contract (invariant)",
    findingsSchemaContract(),
    "",
  ];
  if (input.replacementGuidance !== null) {
    lines.push("## Review guidance (operator-supplied replacement)", input.replacementGuidance, "");
  } else {
    lines.push("## Base review guidance", input.baseGuidance.trim(), "");
    if (input.personaBody !== null) {
      lines.push("## Reviewer persona", input.personaBody.trim(), "");
    }
  }
  if (input.appendContext !== null && input.appendContext !== "") {
    lines.push("## Additional context from the operator", input.appendContext.trim(), "");
  }
  return lines.join("\n");
}

/** Fixer prompt: verify each finding independently before editing anything. */
export function assembleFixerPrompt(opts: {
  passDir: string;
  blockingFindings: string;
  baseBranch: string;
}): string {
  return [
    "You are an isolated Fixer working in the repository's mutable checkout.",
    `Base branch context: origin/${opts.baseBranch}.`,
    `The validated findings for this pass are in ${opts.passDir} (review.json and review.md).`,
    "",
    "## Procedure (invariant)",
    "1. For EACH blocking finding: independently verify it against the code before editing. Do not trust the finding text.",
    "2. Record a disposition per finding: valid, invalid, already_fixed, or blocked — with a one-line reason.",
    "3. Edit only findings you verified as valid. Preserve behavior unless the finding requires a change.",
    "4. Never rewrite unrelated code, never reformat, never expand scope.",
    "5. When every valid finding is fixed, emit a single JSON object:",
    '{"dispositions": [{"finding_id": "F1", "disposition": "valid" | "invalid" | "already_fixed" | "blocked", "note": "..."}]}',
    "",
    "## Blocking findings",
    opts.blockingFindings,
  ].join("\n");
}
