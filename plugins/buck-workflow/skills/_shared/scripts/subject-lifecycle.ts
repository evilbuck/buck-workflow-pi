#!/usr/bin/env bun
import { existsSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { parseSimpleYaml, splitFrontmatter } from "./context-helpers.js";
import ts from "typescript";

export type SubjectLifecycleState = "draft" | "active" | "completed";
export type SubjectLifecycleIntent =
  | { kind: "initialize"; subjectDir: string }
  | { kind: "activate"; subjectDir: string }
  | { kind: "close-verified"; subjectDir: string }
  | { kind: "reopen"; subjectDir: string; reason: string };

export interface SubjectLifecycleInspection {
  subjectDir: string;
  state: SubjectLifecycleState | "missing";
  effectiveState: SubjectLifecycleState | "missing";
  canonical: boolean;
  revision: number;
  provenance: "canonical" | "legacy" | "missing" | "malformed";
  verifiedClosed: boolean;
  blockers: string[];
}

export interface SubjectLifecycleResult extends SubjectLifecycleInspection {
  ok: boolean;
  code: "applied" | "invalid-transition" | "not-verified" | "legacy-ambiguous";
  changed: boolean;
  previousState: SubjectLifecycleState | "missing";
  resultingState: SubjectLifecycleState | "missing";
}


export interface SubjectLifecycleAuditViolation {
  path: string;
  line: number;
  message: string;
}
type Verification = { verified: boolean; ambiguous: boolean; blockers: string[] };
const STATES: Record<SubjectLifecycleState, true> = { draft: true, active: true, completed: true };
const LIFECYCLE_KEYS = [
  "status",
  "lifecycle_schema",
  "lifecycle_revision",
  "lifecycle_last_transition",
  "lifecycle_reopen_reason",
] as const;
const STATE_BY_TRANSITION: Record<SubjectLifecycleIntent["kind"], SubjectLifecycleState> = {
  initialize: "draft",
  activate: "active",
  "close-verified": "completed",
  reopen: "active",
};

function readIndex(subjectDir: string): string {
  const path = join(subjectDir, "index.md");
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function rawState(text: string): SubjectLifecycleState | "missing" {
  const { yaml } = splitFrontmatter(text);
  if (yaml === null) return "missing";
  const status = parseSimpleYaml(yaml).status;
  return typeof status === "string" && status in STATES
    ? status as SubjectLifecycleState
    : "missing";
}

function transitionStateMatches(data: Record<string, unknown>): boolean {
  const transition = data.lifecycle_last_transition;
  if (typeof transition !== "string") return false;
  if (!(transition in STATE_BY_TRANSITION)) return false;
  if (typeof data.status !== "string") return false;
  return STATE_BY_TRANSITION[transition as SubjectLifecycleIntent["kind"]] === data.status;
}

function reopenReasonIsValid(data: Record<string, unknown>): boolean {
  if (data.lifecycle_last_transition !== "reopen") return true;
  if (typeof data.lifecycle_reopen_reason !== "string") return false;
  return data.lifecycle_reopen_reason.trim().length > 0;
}

function canonicalMetadata(text: string): { canonical: boolean; malformed: boolean; revision: number } {
  const { yaml } = splitFrontmatter(text);
  if (yaml === null) return { canonical: false, malformed: false, revision: 0 };
  const data = parseSimpleYaml(yaml);
  const lifecyclePresent = Object.keys(data).some((key) => key.startsWith("lifecycle_"));
  if (!lifecyclePresent) return { canonical: false, malformed: false, revision: 0 };
  const revision = data.lifecycle_revision;
  const validSchema = data.lifecycle_schema === 1;
  const validRevision = Number.isInteger(revision) && (revision as number) >= 1;
  const valid = validSchema && validRevision && transitionStateMatches(data) && reopenReasonIsValid(data);
  return { canonical: valid, malformed: !valid, revision: valid ? revision as number : 0 };
}

function markdownFiles(subjectDir: string): string[] {
  try {
    return readdirSync(subjectDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

function frontmatter(path: string): Record<string, unknown> {
  try {
    const { yaml } = splitFrontmatter(readFileSync(path, "utf8"));
    return yaml === null ? {} : parseSimpleYaml(yaml);
  } catch {
    return {};
  }
}

function attachUnownedPhase(
  phase: string,
  plans: string[],
  phasesByPlan: Map<string, string[]>,
  blockers: string[],
): boolean {
  if (plans.length === 1) {
    phasesByPlan.get(plans[0])?.push(phase);
    return false;
  }
  if (plans.length === 0) return false;
  blockers.push(`${phase}: missing plan ownership in multi-plan subject`);
  return true;
}

function assignPhaseOwnership(
  subjectDir: string,
  phases: string[],
  plans: string[],
  phasesByPlan: Map<string, string[]>,
  blockers: string[],
): boolean {
  let ambiguous = false;
  for (const phase of phases) {
    const data = frontmatter(join(subjectDir, phase));
    const hasOwner = Object.prototype.hasOwnProperty.call(data, "plan");
    if (!hasOwner) {
      if (attachUnownedPhase(phase, plans, phasesByPlan, blockers)) ambiguous = true;
      continue;
    }
    if (typeof data.plan !== "string" || !data.plan.trim()) {
      blockers.push(`${phase}: malformed plan ownership`);
      ambiguous = true;
      continue;
    }
    const owner = basename(data.plan);
    if (!phasesByPlan.has(owner)) {
      blockers.push(`${phase}: unknown plan ${owner}`);
      ambiguous = true;
      continue;
    }
    phasesByPlan.get(owner)?.push(phase);
  }
  return ambiguous;
}

function collectPlanBlockers(
  subjectDir: string,
  plans: string[],
  phasesByPlan: Map<string, string[]>,
  blockers: string[],
): void {
  for (const plan of plans) {
    const owned = phasesByPlan.get(plan) ?? [];
    if (owned.length === 0) {
      blockers.push(`${plan}: unphased plan remains open`);
      continue;
    }
    for (const phase of owned) {
      if (frontmatter(join(subjectDir, phase)).status !== "completed") {
        blockers.push(`${phase}: phase is not completed`);
      }
    }
  }
}

function verifyClose(subjectDir: string): Verification {
  const names = markdownFiles(subjectDir);
  const plans = names.filter((name) => /^plan-.*\.md$/.test(name) && !/-phases\.md$/.test(name));
  const phases = names.filter((name) => /^phase-\d+-.+\.md$/.test(name));
  const blockers: string[] = [];
  const phasesByPlan = new Map(plans.map((plan) => [plan, [] as string[]]));
  const ambiguous = assignPhaseOwnership(subjectDir, phases, plans, phasesByPlan, blockers);
  collectPlanBlockers(subjectDir, plans, phasesByPlan, blockers);
  if (plans.length === 0) blockers.push("no plan provides closeout evidence");
  return { verified: blockers.length === 0, ambiguous, blockers };
}

function lifecycleProvenance(
  metadata: { canonical: boolean; malformed: boolean },
  state: SubjectLifecycleState | "missing",
): SubjectLifecycleInspection["provenance"] {
  if (metadata.malformed) return "malformed";
  if (metadata.canonical) return "canonical";
  return state === "missing" ? "missing" : "legacy";
}

export function inspectSubjectLifecycle(subjectDir: string): SubjectLifecycleInspection {
  const dir = resolve(subjectDir);
  const text = readIndex(dir);
  const state = rawState(text);
  const metadata = canonicalMetadata(text);
  const verification = verifyClose(dir);
  const legacyVerifiedClosed = !metadata.canonical
    && !metadata.malformed
    && (state === "active" || state === "draft")
    && verification.verified;
  const verifiedClosed = state === "completed" || legacyVerifiedClosed;
  const effectiveState = verifiedClosed ? "completed" : state;
  return {
    subjectDir: dir,
    state,
    effectiveState,
    canonical: metadata.canonical,
    revision: metadata.revision,
    provenance: lifecycleProvenance(metadata, state),
    verifiedClosed,
    blockers: verification.blockers,
  };
}

function yamlValue(value: string | number): string {
  if (typeof value === "number") return String(value);
  return /^[A-Za-z0-9._/-]+(?: [A-Za-z0-9._/-]+)*$/.test(value) ? value : JSON.stringify(value);
}

function requestedLifecycleFields(
  fields: Record<string, string | number | undefined>,
): Map<string, string | number> {
  const wanted = new Map<string, string | number>();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) wanted.set(key, value);
  }
  return wanted;
}

function replaceLifecycleLines(lines: string[], wanted: Map<string, string | number>): string[] {
  const next: string[] = [];
  for (const line of lines) {
    const match = /^([A-Za-z0-9_]+):/.exec(line);
    if (!match) {
      next.push(line);
      continue;
    }
    const key = match[1] as typeof LIFECYCLE_KEYS[number];
    if (!LIFECYCLE_KEYS.includes(key)) {
      next.push(line);
      continue;
    }
    const value = wanted.get(key);
    if (value === undefined) continue;
    next.push(`${key}: ${yamlValue(value)}`);
    wanted.delete(key);
  }
  return next;
}

function appendMissingLifecycleLines(next: string[], wanted: Map<string, string | number>): void {
  for (const key of LIFECYCLE_KEYS) {
    const value = wanted.get(key);
    if (value !== undefined) next.push(`${key}: ${yamlValue(value)}`);
  }
}

function updateLifecycleText(text: string, fields: Record<string, string | number | undefined>): string {
  const split = splitFrontmatter(text);
  const lines = split.yaml === null ? [] : split.yaml.split(/\r?\n/);
  const wanted = requestedLifecycleFields(fields);
  const next = replaceLifecycleLines(lines, wanted);
  appendMissingLifecycleLines(next, wanted);
  const body = split.yaml === null ? text : split.body;
  return `---\n${next.join("\n")}\n---\n${body}`;
}

function atomicWrite(subjectDir: string, text: string): void {
  const path = join(subjectDir, "index.md");
  const temp = join(dirname(path), `.index.md.${process.pid}.${Date.now()}.tmp`);
  writeFileSync(temp, text, "utf8");
  renameSync(temp, path);
}

function refusal(inspection: SubjectLifecycleInspection, code: SubjectLifecycleResult["code"]): SubjectLifecycleResult {
  return {
    ...inspection,
    ok: false,
    code,
    changed: false,
    previousState: inspection.state,
    resultingState: inspection.state,
  };
}

function applied(previous: SubjectLifecycleInspection, resultingState: SubjectLifecycleState, changed: boolean): SubjectLifecycleResult {
  const next = inspectSubjectLifecycle(previous.subjectDir);
  return {
    ...next,
    ok: true,
    code: "applied",
    changed,
    previousState: previous.state,
    resultingState,
  };
}

function persist(previous: SubjectLifecycleInspection, state: SubjectLifecycleState, transition: SubjectLifecycleIntent["kind"], reason?: string): SubjectLifecycleResult {
  const current = readIndex(previous.subjectDir);
  const { yaml } = splitFrontmatter(current);
  const existingReason = yaml === null ? undefined : parseSimpleYaml(yaml).lifecycle_reopen_reason;
  const fields: Record<string, string | number | undefined> = {
    status: state,
    lifecycle_schema: 1,
    lifecycle_revision: previous.revision + 1,
    lifecycle_last_transition: transition,
    lifecycle_reopen_reason: reason ?? (typeof existingReason === "string" ? existingReason : undefined),
  };
  atomicWrite(previous.subjectDir, updateLifecycleText(current, fields));
  return applied(previous, state, true);
}

function initializeSubject(inspection: SubjectLifecycleInspection): SubjectLifecycleResult {
  if (inspection.canonical && inspection.state === "draft") return applied(inspection, "draft", false);
  if (inspection.state !== "missing") return refusal(inspection, "invalid-transition");
  return persist(inspection, "draft", "initialize");
}

function activateSubject(inspection: SubjectLifecycleInspection): SubjectLifecycleResult {
  if (inspection.canonical && inspection.state === "active") return applied(inspection, "active", false);
  if (inspection.effectiveState === "completed") return refusal(inspection, "invalid-transition");
  if (inspection.state !== "draft" && inspection.state !== "active") {
    return refusal(inspection, "invalid-transition");
  }
  return persist(inspection, "active", "activate");
}

function closeSubject(inspection: SubjectLifecycleInspection): SubjectLifecycleResult {
  if (inspection.canonical && inspection.state === "completed") return applied(inspection, "completed", false);
  if (!inspection.canonical && inspection.state === "completed") {
    return persist(inspection, "completed", "close-verified");
  }
  const verification = verifyClose(inspection.subjectDir);
  const checked = { ...inspection, blockers: verification.blockers };
  if (verification.ambiguous) return refusal(checked, "legacy-ambiguous");
  if (!verification.verified) return refusal(checked, "not-verified");
  if (inspection.state !== "active" && inspection.state !== "completed") {
    return refusal(checked, "invalid-transition");
  }
  return persist(inspection, "completed", "close-verified");
}

function reopenSubject(inspection: SubjectLifecycleInspection, reason: string): SubjectLifecycleResult {
  const normalizedReason = reason.trim();
  if (!normalizedReason) return refusal(inspection, "invalid-transition");
  if (!inspection.canonical) return refusal(inspection, "invalid-transition");
  if (inspection.state !== "completed") return refusal(inspection, "invalid-transition");
  return persist(inspection, "active", "reopen", normalizedReason);
}

export function applySubjectLifecycleIntent(intent: SubjectLifecycleIntent): SubjectLifecycleResult {
  const inspection = inspectSubjectLifecycle(intent.subjectDir);
  if (inspection.provenance === "malformed") return refusal(inspection, "legacy-ambiguous");
  switch (intent.kind) {
    case "initialize": return initializeSubject(inspection);
    case "activate": return activateSubject(inspection);
    case "close-verified": return closeSubject(inspection);
    case "reopen": return reopenSubject(inspection, intent.reason);
  }
}

function walkFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function nodeText(node: ts.Node): string | null {
  if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (
    node.kind === ts.SyntaxKind.TemplateHead
    || node.kind === ts.SyntaxKind.TemplateMiddle
    || node.kind === ts.SyntaxKind.TemplateTail
  ) {
    return (node as ts.Node & { text: string }).text;
  }
  return null;
}

function propertyNameText(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNoSubstitutionTemplateLiteral(name)) {
    return name.text;
  }
  if (ts.isComputedPropertyName(name)) return nodeText(name.expression);
  return null;
}

type ConstantInitializers = ReadonlyMap<string, ts.Expression>;

function collectConstantInitializers(source: ts.SourceFile): ConstantInitializers {
  const initializers = new Map<string, ts.Expression>();
  const ambiguous = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node)
      && ts.isIdentifier(node.name)
      && node.initializer
      && (node.parent.flags & ts.NodeFlags.Const) !== 0
    ) {
      const name = node.name.text;
      if (initializers.has(name)) {
        initializers.delete(name);
        ambiguous.add(name);
      } else if (!ambiguous.has(name)) {
        initializers.set(name, node.initializer);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return initializers;
}

function collectResolvedStrings(
  node: ts.Node,
  initializers: ConstantInitializers,
  strings: string[],
  resolving = new Set<string>(),
): void {
  const value = nodeText(node);
  if (value !== null) {
    strings.push(value);
    return;
  }
  if (ts.isIdentifier(node)) {
    const initializer = initializers.get(node.text);
    if (!initializer || resolving.has(node.text)) return;
    resolving.add(node.text);
    collectResolvedStrings(initializer, initializers, strings, resolving);
    resolving.delete(node.text);
    return;
  }
  if (ts.isPropertyAssignment(node)) {
    collectResolvedStrings(node.initializer, initializers, strings, resolving);
    return;
  }
  if (ts.isPropertyAccessExpression(node)) {
    collectResolvedStrings(node.expression, initializers, strings, resolving);
    return;
  }
  ts.forEachChild(node, (child) => collectResolvedStrings(child, initializers, strings, resolving));
}

function containsLifecycleObjectField(
  node: ts.Node,
  initializers: ConstantInitializers,
  resolving = new Set<string>(),
): boolean {
  if (ts.isIdentifier(node)) {
    const initializer = initializers.get(node.text);
    if (!initializer || resolving.has(node.text)) return false;
    resolving.add(node.text);
    const found = containsLifecycleObjectField(initializer, initializers, resolving);
    resolving.delete(node.text);
    return found;
  }
  if (ts.isPropertyAssignment(node)) {
    const name = propertyNameText(node.name);
    if (name === "status") {
      const values: string[] = [];
      collectResolvedStrings(node.initializer, initializers, values);
      if (values.some((value) => value in STATES)) return true;
    } else if (name !== null && LIFECYCLE_KEYS.includes(name as (typeof LIFECYCLE_KEYS)[number])) {
      return true;
    }
    return containsLifecycleObjectField(node.initializer, initializers, resolving);
  }
  if (ts.isShorthandPropertyAssignment(node)) {
    if (LIFECYCLE_KEYS.includes(node.name.text as (typeof LIFECYCLE_KEYS)[number])) return true;
    return containsLifecycleObjectField(node.name, initializers, resolving);
  }
  if (ts.isPropertyAccessExpression(node)) {
    return containsLifecycleObjectField(node.expression, initializers, resolving);
  }
  let found = false;
  ts.forEachChild(node, (child) => {
    if (!found) found = containsLifecycleObjectField(child, initializers, resolving);
  });
  return found;
}

function callExpressionName(node: ts.CallExpression): string | null {
  if (ts.isIdentifier(node.expression)) return node.expression.text;
  if (ts.isPropertyAccessExpression(node.expression)) return node.expression.name.text;
  return null;
}

function isDirectLifecycleWrite(
  node: ts.CallExpression,
  initializers: ConstantInitializers,
): boolean {
  const calleeName = callExpressionName(node);
  if (
    calleeName === null
    || !/^(?:write|writeFile|writeFileSync|appendFile|appendFileSync)$/.test(calleeName)
  ) return false;

  const strings: string[] = [];
  for (const argument of node.arguments) collectResolvedStrings(argument, initializers, strings);
  const joined = strings.join("\n");
  if (!/index\.md/.test(joined)) return false;

  return /status:\s*(?:draft|active|completed)/.test(joined)
    || node.arguments.some((argument) => containsLifecycleObjectField(argument, initializers));
}

function auditTypeScript(path: string, repo: string): SubjectLifecycleAuditViolation[] {
  const rel = relative(repo, path).replaceAll("\\", "/");
  if (/\.test\.tsx?$/.test(rel) || rel.includes("/__tests__/")) return [];
  const canonical = "skills/_shared/scripts/subject-lifecycle.ts";
  const bundled = "plugins/buck-workflow/skills/_shared/scripts/subject-lifecycle.ts";
  if (rel === canonical) return [];
  if (rel === bundled) {
    const source = join(repo, canonical);
    return existsSync(source) && readFileSync(source, "utf8") === readFileSync(path, "utf8")
      ? []
      : [{ path: rel, line: 1, message: "bundled lifecycle authority is not byte-identical" }];
  }
  const text = readFileSync(path, "utf8");
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const initializers = collectConstantInitializers(source);
  const violations: SubjectLifecycleAuditViolation[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && isDirectLifecycleWrite(node, initializers)) {
      const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
      violations.push({ path: rel, line, message: "direct subject lifecycle write" });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return violations;
}

const SUBJECT_INDEX_TEMPLATE_PATTERNS = [
  /subject.*(?:frontmatter|metadata).*index\.md/i,
  /index\.md.*subject.*(?:frontmatter|metadata)/i,
];
const SAME_LINE_LIFECYCLE_PATTERNS = [
  /\b(?:create|write|set|update|change|reopen)\b.*index\.md.*status\s*:/i,
  /index\.md.*\b(?:create|write|set|update|change|reopen)\b.*status\s*:/i,
];
const LIFECYCLE_STATUS_FIELD = /^status:\s*(?:draft|active|completed)\s*$/i;

function advanceSubjectIndexFence(
  line: string,
  template: boolean,
  opened: boolean,
): { template: boolean; opened: boolean } {
  if (!template) return { template, opened };
  if (!/^```/.test(line.trim())) return { template, opened };
  if (opened) return { template: false, opened: false };
  return { template: true, opened: true };
}

function auditMarkdown(path: string, repo: string): SubjectLifecycleAuditViolation[] {
  const rel = relative(repo, path).replaceAll("\\", "/");
  const violations: SubjectLifecycleAuditViolation[] = [];
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  let subjectIndexTemplate = false;
  let subjectIndexFenceOpened = false;
  for (const [index, line] of lines.entries()) {
    if (SUBJECT_INDEX_TEMPLATE_PATTERNS.some((pattern) => pattern.test(line))) {
      subjectIndexTemplate = true;
      subjectIndexFenceOpened = false;
    }
    const templateField = subjectIndexTemplate && LIFECYCLE_STATUS_FIELD.test(line.trim());
    if (SAME_LINE_LIFECYCLE_PATTERNS.some((pattern) => pattern.test(line)) || templateField) {
      violations.push({ path: rel, line: index + 1, message: "imperative direct subject lifecycle write" });
    }
    const fence = advanceSubjectIndexFence(line, subjectIndexTemplate, subjectIndexFenceOpened);
    subjectIndexTemplate = fence.template;
    subjectIndexFenceOpened = fence.opened;
  }
  return violations;
}

export function auditSubjectLifecyclePolicy(repoRoot: string): SubjectLifecycleAuditViolation[] {
  const repo = resolve(repoRoot);
  const roots = ["skills", "prompts", "commands", "extensions", "plugins/buck-workflow/skills"];
  const violations: SubjectLifecycleAuditViolation[] = [];
  for (const root of roots) {
    for (const path of walkFiles(join(repo, root))) {
      if (/\.tsx?$/.test(path)) violations.push(...auditTypeScript(path, repo));
      else if (path.endsWith(".md")) violations.push(...auditMarkdown(path, repo));
    }
  }
  return violations.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line);
}

function parseCli(argv: string[]): { command: string; subject?: string; reason?: string; repo?: string } {
  const [command, ...rest] = argv;
  const result: { command: string; subject?: string; reason?: string; repo?: string } = { command: command ?? "" };
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--json") continue;
    if (rest[i] === "--subject") result.subject = rest[++i];
    else if (rest[i] === "--reason") result.reason = rest[++i];
    else if (rest[i] === "--repo") result.repo = rest[++i];
    else throw new Error(`unknown argument: ${rest[i]}`);
  }
  return result;
}

async function main(): Promise<number> {
  try {
    const args = parseCli(process.argv.slice(2));
    if (args.command === "inspect") {
      if (!args.subject) throw new Error("--subject is required");
      console.log(JSON.stringify(inspectSubjectLifecycle(args.subject)));
      return 0;
    }
    if (args.command === "audit") {
      const violations = auditSubjectLifecyclePolicy(args.repo ?? ".");
      console.log(JSON.stringify({ ok: violations.length === 0, violations }));
      return violations.length === 0 ? 0 : 1;
    }
    if (["initialize", "activate", "close-verified", "reopen"].includes(args.command)) {
      if (!args.subject) throw new Error("--subject is required");
      if (args.command === "reopen" && !args.reason) throw new Error("--reason is required");
      const intent = args.command === "reopen"
        ? { kind: "reopen" as const, subjectDir: args.subject, reason: args.reason! }
        : { kind: args.command as "initialize" | "activate" | "close-verified", subjectDir: args.subject };
      const result = applySubjectLifecycleIntent(intent);
      console.log(JSON.stringify(result));
      return result.ok ? 0 : 2;
    }
    throw new Error(`unknown command: ${args.command}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

if (import.meta.main) process.exitCode = await main();
