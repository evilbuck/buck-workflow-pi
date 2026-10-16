/**
 * Save receipts for the Buck-loop supervisor.
 *
 * The supervisor generates the attempt id before `b-save` starts. Fact writes
 * go through `workflow_state`; receipt ids are the revision ids that write
 * returns. There is no follow-up memories SELECT. The database URL is never
 * written to the attempt file or the receipt.
 */
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { SqlMemoryActivitySink } from "../sql-memory/index.js";
import type { ArtifactKind } from "../../skills/_shared/storage/contract.js";
import type { StorageStore } from "../../skills/_shared/storage/contract.js";
import {
  executeWorkflowState,
  resolveTrustedContext,
  type ArtifactRef,
  type TrustedWorkflowContext,
  type WorkflowRequest,
} from "../../skills/_shared/scripts/workflow-state.js";
import { redactRemoteCredentials } from "../token-attribution/git-identity.js";

const ATTEMPT_REL = ".context/workflow/sql-save-attempt.json";
const SECRET_KEY = /password|connection|database_url|sql_memory_url|^url$/i;

export interface SaveAttempt {
  attemptId: string;
  runId: string;
  subject: string;
  project: string;
  phase: string | null;
  receiptRel: string;
}

export interface SaveReceipt {
  attemptId: string;
  runId: string;
  subject: string;
  project: string;
  kind: "rows" | "no-fact";
  ids: string[];
  probed: true;
  completed?: true;
}

export type SaveCheck =
  | { status: "skip" }
  | { status: "verified" }
  | { status: "unverified" }
  | { status: "block"; reason: string };

export interface SaveStoreDeps {
  cwd?: string;
  store?: StorageStore;
  context?: TrustedWorkflowContext;
  identityPath?: string;
  configPath?: string;
  onActivity?: SqlMemoryActivitySink;
}

export type SaveFact = string | { body: string; supersedes?: string };

/** True when the process was given a durable-save target. The URL itself is not persisted or queried. */
export function sqlMode(): boolean {
  return Boolean(process.env.SQL_MEMORY_URL);
}

/** Prepare a new cycle before its saving projection is persisted. */
export function prepareSaveAttempt(cwd: string, subject: string, reuse = false, phase: string | null = null): SaveAttempt | { error: string } {
  if (!safeSubject(subject)) return { error: "SQL save subject path is not a single subject folder." };
  const project = projectOrigin(cwd);
  if (!project) return { error: "Shared SQL memory is configured, but project identity could not be established; no save was started." };
  const previous = readAttempt(cwd);
  if (reuse && previous?.subject === subject && previous.project === project && previous.phase === phase) return previous;
  const attempt = attemptFor(subject, project, phase);
  writeJson(cwd, ATTEMPT_REL, attempt);
  return attempt;
}

/** A receipt is not save-stage proof until all metadata work has succeeded. */
export function completeSaveAttempt(cwd: string, attempt: SaveAttempt): void {
  const receipt = readReceipt(cwd, attempt);
  if (!receipt || receiptShape(receipt, attempt).status !== "verified") throw new Error("SQL save receipt is missing or invalid");
  writeJson(cwd, attempt.receiptRel, { ...receipt, completed: true });
}

/** Child-facing contract. This is not a repair diagnosis. */
export function saveDirective(attempt: SaveAttempt): string {
  return [
    "SQL save attempt.",
    `attemptId: ${attempt.attemptId}`,
    `runId: ${attempt.runId}`,
    `subject: ${attempt.subject}`,
    `project: ${attempt.project}`,
    `phase: ${attempt.phase ?? "null"}`,
    `receipt: ${attempt.receiptRel}`,
    "Connectivity probe succeeded.",
    "Do not write .context/memory files or the memory index.",
    "Do not record the database URL, password, or connection string in any file.",
    "Use workflow_state write for a memory artifact with the exact subject above; use correct with previousId as predecessorRevision. The tool binds project and branch. Do not call sql_memory, construct SQL, or issue a separate read-back SELECT. Write a rows receipt only from revision ids returned by successful writes. Use kind no-fact with ids [] only when this session has no reusable fact.",
    "After all metadata duties succeed, set completed: true on the receipt; persistence alone is not stage completion.",
  ].join("\n");
}

