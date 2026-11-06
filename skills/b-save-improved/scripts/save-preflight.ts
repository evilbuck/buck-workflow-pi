#!/usr/bin/env bun
import { execFileSync } from "node:child_process";
import { accessSync, constants, existsSync, readFileSync, readdirSync, statSync, type Dirent } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import {
  parseBacklogTodo,
  parsePhaseSummaryTable,
  parseSimpleYaml,
  phaseCriteriaAllChecked,
  planMemoryRefStyle,
  readFrontmatter,
  userGoalState,
  type PhaseRow,
} from "../../_shared/scripts/context-helpers.js";
import { inspectSubjectLifecycleTexts } from "../../_shared/scripts/subject-lifecycle.js";
import { withConfiguredStore, type TrustedWorkflowContext } from "../../_shared/scripts/workflow-state.js";
import { classifyContextPath } from "../../_shared/storage/consumers.js";
import type { ArtifactKind, ArtifactRevision, StorageStore } from "../../_shared/storage/contract.js";
import { RepoFilesStorageStore } from "../../_shared/storage/file-store.js";
import { revisionHash } from "../../_shared/storage/adapter-utils.js";

const CONTEXT = ".context";
const LOOSE_ARTIFACT_NAME = /^(?:(?:plan|spec|research|iterate|brainstorm|phase)-.+\.md|draft-commit\.md)$/;

const STALE_REASON = "no writer since the 2026-06-05 extension slim-down";

/**
 * The configured store is authoritative for subject discovery, artifact contents
 * and revisions. Local `.context` files are at most the repo-files editable
 * projection: they are imported only for the repo-files adapter and only where
 * the canonical key is missing, and a storage outage never falls back to disk.
 */
const SUBJECT_ARTIFACT_KIND: Partial<Record<ArtifactKind, true>> = {
  "subject-index": true, plan: true, research: true, phase: true, spec: true,
  iterate: true, brainstorm: true, review: true, capture: true, grill: true,
};
/** Attempt evidence never enters a preflight snapshot. */
const PRIVATE_EVIDENCE_KIND: Partial<Record<ArtifactKind, true>> = {
  receipt: true, "run-state": true, checkpoint: true, activity: true, attribution: true,
};
/** Non-subject scopes share the `subjectId` slot but are addressed by their own prefix. */
const RESERVED_SUBJECT_IDS: Readonly<Record<string, true>> = {
  memory: true, backlog: true, "save-apply": true, workflow: true,
  "workflow-evidence": true, "buck-loop": true, "legacy-memory": true,
};

interface MemoryBackend {
  source: string;
  backend: string | null;
  expect_retain: boolean;
}

export interface SaveSource {
  kind: ArtifactKind;
  subjectId: string;
  logicalName: string;
  revision: string | null;
  sha256: string | null;
  text: string;
  origin: "stored" | "repo-projection";
}

/** The one shape `readSaveSources` hands back to both save entry points. */
export interface SaveSources {
  artifacts: Map<string, ArtifactRevision>;
  repoProjection: boolean;
}

export interface DeletedSource {
  path: string;
  kind: ArtifactKind;
  subject_id: string;
  logical_name: string;
  revision: string;
  sha256: string;
}

interface SnapshotEntry {
  revision: string | null;
  sha256: string | null;
  text: string;
  kind: ArtifactKind | null;
  subject_id: string | null;
  logical_name: string | null;
  origin: SaveSource["origin"] | null;
}

type Snapshot = Map<string, SnapshotEntry>;
type SubjectStatus = "draft" | "active" | "completed" | null;
type SourcePath = Pick<SaveSource, "kind" | "subjectId" | "logicalName">;

function emit(payload: unknown, code: number): never {
  console.log(JSON.stringify(payload));
  process.exit(code);
}

