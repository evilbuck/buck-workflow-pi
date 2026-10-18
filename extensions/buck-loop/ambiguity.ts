/**
 * Ambiguous postcondition gate. The scan only knows the expected artifact
 * did not land. The supervisor diagnoses that gap, then asks Jev how large a
 * continuation it is. Light and medium lifts continue automatically with the
 * diagnosis. A heavy lift is handed to the operator.
 */
import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { unfinishedIterates, readStatus } from "./scan.js";
import { commitConsumerBatch, consumerKey, scheduleConfiguredRetain } from "../../skills/_shared/storage/consumers.js";
import { resolveConsumerContext, withBoundStore } from "../../skills/_shared/scripts/workflow-state.js";
import { frontmatterSpan } from "./phase-completion.js";
import { runJev } from "../jev-tool/index.js";
import { frontmatterAcceptanceCriteria, isCheckedCriterion, openCriteria } from "../../skills/_shared/scripts/plan-acceptance.js";
import { createTypeSafeEvaluator } from "../typed-output/evaluator.js";

const LIFTS = ["light", "medium", "heavy"] as const;

export type RepairLift = (typeof LIFTS)[number];

export type RepairPlan = { lift: RepairLift; reason: string; diagnosis: string };

export type AmbiguityEvidence = {
  abs: string | null;
  sessionText: string;
  why: string;
  /** An iterating miss is about artifacts, not the phase; supplied by the caller. */
  iterateReport?: string;
  /** Why the supervisor's acceptance stamp left boxes open (e.g. jev unavailable). */
  acceptanceGap?: string;
};

/** Frontmatter criteria through the shared parser, so repair reads what the guard reads. */
export function acceptanceCriteria(abs: string): string[] {
  try {
    return frontmatterAcceptanceCriteria(readFileSync(abs, "utf8")) ?? [];
  } catch {
    return [];
  }
}

/** All boxes checked, but the scanner only confirms `status: completed`. */
export function repairCheckedPhase(abs: string, at: string): boolean {
  const items = acceptanceCriteria(abs);
  if (items.length === 0 || items.some((item) => !isCheckedCriterion(item))) return false;
  const text = readFileSync(abs, "utf8");
  const fm = frontmatterSpan(text);
  if (!fm) return false;
  if (/^status:\s*completed\s*$/m.test(fm.body)) return false;
  const today = at.slice(0, 10);
  let body = /^status:/m.test(fm.body)
    ? fm.body.replace(/^status:.*$/m, "status: completed")
    : `status: completed\n${fm.body}`;
  body = /^completed_at:/m.test(body)
    ? body.replace(/^completed_at:.*$/m, `completed_at: ${today}`)
    : body.replace(/^status: completed$/m, `status: completed\ncompleted_at: ${today}`);
  writeFileSync(abs, text.slice(0, fm.start) + body + text.slice(fm.end));
  return true;
}

/** Status a diagnosis should name for each unfinished artifact. */
export async function unfinishedIterateReport(subjectDir: string): Promise<string> {
  const files = await unfinishedIterates(subjectDir);
  if (files.length === 0) return "no unfinished iterate artifact";
  const entries = await Promise.all(files.map(async (abs) => `${basename(abs)} (status ${await readStatus(abs) ?? "missing"})`));
  return `unfinished iterate artifacts: ${entries.join(", ")}`;
}

/**
 * Close the one iterate artifact a successful session left open, so the run
 * reaches review instead of a heavy-lift handoff. Deliberately narrow: exactly
 * one candidate, well-formed `active` frontmatter, only the three lifecycle
 * fields touched, and durable readback before success. Malformed or non-unique
 * targets return false; storage failures propagate to the caller.
 */
export async function closeSingleUnfinishedIterate(subjectDir: string, at: string): Promise<boolean> {
  subjectDir = resolve(subjectDir);
  const root = dirname(dirname(subjectDir));
  const context = await resolveConsumerContext(root);
  const targets = await unfinishedIterates(subjectDir);
  if (targets.length !== 1) return false;
  const abs = targets[0]!;
  return withBoundStore(root, context, async (store) => {
    if (!context.worktreeId || !context.runId) throw new Error("Trusted worktree/run identity is not bound");
    const scope = { ...context, worktreeId: context.worktreeId, runId: context.runId };
    const subjectId = basename(subjectDir);
    const logicalName = basename(abs);
    const current = await store.read(consumerKey(scope, "iterate", subjectId, logicalName));
    if (!current) throw new Error(`Missing authoritative artifact: ${abs}`);
    const original = new TextDecoder().decode(current.bytes);
    const fm = frontmatterSpan(original);
    if (!fm || !/^status:\s*active\s*$/m.test(fm.body)) return false;
    const today = at.slice(0, 10);
    let next = fm.body.replace(/^status:\s*active\s*$/m, "status: completed");
    for (const key of ["completed", "updated"]) {
      next = new RegExp(`^${key}:`, "m").test(next)
        ? next.replace(new RegExp(`^${key}:.*$`, "m"), `${key}: ${today}`)
        : next.replace(/^status: completed$/m, `status: completed\n${key}: ${today}`);
    }
    await commitConsumerBatch(store, scope, [{
      kind: "iterate", subjectId, logicalName,
      bytes: new TextEncoder().encode(original.slice(0, fm.start) + next + original.slice(fm.end)),
      links: current.links, expectedRevision: current.revision, source: "buck-loop-iterate-closeout",
    }], { attemptId: randomUUID(), runId: randomUUID(), status: "attempted" });
    return true;
  });
}

