/**
 * Loop-owned acceptance stamp. After a successful build session the
 * supervisor, not the nested child, ticks acceptance boxes: it collects the
 * still-open criteria on the built plan or phase file, asks Jev one `noul`
 * per criterion against the child's report, and ticks only `noul >= 0.7`.
 * The nested child has no `jev` tool (its tool list is restricted), so this
 * bookkeeping must live here or the building guard can never confirm.
 */
import { readFileSync, writeFileSync } from "node:fs";
import {
  criterionText,
  openCriteria,
  tickCriteria,
} from "../../skills/_shared/scripts/plan-acceptance.js";

export const ACCEPTANCE_THRESHOLD = 0.7;

export type AcceptanceQuestion = {
  type: "noul";
  instructions: string;
  criteria: { true: string; false: string };
};

export type AcceptanceJudge = (
  state: unknown,
  questions: Record<string, AcceptanceQuestion>,
) => Promise<{ raw?: string; details: unknown } | undefined>;

export type AcceptanceStamp = {
  /** Criteria ticked by this stamp, verbatim. */
  ticked: string[];
  /** Criteria still open after the stamp, verbatim. */
  open: string[];
  /** Why open criteria stayed open, when the judge itself failed. */
  unavailable?: string;
};

/**
 * Keep the tail of the report: b-build loop mode puts `## Acceptance evidence`
 * last, so a long report still sends the evidence. Reordering the report
 * sections in the skill would need this slice revisited.
 */
const EVIDENCE_LIMIT = 12_000;

export async function stampAcceptance(abs: string, sessionText: string, judge: AcceptanceJudge): Promise<AcceptanceStamp> {
  let text: string;
  try {
    text = readFileSync(abs, "utf8");
  } catch {
    return { ticked: [], open: [] };
  }
  const open = openCriteria(text);
  if (open.length === 0) return { ticked: [], open: [] };
  const questions: Record<string, AcceptanceQuestion> = {};
  open.forEach((line, i) => {
    questions[`criterion_${i + 1}`] = {
      type: "noul",
      instructions: `Is this acceptance criterion done: ${criterionText(line)}?`,
      criteria: {
        true: "The supplied evidence directly proves this criterion. A review claim, an unchecked box, or an intention is not proof.",
        false: "Evidence is missing, indirect, or contradicts the criterion.",
      },
    };
  });
  const evidence = sessionText.trim().slice(-EVIDENCE_LIMIT) || "the build session returned no report";
  let details: unknown;
  try {
    details = (await judge({ evidence, criteria: open.map(criterionText) }, questions))?.details;
  } catch (error) {
    return { ticked: [], open, unavailable: `jev unavailable: ${error instanceof Error ? error.message : String(error)}` };
  }
  const answers = readAnswers(details);
  if (answers === null) return { ticked: [], open, unavailable: `jev unavailable: ${jevErrorMessage(details)}` };
  const ticked = open.filter((_, i) => {
    const answer = answers[`criterion_${i + 1}`];
    return isNoul(answer) && answer.noul >= ACCEPTANCE_THRESHOLD;
  });
  if (ticked.length > 0) writeFileSync(abs, tickCriteria(text, ticked));
  const remaining = openCriteria(readFileSync(abs, "utf8"));
  return { ticked, open: remaining };
}

/** Operator-facing gap: every open criterion verbatim, plus the judge failure when there was one. */
export function describeAcceptanceGap(stamp: AcceptanceStamp | null | undefined): string | undefined {
  if (!stamp || stamp.open.length === 0) return stamp?.unavailable;
  const list = stamp.open.map((item) => `"${item}"`).join("; ");
  return stamp.unavailable ? `${stamp.unavailable}; unchecked acceptance: ${list}` : `unchecked acceptance: ${list}`;
}

function readAnswers(details: unknown): Record<string, unknown> | null {
  if (!details || typeof details !== "object") return null;
  const record = details as Record<string, unknown>;
  if (record.error === true) return null;
  const answers = record.answers;
  return answers && typeof answers === "object" ? (answers as Record<string, unknown>) : null;
}

function isNoul(answer: unknown): answer is { type: "noul"; noul: number } {
  if (!answer || typeof answer !== "object") return false;
  const a = answer as Record<string, unknown>;
  return a.type === "noul" && typeof a.noul === "number" && Number.isFinite(a.noul);
}

function jevErrorMessage(details: unknown): string {
  if (details && typeof details === "object" && typeof (details as Record<string, unknown>).message === "string") {
    return (details as { message: string }).message;
  }
  return "no answers returned";
}