function git(args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function stringValue(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function toArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(stringValue).filter((item): item is string => item !== null);
  const scalar = stringValue(value);
  return scalar ? [scalar] : [];
}

function localDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function slugFromBranch(branch: string): string {
  const segment = branch.split("/").at(-1) || "session";
  return segment.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "session";
}

function normalizeSubjectName(name: string, today: string): string {
  const trimmed = name.trim();
  if (/^\d{4}-\d{2}-\d{2}\./.test(trimmed)) return trimmed;
  const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "session";
  return `${today}.${slug}`;
}

function parseArgs(argv: string[]): { subject: string | null } {
  let subject: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--json") continue;
    if (argv[i] === "--subject") {
      if (!argv[i + 1]) emit({ error: "--subject requires a folder name" }, 1);
      subject = argv[++i];
    }
  }
  return { subject };
}

function memoryIndexShape(contents: string): "two-line" | "single-line" | "empty" {
  const lines = contents.split(LINE_BREAK).filter((line) => line.trim() !== "");
  if (/^- \d{4}-\d{2}-\d{2} — \[/.test(lines[0] ?? "") && /^  - /.test(lines[1] ?? "")) return "two-line";
  if (/^- \d{4}-\d{2}-\d{2} \| /.test(lines[0] ?? "")) return "single-line";
  return "empty";
}

// Built through `RegExp` so the `#`-then-quantifier group survives tooling that
// mis-lexes `#*` inside a regex literal; the pattern is unchanged.
const MEMORY_HEADER_LINE = new RegExp("^memory:\\s*(?:#.*)?$");
const TOP_LEVEL_LINE = /^\S/;
// `'` is written as `\x27` so the apostrophe never appears literally in the
// pattern; the matched character set is unchanged.
const BACKEND_VALUE = /^\s+backend:\s*["\x27]?([^\s#"\x27]+)/;
const SUPPORTED_BACKENDS: readonly string[] = ["hindsight", "mnemopi", "local"];
const RETAIN_BACKENDS: readonly string[] = ["hindsight", "mnemopi"];

// Patterns are named so tooling that mis-lexes a regex literal sitting in sole
// call-argument position still attributes the enclosing function honestly.
const LINE_BREAK = /\r?\n/;
const MEMORY_REFS_LINE = /^\*\*memory:\*\*/i;
const MEMORY_REF_LINK = /\[[^\]]*\]\(([^)]+)\)/g;
const GIT_STATUS_LINE = /^\s?([MADRCU?!])\s+(.+)$/;
const DATE_PREFIX = /^\d{4}-\d{2}-\d{2}\./;

function isMemoryHeaderLine(line: string): boolean {
  return MEMORY_HEADER_LINE.test(line);
}

function isTopLevelLine(line: string): boolean {
  return TOP_LEVEL_LINE.test(line) && line.trim() !== "";
}

function backendValueOf(line: string): string | null {
  return BACKEND_VALUE.exec(line)?.[1] ?? null;
}

function supportedBackend(backend: string | null): backend is string {
  return backend !== null && SUPPORTED_BACKENDS.includes(backend);
}

/** First `backend:` value under the `memory:` YAML key, ignoring commented keys. */
function configuredBackend(lines: string[]): string | null {
  const start = lines.findIndex(isMemoryHeaderLine);
  if (start < 0) return null;
  for (let index = start + 1; index < lines.length; index++) {
    if (isTopLevelLine(lines[index])) break;
    const value = backendValueOf(lines[index]);
    if (value !== null) return value;
  }
  return null;
}

function memoryBackend(): MemoryBackend {
  const source = join(process.env.HOME || homedir(), ".omp/agent/config.yml");
  if (!existsSync(source)) return { source, backend: null, expect_retain: false };
  const backend = configuredBackend(readFileSync(source, "utf8").split(LINE_BREAK));
  if (!supportedBackend(backend)) return { source, backend: null, expect_retain: false };
  return { source, backend, expect_retain: RETAIN_BACKENDS.includes(backend) };
}

function uncheckedCriteria(data: Record<string, unknown>): string[] {
  return toArray(data.acceptance_criteria).filter((criterion) => !/^\[x\]/i.test(criterion.trim()));
}

function markdownMemoryRefs(contents: string): string[] {
  const line = contents.split(LINE_BREAK).find((candidate) => MEMORY_REFS_LINE.test(candidate.trim()));
  return line ? [...line.matchAll(MEMORY_REF_LINK)].map((match) => match[1]) : [];
}

const WORKFLOW_HINT_NAME = "current-session.json";