export function explainAmbiguity(abs: string | null): string {
  if (!abs) return "postcondition is ambiguous because the expected artifact did not land";
  const status = frontmatter(abs).match(/^status:\s*(.+)$/m)?.[1]?.trim() ?? "missing";
  const text = readFileSync(abs, "utf8");
  const open = openCriteria(text);
  const checkpoint = section(text, "Execution checkpoint");
  const unchecked = open.length > 0 ? ` Unchecked: ${open.join("; ")}.` : "";
  const why = checkpoint ? ` ${firstSentence(checkpoint)}` : "";
  const headline = status === "completed" ? `phase status is ${status}.` : `phase status is ${status}, not completed.`;
  return `${headline}${unchecked}${why}`;
}

export function diagnoseAmbiguity(evidence: AmbiguityEvidence): string {
  const report = evidence.sessionText.trim();
  const child = report.length > 0 ? clip(report) : "the session returned no report";
  const disk = evidence.abs ? explainAmbiguity(evidence.abs) : "no phase file to inspect";
  return [
    "Diagnosis: the assigned session finished without landing the expected artifact.",
    `Supervisor saw: ${evidence.why}`,
    `Child report: ${child}`,
    ...(evidence.iterateReport ? [`Iterate artifacts: ${evidence.iterateReport}`] : []),
    `Disk: ${disk}`,
    ...(evidence.acceptanceGap ? [`Acceptance stamp: ${evidence.acceptanceGap}`] : []),
    "Judge the remaining work from the child report and disk evidence. Unchecked boxes name the gap; they are not a separate cause.",
  ].join("\n");
}

/** Closed lift judgment. A missing or illegal answer is a heavy handoff, not an automatic retry. */
export async function askRepairLift(diagnosis: string, audit?: { cwd: string; subject: string }): Promise<RepairPlan> {
  let lift: RepairLift | null = null;
  let raw = "";
  let reason = "";
  try {
    const result = await runJev(createTypeSafeEvaluator(), {
      state: diagnosis,
      questions: {
        lift: {
          type: "choice",
          instructions: "Classify the diagnosed remaining work. The criteria labels are the only legal lifts.",
          criteria: {
            light: "A small unfinished slice of the same assignment. Another run of the same skill can finish it. No credential, disposable database, or operator decision is missing.",
            medium: "Unfinished work that is still this phase and can be continued by another skill run. No operator-only input is required.",
            heavy: "Missing operator input, a disposable database, a product decision, or work too large for one automatic continuation.",
          },
        },
      },
    });
    raw = result.raw;
    lift = readLift(result.details);
    reason = lift ? `Jev classified the repair as ${lift}` : "Jev did not return a legal lift";
  } catch (error) {
    reason = error instanceof Error ? error.message : "Jev lift call failed";
  }
  const plan: RepairPlan = { lift: lift ?? "heavy", reason, diagnosis };
  if (audit) {
    const directory = join(audit.cwd, ".context", audit.subject, "transition-audits");
    await mkdir(directory, { recursive: true });
    const name = `${Date.now()}-repair-lift-${randomUUID()}.json`;
    const body = `${JSON.stringify({
      source: "repair-lift", context: diagnosis, raw, lift: plan.lift,
      accepted: lift !== null, reason,
    }, null, 2)}\n`;
    await writeFile(join(directory, name), body);
    await scheduleConfiguredRetain({
      kind: "audit", subjectId: audit.subject, logicalName: `transition-audits/${name}`,
      bytes: new TextEncoder().encode(body), cwd: audit.cwd, source: "buck-loop",
    });
  }
  return plan;
}

function firstSentence(text: string): string {
  return (text.match(/^[\s\S]*?[.!?](?=\s|$)/)?.[0] ?? text.split("\n", 1)[0] ?? "")
    .replace(/\s+/g, " ").trim();
}

function frontmatter(abs: string): string {
  const text = readFileSync(abs, "utf8");
  if (!text.startsWith("---")) return "";
  const end = text.indexOf("\n---", 3);
  return end < 0 ? "" : text.slice(4, end);
}

function section(text: string, heading: string): string | null {
  const match = text.match(new RegExp(`## ${heading}\\n+([\\s\\S]*?)(?:\\n## |\\n# |$)`));
  const body = match?.[1]?.trim();
  return body ? body : null;
}

function field(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return (value as Record<string, unknown>)[key];
}

function readLift(details: unknown): RepairLift | null {
  const answer = field(field(field(details, "answers"), "lift"), "choice");
  return LIFTS.find((lift) => lift === answer) ?? null;
}

function clip(text: string): string {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length <= 1200 ? compact : compact.slice(0, 1200);
}

export function phaseAbs(cwd: string, phasePath: string | null): string | null {
  return phasePath ? resolve(cwd, phasePath) : null;
}

/** Fingerprints the running extension before a retry; pre-existing dirt is not a new repair. */
export function loopExtensionFiles(cwd: string): Map<string, string> {
  const root = join(cwd, "extensions/buck-loop");
  const files = new Map<string, string>();
  if (!existsSync(root)) return files;
  function collect(dir: string, relative: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) collect(abs, name);
      else if (entry.isFile()) files.set(`extensions/buck-loop/${name}`, createHash("sha256").update(readFileSync(abs)).digest("hex"));
    }
  }
  collect(root, "");
  return files;
}

export function changedLoopExtensionFiles(cwd: string, before: ReadonlyMap<string, string>): string[] {
  const after = loopExtensionFiles(cwd);
  return [...new Set([...before.keys(), ...after.keys()])]
    .filter((path) => before.get(path) !== after.get(path))
    .sort();
}
