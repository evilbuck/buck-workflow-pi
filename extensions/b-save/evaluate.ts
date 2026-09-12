import { join, normalize, relative, resolve, sep } from "node:path";
import type { RoleId } from "./roles.js";
import type { SnapshotAmbiguous, SnapshotOk, SubjectCandidate } from "./snapshot.js";

export type RuleId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export class NeedsJudgmentError extends Error {
  readonly role: RoleId;
  readonly rule: RuleId;
  constructor(role: RoleId, rule: RuleId, message: string) {
    super(message);
    this.name = "NeedsJudgmentError";
    this.role = role;
    this.rule = rule;
  }
}

export class UserGateError extends Error {
  readonly gate: "subject" | "backlog_inferred";
  readonly options: string[];
  constructor(gate: "subject" | "backlog_inferred", options: string[]) {
    super("user gate: " + gate);
    this.name = "UserGateError";
    this.gate = gate;
    this.options = options;
  }
}

export class ContainmentError extends Error {
  constructor(path: string) {
    super("path escapes .context: " + path);
    this.name = "ContainmentError";
  }
}

export class SchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchemaError";
  }
}

export class StaleInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StaleInputError";
  }
}

export class ProgrammerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProgrammerError";
  }
}

export type ClosedRule = { id: RuleId; result: unknown };

export type PatchOp = { path: string; content: string };

export type PatchPlan = {
  ops: PatchOp[];
  moves: Array<{ from: string; to: string }>;
};

export function upsertIndexLine(existing: string, line: string) {
  const rows = existing.split("\n");
  if (rows.some((row) => row.trim() === line.trim())) return existing;
  const body = existing.endsWith("\n") || existing === "" ? existing : existing + "\n";
  return body + line + (line.endsWith("\n") ? "" : "\n");
}

export type Evaluation = {
  rules: ClosedRule[];
  patch: PatchPlan;
};

export type EvalInput = {
  snapshot: SnapshotOk | SnapshotAmbiguous;
  today?: string;
  scribe?: { title: string; body: string; domains: string[]; topics: string[]; priority: string } | null;
  auditor?: { complete: boolean; citations: string[] } | null;
  goal?: { classification: "exact" | "near" | "missing" } | null;
  archiveInferred?: boolean;
  inferredBacklog?: string[];
  explicitCompleted?: string[];
  expectedHashes?: Record<string, string>;
  subjectResolved?: boolean;
  currentHashes?: Record<string, string>;
};

function asOk(snapshot: SnapshotOk | SnapshotAmbiguous): SnapshotOk["snapshot"] {
  if (snapshot.kind !== "ok") throw new ProgrammerError("evaluate requires resolved snapshot");
  return snapshot.snapshot;
}

function assertContextPath(path: string) {
  const n = normalize(path).replace(/\\/g, "/");
  if (n.includes("..") || n.startsWith("/") || !n.startsWith(".context/")) {
    throw new ContainmentError(path);
  }
}

function todayOf(input: EvalInput, snap: SnapshotOk["snapshot"]) {
  return input.today ?? snap.subject.name.slice(0, 10);
}

function subjectFiles(snap: SnapshotOk["snapshot"]) {
  return [
    ...snap.plans.map((p) => p.path),
    ...snap.specs,
    ...snap.iterates,
    ...snap.phases,
  ];
}

function ruleSession(input: EvalInput): ClosedRule {
  const snap = asOk(input.snapshot);
  return { id: 1, result: snap.session_evidence };
}

function ruleSubject(input: EvalInput): ClosedRule {
  const snap = asOk(input.snapshot);
  const eligible = snap.subject_candidates.filter((c: SubjectCandidate) => c.status === "active");
  // The command adapter resolves ambiguity upstream via --subject; when that
  // human decision exists the gate is answered and must not re-trip forever.
  if (!input.subjectResolved && eligible.length > 1) {
    throw new UserGateError("subject", eligible.map((c) => c.name));
  }
  return { id: 2, result: { selected: snap.subject.name, moves: snap.loose_artifacts } };
}

function ruleMemory(input: EvalInput): ClosedRule {
  const snap = asOk(input.snapshot);
  if (!input.scribe) throw new NeedsJudgmentError("scribe", 3, "memory body needs a scribe draft");
  if ("writable_paths" in input.scribe) throw new SchemaError("scribe returned writable_paths");
  const path = join(snap.subject.path, "memory-" + todayOf(input, snap) + ".md");
  assertContextPath(path);
  return { id: 3, result: { path, draft: input.scribe } };
}