/**
 * Loose context-root documents and the legacy session hint share the audit
 * scope; every other reserved subject id has no Markdown projection.
 */
function auditContextPath(source: SourcePath): string | null {
  if (source.subjectId === "save-apply") {
    return !source.logicalName.includes("/") && source.logicalName.endsWith(".md")
      ? `${CONTEXT}/${source.logicalName}` : null;
  }
  if (source.subjectId === "workflow") {
    return source.logicalName === WORKFLOW_HINT_NAME ? `${CONTEXT}/workflow/${source.logicalName}` : null;
  }
  if (RESERVED_SUBJECT_IDS[source.subjectId] || source.logicalName === "index.md") return null;
  return `${CONTEXT}/${source.subjectId}/${source.logicalName}`;
}

/**
 * Logical `.context` address for save metadata, not a filesystem export.
 * Reserved prefixes belong only to their matching subject ids; subject-scoped
 * memory facts must never become narrative subject metadata.
 */
export function contextPathOf(source: SourcePath): string | null {
  if (source.kind === "memory") {
    return source.subjectId === "memory" ? `${CONTEXT}/memory/${source.logicalName}` : null;
  }
  if (source.kind === "backlog") {
    return source.subjectId === "backlog" ? `${CONTEXT}/backlog/${source.logicalName}` : null;
  }
  if (source.kind === "audit") return auditContextPath(source);
  if (!SUBJECT_ARTIFACT_KIND[source.kind] || RESERVED_SUBJECT_IDS[source.subjectId]) return null;
  return `${CONTEXT}/${source.subjectId}/${source.logicalName}`;
}

/** Snapshot reads are explicit about absence so a caller never resurrects a stale local file. */
function readSnapshot(snapshot: Snapshot, path: string): string {
  return snapshot.get(path)?.text ?? "";
}

/**
 * Presence means an authoritative or projected source backs the path. The CAS
 * anchor is the entry's `revision`, which is null for a projection-only key.
 */
function hasSnapshot(snapshot: Snapshot, path: string): boolean {
  return snapshot.get(path)?.origin !== null && snapshot.get(path) !== undefined;
}

function absentEntry(): SnapshotEntry {
  return { revision: null, sha256: null, text: "", kind: null, subject_id: null, logical_name: null, origin: null };
}

function snapshotEntry(source: SaveSource): SnapshotEntry {
  return {
    revision: source.revision,
    sha256: source.sha256,
    text: source.text,
    kind: source.kind,
    subject_id: source.subjectId,
    logical_name: source.logicalName,
    origin: source.origin,
  };
}

function decodeRevision(item: ArtifactRevision): string | null {
  try { return new TextDecoder("utf-8", { fatal: true }).decode(item.bytes); }
  catch { return null; }
}

/**
 * A repo-files projection has no stored revision; `revision: null` is the signal
 * that the canonical key is absent and a write must expect `null`, not a revision.
 */
function toSaveSource(artifact: ArtifactRevision): SaveSource {
  return {
    kind: artifact.key.kind,
    subjectId: artifact.key.subjectId,
    logicalName: artifact.key.logicalName,
    revision: artifact.revision === "" ? null : artifact.revision,
    sha256: artifact.revision === "" ? null : artifact.sha256,
    text: decodeRevision(artifact) ?? "",
    origin: artifact.revision === "" ? "repo-projection" : "stored",
  };
}

