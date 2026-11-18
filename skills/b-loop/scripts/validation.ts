/**
 * Pre-flight validation helpers for `/b-loop <subject>`:
 * strict argument & bridge checks, cwd-scoped Git branch validation, fail-closed
 * storage config validation (`repo-files`, no `integration_ref`), and
 * `workflow_state` plan/phase pinning.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, normalize } from "node:path";
import {
  countAcceptanceCriteria,
  parseFrontmatter,
  splitInlineArray,
  stripInlineComment,
  stripOuterQuotes,
  unwrapToolResult,
} from "./frontmatter.js";
import type {
  BranchValidationResult,
  BuckBuildHint,
  EvalBridges,
  PhaseDifficulty,
  PinnedPhase,
  PinnedPlan,
  ValidatedBridges,
  WorkflowStateTool,
} from "./types.js";

const SUBJECT_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
export const COMMIT_SHA_RE = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/i;
const REMOVED_FLAGS = new Set(["--status", "--resume", "--stop", "--profile"]);
const REQUIRED_BRIDGE_KEYS = ["agent", "wait", "judge", "sh", "phase", "log"] as const;

export interface PorcelainEntry {
  xy: string;
  path: string;
  origPath?: string;
}

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function shellQuote(value: string): string {
  const q = "\x27";
  return q + value.split(q).join(`${q}\\${q}${q}`) + q;
}

export function isWorkflowScratchPath(relPath: string): boolean {
  const norm = relPath.replace(/\\/g, "/");
  return norm === ".context/workflow" || norm.startsWith(".context/workflow/");
}

export function parsePorcelainZ(raw: string): PorcelainEntry[] {
  const tokens = raw.split("\0").filter((t) => t.length > 0);
  const out: PorcelainEntry[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const rec = tokens[i];
    if (rec.length < 4) continue;
    const xy = rec.slice(0, 2);
    const path = rec.slice(3);
    const isRenameOrCopy = xy[0] === "R" || xy[0] === "C" || xy[1] === "R" || xy[1] === "C";
    const origPath = isRenameOrCopy ? tokens[++i] : undefined;
    out.push({ xy, path, origPath });
  }
  return out;
}

function parseJsonRecord(text: string): Record<string, unknown> | null {
  try {
    const val = JSON.parse(text);
    return val && typeof val === "object" && !Array.isArray(val) ? (val as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function extractJsonObject(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  const direct = parseJsonRecord(trimmed);
  if (direct) return direct;
  const openIdx = trimmed.indexOf("```");
  if (openIdx >= 0) {
    const nlIdx = trimmed.indexOf("\n", openIdx + 3);
    const bodyStart = nlIdx >= 0 ? nlIdx + 1 : openIdx + 3;
    const closeIdx = trimmed.indexOf("```", bodyStart);
    if (closeIdx > bodyStart) {
      const inner = parseJsonRecord(trimmed.slice(bodyStart, closeIdx).trim());
      if (inner) return inner;
    }
  }
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return parseJsonRecord(trimmed.slice(firstBrace, lastBrace + 1));
  }
  return null;
}

export function agentHandleId(handle: unknown): string | null {
  if (!handle || typeof handle !== "object") return null;
  const rec = handle as Record<string, unknown>;
  if (typeof rec.handle === "string") return rec.handle;
  if (typeof rec.id === "string") return rec.id;
  return null;
}

export function xdgEnvPrefixFor(ctxXdg?: string, fallbackXdg?: string): string {
  const xdgEnv = ctxXdg?.trim() || fallbackXdg?.trim() || process.env.XDG_CONFIG_HOME?.trim();
  return xdgEnv ? `XDG_CONFIG_HOME=${shellQuote(xdgEnv)} ` : "";
}

function assertDirectory(cwd: string): string {
  if (!cwd || !existsSync(cwd) || !statSync(cwd).isDirectory()) {
    throw new Error(`Target working directory does not exist or is not a directory: ${cwd}`);
  }
  return cwd;
}

function gitCommand(cwd: string, args: string): string {
  return `git -C ${shellQuote(assertDirectory(cwd))} ${args}`;
}

function rejectUnsupportedToken(token: string): void {
  if (REMOVED_FLAGS.has(token) || token.startsWith("--profile=")) {
    throw new Error(`Unsupported flag ${token}: optional controls (status, resume, stop, profiles) were removed; run \`/b-loop <subject>\`.`);
  }
  if (token.startsWith("-")) {
    throw new Error(`Unsupported option ${token}: \`/b-loop <subject>\` accepts only one subject ID.`);
  }
}

function assertValidSubjectId(subjectId: string): string {
  if (subjectId.includes("/") || subjectId.includes("\\") || subjectId.includes("..") || subjectId.endsWith(".md")) {
    throw new Error(`Invalid subject ID "${subjectId}": pass a subject identifier (e.g. 2026-11-17.my-feature), not a file path.`);
  }
  if (!SUBJECT_ID_RE.test(subjectId)) {
    throw new Error(`Invalid subject ID "${subjectId}": must match ${SUBJECT_ID_RE.source}.`);
  }
  return subjectId;
}

/** Parse and strictly validate the single `<subject>` argument; reject flags, paths, and omitted targets. */
export function parseSubjectArgument(rawArgs: string, explicitSubject?: string): string {
  const source = (explicitSubject ?? rawArgs).trim();
  if (!source) {
    throw new Error("A subject ID is required (`/b-loop <subject>`). Automatic subject selection is disabled.");
  }
  const tokens = source.split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    rejectUnsupportedToken(token);
  }
  if (tokens.length !== 1) {
    throw new Error(`Expected exactly one <subject> argument, got ${tokens.length}.`);
  }
  return assertValidSubjectId(tokens[0]);
}

