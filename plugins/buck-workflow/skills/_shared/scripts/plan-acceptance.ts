/**
 * The one acceptance-criteria parser. Phase files keep criteria in the
 * frontmatter `acceptance_criteria` list; unphased plans keep them as body
 * boxes under `## Acceptance criteria`. Both forms accept `[x]` or `[X]`,
 * CRLF line endings, and YAML comments. Every guard and repair path reads
 * criteria through this module so they cannot disagree.
 */
import { parse as parseYaml } from "yaml";

const CHECKED_RE = /^\s*(?:[-*]\s+)?\[[xX]\]/;
const BOX_RE = /^\s*(?:[-*]\s+)?\[[ xX]\]/;
const BODY_BOX_RE = /^\s*[-*]\s+\[[ xX]\]/;
const HEADING_RE = /^##\s+Acceptance criteria\s*$/i;

export function normalizeNewlines(text: string): string {
  return text.replace(/\r\n?/g, "\n");
}

/** `[x]` or `[X]`, with or without a leading list marker. */
export function isCheckedCriterion(item: string): boolean {
  return CHECKED_RE.test(item);
}

/** An item that carries a checkbox at all. */
export function hasCheckbox(item: string): boolean {
  return BOX_RE.test(item);
}

/** Criterion text without its list marker or box. */
export function criterionText(item: string): string {
  return item.replace(/^\s*(?:[-*]\s+)?\[[ xX]\]\s*/, "").trim();
}

/** Raw YAML between the opening `---` and the closing `---`, or null. */
export function frontmatterYaml(text: string): string | null {
  const match = normalizeNewlines(text).match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  return match ? match[1] : null;
}

/**
 * Frontmatter `acceptance_criteria`. `null` when the key is absent, `[]` when
 * present and empty. A real YAML parse decides first; an item a model wrote
 * unquoted (`- [x] done`, which YAML reads as a flow sequence) falls back to a
 * line reader so a ticked box is never lost to quoting.
 */
export function frontmatterAcceptanceCriteria(text: string): string[] | null {
  const yaml = frontmatterYaml(text);
  if (yaml === null) return null;
  const lines = yaml.split("\n");
  const index = lines.findIndex((line) => /^acceptance_criteria\s*:/.test(line));
  if (index < 0) return null;
  const parsed = parsedList(yaml);
  if (parsed !== undefined) return parsed;
  return lineList(lines, index);
}

function parsedList(yaml: string): string[] | null | undefined {
  let doc: unknown;
  try {
    doc = parseYaml(yaml);
  } catch {
    return undefined;
  }
  if (!doc || typeof doc !== "object") return undefined;
  const value = (doc as Record<string, unknown>).acceptance_criteria;
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) return undefined;
  if (!value.every((item) => typeof item === "string")) return undefined;
  return value.map((item) => item.trim()).filter((item) => item.length > 0);
}