export function writeReceipt(cwd: string, attempt: SaveAttempt, body: Pick<SaveReceipt, "kind" | "ids">): void {
  const receipt: SaveReceipt = {
    attemptId: attempt.attemptId,
    runId: attempt.runId,
    subject: attempt.subject,
    project: attempt.project,
    kind: body.kind,
    ids: body.ids,
    probed: true,
  };
  writeJson(cwd, attempt.receiptRel, receipt);
}

/** Persist reusable facts before applying filesystem metadata. Retries reuse the attempt receipt. */
export async function saveSqlFacts(cwd: string, attempt: SaveAttempt, facts: SaveFact[], deps: SaveStoreDeps = {}, onActivity?: SqlMemoryActivitySink): Promise<string[]> {
  const reused = savedIds(cwd, attempt, facts);
  if (reused) {
    await persistAttemptOnStore(cwd, attempt, deps, reused);
    return reused;
  }
  try {
    const ids = facts.length === 0 ? await saveNoFacts(cwd, attempt, deps) : await saveRows(cwd, attempt, facts, deps);
    note(onActivity ?? deps.onActivity, true, facts.length === 0 ? "Memory wrote · no-fact" : "Memory wrote");
    return ids;
  } catch (error) {
    note(onActivity ?? deps.onActivity, false, "Memory failed");
    throw error;
  }
}

async function saveRows(cwd: string, attempt: SaveAttempt, facts: SaveFact[], deps: SaveStoreDeps): Promise<string[]> {
  const ids: string[] = [];
  for (const [index, fact] of facts.entries()) ids.push(await saveOne(cwd, attempt, deps, fact, index + 1));
  writeReceipt(cwd, attempt, { kind: "rows", ids });
  await persistAttemptOnStore(cwd, attempt, deps, ids);
  return ids;
}

async function persistAttemptOnStore(cwd: string, attempt: SaveAttempt, deps: SaveStoreDeps, ids: string[]): Promise<void> {
  if (deps.store && deps.context) {
    await deps.store.writeReceipt({
      projectId: deps.context.projectId,
      branchId: deps.context.branchId,
      worktreeId: deps.context.worktreeId ?? `worktree:${attempt.runId}`,
      runId: attempt.runId,
      attemptId: attempt.attemptId,
      status: "attempted",
      artifactRevisions: ids,
      kind: ids.length === 0 ? "no-fact" : "rows",
      metadataDuties: ["save-metadata", ids.length === 0 ? "probe" : "readback"],
    });
    return;
  }
  await callStore(cwd, deps, {
    operation: "write-receipt",
    attemptId: attempt.attemptId,
    status: "attempted",
    artifactRevisions: ids,
    kind: ids.length === 0 ? "no-fact" : "rows",
    metadataDuties: ["save-metadata", ids.length === 0 ? "probe" : "readback"],
  });
}

async function saveOne(cwd: string, attempt: SaveAttempt, deps: SaveStoreDeps, fact: SaveFact, seq: number): Promise<string> {
  const body = typeof fact === "string" ? fact : fact.body;
  const supersedes = typeof fact === "string" ? undefined : fact.supersedes;
  return supersedes ? correctFact(cwd, attempt, deps, body, supersedes, seq) : writeFact(cwd, attempt, deps, body, seq);
}

async function writeFact(cwd: string, attempt: SaveAttempt, deps: SaveStoreDeps, body: string, seq: number): Promise<string> {
  const ref: ArtifactRef = { subjectId: attempt.subject, kind: "memory", logicalName: factName(attempt, seq) };
  try {
    const written = await callStore(cwd, deps, {
      operation: "write", ref, body, expectedRevision: null,
      author: git(cwd, "config", "user.email") ?? "workflow-state",
      source: attempt.phase ?? "b-save",
    });
    const revision = revisionOf(written);
    if (!revision) throw new Error("SQL save did not return a memory id");
    return revision;
  } catch (error) {
    if (!/stale revision/i.test(errorMessage(error))) throw error;
    const existing = revisionOf(await callStore(cwd, deps, { operation: "read", ref }));
    if (!existing) throw error;
    return existing;
  }
}

