/**
 * Acceptance-criteria list is the phase completion signal.
 *
 * A non-empty list decides: every item `[x]` means done, and `status` is
 * only a copy of that fact. The loop writes `status: completed` when the
 * boxes say so. A phase with no list still uses `status`.
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename, dirname, relative, resolve, sep } from "node:path";
import { classifyContextPath, commitConsumerBatch, consumerKey, type ConsumerWrite } from "../../skills/_shared/storage/consumers.js";
import { resolveConsumerContext, withBoundStore } from "../../skills/_shared/scripts/workflow-state.js";
import { readLoopDocuments, scanDocuments } from "./scan.js";
import {
  frontmatterAcceptanceCriteria,
  isCheckedCriterion,
  planAcceptanceCriteria,
} from "../../skills/_shared/scripts/plan-acceptance.js";

const PHASE_FILE_RE = /^phase-(\d+)-.+\.md$/;

/** `null` when the key is absent. `[]` when the key is present and empty. Shared parser. */
export function acceptanceCriteria(text: string): string[] | null {
  return frontmatterAcceptanceCriteria(text);
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
export async function syncCheckedPhasesAt(root: string, input: string, today: string): Promise<string[]> {
  root = resolve(root);
  const context = await resolveConsumerContext(root);
  const documents = await readLoopDocuments(root);
  const selected = scanDocuments({ projectRoot: root, path: input }, documents);
  if (!selected.planPath) return [];
  const planAbs = resolve(root, selected.planPath);
  const subjectDir = dirname(planAbs);
  return withBoundStore(root, context, async (store) => {
    if (!context.worktreeId || !context.runId) throw new Error("Trusted worktree/run identity is not bound");
    const scope = { ...context, worktreeId: context.worktreeId, runId: context.runId };
    const writes: ConsumerWrite[] = [];
    const written: string[] = [];
    const completedPhases: string[] = [];
    const update = async (abs: string, transform: (text: string) => string): Promise<boolean> => {
      const artifact = classifyContextPath(relative(root, abs).split(sep).join("/"));
      const current = await store.read(consumerKey(scope, artifact.kind, artifact.subjectId, artifact.logicalName));
      if (!current) throw new Error(`Missing authoritative artifact: ${abs}`);
      const text = new TextDecoder().decode(current.bytes);
      if (text !== documents.get(abs)) throw new Error(`Authoritative artifact changed during completion: ${abs}`);
      const next = transform(text);
      if (next === text) return false;
      writes.push({ ...artifact, bytes: new TextEncoder().encode(next), links: current.links,
        expectedRevision: current.revision, source: "buck-loop-phase-completion" });
      return true;
    };
    const paths = [...documents.keys()].filter((abs) => dirname(abs) === subjectDir).sort();
    for (const abs of paths) {
      if (!PHASE_FILE_RE.test(basename(abs))) continue;
      if (!await update(abs, (text) => markPhaseCompleted(text, today))) continue;
      written.push(abs);
      completedPhases.push(basename(abs));
    }
    await completeOverviews(paths, completedPhases, update);
    if (selected.planFacts.kind === "unphased" && await update(planAbs, (text) => markUnphasedPlanCompleted(text, today))) {
      written.push(planAbs);
    }
    if (writes.length > 0) await commitConsumerBatch(store, scope, writes, { attemptId: randomUUID(), runId: randomUUID(), status: "attempted" });
    return written;
  });
}

async function completeOverviews(paths: readonly string[], completedPhases: readonly string[], update: (abs: string, transform: (text: string) => string) => Promise<boolean>): Promise<void> {
  if (completedPhases.length === 0) return;
  for (const abs of paths) {
    if (!/^plan-.*-phases.*\.md$/.test(basename(abs))) continue;
    await update(abs, (text) => completedPhases.reduce(markOverviewRow, text));
  }
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

function markUnphasedPlanCompleted(text: string, today: string): string {
  const fm = frontmatterSpan(text);
  const criteria = planAcceptanceCriteria(text);
  if (criteria.length === 0 || criteria.some((line) => !isCheckedCriterion(line))) return text;
  if (!fm) return text;
  if (frontmatterStatus(text) === "completed") return text;
  const updated = /^status:/m.test(fm.body)
    ? fm.body.replace(/^status:.*$/m, "status: completed")
    : `status: completed\n${fm.body}`;
  const withDate = /^completed_at:/m.test(updated)
    ? updated.replace(/^completed_at:.*$/m, `completed_at: ${today}`)
    : updated.replace(/^status: completed$/m, `status: completed\ncompleted_at: ${today}`);
  return text.slice(0, fm.start) + withDate + text.slice(fm.end);
}

function criteriaAllChecked(criteria: string[] | null): boolean {
  return criteria !== null && criteria.length > 0 && criteria.every(isCheckedCriterion);
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