function contextRelativeFiles(root: string): string[] {
  const found: string[] = [];
  const walk = (directory: string, relative: string): void => {
    let entries: Dirent[];
    try { entries = readdirSync(directory, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const next = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(join(directory, entry.name), next);
      else if (entry.isFile() && (entry.name.endsWith(".md") || next === "workflow/current-session.json")) found.push(next);
    }
  };
  walk(root, "");
  return found.sort();
}

/**
 * Repo-files keeps editable bodies in `.context`; a first projection of an
 * unimported file must still be readable, so surface it for this adapter only.
 * `expectedRevision: null` states the canonical key is genuinely absent.
 * Every other adapter answers from stored revisions or not at all.
 */
function projectRepoFiles(cwd: string, context: TrustedWorkflowContext, canonical: ReadonlyMap<string, ArtifactRevision>): ArtifactRevision[] {
  const projected: ArtifactRevision[] = [];
  const seen = new Set(canonical.keys());
  for (const relative of contextRelativeFiles(join(cwd, CONTEXT))) {
    const classified = classifyContextPath(`${CONTEXT}/${relative}`);
    if (contextPathOf(classified) === null) continue;
    const identity = `${classified.kind}\0${classified.subjectId}\0${classified.logicalName}`;
    if (seen.has(identity)) continue;
    let body: string;
    try { body = readFileSync(join(cwd, CONTEXT, relative), "utf8"); }
    catch { continue; }
    seen.add(identity);
    const bytes = new TextEncoder().encode(body);
    projected.push({
      key: {
        projectId: context.projectId,
        branchId: context.branchId,
        ...classified,
      },
      revision: "",
      bytes,
      sha256: revisionHash(bytes),
      author: "repo-projection",
      source: "repo-projection",
      createdAt: new Date(0).toISOString(),
      links: [],
      expectedRevision: null,
    });
  }
  return projected;
}

/**
 * The one read seam both save entry points use: every save-relevant artifact for
 * the bound scope, keyed by canonical `kind\0subjectId\0logicalName`.
 *
 * Repo-files additionally projects its editable `.context` bodies for keys the
 * store has never seen; those carry `expectedRevision: null` and empty links so
 * a caller can create them and every other adapter stays strictly store-backed.
 */
export async function readSaveSources(store: StorageStore, context: TrustedWorkflowContext, cwd: string): Promise<SaveSources> {
  const visible = await store.list({
    projectId: context.projectId,
    branchId: context.branchId,
    publishedRevisionIds: context.publishedRevisionIds,
    // Private retains land in the bound workspace run, so the run scope is part
    // of this read or canonical root audit and nested audit rows stay invisible.
    ...(context.worktreeId && context.runId ? { worktreeId: context.worktreeId, runId: context.runId } : {}),
  });
  const artifacts = new Map<string, ArtifactRevision>();
  for (const item of visible) {
    if (PRIVATE_EVIDENCE_KIND[item.key.kind]) continue;
    artifacts.set(`${item.key.kind}\0${item.key.subjectId}\0${item.key.logicalName}`, item);
  }
  // The editable projection exists only for repo-files; other adapters never read
  // `.context` and never infer a deletion from a missing export.
  const repoProjection = store instanceof RepoFilesStorageStore;
  if (repoProjection) {
    for (const projected of projectRepoFiles(cwd, context, artifacts)) {
      artifacts.set(`${projected.key.kind}\0${projected.key.subjectId}\0${projected.key.logicalName}`, projected);
    }
  }
  return { artifacts, repoProjection };
}

function loadSaveSources(cwd: string): Promise<SaveSources> {
  return withConfiguredStore(cwd, (store, context) => readSaveSources(store, context, cwd));
}

/**
 * A deletion is only ever an explicit Git-tracked removal of a `.context` export
 * that has a captured canonical revision. Absence alone never means deleted.
 */
function deletedContextSources(statusPorcelain: string, artifacts: ReadonlyMap<string, ArtifactRevision>, subjectId: string): DeletedSource[] {
  const deleted: DeletedSource[] = [];
  for (const line of statusPorcelain.split(LINE_BREAK)) {
    // Git trims the first line, which can drop the index column, so match the
    // status column by shape instead of a fixed offset.
    const status = GIT_STATUS_LINE.exec(line);
    if (status === null) continue;
    const [, code, path] = status;
    if (!code.includes("D")) continue;
    if (!path.startsWith(`${CONTEXT}/`)) continue;
    const classified = classifyContextPath(path);
    // Deletions a save may act on are scoped to the active subject plus the
    // backlog and memory a checkpoint rewrites; nothing else crosses scope.
    if (classified.kind !== "memory" && classified.kind !== "backlog" && classified.subjectId !== subjectId) continue;
    const artifact = artifacts.get(`${classified.kind}\0${classified.subjectId}\0${classified.logicalName}`);
    // A deletion needs a captured canonical revision; a projection has none.
    if (artifact === undefined || artifact.revision === "") continue;
    deleted.push({
      path,
      kind: artifact.key.kind,
      subject_id: artifact.key.subjectId,
      logical_name: artifact.key.logicalName,
      revision: artifact.revision,
      sha256: artifact.sha256,
    });
  }
  return deleted.sort((left, right) => left.path.localeCompare(right.path));
}

/** Lifecycle status comes from the stored index plus stored plan/phase evidence. */
function storedStatus(items: readonly SaveSource[]): SubjectStatus {
  const files = new Map<string, string>();
  let index = "";
  for (const item of items) {
    const name = basename(item.logicalName);
    if (name !== "index.md" && !/^plan-.*\.md$/.test(name) && !/^phase-\d+-.+\.md$/.test(name)) continue;
    files.set(name, item.text);
    if (name === "index.md") index = item.text;
  }
  const inspection = inspectSubjectLifecycleTexts(index, files);
  if (inspection.provenance === "malformed") return null;
  return inspection.effectiveState === "missing" ? null : inspection.effectiveState;
}

interface SubjectInventory {
  snapshot: Snapshot;
  items: Map<string, SaveSource[]>;
  statuses: Map<string, SubjectStatus>;
}

interface SubjectSelection {
  name: string;
  status: SubjectStatus;
  created: boolean;
}

interface Candidate {
  name: string;
  status: SubjectStatus;
}

interface PlanSummary {
  path: string;
  memory_ref_style: "yaml" | "bold-line" | "none";
  memory_refs: string[];
  spec: string | null;
}

interface UserGoal {
  missing: string[];
  waived: string[];
  present: string[];
}

interface PhaseFile {
  path: string;
  status: string | null;
  completed_at: string | null;
  criteria_all_checked: boolean;
  criteria_unchecked: string[];
}

/** The bound scope's canonical read must succeed; an outage is never an empty subject set. */
async function loadSourcesOrExit(): Promise<SaveSources> {
  try {
    return await loadSaveSources(process.cwd());
  } catch (error) {
    emit({ error: `storage unavailable: ${error instanceof Error ? error.message : String(error)}` }, 1);
  }
}

/** Only repo-files reads `.context`, so only it can find that directory unreadable. */
function assertContextReadable(repoProjection: boolean): void {
  if (!repoProjection || !existsSync(CONTEXT)) return;
  try {
    if (!statSync(CONTEXT).isDirectory()) throw new Error("not a directory");
    accessSync(CONTEXT, constants.R_OK);
  } catch {
    emit({ error: ".context directory is unreadable" }, 1);
  }
}

function currentBranch(): string {
  try {
    if (git(["rev-parse", "--is-inside-work-tree"]) !== "true") emit({ error: "not a git repository" }, 1);
    return git(["symbolic-ref", "--short", "HEAD"]);
  } catch {
    emit({ error: "not a git repository" }, 1);
  }
}

/**
 * Every save-relevant artifact becomes a snapshot entry at its `.context` path;
 * subject-scoped artifacts are additionally grouped by subject for lifecycle
 * status and candidate selection.
 */
function buildInventory(artifacts: ReadonlyMap<string, ArtifactRevision>): SubjectInventory {
  const snapshot: Snapshot = new Map();
  const items = new Map<string, SaveSource[]>();
  for (const artifact of artifacts.values()) {
    const path = contextPathOf(artifact.key);
    if (path === null) continue;
    const source = toSaveSource(artifact);
    snapshot.set(path, snapshotEntry(source));
    if (SUBJECT_ARTIFACT_KIND[source.kind] && !RESERVED_SUBJECT_IDS[source.subjectId]) {
      const group = items.get(source.subjectId) ?? [];
      group.push(source);
      items.set(source.subjectId, group);
    }
  }
  const statuses = new Map<string, SubjectStatus>();
  for (const [subjectId, group] of items) statuses.set(subjectId, storedStatus(group));
  return { snapshot, items, statuses };
}

function eligibleCandidates(candidates: readonly Candidate[]): Candidate[] {
  const active = candidates.filter((candidate) => candidate.status === "active");
  return active.length ? active : candidates.filter((candidate) => candidate.status === "draft");
}

function subjectCandidates(inventory: SubjectInventory): Candidate[] {
  return [...inventory.items.keys()]
    .map((name) => ({ name, status: inventory.statuses.get(name) ?? null }))
    .sort((a, b) => b.name.localeCompare(a.name));
}

/**
 * An explicit `--subject` always wins, normalizing a requested folder that the
 * store has never seen. Without one, a single active (then draft) candidate is
 * the subject; anything genuinely ambiguous stops the preflight.
 */
function selectSubject(args: { subject: string | null }, today: string, branch: string, inventory: SubjectInventory, candidates: Candidate[]): SubjectSelection {
  if (args.subject) {
    if (!inventory.items.has(args.subject)) {
      return { name: normalizeSubjectName(args.subject, today), status: null, created: true };
    }
    return { name: args.subject, status: inventory.statuses.get(args.subject) ?? null, created: false };
  }

  const eligible = eligibleCandidates(candidates);
  if (eligible.length > 1) {
    emit({
      error: "ambiguous subject",
      subject_candidates: candidates,
      suggested_subject: `${today}.${slugFromBranch(branch)}`,
    }, 2);
  }
  if (eligible.length === 1) return { name: eligible[0].name, status: eligible[0].status, created: false };
  return { name: `${today}.${slugFromBranch(branch)}`, status: null, created: true };
}

interface Paths {
  subject: string;
  hint: string;
  memoryIndex: string;
  existingMemory: string;
  todo: string;
  itemsDir: string;
  archiveDir: string;
  completedLog: string;
}

function resolvePaths(selectedName: string, today: string): Paths {
  const subjectSlug = selectedName.replace(DATE_PREFIX, "");
  const archiveDir = `${CONTEXT}/backlog/archive`;
  return {
    subject: `${CONTEXT}/${selectedName}`,
    hint: `${CONTEXT}/workflow/${WORKFLOW_HINT_NAME}`,
    memoryIndex: `${CONTEXT}/memory/index.md`,
    existingMemory: `${CONTEXT}/memory/${subjectSlug}-${today}.md`,
    todo: `${CONTEXT}/backlog/todo.md`,
    itemsDir: `${CONTEXT}/backlog/items`,
    archiveDir,
    completedLog: `${archiveDir}/completed.md`,
  };
}

/**
 * The session hint is reported, never trusted: `used` stays false and any
 * present hint carries the stale reason, since no writer has run since the
 * extension slim-down.
 */
function buildSessionHint(snapshot: Snapshot, paths: Paths): Record<string, unknown> {
  const present = hasSnapshot(snapshot, paths.hint);
  let data: Record<string, unknown> = {};
  if (present) {
    try { data = JSON.parse(readSnapshot(snapshot, paths.hint)) as Record<string, unknown>; } catch { data = {}; }
  }
  return {
    path: paths.hint,
    present,
    started_at: stringValue(data.started_at),
    subject: stringValue(data.subject),
    memory_file: stringValue(data.memory_file),
    used: false,
    stale_reasons: present ? [STALE_REASON] : [],
  };
}

/** An open backlog item is snapshotted explicitly so a caller cannot resurrect a stale file. */
function openBacklogItems(snapshot: Snapshot, todoPath: string): Record<string, unknown>[] {
  return parseBacklogTodo(readSnapshot(snapshot, todoPath)).sections
    .flatMap((section) => section.items)
    .filter((item) => !item.checked)
    .map((item) => {
      const itemPath = `${CONTEXT}/backlog/${item.link}`;
      if (!hasSnapshot(snapshot, itemPath)) snapshot.set(itemPath, absentEntry());
      const data = readFrontmatter(readSnapshot(snapshot, itemPath)).data;
      return {
        slug: item.slug,
        label: item.label,
        link: item.link,
        related: toArray(data.related),
        status: stringValue(data.status),
      };
    });
}

function buildSpecs(subjectFiles: string[], subjectFile: (name: string) => string): Record<string, unknown>[] {
  return subjectFiles.filter((name) => /^spec-.*\.md$/.test(name)).map((name) => {
    const parsed = readFrontmatter(subjectFile(name));
    return { path: name, status: stringValue(parsed.data.status), acceptance_present: toArray(parsed.data.acceptance_criteria).length > 0 };
  });
}

function phaseDrift(rows: PhaseRow[], phaseFiles: PhaseFile[]): Record<string, unknown>[] {
  return rows.flatMap((row) => {
    const file = phaseFiles.find((candidate) => candidate.path === row.file);
    return file && file.status !== row.status ? [{ file: row.file, table_says: row.status, file_says: file.status }] : [];
  });
}

/**
 * Phase progress is reported from the stored phase files; the overview table
 * only contributes its rows, so a stale table surfaces as drift rather than as
 * the authority on whether a phase is done.
 */
function buildPhases(subjectFiles: string[], subjectFile: (name: string) => string, subjectPath: string): Record<string, unknown> {
  const overviewName = subjectFiles.find((name) => /^plan-.*-phases\.md$/.test(name)) ?? null;
  const rows = overviewName ? parsePhaseSummaryTable(subjectFile(overviewName)) : [];
  const files = subjectFiles.filter((name) => /^phase-.*\.md$/.test(name)).map((name) => {
    const data = readFrontmatter(subjectFile(name)).data;
    return {
      path: name,
      status: stringValue(data.status),
      completed_at: stringValue(data.completed_at),
      criteria_all_checked: phaseCriteriaAllChecked(data),
      criteria_unchecked: uncheckedCriteria(data),
    };
  });
  const autoCompletable = files.filter((file) => file.criteria_all_checked && file.status !== "completed").map((file) => file.path);
  const needsAdjudication = files.filter((file) => !file.criteria_all_checked && !["completed", "pending", "draft"].includes(file.status ?? "")).map((file) => file.path);
  return {
    overview: overviewName ? `${subjectPath}/${overviewName}` : null,
    rows,
    files,
    auto_completable: autoCompletable,
    needs_adjudication: needsAdjudication,
    table_drift: phaseDrift(rows, files),
  };
}

/** Memory refs are read the way the plan writes them; the style decides the source. */
function planMemoryRefs(contents: string, style: "yaml" | "bold-line" | "none", parsed: Record<string, unknown>): string[] {
  if (style === "yaml") return toArray(parsed.memory);
  return style === "bold-line" ? markdownMemoryRefs(contents) : [];
}

function buildPlans(subjectFiles: string[], subjectFile: (name: string) => string): PlanSummary[] {
  return subjectFiles.filter((name) => /^plan-.*\.md$/.test(name) && !/-phases\.md$/.test(name)).map((name) => {
    const contents = subjectFile(name);
    const parsed = readFrontmatter(contents);
    const memory_ref_style = planMemoryRefStyle(contents);
    return {
      path: name,
      memory_ref_style,
      memory_refs: planMemoryRefs(contents, memory_ref_style, parsed.data),
      spec: stringValue(parsed.data.spec),
    };
  });
}

/** An iterate links to its plan by exact path first, then by basename. */
function addressedPlan(plans: PlanSummary[], addresses: string | null): PlanSummary | null {
  if (addresses === null) return null;
  return plans.find((candidate) => candidate.path === addresses)
    ?? plans.find((candidate) => basename(candidate.path) === basename(addresses))
    ?? null;
}

function buildIterates(subjectFiles: string[], subjectFile: (name: string) => string, plans: PlanSummary[]): Record<string, unknown>[] {
  return subjectFiles.filter((name) => /^iterate-.*\.md$/.test(name)).map((name) => {
    const parsed = readFrontmatter(subjectFile(name));
    const addresses = stringValue(parsed.data.addresses);
    const plan = addressedPlan(plans, addresses);
    const planData = plan ? readFrontmatter(subjectFile(plan.path)).data : {};
    return { path: name, status: stringValue(parsed.data.status), addresses, plan_has_iterations_ref: toArray(planData.iterations).includes(name) };
  });
}

function buildUserGoal(subjectFiles: string[], subjectFile: (name: string) => string): UserGoal {
  const userGoal: UserGoal = { missing: [], waived: [], present: [] };
  for (const name of subjectFiles.filter((candidate) => /^(?:plan|brainstorm)-.*\.md$/.test(candidate))) {
    userGoal[userGoalState(subjectFile(name))].push(name);
  }
  return userGoal;
}

/** Loose artifacts are the context-root documents, never a nested knowledge path. */
function looseArtifacts(snapshot: Snapshot): string[] {
  return [...snapshot.keys()]
    .filter((path) => LOOSE_ARTIFACT_NAME.test(basename(path)) && path.slice(CONTEXT.length + 1).indexOf("/") === -1)
    .sort();
}

/** Explicit absence prevents a caller from resurrecting a stale local file. */
function markAbsent(snapshot: Snapshot, paths: readonly string[]): void {
  for (const path of paths) {
    if (!hasSnapshot(snapshot, path)) snapshot.set(path, absentEntry());
  }
}

/**
 * Subject-root Markdown only. Nested knowledge keeps its subject-relative path,
 * and the root-prefix selectors below then exclude it unless it really is a
 * subject-root document.
 */
function subjectFileNames(inventory: SubjectInventory, selectedName: string): string[] {
  return (inventory.items.get(selectedName) ?? [])
    .filter((item) => item.logicalName.endsWith(".md"))
    .map((item) => item.logicalName)
    .sort();
}

/**
 * The preflight report. Everything is derived from the store's canonical read
 * plus, for repo-files only, the `.context` projection the snapshot carries.
 */
async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const branch = currentBranch();
  const today = localDate();
  const loaded = await loadSourcesOrExit();
  assertContextReadable(loaded.repoProjection);

  const inventory = buildInventory(loaded.artifacts);
  const candidates = subjectCandidates(inventory);
  const selection = selectSubject(args, today, branch, inventory, candidates);
  if (loaded.artifacts.size === 0 && !existsSync(CONTEXT)) emit({ error: "no stored or projected context" }, 3);

  const snapshot = inventory.snapshot;
  const paths = resolvePaths(selection.name, today);
  const subjectFiles = subjectFileNames(inventory, selection.name);
  const subjectFile = (name: string): string => readSnapshot(snapshot, `${paths.subject}/${name}`);
  markAbsent(snapshot, [`${paths.subject}/index.md`]);

  const sessionHint = buildSessionHint(snapshot, paths);
  const openItems = openBacklogItems(snapshot, paths.todo);
  const plans = buildPlans(subjectFiles, subjectFile);
  const loose = looseArtifacts(snapshot);
  markAbsent(snapshot, [paths.existingMemory, paths.memoryIndex, paths.todo, paths.completedLog, paths.hint]);

  const statusPorcelain = git(["status", "--porcelain"]);
  const output = {
    code: 0,
    today,
    subject: { name: selection.name, path: paths.subject, status: selection.status, created: selection.created },
    subject_candidates: candidates,
    session_hint: sessionHint,
    loose_artifacts: loose,
    // Only an explicit tracked removal of a `.context` export with a captured
    // canonical revision counts; a missing export is never inferred as a deletion.
    deleted_sources: loaded.repoProjection ? deletedContextSources(statusPorcelain, loaded.artifacts, selection.name) : [],
    existing_memory: { path: paths.existingMemory, present: hasSnapshot(snapshot, paths.existingMemory) },
    memory_index: { path: paths.memoryIndex, first_entry_shape: memoryIndexShape(readSnapshot(snapshot, paths.memoryIndex)) },
    backlog: { todo_path: paths.todo, items_dir: paths.itemsDir, archive_dir: paths.archiveDir, completed_log: paths.completedLog, open_items: openItems },
    specs: buildSpecs(subjectFiles, subjectFile),
    phases: buildPhases(subjectFiles, subjectFile, paths.subject),
    iterates: buildIterates(subjectFiles, subjectFile, plans),
    plans,
    user_goal: buildUserGoal(subjectFiles, subjectFile),
    memory_backend: memoryBackend(),
    git: { status_porcelain: statusPorcelain, diff_stat: git(["diff", "--stat"]), branch },
    storage_snapshot: Object.fromEntries([...snapshot.entries()].sort(([left], [right]) => left.localeCompare(right))),
  };
  console.log(JSON.stringify(output));
}

// Keep the imported parser part of this script's explicit, dependency-free YAML contract.
void parseSimpleYaml;

if (import.meta.main) {
  main().catch((error) => {
    emit({ error: error instanceof Error ? error.message : String(error) }, 1);
  });
}