async function correctFact(cwd: string, attempt: SaveAttempt, deps: SaveStoreDeps, body: string, supersedes: string, seq: number): Promise<string> {
  const listed = await callStore(cwd, deps, { operation: "list", kind: "memory" });
  const ref = refOf(Array.isArray(listed) ? listed.find((item) => revisionOf(item) === supersedes) : undefined);
  if (!ref) throw new Error("SQL correction target is not in this project");
  const corrected = await callStore(cwd, deps, {
    operation: "correct", ref, predecessorRevision: supersedes, body, idempotencyKey: `${attempt.runId}:${seq}`,
  });
  const revision = revisionOf(corrected);
  if (!revision) throw new Error("SQL save did not return a memory id");
  return revision;
}

async function saveNoFacts(cwd: string, attempt: SaveAttempt, deps: SaveStoreDeps): Promise<string[]> {
  const probed = await probeStore(cwd, deps);
  if (probed.status !== "verified") throw new Error(probed.status === "block" ? probed.reason : "SQL save requires connectivity");
  writeReceipt(cwd, attempt, { kind: "no-fact", ids: [] });
  await persistAttemptOnStore(cwd, attempt, deps, []);
  return [];
}

export async function probeSql(deps: SaveStoreDeps = {}, onActivity?: SqlMemoryActivitySink): Promise<SaveCheck> {
  const check = await probeStore(deps.cwd ?? process.cwd(), deps);
  if (check.status === "block") note(onActivity ?? deps.onActivity, false, "Memory failed");
  return check;
}

/** Confirm the current attempt's receipt against visible store revisions. */
export async function verifySqlSave(cwd: string, subject: string | null, deps: SaveStoreDeps = {}, requireComplete = true, expectedAttemptId?: string | null, onActivity?: SqlMemoryActivitySink): Promise<SaveCheck> {
  if (!sqlMode()) return { status: "skip" };
  return verifySqlSaveAttempt(cwd, subject, deps, requireComplete, expectedAttemptId, onActivity);
}

async function verifySqlSaveAttempt(cwd: string, subject: string | null, deps: SaveStoreDeps, requireComplete: boolean, expectedAttemptId?: string | null, onActivity?: SqlMemoryActivitySink): Promise<SaveCheck> {
  const preflight = verifyLocalAttempt(cwd, subject, expectedAttemptId);
  if (preflight) return preflight;
  const attempt = readAttempt(cwd)!;
  const projectCheck = verifyAttemptProject(cwd, attempt);
  if (projectCheck.status !== "verified") return projectCheck;
  const receipt = readReceipt(cwd, attempt);
  if (!receipt) return { status: "unverified" };
  const shape = receiptShape(receipt, attempt);
  if (shape.status !== "verified") return shape;
  if (requireComplete && receipt.completed !== true) return { status: "unverified" };
  const check = await confirmReceipt(cwd, receipt, attempt, deps);
  if (check.status === "block") note(onActivity, false, "Memory failed");
  if (check.status !== "verified" || !requireComplete) return check;
  return completeStoreReceipt(cwd, attempt, receipt, deps);
}

function verifyLocalAttempt(cwd: string, subject: string | null, expectedAttemptId?: string | null): SaveCheck | null {
  if (!subject) return { status: "block", reason: "SQL save has no subject; refusing to commit." };
  const projected = projectedAttemptCheck(readAttempt(cwd), subject, expectedAttemptId);
  return projected;
}

function verifyAttemptProject(cwd: string, attempt: SaveAttempt): SaveCheck {
  const current = projectOrigin(cwd);
  return current && current === attempt.project
    ? { status: "verified" }
    : { status: "block", reason: "SQL save receipt project does not match the current Git project." };
}

function projectedAttemptCheck(attempt: SaveAttempt | null, subject: string, expectedId?: string | null): SaveCheck | null {
  if (matchesProjectedAttempt(attempt, subject, expectedId)) return null;
  return expectedId !== undefined
    ? { status: "block", reason: "SQL save attempt does not match the projected transition." }
    : { status: "unverified" };
}

function matchesProjectedAttempt(attempt: SaveAttempt | null, subject: string, expectedId?: string | null): attempt is SaveAttempt {
  return attempt !== null && attempt.subject === subject
    && (expectedId === undefined || attempt.attemptId === expectedId);
}