/** Verify all required OMP runtime bridges exist without substituting no-op mocks. */
export function validateBridges(bridges?: EvalBridges): ValidatedBridges {
  if (!bridges) {
    throw new Error("Missing required OMP bridges: agent, wait, judge, sh, phase, log, tool.workflow_state");
  }
  const missing: string[] = [];
  for (const key of REQUIRED_BRIDGE_KEYS) {
    if (typeof bridges[key] !== "function") missing.push(key);
  }
  const toolVal = bridges.tool;
  const hasToolHost = toolVal !== null && (typeof toolVal === "object" || typeof toolVal === "function");
  if (!hasToolHost || typeof toolVal?.workflow_state !== "function") {
    missing.push("tool.workflow_state");
  }
  if (missing.length > 0) {
    throw new Error(`Missing required OMP bridges: ${missing.join(", ")}`);
  }
  return bridges as ValidatedBridges;
}

function exitCodeOf(value: Record<string, unknown>): number | undefined {
  for (const key of ["exitCode", "exit_code", "status", "code"] as const) {
    const val = value[key];
    if (typeof val === "number" && Number.isFinite(val)) return val;
    if (typeof val === "string" && /^-?\d+$/.test(val.trim())) {
      return Number.parseInt(val.trim(), 10);
    }
  }
  return undefined;
}

function textFromError(error: unknown): string {
  if (error && typeof error === "object") {
    const rec = error as Record<string, unknown>;
    const code = exitCodeOf(rec);
    const stderrText = typeof rec.stderr === "string" ? rec.stderr.trim() : "";
    const outText = typeof rec.output === "string" ? rec.output.trim() : "";
    const detail = outText || stderrText;
    const msg = error instanceof Error ? error.message : detail || String(error);
    return code !== undefined ? `exit ${code}: ${detail || msg}` : detail || msg;
  }
  return String(error);
}

function shFailureDetail(rec: Record<string, unknown>, code: number | undefined): string {
  const stderrText = typeof rec.stderr === "string" ? rec.stderr.trim() : "";
  const outText = typeof rec.output === "string" ? rec.output.trim() : "";
  const signalText = typeof rec.signal === "string" ? `signal ${rec.signal}` : "";
  const codeText = code !== undefined ? `exit ${code}` : "missing finite zero exitCode";
  return stderrText || outText || signalText || codeText;
}