function ruleCrossref(input: EvalInput): ClosedRule {
  const snap = asOk(input.snapshot);
  const files = subjectFiles(snap);
  for (const file of files) assertContextPath(file);
  return { id: 4, result: { files } };
}

function ruleBacklog(input: EvalInput): ClosedRule {
  const inferred = input.inferredBacklog ?? [];
  if (inferred.length > 0 && !input.archiveInferred) {
    throw new UserGateError("backlog_inferred", inferred);
  }
  return { id: 5, result: { explicit: input.explicitCompleted ?? [], inferred } };
}

function ruleSpec(input: EvalInput): ClosedRule {
  if (!input.auditor) {
    throw new NeedsJudgmentError("evidence-auditor", 6, "spec criteria are not mechanical");
  }
  if (!Array.isArray(input.auditor.citations) || input.auditor.citations.length === 0) {
    throw new SchemaError("auditor citations missing");
  }
  return { id: 6, result: { complete: input.auditor.complete === true, citations: input.auditor.citations } };
}

function ruleIndex(input: EvalInput): ClosedRule {
  const snap = asOk(input.snapshot);
  const file = "memory-" + todayOf(input, snap) + ".md";
  return {
    id: 7,
    result: { upsertKey: file, path: ".context/memory/index.md", existing: snap.memory_index_content },
  };
}

function ruleNative(): ClosedRule {
  return { id: 8, result: { status: "unsupported" } };
}

function ruleReindex(): ClosedRule {
  return { id: 9, result: { status: "skipped" } };
}

function rulePhases(input: EvalInput): ClosedRule {
  if (!input.auditor) {
    throw new NeedsJudgmentError("evidence-auditor", 10, "phase criteria are not mechanical");
  }
  return { id: 10, result: { complete: input.auditor.complete === true } };
}

function ruleIterate(input: EvalInput): ClosedRule {
  if (!input.auditor) {
    throw new NeedsJudgmentError("evidence-auditor", 11, "iterate acceptance is not mechanical");
  }
  return { id: 11, result: { complete: input.auditor.complete === true } };
}

function ruleUserGoal(input: EvalInput): ClosedRule {
  if (input.goal?.classification === "near") {
    throw new NeedsJudgmentError("goal-classifier", 12, "user-goal heading is a semantic near-match");
  }
  if (input.goal?.classification === "missing") {
    return { id: 12, result: { warning: true } };
  }
  return { id: 12, result: { warning: false } };
}

const RULES = [
  ruleSession,
  ruleSubject,
  ruleMemory,
  ruleCrossref,
  ruleBacklog,
  ruleSpec,
  ruleIndex,
  ruleNative,
  ruleReindex,
  rulePhases,
  ruleIterate,
  ruleUserGoal,
];

function recheckHashes(input: EvalInput) {
  const expected = input.expectedHashes ?? {};
  const current = input.currentHashes ?? expected;
  for (const key of Object.keys(expected)) {
    if (current[key] !== expected[key]) throw new StaleInputError(key);
  }
}

function composePatch(rules: ClosedRule[]): PatchPlan {
  const memory = rules.find((r) => r.id === 3)?.result as { path: string; draft: { title: string; body: string } } | undefined;
  const ops: PatchOp[] = [];
  if (memory) {
    ops.push({
      path: memory.path,
      content: "# " + memory.draft.title + "\n\n" + memory.draft.body + "\n",
    });
  }
  const index = rules.find((r) => r.id === 7)?.result as
    | { path: string; upsertKey: string; existing: string }
    | undefined;
  if (index && memory) {
    ops.push({
      path: index.path,
      // Upsert onto the current index content — replacing the file with a
      // single line would wipe every existing memory entry.
      content: upsertIndexLine(index.existing, "- " + index.upsertKey),
    });
  }
  return { ops, moves: [] };
}

export function evaluateSnapshot(input: EvalInput): Evaluation {
  if (input.snapshot.kind === "ambiguous") {
    throw new UserGateError("subject", input.snapshot.candidates.map((c) => c.name));
  }
  recheckHashes(input);
  const rules: ClosedRule[] = [];
  for (const rule of RULES) rules.push(rule(input));
  return { rules, patch: composePatch(rules) };
}

export function dependentKeys(changed: string): string[] {
  if (changed.startsWith(".context/memory/")) return ["memory", "index"];
  if (changed.includes("phase-")) return ["phases"];
  return [changed];
}

export function contextRootJoin(root: string, rel: string) {
  assertContextPath(rel);
  const abs = resolve(root, rel);
  const relToRoot = relative(resolve(root), abs);
  if (relToRoot.startsWith("..") || relToRoot.split(sep).includes("..")) throw new ContainmentError(rel);
  return abs;
}