/** Resume may retry an unverified save. It must not commit one. Outages always block. */
export function resumeSaveDecision(state: string, check: SaveCheck): "continue" | "block" {
  if (check.status === "skip" || check.status === "verified") return "continue";
  if (check.status === "block" || state === "committing") return "block";
  return "continue";
}

function attemptFor(subject: string, project: string, phase: string | null): SaveAttempt {
  const attemptId = randomUUID();
  const runId = randomUUID();
  return {
    attemptId,
    runId,
    subject,
    project,
    phase,
    receiptRel: join(".context", subject, "sql-memory-receipts", `${runId}-${attemptId}.json`),
  };
}

function receiptShape(value: unknown, attempt: SaveAttempt): SaveCheck {
  if (hasSecretKey(value)) return { status: "block", reason: "SQL save receipt recorded a database URL or secret." };
  const receipt = parseReceipt(value);
  if (!receipt || !sameAttempt(receipt, attempt)) return { status: "unverified" };
  if (receipt.kind === "no-fact") {
    return receipt.ids.length === 0
      ? { status: "verified" }
      : { status: "block", reason: "SQL no-fact receipt listed memory ids." };
  }
  return receipt.ids.length > 0 ? { status: "verified" } : { status: "unverified" };
}

async function confirmReceipt(cwd: string, receipt: SaveReceipt, attempt: SaveAttempt, deps: SaveStoreDeps): Promise<SaveCheck> {
  if (receipt.kind === "no-fact") return probeStore(cwd, deps);
  try {
    const listed = await callStore(cwd, deps, { operation: "list", subjectId: attempt.subject, kind: "memory" });
    const visible = listedRevisions(listed);
    const missing = receipt.ids.filter((id) => !visible.has(id));
    if (missing.length > 0) return { status: "block", reason: `SQL save receipt ids were not readable for this project: ${missing.join(", ")}` };
    return { status: "verified" };
  } catch (error) {
    return { status: "block", reason: `SQL save receipt check failed: ${errorMessage(error)}` };
  }
}

async function completeStoreReceipt(cwd: string, attempt: SaveAttempt, receipt: SaveReceipt, deps: SaveStoreDeps): Promise<SaveCheck> {
  try {
    return deps.store && deps.context
      ? await completeInjectedReceipt(attempt, receipt, deps)
      : await completeWorkflowReceipt(cwd, attempt, receipt, deps);
  } catch (error) {
    return { status: "block", reason: `Durable save receipt completion failed: ${errorMessage(error)}` };
  }
}

async function completeInjectedReceipt(attempt: SaveAttempt, receipt: SaveReceipt, deps: SaveStoreDeps & { store: StorageStore; context: TrustedWorkflowContext }): Promise<SaveCheck> {
  const { store, context } = deps;
  const expectedWorktree = context.worktreeId ?? `worktree:${attempt.runId}`;
  let existing = await store.readReceipt(context.projectId, attempt.runId);
  if (!existing) {
    await store.writeReceipt({
      projectId: context.projectId,
      branchId: context.branchId,
      worktreeId: expectedWorktree,
      runId: attempt.runId,
      attemptId: attempt.attemptId,
      status: "attempted",
      artifactRevisions: receipt.ids,
      kind: receipt.kind,
      metadataDuties: requiredReceiptDuties(receipt.kind),
    });
    existing = await store.readReceipt(context.projectId, attempt.runId);
    if (!existing) return { status: "unverified" };
  }
  if (existing.status !== "complete") await persistInjectedCompletion(store, existing, attempt, receipt);
  const stored = await store.readReceipt(context.projectId, attempt.runId);
  return injectedReceiptMatches(stored, context, expectedWorktree, attempt, receipt)
    ? { status: "verified" }
    : { status: "unverified" };
}

async function persistInjectedCompletion(store: StorageStore, existing: RunReceipt, attempt: SaveAttempt, receipt: SaveReceipt): Promise<void> {
  await store.writeReceipt({
    ...existing,
    status: "complete",
    artifactRevisions: receipt.ids,
    kind: receipt.kind,
    metadataDuties: requiredReceiptDuties(receipt.kind),
  });
}

