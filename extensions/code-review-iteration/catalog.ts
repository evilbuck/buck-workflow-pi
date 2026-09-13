/**
 * catalog — editable per-model Markdown capability catalog + Fixer routing.
 *
 * One Markdown file per exact provider/model selector. YAML frontmatter is
 * the machine contract; the body records human calibration rationale.
 * Routing: lowest sufficient capability tier first, then Reviewer-model
 * exclusion, family/provider diversity, and stable priority — never runtime
 * model self-ranking. OMP runtime availability filters candidates before
 * routing; `modelRoles` is the caller's fallback when nothing is eligible.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseFrontmatter, FrontmatterParseError, type FrontmatterData } from "./frontmatter.js";
import { tierAtLeast, HARDNESSES, type Hardness } from "./rubric.js";

export const THINKING_LEVELS: readonly string[] = ["minimal", "low", "medium", "high", "xhigh"];
export const CALIBRATION_SOURCES: readonly string[] = ["seeded", "benchmarked", "user"];
export const STALENESS_DAYS = 180;
const DAY_MS = 24 * 60 * 60 * 1000;

export type Role = "reviewer" | "fixer";

export interface ModelCatalogEntry {
  selector: string;
  family: string;
  aliases: string[];
  fixerCapability: Hardness;
  roles: Role[];
  priority: number;
  thinking: Record<Hardness, string>;
  enabled: boolean;
  calibrationSource: string;
  reviewedAt: string;
  sourceFile: string;
}

export interface CatalogLoad {
  entries: ModelCatalogEntry[];
  /** Invalid or duplicate entries — catalog preflight fails visibly on these. */
  errors: string[];
  /** Staleness and non-fatal notes surfaced to activity and the report. */
  warnings: string[];
}

export class CatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogError";
  }
}

function requireString(data: FrontmatterData, key: string, file: string): string {
  const value = data[key];
  if (typeof value !== "string" || value === "") {
    throw new CatalogError(`${file}: missing or invalid \`${key}\``);
  }
  return value;
}

function requireIntInRange(data: FrontmatterData, key: string, min: number, max: number, file: string): number {
  const raw = requireString(data, key, file);
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new CatalogError(`${file}: \`${key}\` must be an integer ${min}–${max}`);
  }
  return value;
}

function requireEnum(data: FrontmatterData, key: string, values: readonly string[], file: string): string {
  const value = requireString(data, key, file);
  if (!values.includes(value)) {
    throw new CatalogError(`${file}: \`${key}\` must be one of ${values.join(", ")}`);
  }
  return value;
}

function requireBool(data: FrontmatterData, key: string, file: string): boolean {
  const value = requireString(data, key, file);
  if (value !== "true" && value !== "false") {
    throw new CatalogError(`${file}: \`${key}\` must be true or false`);
  }
  return value === "true";
}

function requireDate(data: FrontmatterData, key: string, file: string): string {
  const value = requireString(data, key, file);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) {
    throw new CatalogError(`${file}: \`${key}\` must be a YYYY-MM-DD date`);
  }
  return value;
}

function requireRoles(data: FrontmatterData, file: string): Role[] {
  const value = data.roles;
  if (!Array.isArray(value) || value.length === 0) {
    throw new CatalogError(`${file}: \`roles\` must be a non-empty list`);
  }
  const roles = value as string[];
  if (roles.some((role) => role !== "reviewer" && role !== "fixer")) {
    throw new CatalogError(`${file}: \`roles\` entries must be reviewer or fixer`);
  }
  if (new Set(roles).size !== roles.length) {
    throw new CatalogError(`${file}: \`roles\` contains duplicates`);
  }
  return roles as Role[];
}

function optionalAliases(data: FrontmatterData, file: string): string[] {
  const value = data.aliases;
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new CatalogError(`${file}: \`aliases\` must be a list`);
  }
  return value as string[];
}

/** Parse one catalog entry file. Throws CatalogError on contract violations. */
export function parseModelEntry(text: string, file: string, now = Date.now()): { entry: ModelCatalogEntry; warnings: string[] } {
  let data: FrontmatterData;
  try {
    data = parseFrontmatter(text).data;
  } catch (e: unknown) {
    const message = e instanceof FrontmatterParseError ? e.message : String(e);
    throw new CatalogError(`${file}: frontmatter parse failed — ${message}`);
  }
  if (requireString(data, "schema_version", file) !== "1") {
    throw new CatalogError(`${file}: unsupported schema_version (expected 1)`);
  }
  const thinking: Record<Hardness, string> = {
    easy: requireEnum(data, "thinking_easy", THINKING_LEVELS, file),
    medium: requireEnum(data, "thinking_medium", THINKING_LEVELS, file),
    hard: requireEnum(data, "thinking_hard", THINKING_LEVELS, file),
  };
  const reviewedAt = requireDate(data, "reviewed_at", file);
  const warnings: string[] = [];
  if (now - Date.parse(reviewedAt) > STALENESS_DAYS * DAY_MS) {
    warnings.push(`${file}: calibration older than ${STALENESS_DAYS} days (reviewed_at ${reviewedAt})`);
  }
  return {
    entry: {
      selector: requireString(data, "selector", file),
      family: requireString(data, "family", file),
      aliases: optionalAliases(data, file),
      fixerCapability: requireEnum(data, "fixer_capability", HARDNESSES, file) as Hardness,
      roles: requireRoles(data, file),
      priority: requireIntInRange(data, "priority", 1, 1000, file),
      thinking,
      enabled: requireBool(data, "enabled", file),
      calibrationSource: requireEnum(data, "calibration_source", CALIBRATION_SOURCES, file),
      reviewedAt,
      sourceFile: file,
    },
    warnings,
  };
}