function lineList(lines: string[], index: number): string[] {
  const rest = lines[index].replace(/^acceptance_criteria\s*:/, "").replace(/\s+#.*$/, "").trim();
  if (rest.startsWith("[")) return inlineItems(rest);
  const items: string[] = [];
  for (let i = index + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "" || /^\s*#/.test(line)) continue;
    const item = line.match(/^\s*-\s+(.*)$/);
    if (!item) break;
    items.push(unquote(item[1].trim()));
  }
  return items;
}

function inlineItems(rest: string): string[] {
  if (rest === "[]") return [];
  const inner = rest.endsWith("]") ? rest.slice(1, -1) : rest.slice(1);
  return inner.split(",").map((part) => unquote(part.trim())).filter((part) => part.length > 0);
}

function unquote(value: string): string {
  const quote = value[0];
  if ((quote === "\"" || quote === "'") && value.endsWith(quote) && value.length >= 2) return value.slice(1, -1);
  return value;
}

/** Body acceptance boxes under `## Acceptance criteria`. */
export function planAcceptanceCriteria(text: string): string[] {
  const lines = normalizeNewlines(text).split("\n");
  const heading = lines.findIndex((line) => HEADING_RE.test(line));
  if (heading < 0) return [];
  const tail = lines.slice(heading + 1);
  const end = tail.findIndex((line) => /^##\s/.test(line));
  return (end < 0 ? tail : tail.slice(0, end)).filter((line) => BODY_BOX_RE.test(line));
}

export function unphasedCloseout(text: string): { closeEligible: boolean; openAcceptanceLines: string[] } {
  const status = frontmatterYaml(text)?.match(/^status:\s*(.*?)\s*$/m)?.[1];
  const openAcceptanceLines = planAcceptanceCriteria(text).filter((line) => !isCheckedCriterion(line));
  return { closeEligible: status === "completed" && openAcceptanceLines.length === 0, openAcceptanceLines };
}

/**
 * Criteria for one plan or phase file: the frontmatter list when present,
 * otherwise the body boxes. `source` tells a writer which form to edit.
 */
export function fileAcceptanceCriteria(text: string): { source: "frontmatter" | "body" | "none"; items: string[] } {
  const front = frontmatterAcceptanceCriteria(text);
  if (front !== null && front.length > 0) return { source: "frontmatter", items: front };
  const body = planAcceptanceCriteria(text);
  if (body.length > 0) return { source: "body", items: body };
  return { source: "none", items: [] };
}

export function openCriteria(text: string): string[] {
  return fileAcceptanceCriteria(text).items.filter((item) => !isCheckedCriterion(item));
}

/**
 * Tick `[ ]` → `[x]` on the lines whose criterion text matches. Only the
 * acceptance region is touched; already-checked lines and unmatched lines
 * keep their bytes. Line endings are preserved.
 */
export function tickCriteria(text: string, toTick: readonly string[]): string {
  if (toTick.length === 0) return text;
  const wanted = new Set(toTick.map(criterionText));
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = normalizeNewlines(text).split("\n");
  const { source } = fileAcceptanceCriteria(text);
  if (source === "frontmatter") {
    const key = acceptanceKeyLine(lines);
    if (key >= 0 && inlineFlowRest(lines[key]) !== null) {
      lines[key] = tickInlineFlowLine(lines[key], wanted);
      return lines.join(eol);
    }
  }
  const [start, end] = source === "frontmatter" ? frontmatterRegion(lines) : bodyRegion(lines);
  for (let i = start; i < end; i++) {
    const match = lines[i].match(/^(\s*(?:-\s+)?["']?(?:[-*]\s+)?)\[ \](.*)$/);
    if (!match) continue;
    const rest = match[2].replace(/["']\s*$/, "");
    if (!wanted.has(rest.trim())) continue;
    lines[i] = `${match[1]}[x]${match[2]}`;
  }
  return lines.join(eol);
}

/** Tick unchecked boxes inside `acceptance_criteria: ["[ ] a", ...]`. */
function tickInlineFlowLine(line: string, wanted: Set<string>): string {
  return line.replace(/(["'])\[ \]\s*(.*?)\1/g, (full, quote: string, text: string) => {
    if (!wanted.has(text.trim())) return full;
    return `${quote}[x] ${text.trim()}${quote}`;
  });
}

function inlineFlowRest(line: string): string | null {
  const rest = line.replace(/^acceptance_criteria\s*:/, "").replace(/\s+#.*$/, "").trim();
  return rest.startsWith("[") ? rest : null;
}

function acceptanceKeyLine(lines: string[]): number {
  if (lines[0] !== "---") return -1;
  const close = lines.indexOf("---", 1);
  const end = close < 0 ? lines.length : close;
  return lines.findIndex((line, i) => i > 0 && i < end && /^acceptance_criteria\s*:/.test(line));
}

function frontmatterRegion(lines: string[]): [number, number] {
  const key = acceptanceKeyLine(lines);
  if (key < 0) return [0, 0];
  const close = lines.indexOf("---", 1);
  const end = close < 0 ? lines.length : close;
  let stop = key + 1;
  while (stop < end && (lines[stop].trim() === "" || /^\s*(#|-\s)/.test(lines[stop]))) stop++;
  return [key + 1, stop];
}

function bodyRegion(lines: string[]): [number, number] {
  const heading = lines.findIndex((line) => HEADING_RE.test(line));
  if (heading < 0) return [0, 0];
  const next = lines.slice(heading + 1).findIndex((line) => /^##\s/.test(line));
  return [heading + 1, next < 0 ? lines.length : heading + 1 + next];
}