function injectedReceiptMatches(stored: RunReceipt | null, context: TrustedWorkflowContext, worktreeId: string, attempt: SaveAttempt, receipt: SaveReceipt): boolean {
  return stored !== null && stored.branchId === context.branchId && stored.worktreeId === worktreeId &&
    stored.attemptId === attempt.attemptId && stored.kind === receipt.kind &&
    receiptMatches(stored, attempt, receipt.ids, "complete");
}

async function completeWorkflowReceipt(cwd: string, attempt: SaveAttempt, receipt: SaveReceipt, deps: SaveStoreDeps): Promise<SaveCheck> {
  const revisions = receipt.ids;
  const duties = ["save-metadata", receipt.kind === "no-fact" ? "probe" : "readback"];
  const existing = await callStore(cwd, deps, { operation: "read-receipt" });
  if (!receiptMatches(existing, attempt, revisions, "complete")) {
    if (!receiptMatches(existing, attempt, revisions, "attempted")) {
      await callStore(cwd, deps, {
        operation: "write-receipt",
        attemptId: attempt.attemptId,
        status: "attempted",
        artifactRevisions: revisions,
        kind: receipt.kind,
        metadataDuties: duties,
      });
    }
    await callStore(cwd, deps, {
      operation: "write-receipt",
      attemptId: attempt.attemptId,
      status: "complete",
      artifactRevisions: revisions,
      kind: receipt.kind,
      metadataDuties: duties,
    });
  }
  const stored = await callStore(cwd, deps, { operation: "read-receipt" });
  return receiptMatches(stored, attempt, revisions, "complete")
    ? { status: "verified" }
    : { status: "unverified" };
}


function receiptMatches(value: unknown, attempt: SaveAttempt, revisions: readonly string[], status: string): boolean {
  if (!value || typeof value !== "object") return false;
  const receipt = value as Record<string, unknown>;
  return receipt.status === status && receipt.attemptId === attempt.attemptId &&
    hasRevisions(receipt.artifactRevisions, revisions) &&
    (status !== "complete" || hasRequiredDuties(receipt));
}

function hasRevisions(value: unknown, revisions: readonly string[]): boolean {
  return Array.isArray(value) && value.length === revisions.length &&
    value.every((revision, index) => revision === revisions[index]);
}

function hasRequiredDuties(receipt: Record<string, unknown>): boolean {
  const duties = Array.isArray(receipt.metadataDuties) ? receipt.metadataDuties : [];
  return requiredReceiptDuties(receipt.kind === "no-fact" ? "no-fact" : "rows").every((duty) => duties.includes(duty));
}

function requiredReceiptDuties(kind: SaveReceipt["kind"]): string[] {
  return ["save-metadata", kind === "no-fact" ? "probe" : "readback"];
}

async function probeStore(cwd: string, deps: SaveStoreDeps): Promise<SaveCheck> {
  if (!sqlMode()) return { status: "skip" };
  try {
    await callStore(cwd, deps, { operation: "list", limit: 1 });
    return { status: "verified" };
  } catch (error) {
    return { status: "block", reason: `SQL save connectivity probe failed: ${errorMessage(error)}` };
  }
}

async function callStore(cwd: string, deps: SaveStoreDeps, request: WorkflowRequest): Promise<unknown> {
  const context = deps.context ?? await resolveTrustedContext(cwd, {
    ...(deps.identityPath ? { identityPath: deps.identityPath } : {}),
    ...(deps.configPath ? { configPath: deps.configPath } : {}),
  });
  return executeWorkflowState({
    cwd,
    request,
    context,
    role: "save",
    ...(deps.store ? { store: deps.store } : {}),
    ...(deps.configPath ? { configPath: deps.configPath } : {}),
    ...(deps.identityPath ? { identityPath: deps.identityPath } : {}),
  });
}

function savedIds(cwd: string, attempt: SaveAttempt, facts: SaveFact[]): string[] | null {
  const receipt = readReceipt(cwd, attempt);
  if (!receipt || !sameAttempt(receipt, attempt)) return null;
  if (facts.length === 0) return receipt.kind === "no-fact" ? [] : null;
  return receipt.kind === "rows" && receipt.ids.length === facts.length ? receipt.ids : null;
}

function factName(attempt: SaveAttempt, seq: number): string {
  const digest = createHash("sha256").update(`${attempt.subject}:${attempt.runId}:${seq}`).digest("hex").slice(0, 32);
  return `memory/${digest}.md`;
}


