/**
 * Acceptance-criteria list is the phase completion signal.
 *
 * A non-empty list decides: every item `[x]` means done, and `status` is
 * only a copy of that fact. The loop writes `status: completed` when the
 * boxes say so. A phase with no list still uses `status`.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { scan } from "./scan.js";
import { planAcceptanceCriteria } from "../../skills/_shared/scripts/plan-acceptance.js";

const PHASE_FILE_RE = /^phase-(\d+)-.+\.md$/;

/** `null` when the key is absent. `[]` when the key is present and empty. */
export function acceptanceCriteria(text: string): string[] | null {
  const body = frontmatterBody(text);
  if (body === null) return null;
  const lines = body.split("\n");
  const index = lines.findIndex((line) => /^acceptance_criteria:/.test(line));
  if (index < 0) return null;
  const rest = lines[index].slice("acceptance_criteria:".length).trim();
  if (rest.startsWith("[")) return inlineItems(rest);
  const items: string[] = [];
  for (let i = index + 1; i < lines.length; i++) {
    const item = lines[i].match(/^\s*-\s+(.*)$/);
    if (!item) {
      if (lines[i].trim() === "") continue;
      break;
    }
    items.push(unquote(item[1].trim()));
  }
  return items;
}

/** Boxes win when the list is non-empty. Otherwise `status: completed` decides. */
export function phaseIsDone(status: string | null, criteria: string[] | null): boolean {
  if (criteria !== null && criteria.length > 0) return criteriaAllChecked(criteria);
  return status === "completed";
}

export function phaseFileDone(abs: string): boolean {
  let text = "";
  try {
    text = readFileSync(abs, "utf8");
  } catch {
    return false;
  }
  return phaseIsDone(frontmatterStatus(text), acceptanceCriteria(text));
}

/**
 * Write `status: completed` and `completed_at` when every criterion is `[x]`.
 * Returns the paths written. Does not demote a status that the boxes reject.
 */
export function syncCheckedPhasesAt(root: string, input: string, today: string): string[] {
  const selected = scan({ projectRoot: root, path: input });
  if (!selected.planPath) return [];
  const abs = resolve(root, selected.planPath);
  const subjectDir = dirname(abs);
  const written: string[] = [];
  for (const name of readdirSync(subjectDir)) {
    if (PHASE_FILE_RE.test(name)) {
      const phaseAbs = resolve(subjectDir, name);
      if (!writeCompletedStatus(phaseAbs, today)) continue;
      written.push(phaseAbs);
      syncOverviews(subjectDir, name);
    }
  }
  if (selected.planFacts.kind === "unphased" && writeUnphasedPlanStatus(abs, today)) written.push(abs);
  return written;
}

export function markPhaseCompleted(text: string, today: string): string {
  if (!criteriaAllChecked(acceptanceCriteria(text))) return text;
  const fm = frontmatterSpan(text);
  if (!fm) return text;
  if (/^status:\s*completed\s*$/m.test(fm.body)) return text;
  let body = /^status:/m.test(fm.body)
    ? fm.body.replace(/^status:.*$/m, "status: completed")
    : `status: completed\n${fm.body}`;
  body = /^completed_at:/m.test(body)
    ? body.replace(/^completed_at:.*$/m, `completed_at: ${today}`)
    : body.replace(/^status: completed$/m, `status: completed\ncompleted_at: ${today}`);
  return text.slice(0, fm.start) + body + text.slice(fm.end);
}

function writeUnphasedPlanStatus(abs: string, today: string): boolean {
  const text = readFileSync(abs, "utf8");
  const fm = frontmatterSpan(text);
  const criteria = planAcceptanceCriteria(text);
  if (criteria.length === 0 || criteria.some((line) => !/^\s*[-*]\s+\[x\]/.test(line))) return false;
  if (!fm) return false;
  if (frontmatterStatus(text) === "completed") return false;
  const updated = /^status:/m.test(fm.body)
    ? fm.body.replace(/^status:.*$/m, "status: completed")
    : `status: completed\n${fm.body}`;
  const withDate = /^completed_at:/m.test(updated)
    ? updated.replace(/^completed_at:.*$/m, `completed_at: ${today}`)
    : updated.replace(/^status: completed$/m, `status: completed\ncompleted_at: ${today}`);
  writeFileSync(abs, text.slice(0, fm.start) + withDate + text.slice(fm.end));
  return true;
}

function criteriaAllChecked(criteria: string[] | null): boolean {
  return criteria !== null && criteria.length > 0 && criteria.every((entry) => entry.trimStart().startsWith("[x]"));
}

function writeCompletedStatus(abs: string, today: string): boolean {
  const text = readFileSync(abs, "utf8");
  const next = markPhaseCompleted(text, today);
  if (next === text) return false;
  writeFileSync(abs, next);
  return true;
}

function syncOverviews(subjectDir: string, phaseName: string): void {
  for (const name of readdirSync(subjectDir)) {
    if (!name.startsWith("plan-") || !name.endsWith(".md") || !name.includes("-phases")) continue;
    const abs = resolve(subjectDir, name);
    const text = readFileSync(abs, "utf8");
    const next = markOverviewRow(text, phaseName);
    if (next !== text) writeFileSync(abs, next);
  }
}

function markOverviewRow(text: string, phaseName: string): string {
  const lines = text.split("\n");
  const headerIdx = lines.findIndex(
    (line) => /\|/.test(line) && /Phase/i.test(line) && /Status/i.test(line) && /File/i.test(line),
  );
  if (headerIdx < 0) return text;
  const header = splitRow(lines[headerIdx]);
  const statusCol = header.findIndex((cell) => /^status$/i.test(cell));
  const fileCol = header.findIndex((cell) => /^file$/i.test(cell));
  if (statusCol < 0 || fileCol < 0) return text;
  for (let i = headerIdx + 1; i < lines.length; i++) {
    if (!lines[i].includes("|")) break;
    if (/^\|?\s*:?-{3,}/.test(lines[i].trim())) continue;
    const cells = splitRow(lines[i]);
    if (!cells[fileCol]?.includes(phaseName)) continue;
    cells[statusCol] = "completed";
    lines[i] = `| ${cells.join(" | ")} |`;
    return lines.join("\n");
  }
  return text;
}

function splitRow(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

function frontmatterBody(text: string): string | null {
  return frontmatterSpan(text)?.body ?? null;
}

export function frontmatterSpan(text: string): { body: string; start: number; end: number } | null {
  if (!text.startsWith("---")) return null;
  const end = text.indexOf("\n---", 3);
  if (end < 0) return null;
  return { body: text.slice(4, end), start: 4, end };
}

function frontmatterStatus(text: string): string | null {
  const body = frontmatterBody(text);
  if (body === null) return null;
  const line = body.split("\n").find((entry) => /^status:/.test(entry));
  return line ? line.slice("status:".length).trim() : null;
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