/** Load every `*.md` file in a catalog directory; aggregate errors visibly. */
export function loadCatalog(dir: string, now = Date.now()): CatalogLoad {
  const result: CatalogLoad = { entries: [], errors: [], warnings: [] };
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".md")).sort();
  } catch {
    result.errors.push(`catalog directory not readable: ${dir}`);
    return result;
  }
  const seen = new Map<string, string>();
  for (const file of files) {
    const path = join(dir, file);
    try {
      const { entry, warnings } = parseModelEntry(readFileSync(path, "utf-8"), file, now);
      const duplicate = seen.get(entry.selector);
      if (duplicate) {
        result.errors.push(`duplicate selector ${entry.selector} in ${duplicate} and ${file}`);
        continue;
      }
      seen.set(entry.selector, file);
      result.entries.push(entry);
      result.warnings.push(...warnings);
    } catch (e: unknown) {
      result.errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  return result;
}

export interface FixerSelection {
  selector: string;
  entry: ModelCatalogEntry | null;
  /** True when the exact Reviewer model was reused for lack of an alternative. */
  reusedReviewer: boolean;
  /** True when nothing catalogued was eligible; caller falls back to modelRoles. */
  fallback: boolean;
}

function providerOf(selector: string): string {
  const slash = selector.indexOf("/");
  return slash > 0 ? selector.slice(0, slash) : selector;
}

function selectionKey(
  entry: ModelCatalogEntry,
  reviewer: string,
  reviewerFamily: string | null,
  reviewerProvider: string | null,
): string {
  return [
    HARDNESSES.indexOf(entry.fixerCapability),
    Number(entry.selector === reviewer),
    Number(entry.family === reviewerFamily),
    Number(providerOf(entry.selector) === reviewerProvider),
    entry.priority.toString().padStart(8, "0"),
    entry.selector,
  ].join("\0");
}

function toAvailableSet(selectors: ReadonlySet<string> | string[]): ReadonlySet<string> {
  return selectors instanceof Set ? selectors : new Set(selectors);
}

function eligibleFixers(
  entries: ModelCatalogEntry[],
  available: ReadonlySet<string>,
  requiredHardness: Hardness,
): ModelCatalogEntry[] {
  return entries.filter(
    (entry) =>
      entry.enabled &&
      entry.roles.includes("fixer") &&
      available.has(entry.selector) &&
      tierAtLeast(entry.fixerCapability, requiredHardness),
  );
}

/**
 * Select one Fixer for the pass's maximum blocking hardness.
 * Ordering: capability tier, then non-reviewer selector, different family,
 * different provider, priority, selector — all ascending/stable.
 */
export function selectFixerModel(catalog: {
  entries: ModelCatalogEntry[];
  availableSelectors: ReadonlySet<string> | string[];
  requiredHardness: Hardness;
  reviewerSelector?: string;
}): FixerSelection {
  const available = toAvailableSet(catalog.availableSelectors);
  const eligible = eligibleFixers(catalog.entries, available, catalog.requiredHardness);
  if (eligible.length === 0) {
    return { selector: "", entry: null, reusedReviewer: false, fallback: true };
  }
  const reviewer = catalog.reviewerSelector ?? "";
  const reviewerEntry = catalog.entries.find((entry) => entry.selector === reviewer);
  const reviewerFamily = reviewerEntry?.family ?? null;
  const reviewerProvider = reviewer ? providerOf(reviewer) : null;
  const best = [...eligible].sort((a, b) =>
    selectionKey(a, reviewer, reviewerFamily, reviewerProvider)
      .localeCompare(selectionKey(b, reviewer, reviewerFamily, reviewerProvider)),
  )[0];
  return {
    selector: best.selector,
    entry: best,
    reusedReviewer: best.selector === reviewer,
    fallback: false,
  };
}

/** Thinking level a catalogued Fixer should run at for the given hardness tier. */
export function thinkingFor(entry: ModelCatalogEntry, tier: Hardness): string {
  return entry.thinking[tier];
}

/** Parse a `:thinking` suffix from an exact OMP selector. */
export function thinkingFromSelector(selector: string | null | undefined): string | null {
  if (!selector) return null;
  const colon = selector.lastIndexOf(":");
  if (colon <= 0) return null;
  const level = selector.slice(colon + 1);
  return (THINKING_LEVELS as readonly string[]).includes(level) ? level : null;
}

/** Reviewer thinking: selector suffix, else the catalogued medium-tier default. */
export function reviewerThinking(selector: string | null | undefined, entries: ModelCatalogEntry[]): string | null {
  const fromSelector = thinkingFromSelector(selector);
  if (fromSelector) return fromSelector;
  if (!selector) return null;
  const base = selector.split(":")[0];
  const entry = entries.find((item) => item.selector === selector || item.selector === base);
  return entry?.thinking.medium ?? null;
}