function revisionOf(value: unknown): string | null {
  if (!value || typeof value !== "object" || !("revision" in value)) return null;
  const revision = value.revision;
  return typeof revision === "string" && revision.length > 0 ? revision : null;
}

function listedRevisions(value: unknown): Set<string> {
  if (!Array.isArray(value)) return new Set();
  return new Set(value.flatMap((item) => {
    const revision = revisionOf(item);
    return revision ? [revision] : [];
  }));
}

function refOf(value: unknown): ArtifactRef | null {
  if (!value || typeof value !== "object") return null;
  if (!("subjectId" in value) || !("kind" in value) || !("logicalName" in value)) return null;
  if (typeof value.subjectId !== "string" || typeof value.kind !== "string" || typeof value.logicalName !== "string") return null;
  return { subjectId: value.subjectId, kind: value.kind as ArtifactKind, logicalName: value.logicalName };
}

function note(sink: SqlMemoryActivitySink | undefined, ok: boolean, message: string): void {
  sink?.({ kind: "toolEnd", tool: "workflow_state", ok, message });
}

function sameAttempt(value: SaveReceipt, attempt: SaveAttempt): boolean {
  return value.attemptId === attempt.attemptId
    && value.runId === attempt.runId
    && value.subject === attempt.subject
    && value.project === attempt.project
    && value.probed === true;
}

function readAttempt(cwd: string): SaveAttempt | null {
  return parseAttempt(readJson(cwd, ATTEMPT_REL));
}

function readReceipt(cwd: string, attempt: SaveAttempt): SaveReceipt | null {
  return parseReceipt(readJson(cwd, attempt.receiptRel));
}

function parseAttempt(value: unknown): SaveAttempt | null {
  if (!isAttempt(value) || hasSecretKey(value)) return null;
  return value;
}

function parseReceipt(value: unknown): SaveReceipt | null {
  if (!isReceipt(value)) return null;
  return value;
}

function isAttempt(value: unknown): value is SaveAttempt {
  if (!value || typeof value !== "object") return false;
  const row = value as SaveAttempt;
  return typeof row.attemptId === "string"
    && typeof row.runId === "string"
    && typeof row.subject === "string"
    && typeof row.project === "string"
    && typeof row.receiptRel === "string"
    && (row.phase === null || typeof row.phase === "string");
}

function isReceipt(value: unknown): value is SaveReceipt {
  if (!value || typeof value !== "object") return false;
  const row = value as SaveReceipt;
  if (!Array.isArray(row.ids) || !row.ids.every((id) => typeof id === "string")) return false;
  return (row.kind === "rows" || row.kind === "no-fact") && row.probed === true;
}

function hasSecretKey(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  return Object.keys(value).some((key) => SECRET_KEY.test(key));
}

function safeSubject(subject: string): boolean {
  return /^[\w.-]+$/.test(subject);
}

function projectOrigin(cwd: string): string | null {
  const origin = git(cwd, "remote", "get-url", "origin");
  if (origin) return redactRemoteCredentials(origin);
  const commonDir = git(cwd, "rev-parse", "--git-common-dir");
  if (!commonDir) return null;
  return commonDir.startsWith("/") ? commonDir : resolve(cwd, commonDir);
}

function git(cwd: string, ...args: string[]): string | null {
  try {
    const value = execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    return value || null;
  } catch {
    return null;
  }
}

function readJson(cwd: string, rel: string): unknown {
  const full = contained(cwd, rel);
  if (!full || !existsSync(full)) return null;
  try {
    return JSON.parse(readFileSync(full, "utf8"));
  } catch {
    return null;
  }
}

function writeJson(cwd: string, rel: string, value: SaveAttempt | SaveReceipt): void {
  const full = contained(cwd, rel);
  if (!full) throw new Error(`SQL save path escapes the project: ${rel}`);
  mkdirSync(dirname(full), { recursive: true });
  const temporary = `${full}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(temporary, full);
}

function contained(cwd: string, rel: string): string | null {
  const root = resolve(cwd);
  const full = resolve(root, rel);
  return full === root || full.startsWith(`${root}/`) ? full : null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