function isShObjectFailure(rec: Record<string, unknown>, code: number | undefined): boolean {
  if (rec.ok === false || rec.isError === true || rec.cancelled === true) return true;
  return code === undefined || code !== 0;
}

function extractObjectShOutput(rec: Record<string, unknown>, command: string): string {
  const code = exitCodeOf(rec);
  if (isShObjectFailure(rec, code)) {
    throw new Error(`Command failed (${command}): ${shFailureDetail(rec, code)}`);
  }
  if (typeof rec.stdout === "string") return rec.stdout;
  if (typeof rec.output === "string") return rec.output;
  return "";
}

/** Execute shell command through OMP `sh`, failing closed on thrown ShellError, missing exitCode, or non-zero status. */
export async function runSh(
  shFn: (cmd: string | TemplateStringsArray, ...args: unknown[]) => Promise<unknown>,
  command: string,
): Promise<string> {
  let result: unknown;
  try {
    result = await shFn(command);
  } catch (error) {
    throw new Error(`Command failed (${command}): ${textFromError(error)}`);
  }
  if (typeof result === "string") return result;
  if (result && typeof result === "object" && !Array.isArray(result)) {
    return extractObjectShOutput(result as Record<string, unknown>, command);
  }
  throw new Error(`Command failed (${command}): unexpected empty or non-object shell result (${String(result)}).`);
}

