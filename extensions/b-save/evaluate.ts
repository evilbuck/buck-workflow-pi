import { join, normalize, relative, resolve, sep } from "node:path";
import type { RoleId, ScribeProposal } from "./roles.js";
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

export type PatchOp = { path: string; content: string | null };

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
  checkpoint?: { scribe: ScribeProposal; sources: Record<string, string> };
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
  ].map((path) => {
    if (path.startsWith(".context/")) return path;
    if (path.includes("..") || path.startsWith("/") || path.includes("\\")) throw new ContainmentError(path);
    return join(snap.subject.path, path);
  });
}

function memoryFilename(snap: SnapshotOk["snapshot"], today: string) {
  const topic = snap.subject.name.replace(/^\d{4}-\d{2}-\d{2}\./, "") || "session";
  return topic + "-" + today + ".md";
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
  const path = join(".context", "memory", memoryFilename(snap, todayOf(input, snap)));
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
  const file = memoryFilename(snap, todayOf(input, snap));
  return { id: 7, result: { upsertKey: file, path: ".context/memory/index.md", existing: snap.memory_index_content } };
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

function field(text: string, key: string, value: string) {
  if (!text.startsWith("---\n")) return "---\n" + key + ": " + value + "\n---\n\n" + text;
  const end = text.indexOf("\n---", 4);
  if (end < 0) throw new SchemaError("unterminated frontmatter");
  const head = text.slice(4, end + 1);
  const next = new RegExp("^" + key + ":.*$", "m").test(head)
    ? head.replace(new RegExp("^" + key + ":.*$", "m"), key + ": " + value)
    : head + key + ": " + value + "\n";
  return "---\n" + next + "---" + text.slice(end + 4);
}

function backlogSlug(slug: string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new SchemaError("invalid backlog slug: " + slug);
  return slug;
}

type PatchWriter = (path: string, content: string | null) => void;
type SourceReader = (path: string) => string;
type SourceExists = (path: string) => boolean;

function memoryContent(snap: SnapshotOk["snapshot"], scribe: ScribeProposal, today: string, memory: string) {
  const facts = scribe.facts.map((fact) => "- " + fact.text).join("\n");
  const artifacts = [memory, ...snap.plans.map((plan) => plan.path), ...snap.specs, ...snap.phases, ...snap.iterates];
  return "---\ndate: " + today + "\ndomains: [" + scribe.domains.map((item) => JSON.stringify(item.text)).join(", ") + "]\ntopics: [" + scribe.topics.map((item) => JSON.stringify(item.text)).join(", ") + "]\nrelated: []\npriority: " + scribe.priority.value + "\nstatus: completed\nsubject: " + JSON.stringify(snap.subject.name) + "\nartifacts: [" + artifacts.map((path) => JSON.stringify(path)).join(", ") + "]\n---\n\n# " + scribe.title.text + "\n\n" + scribe.summary.text + "\n\n## Facts\n\n" + facts + "\n";
}

function updateSubjectFiles(snap: SnapshotOk["snapshot"], source: SourceReader, put: PatchWriter, memoryFile: string, complete: boolean) {
  const planPaths = snap.plans.map((plan) => plan.path.startsWith(".context/") ? plan.path : join(snap.subject.path, plan.path));
  for (const path of planPaths) put(path, field(source(path), "memory", "[" + JSON.stringify(memoryFile) + "]"));
  for (const name of snap.specs) {
    const path = name.startsWith(".context/") ? name : join(snap.subject.path, name);
    const status = complete ? field(source(path), "status", "completed") : source(path);
    put(path, field(status, "plans", "[" + planPaths.map((planPath) => JSON.stringify(planPath)).join(", ") + "]"));
  }
  for (const name of [...snap.phases, ...snap.iterates]) {
    const path = name.startsWith(".context/") ? name : join(snap.subject.path, name);
    if (complete) put(path, field(source(path), "status", "completed"));
  }
}

function updateSubjectIndex(snap: SnapshotOk["snapshot"], source: SourceReader, put: PatchWriter, memoryFile: string, complete: boolean) {
  const path = join(snap.subject.path, "index.md");
  const entry = upsertIndexLine(source(path), "- [" + memoryFile + "](../memory/" + memoryFile + ")");
  put(path, field(entry, "status", complete ? "completed" : "active"));
}

function updateBacklog(scribe: ScribeProposal, source: SourceReader, hasSource: SourceExists, put: PatchWriter, today: string, archiveInferred: boolean) {
  const originalTodo = source(".context/backlog/todo.md");
  let todo = originalTodo;
  const completed = [...scribe.backlog.complete_explicit, ...(archiveInferred ? scribe.backlog.complete_inferred : [])];
  for (const entry of completed) {
    const slug = backlogSlug(entry.slug);
    const itemPath = join(".context", "backlog", "items", slug + ".md");
    const archive = join(".context", "backlog", "archive", today.slice(0, 7), slug + ".md");
    put(archive, field(field(field(source(itemPath), "status", "completed"), "completed", today), "updated", today));
    put(itemPath, null);
    todo = todo.split("\n").filter((line) => !line.includes("items/" + slug + ".md")).join("\n");
  }
  for (const item of scribe.backlog.new_items) {
    const slug = backlogSlug(item.slug);
    const path = join(".context", "backlog", "items", slug + ".md");
    if (hasSource(path)) throw new SchemaError("new backlog item exists: " + slug);
    put(path, "---\ntitle: " + JSON.stringify(item.title.text) + "\nstatus: active\npriority: " + item.priority.value + "\ncreated: " + today + "\nupdated: " + today + "\ncompleted: null\nrelated: [" + item.related.map((itemPath) => JSON.stringify(itemPath)).join(", ") + "]\n---\n\n" + item.body.text + "\n");
    todo = upsertIndexLine(todo, "- [ ] [" + item.title.text + "](items/" + slug + ".md)");
  }
  if (todo !== originalTodo) put(".context/backlog/todo.md", todo);
}

function moveLooseArtifacts(snap: SnapshotOk["snapshot"], source: SourceReader, put: PatchWriter) {
  for (const artifact of snap.loose_artifacts.filter((item) => item.move)) {
    const destination = join(snap.subject.path, artifact.path.split("/").at(-1)!);
    put(destination, source(artifact.path));
    put(artifact.path, null);
  }
}

function checkpointPatch(input: EvalInput, ops: PatchOp[]) {
  if (!input.checkpoint) return ops;
  const snap = asOk(input.snapshot);
  const { scribe, sources } = input.checkpoint;
  const today = todayOf(input, snap);
  const memory = join(".context", "memory", memoryFilename(snap, today));
  const all = new Map(ops.map((op) => [op.path, op.content]));
  const put: PatchWriter = (path, content) => { assertContextPath(path); all.set(path, content); };
  const source: SourceReader = (path) => {
    if (path === ".context/backlog/todo.md" && !Object.hasOwn(sources, path)) return "";
    if (!Object.hasOwn(sources, path)) throw new SchemaError("checkpoint source is absent: " + path);
    return sources[path]!;
  };
  const complete = input.auditor?.complete === true;
  const memoryFile = memory.split("/").at(-1)!;
  put(memory, memoryContent(snap, scribe, today, memory));
  updateSubjectFiles(snap, source, put, memoryFile, complete);
  updateSubjectIndex(snap, source, put, memoryFile, complete);
  updateBacklog(scribe, source, (path) => Object.hasOwn(sources, path), put, today, input.archiveInferred === true);
  moveLooseArtifacts(snap, source, put);
  return [...all].map(([path, content]) => ({ path, content }));
}

function composePatch(rules: ClosedRule[], input?: EvalInput): PatchPlan {
  const memory = rules.find((r) => r.id === 3)?.result as { path: string; draft: { title: string; body: string } } | undefined;
  const ops: PatchOp[] = [];
  if (memory) ops.push({ path: memory.path, content: "# " + memory.draft.title + "\n\n" + memory.draft.body + "\n" });
  const index = rules.find((r) => r.id === 7)?.result as { path: string; upsertKey: string; existing: string } | undefined;
  if (index && memory) ops.push({ path: index.path, content: upsertIndexLine(index.existing, "- " + index.upsertKey) });
  return { ops: input ? checkpointPatch(input, ops) : ops, moves: [] };
}

export function evaluateSnapshot(input: EvalInput): Evaluation {
  if (input.snapshot.kind === "ambiguous") throw new UserGateError("subject", input.snapshot.candidates.map((c) => c.name));
  recheckHashes(input);
  const rules: ClosedRule[] = [];
  for (const rule of RULES) rules.push(rule(input));
  return { rules, patch: composePatch(rules, input) };
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