/** Validate `cwd` is inside a Git worktree on a valid named local branch with a resolved HEAD commit. */
export async function validateNamedBranch(
  cwd: string,
  sh: ValidatedBridges["sh"],
): Promise<BranchValidationResult> {
  const inside = (await runSh(sh, gitCommand(cwd, "rev-parse --is-inside-work-tree"))).trim();
  if (inside !== "true") {
    throw new Error("Target directory is not inside a Git worktree.");
  }

  let worktreeRoot: string;
  try {
    worktreeRoot = (await runSh(sh, gitCommand(cwd, "rev-parse --show-toplevel"))).trim();
  } catch (error) {
    throw new Error(
      `Unable to resolve Git top-level directory: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!worktreeRoot) {
    throw new Error("Unable to resolve Git top-level directory.");
  }

  let branchRef: string;
  try {
    branchRef = (await runSh(sh, gitCommand(worktreeRoot, "symbolic-ref --quiet HEAD"))).trim();
  } catch {
    throw new Error("Detached HEAD is not supported: checkout a named local branch before running `/b-loop <subject>`.");
  }

  if (!branchRef.startsWith("refs/heads/")) {
    throw new Error(`HEAD (${branchRef || "unknown"}) is not a named local branch under refs/heads/.`);
  }

  let headCommit: string;
  try {
    headCommit = (await runSh(sh, gitCommand(worktreeRoot, "rev-parse --verify HEAD^{commit}"))).trim();
  } catch {
    throw new Error(`Named branch ${branchRef} has no valid HEAD commit (unborn branch).`);
  }

  if (!/^[a-f0-9]{40,64}$/i.test(headCommit)) {
    throw new Error(`Unexpected HEAD commit hash "${headCommit}".`);
  }

  return {
    branchRef,
    branchName: branchRef.slice("refs/heads/".length),
    headCommit,
    worktreeRoot,
  };
}

/** Read Git remote origin URL for `cwd` if configured; return undefined when no origin is set. */
export async function tryReadGitOrigin(
  cwd: string,
  sh: ValidatedBridges["sh"],
): Promise<string | undefined> {
  try {
    const out = (await runSh(sh, gitCommand(cwd, "config --get remote.origin.url"))).trim();
    return out || undefined;
  } catch (error) {
    const detail = textFromError(error);
    // `git config --get` exits 1 when the setting is absent; other failures must propagate.
    if (/\bexit 1\b/.test(detail)) {
      return undefined;
    }
    throw new Error(`Unable to probe git remote.origin.url: ${detail}`);
  }
}

/** Canonical origin normalizer matching `skills/_shared/storage/identity.ts#redactOrigin`. */
export function redactOrigin(origin: string): string {
  const text = origin.trim();
  if (!text) throw new Error("Project identity origin is empty");
  if (isAbsolute(text)) return normalize(text);
  if (!text.includes("://")) {
    const match = /^(?:[^@/]+@)?([^:/\s]+):(.+)$/.exec(text);
    if (!match) throw new Error("Relative local project origin is ambiguous");
    return `${match[1].toLowerCase()}:${match[2]}`;
  }
  const url = new URL(text);
  url.username = "";
  url.password = "";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

interface ParsedProjectBlock {
  origins: string[];
  integrationRef?: string;
  adapter?: string;
  seenFields: Set<string>;
}

type YamlFrame =
  | { kind: "top-storage"; indent: number; seenFields: Set<string> }
  | { kind: "projects"; indent: number }
  | { kind: "project"; indent: number; name: string }
  | { kind: "project-origins"; indent: number; name: string }
  | { kind: "project-storage"; indent: number; name: string; seenFields: Set<string> };

interface StorageYamlState {
  version?: number;
  defaultAdapter: string;
  seenTopKeys: Set<string>;
  projects: Record<string, ParsedProjectBlock>;
  stack: YamlFrame[];
}

function stripQuotedSegments(cleaned: string): string {
  let out = "";
  let quote: '"' | "'" | null = null;
  let escaped = false;
  for (const ch of cleaned) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (quote === '"' && ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = quote === ch ? null : quote === null ? ch : quote;
      continue;
    }
    if (quote === null) out += ch;
  }
  return out;
}

function rejectUnsupportedYamlTokens(cleaned: string): void {
  const unquoted = stripQuotedSegments(cleaned);
  if (/^\s*-\s*\{/.test(unquoted) || /:\s*\{/.test(unquoted)) {
    throw new Error(`Unsupported YAML flow mapping syntax in storage config: ${cleaned}`);
  }
  if (/(?:^|[\s\[,])([&*][A-Za-z0-9_-]+)/.test(unquoted)) {
    throw new Error(`Unsupported YAML anchor/alias syntax in storage config: ${cleaned}`);
  }
  const colonIdx = unquoted.indexOf(":");
  const valPart = colonIdx >= 0 ? unquoted.slice(colonIdx + 1).trim() : unquoted.trim();
  if (/^[|>]/.test(valPart)) {
    throw new Error(`Unsupported YAML block scalar syntax in storage config: ${cleaned}`);
  }
}

function popFramesToIndent(stack: YamlFrame[], indent: number, trimmed: string): void {
  while (stack.length > 0) {
    const top = stack[stack.length - 1];
    if (top.kind === "project-origins" && trimmed.startsWith("- ") && indent === top.indent) {
      return;
    }
    if (indent > top.indent) return;
    stack.pop();
  }
}

function parseOriginsValue(project: ParsedProjectBlock, rawVal: string, indent: number, stack: YamlFrame[], name: string): void {
  if (!rawVal) {
    stack.push({ kind: "project-origins", indent, name });
    return;
  }
  if (rawVal.startsWith("[") && rawVal.endsWith("]")) {
    project.origins.push(...splitInlineArray(rawVal.slice(1, -1)));
    return;
  }
  throw new Error(`Unsupported projects.${name}.origins syntax: ${rawVal}`);
}

function handleProjectField(
  state: StorageYamlState,
  name: string,
  indent: number,
  key: string,
  rawVal: string,
): void {
  const project = state.projects[name];
  if (project.seenFields.has(key)) {
    throw new Error(`Duplicate YAML key "${key}" in projects.${name}`);
  }
  project.seenFields.add(key);

  if (key === "origins") {
    parseOriginsValue(project, rawVal, indent, state.stack, name);
    return;
  }
  if (key === "storage") {
    if (rawVal) throw new Error(`Unsupported projects.${name}.storage value: ${rawVal}`);
    state.stack.push({ kind: "project-storage", indent, name, seenFields: new Set() });
    return;
  }
  if (key === "integration_ref") {
    project.integrationRef = stripOuterQuotes(rawVal);
  }
}

function handleProjectChildLine(
  state: StorageYamlState,
  frame: Extract<YamlFrame, { name: string }>,
  indent: number,
  trimmed: string,
): void {
  if (frame.kind === "project-origins") {
    if (!trimmed.startsWith("- ")) {
      throw new Error(`Invalid origins entry in storage config: ${trimmed}`);
    }
    state.projects[frame.name].origins.push(stripOuterQuotes(trimmed.slice(2).trim()));
    return;
  }
  const kv = /^([\w-]+)\s*:\s*(.*)$/.exec(trimmed);
  if (!kv) throw new Error(`Malformed line in storage config project ${frame.name}: ${trimmed}`);
  if (frame.kind === "project-storage") {
    if (frame.seenFields.has(kv[1])) throw new Error(`Duplicate YAML key "${kv[1]}" in projects.${frame.name}.storage`);
    frame.seenFields.add(kv[1]);
    if (kv[1] === "adapter") state.projects[frame.name].adapter = stripOuterQuotes(kv[2]);
    return;
  }
  handleProjectField(state, frame.name, indent, kv[1], kv[2].trim());
}

function handleTopLevelLine(state: StorageYamlState, indent: number, trimmed: string): void {
  const kv = /^([\w-]+)\s*:\s*(.*)$/.exec(trimmed);
  if (!kv || indent !== 0) throw new Error(`Malformed top-level config line: ${trimmed}`);
  if (state.seenTopKeys.has(kv[1])) throw new Error(`Duplicate top-level YAML key "${kv[1]}" in storage config`);
  state.seenTopKeys.add(kv[1]);

  if (kv[1] === "version") state.version = Number.parseInt(kv[2], 10);
  else if (kv[1] === "storage") state.stack.push({ kind: "top-storage", indent, seenFields: new Set() });
  else if (kv[1] === "projects") state.stack.push({ kind: "projects", indent });
}

function handleStorageConfigLine(state: StorageYamlState, rawLine: string): void {
  const cleaned = stripInlineComment(rawLine);
  const trimmed = cleaned.trim();
  if (!trimmed) return;
  rejectUnsupportedYamlTokens(cleaned);

  const indent = cleaned.length - cleaned.trimStart().length;
  popFramesToIndent(state.stack, indent, trimmed);

  const top = state.stack[state.stack.length - 1];
  if (!top) {
    handleTopLevelLine(state, indent, trimmed);
    return;
  }
  if (top.kind === "top-storage") {
    const kv = /^([\w-]+)\s*:\s*(.*)$/.exec(trimmed);
    if (!kv) throw new Error(`Malformed storage section line: ${trimmed}`);
    if (top.seenFields.has(kv[1])) throw new Error(`Duplicate YAML key "${kv[1]}" in storage`);
    top.seenFields.add(kv[1]);
    if (kv[1] === "adapter") state.defaultAdapter = stripOuterQuotes(kv[2]);
    return;
  }
  if (top.kind === "projects") {
    const hdr = /^([\w.-]+)\s*:\s*$/.exec(trimmed);
    if (!hdr) throw new Error(`Malformed project entry in storage config: ${trimmed}`);
    if (state.projects[hdr[1]]) throw new Error(`Duplicate project key "${hdr[1]}" in storage config`);
    state.projects[hdr[1]] = { origins: [], seenFields: new Set() };
    state.stack.push({ kind: "project", indent, name: hdr[1] });
    return;
  }
  handleProjectChildLine(state, top, indent, trimmed);
}

function parseStorageYaml(raw: string, configPath: string): StorageYamlState {
  const state: StorageYamlState = {
    defaultAdapter: "repo-files",
    seenTopKeys: new Set(),
    projects: {},
    stack: [],
  };
  for (const line of raw.split(/\r?\n/)) {
    handleStorageConfigLine(state, line);
  }
  if (state.version !== 1) {
    throw new Error(`Unsupported Buck storage config version in ${configPath}`);
  }
  return state;
}

function resolveStorageConfigPath(options: {
  configPath?: string;
  xdgConfigHome?: string;
  homeDir?: string;
}): { configPath: string; explicit: boolean } {
  const homeDir = options.homeDir ?? homedir();
  const xdg = nonEmpty(options.xdgConfigHome) || nonEmpty(process.env.XDG_CONFIG_HOME) || join(homeDir, ".config");
  const explicitVal = nonEmpty(options.configPath) || nonEmpty(process.env.BUCK_WORKFLOW_CONFIG);
  return {
    configPath: explicitVal || join(xdg, "buck-workflow", "config.yaml"),
    explicit: Boolean(explicitVal),
  };
}

function findMatchingProject(projects: Record<string, ParsedProjectBlock>, origin?: string): ParsedProjectBlock | undefined {
  if (!origin) return undefined;
  const canonicalOrigin = redactOrigin(origin);
  const matches = Object.values(projects).filter((proj) =>
    proj.origins.some((item) => redactOrigin(item) === canonicalOrigin),
  );
  if (matches.length > 1) {
    throw new Error("Ambiguous project storage configuration: multiple project entries match remote origin.");
  }
  return matches[0];
}

/** Validate effective Buck storage config allows only `repo-files` without `integration_ref`. */
export function validateStorageConfig(options: {
  configPath?: string;
  xdgConfigHome?: string;
  homeDir?: string;
  origin?: string;
} = {}): { adapter: "repo-files"; configPath: string } {
  const { configPath, explicit } = resolveStorageConfigPath(options);
  if (!existsSync(configPath)) {
    if (explicit) throw new Error(`Configured BUCK_WORKFLOW_CONFIG file does not exist: ${configPath}`);
    return { adapter: "repo-files", configPath };
  }

  const parsed = parseStorageYaml(readFileSync(configPath, "utf8"), configPath);
  const matched = findMatchingProject(parsed.projects, options.origin);
  if (matched?.integrationRef) {
    throw new Error(`Configured integration_ref (${matched.integrationRef}) is outside the initial \`/b-loop\` repair scope.`);
  }

  const adapter = matched?.adapter ?? parsed.defaultAdapter;
  if (adapter !== "repo-files") {
    throw new Error(`Unsupported storage adapter "${adapter}": \`/b-loop\` currently supports only "repo-files" without integration_ref.`);
  }
  return { adapter: "repo-files", configPath };
}

interface RawWorkflowItem {
  token: string;
  revision: string;
  sha256: string;
  logicalName: string;
  kind: string;
  text: string;
}

function normalizeArtifactItem(raw: unknown): RawWorkflowItem {
  if (!raw || typeof raw !== "object") {
    throw new Error("Malformed artifact record returned by workflow_state.");
  }
  const r = raw as Record<string, unknown>;
  if (typeof r.logicalName !== "string" || typeof r.revision !== "string" || typeof r.token !== "string") {
    throw new Error("Malformed artifact record returned by workflow_state: missing token, revision, or logicalName.");
  }
  const text = typeof r.text === "string"
    ? r.text
    : typeof r.bytesBase64 === "string"
      ? Buffer.from(r.bytesBase64, "base64").toString("utf8")
      : "";
  return {
    token: r.token,
    revision: r.revision,
    sha256: typeof r.sha256 === "string" ? r.sha256 : "",
    logicalName: r.logicalName,
    kind: typeof r.kind === "string" ? r.kind : "",
    text,
  };
}

function parsePhaseItem(item: RawWorkflowItem): PinnedPhase {
  const fm = parseFrontmatter(item.text);
  const nameMatch = /^phase-(\d+)/.exec(item.logicalName);
  const fileNum = nameMatch ? Number.parseInt(nameMatch[1], 10) : 0;
  const phaseNum = typeof fm.phase === "number" ? fm.phase : fileNum;
  const order = typeof fm.order === "number" ? fm.order : phaseNum;
  const diffRaw = fm.difficulty;
  const difficulty: PhaseDifficulty = diffRaw === "easy" || diffRaw === "hard" ? diffRaw : "medium";
  const hintRaw = fm.buck_hint;
  const buckHint: BuckBuildHint = hintRaw === "/b-build-hard" || difficulty === "hard" ? "/b-build-hard" : "/b-build";
  const criteria = countAcceptanceCriteria(fm.acceptance_criteria);
  const files = Array.isArray(fm.files) ? fm.files.filter((x): x is string => typeof x === "string") : [];

  return {
    phaseNum,
    order,
    logicalName: item.logicalName,
    slug: item.logicalName.replace(/\.md$/, ""),
    token: item.token,
    revision: item.revision,
    sha256: item.sha256,
    status: typeof fm.status === "string" ? fm.status : "pending",
    difficulty,
    buckHint,
    files,
    acceptanceCriteria: criteria.items,
  };
}

function sortAndValidatePhases(phaseItems: RawWorkflowItem[]): PinnedPhase[] {
  if (phaseItems.length === 0) {
    throw new Error("Unphased plans are outside `/b-loop` scope: discrete `phase-*.md` artifacts are required.");
  }
  const parsed = phaseItems.map(parsePhaseItem).sort((a, b) => a.order - b.order || a.phaseNum - b.phaseNum);
  const seenOrders = new Set<number>();
  for (const phase of parsed) {
    if (seenOrders.has(phase.order)) {
      throw new Error(`Duplicate phase order ${phase.order} detected in plan (${phase.logicalName}).`);
    }
    seenOrders.add(phase.order);
  }
  return parsed;
}

/** Resolve named subject plan and discrete phase artifacts via `workflow_state` and pin order/inputs. */
export async function resolveAndPinPlan(
  workflowState: WorkflowStateTool,
  subjectId: string,
  branch: BranchValidationResult,
): Promise<PinnedPlan> {
  const listedRaw = unwrapToolResult(await workflowState({ operation: "list", subjectId }));
  if (!Array.isArray(listedRaw) || listedRaw.length === 0) {
    throw new Error(`No workflow artifacts found for subject "${subjectId}" via workflow_state.`);
  }

  const items = listedRaw.map(normalizeArtifactItem);
  const isPlanItem = (i: RawWorkflowItem): boolean =>
    (!i.kind || i.kind === "plan") && /^plan-[^/\\]*\.md$/.test(i.logicalName);
  const primaryPlan = items.find((i) => isPlanItem(i) && !i.logicalName.endsWith("-phases.md"));
  const overview = items.find((i) => isPlanItem(i) && i.logicalName.endsWith("-phases.md"));
  const targetPlan = primaryPlan ?? overview;
  if (!targetPlan) {
    throw new Error(`Subject "${subjectId}" has no plan artifact in workflow_state.`);
  }

  const phaseItems = items.filter(
    (i) => (!i.kind || i.kind === "phase") && /^phase-\d+[^/\\]*\.md$/.test(i.logicalName),
  );
  const phases = sortAndValidatePhases(phaseItems);

  return {
    subjectId,
    branchRef: branch.branchRef,
    branchName: branch.branchName,
    headCommit: branch.headCommit,
    adapter: "repo-files",
    planLogicalName: targetPlan.logicalName,
    planRevision: targetPlan.revision,
    planSha256: targetPlan.sha256,
    ...(overview ? { overviewLogicalName: overview.logicalName } : {}),
    phases,
  };
}
