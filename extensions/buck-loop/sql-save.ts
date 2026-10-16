/** One attempt owns fact writes, metadata evidence, and the exact durable receipt. */
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { SqlMemoryActivitySink } from "../sql-memory/index.js";
import type { ArtifactKey, ArtifactRevision, RunReceipt, StorageStore } from "../../skills/_shared/storage/contract.js";
import {
  executeWorkflowState, resolveConsumerContext, resolveTrustedContext, withBoundStore,
  type TrustedWorkflowContext,
} from "../../skills/_shared/scripts/workflow-state.js";
import { consumerKey } from "../../skills/_shared/storage/consumers.js";
import { revisionHash } from "../../skills/_shared/storage/adapter-utils.js";
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
export type SaveCheck = { status: "skip" } | { status: "verified" } | { status: "unverified" } | { status: "block"; reason: string };
export interface SaveStoreDeps {
  cwd?: string;
  store?: StorageStore;
  context?: TrustedWorkflowContext;
  identityPath?: string;
  configPath?: string;
  onActivity?: SqlMemoryActivitySink;
}
export type SaveFact = string | { body: string; supersedes?: string };
/** Named so the projection's refusal is a distinct domain outcome, not an anonymous shape. */
export interface PrepareError { error: string }
export type PrepareResult = SaveAttempt | PrepareError;
interface Evidence { key: ArtifactKey; revision: string; sha256: string }
interface AttemptState {
  attempt: SaveAttempt;
  factsDigest: string;
  ids: string[];
  facts: Evidence[];
  metadata?: Evidence[];
  removed?: ArtifactKey[];
  metadataDigest?: string;
}
type BoundContext = TrustedWorkflowContext & { worktreeId: string; runId: string };
export function sqlMode(): boolean { return Boolean(process.env.SQL_MEMORY_URL); }

/** Synchronous supervisor projection; the first store operation persists and binds it. */
export function prepareSaveAttempt(cwd: string, subject: string, reuse = false, phase: string | null = null): PrepareResult {
  if (!/^[\w.-]+$/.test(subject) || subject === "." || subject === "..") return { error: "SQL save subject path is not a single subject folder." };
  const project = projectOrigin(cwd);
  if (!project) return { error: "Shared SQL memory is configured, but project identity could not be established; no save was started." };
  const previous = readAttempt(cwd);
  if (reuse && previous?.subject === subject && previous.project === project && previous.phase === phase) return previous;
  const attemptId = randomUUID();
  const attempt = { attemptId, runId: `run-${randomUUID()}`, subject, project, phase, receiptRel: join(".context", subject, "sql-memory-receipts", `${attemptId}.json`) };
  writeJson(cwd, ATTEMPT_REL, attempt);
  return attempt;
}

/** Completion observes durable metadata evidence, never a local completed flag. */
export async function completeSaveAttempt(cwd: string, attempt: SaveAttempt, deps: SaveStoreDeps = {}): Promise<void> {
  await withSaveStore(cwd, deps, async (store, context) => {
    const state = await readState(store, context, attempt);
    if (!state?.metadata) throw new Error("SQL save metadata evidence is missing or invalid");
    await confirmEvidence(store, state);
    const expected = receiptFor(context, state, "complete");
    const existing = await store.readReceipt(context.projectId, attempt.runId);
    if (!exactReceipt(existing, expected)) {
      if (!exactReceipt(existing, { ...expected, status: "attempted" })) throw new Error("SQL save attempted receipt is missing or invalid");
      await store.writeReceipt(expected);
    }
    if (!exactReceipt(await store.readReceipt(context.projectId, attempt.runId), expected)) throw new Error("Durable save receipt readback mismatch");
    writeJson(cwd, attempt.receiptRel, { ...localReceipt(state), completed: true });
  });
}

export function saveDirective(attempt: SaveAttempt): string {
  return [
    "Durable save attempt.", `attemptId: ${attempt.attemptId}`, `runId: ${attempt.runId}`, `subject: ${attempt.subject}`,
    `project: ${attempt.project}`, `phase: ${attempt.phase ?? "null"}`, `receipt: ${attempt.receiptRel}`,
    `Persist facts first: run bun ${JSON.stringify(fileURLToPath(import.meta.url))} facts with stdin JSON {"attemptId":${JSON.stringify(attempt.attemptId)},"facts":[...]} (strings or {body,supersedes}; [] for no reusable facts). Use its returned receipt.path and receipt.ids in sql_receipt.`,
    `Apply ALL metadata using bun ${JSON.stringify(fileURLToPath(new URL("../../skills/b-save-improved/scripts/save-apply.ts", import.meta.url)))} with the normal save payload on stdin, including sql_receipt and storage_snapshot from save-preflight. This seals metadata and completes this same durable attempt. Do not perform separate manual metadata writes or completion.`,
    "Do not write .context/memory files or the memory index in SQL save mode. Do not call sql_memory or record credentials.",
    "A local completed flag is not proof; missing facts or metadata evidence must block completion.",
  ].join("\n");
}

/** Optional local export, not durable evidence. */
export function writeReceipt(cwd: string, attempt: SaveAttempt, body: Pick<SaveReceipt, "kind" | "ids">): void {
  writeJson(cwd, attempt.receiptRel, { ...attempt, kind: body.kind, ids: body.ids, probed: true });
}

export async function saveSqlFacts(cwd: string, attempt: SaveAttempt, facts: SaveFact[], deps: SaveStoreDeps = {}, onActivity?: SqlMemoryActivitySink): Promise<string[]> {
  try {
    const ids = await withSaveStore(cwd, deps, async (store, context) => {
      await bindAttemptRun(cwd, store, context, deps, attempt, facts.length ? "rows" : "no-fact");
      const digest = revisionHash(new TextEncoder().encode(JSON.stringify(facts)));
      const previous = await readState(store, context, attempt);
      if (previous) {
        if (previous.factsDigest !== digest) throw new Error("Save attempt facts changed; start a new attempt");
        await confirmEvidence(store, previous);
        await ensureAttemptReceipt(store, context, previous);
        await writeRecord(store, pointerKey(context), attempt);
        writeJson(cwd, attempt.receiptRel, localReceipt(previous));
        return previous.ids;
      }
      const evidence: Evidence[] = [];
      for (const [index, fact] of facts.entries()) evidence.push(await saveFact(cwd, store, context, attempt, fact, index + 1));
      const state: AttemptState = { attempt: { ...attempt }, factsDigest: digest, ids: evidence.map(item => item.revision), facts: evidence };
      await writeRecord(store, stateKey(context, attempt), state);
      await writeAttemptReceipt(store, context, state);
      await writeRecord(store, pointerKey(context), attempt);
      writeJson(cwd, attempt.receiptRel, localReceipt(state));
      return state.ids;
    });
    note(onActivity ?? deps.onActivity, true, facts.length ? "Memory wrote" : "Memory wrote · no-fact");
    return ids;
  } catch (error) { note(onActivity ?? deps.onActivity, false, "Memory failed"); throw error; }
}

/**
 * Resolves the durable run this attempt writes under, before any state is read:
 * durable state is keyed by the bound runId, so the binding must exist first.
 *
 * A durable pointer naming this attempt already carries its bound run and is
 * replayed as-is, so a completed receipt is never restamped as attempted. Only a
 * genuinely new attempt allocates a run, through the supported write-receipt seam
 * with the caller's identityPath so the binding lands in the same registry the
 * trusted context was resolved from. An injected store owns its own lifecycle and
 * consults no identity registry.
 */
async function bindAttemptRun(cwd: string, store: StorageStore, context: BoundContext, deps: SaveStoreDeps, attempt: SaveAttempt, kind: SaveReceipt["kind"]): Promise<void> {
  const bound = deps.store ? attempt.runId : await resolveAttemptRun(cwd, store, context, deps, attempt, kind);
  if (bound === attempt.runId) return;
  attempt.runId = bound;
  writeJson(cwd, ATTEMPT_REL, attempt);
}

/** Replay adopts the pointer's run; only a new attempt allocates one. */
async function resolveAttemptRun(cwd: string, store: StorageStore, context: BoundContext, deps: SaveStoreDeps, attempt: SaveAttempt, kind: SaveReceipt["kind"]): Promise<string> {
  const persisted = await readPointerAttempt(store, context);
  if (persisted?.attemptId === attempt.attemptId) {
    if (persisted.subject !== attempt.subject || persisted.project !== attempt.project || persisted.phase !== attempt.phase
      || persisted.receiptRel !== attempt.receiptRel) throw new Error("Durable save attempt identity mismatch");
    return persisted.runId;
  }
  return allocateAttemptRun(cwd, store, context, deps, attempt.attemptId, kind);
}

async function allocateAttemptRun(cwd: string, store: StorageStore, context: BoundContext, deps: SaveStoreDeps, attemptId: string, kind: SaveReceipt["kind"]): Promise<string> {
  const current = await executeWorkflowState({
    cwd, store, context, role: "save", identityPath: deps.identityPath, configPath: deps.configPath,
    request: { operation: "read-receipt" },
  }) as RunReceipt | null;
  if (current?.attemptId === attemptId) return current.runId;
  const receipt = await executeWorkflowState({
    cwd, store, context, role: "save", identityPath: deps.identityPath, configPath: deps.configPath,
    request: { operation: "write-receipt", attemptId, status: "attempted", artifactRevisions: [], kind, metadataDuties: ["save-metadata", kind === "no-fact" ? "probe" : "readback"] },
  }) as { runId?: string };
  if (!receipt?.runId) throw new Error("SQL save could not allocate a durable attempt run");
  return receipt.runId;
}

/** Called only after metadata mutations and scoped source corrections succeeded. */
export async function recordSaveMetadata(cwd: string, attempt: SaveAttempt, revisions: readonly ArtifactRevision[], removed: readonly ArtifactKey[] = [], deps: SaveStoreDeps = {}, metadataDigest?: string): Promise<void> {
  await withSaveStore(cwd, deps, async (store, context) => {
    const state = await readState(store, context, attempt);
    if (!state) throw new Error("Durable save facts evidence is missing");
    if (state.metadata) throw new Error("Save metadata is already sealed; resume the recorded metadata attempt");
    state.metadata = revisions.map(evidenceOf);
    state.removed = [...removed];
    state.metadataDigest = metadataDigest;
    await confirmEvidence(store, state);
    await writeRecord(store, stateKey(context, attempt), state);
    await writeAttemptReceipt(store, context, state);
  });
}

/** A retry repairs receipt completion without rewriting already sealed metadata. */
export async function resumeSaveMetadata(cwd: string, attempt: SaveAttempt, metadataDigest: string, deps: SaveStoreDeps = {}): Promise<boolean> {
  const sealed = await withSaveStore(cwd, deps, async (store, context) => {
    const state = await readState(store, context, attempt);
    if (!state?.metadata) return false;
    if (state.metadataDigest !== metadataDigest) throw new Error("Save attempt metadata changed; start a new attempt");
    await confirmEvidence(store, state);
    return true;
  });
  if (sealed) await completeSaveAttempt(cwd, attempt, deps);
  return sealed;
}

/** Adapter-only recovery: the local attempt/receipt exports may both be absent. */
export async function loadSaveAttempt(cwd: string, deps: SaveStoreDeps = {}): Promise<SaveAttempt | null> {
  return withSaveStore(cwd, deps, (store, context) => readPointerAttempt(store, context));
}

/** The checkpoint pointer names the one authoritative persisted attempt. */
async function readPointerAttempt(store: StorageStore, context: BoundContext): Promise<SaveAttempt | null> {
  const pointer = await store.read(pointerKey(context));
  return pointer ? parseAttempt(JSON.parse(new TextDecoder().decode(pointer.bytes))) : null;
}

export async function probeSql(deps: SaveStoreDeps = {}, onActivity?: SqlMemoryActivitySink): Promise<SaveCheck> {
  if (!sqlMode()) return { status: "skip" };
  try { await withSaveStore(deps.cwd ?? process.cwd(), deps, async (store, context) => { await store.list({ ...context, limit: 1 }); }); return { status: "verified" }; }
  catch (error) { note(onActivity ?? deps.onActivity, false, "Memory failed"); return { status: "block", reason: `SQL save connectivity probe failed: ${errorMessage(error)}` }; }
}

/** Verification is read-only: it must not invent or complete missing evidence. */
export async function verifySqlSave(cwd: string, subject: string | null, deps: SaveStoreDeps = {}, requireComplete = true, expectedAttemptId?: string | null, onActivity?: SqlMemoryActivitySink): Promise<SaveCheck> {
  if (!sqlMode()) return { status: "skip" };
  if (!subject) return { status: "block", reason: "SQL save has no subject; refusing to commit." };
  try {
    return await withSaveStore(cwd, deps, async (store, context) => {
      const attempt = await readPointerAttempt(store, context);
      if (!attempt) return { status: "unverified" };
      const mismatch = attemptMismatch(cwd, attempt, subject, expectedAttemptId);
      if (mismatch) return mismatch;
      const state = await readState(store, context, attempt);
      if (!state || (requireComplete && !state.metadata)) return { status: "unverified" };
      await confirmEvidence(store, state);
      return receiptProves(store, context, state, requireComplete);
    });
  } catch (error) { note(onActivity ?? deps.onActivity, false, "Memory failed"); return { status: "block", reason: `SQL save receipt check failed: ${errorMessage(error)}` }; }
}
/** Completion demands the complete receipt; a non-completing check accepts whatever status is durable. */
async function receiptProves(store: StorageStore, context: BoundContext, state: AttemptState, requireComplete: boolean): Promise<SaveCheck> {
  const receipt = await store.readReceipt(context.projectId, state.attempt.runId);
  const status = requireComplete ? "complete" : receipt?.status ?? "attempted";
  return exactReceipt(receipt, receiptFor(context, state, status)) ? { status: "verified" } : { status: "unverified" };
}
/** A block check is returned only for a projected transition that cannot be this attempt. */
function attemptMismatch(cwd: string, attempt: SaveAttempt, subject: string, expectedAttemptId?: string | null): SaveCheck | null {
  if (attempt.subject !== subject || (expectedAttemptId !== undefined && attempt.attemptId !== expectedAttemptId)) return { status: "block", reason: "SQL save attempt does not match the projected transition." };
  if (projectOrigin(cwd) !== attempt.project) return { status: "block", reason: "SQL save receipt project does not match the current Git project." };
  return null;
}
export function resumeSaveDecision(state: string, check: SaveCheck): "continue" | "block" {
  return check.status === "block" || (state === "committing" && check.status === "unverified") ? "block" : "continue";
}

export async function withSaveStore<T>(cwd: string, deps: SaveStoreDeps, run: (store: StorageStore, context: BoundContext) => Promise<T>): Promise<T> {
  const context = deps.context ?? (deps.configPath || deps.identityPath ? await resolveTrustedContext(cwd, deps) : await resolveConsumerContext(cwd));
  if (!context.worktreeId || !context.runId) throw new Error("Save requires a trusted worktree/run identity");
  const bound = context as BoundContext;
  return deps.store ? run(deps.store, bound) : withBoundStore(cwd, bound, store => run(store, bound));
}
function pointerKey(context: BoundContext): ArtifactKey { return consumerKey(context, "checkpoint", "save-attempts", "workflow/sql-save-attempt.json"); }
function stateKey(context: BoundContext, attempt: SaveAttempt): ArtifactKey { return consumerKey({ ...context, runId: attempt.runId }, "receipt", attempt.subject, `save-attempts/${attempt.attemptId}.json`); }
function evidenceOf(item: ArtifactRevision): Evidence { return { key: item.key, revision: item.revision, sha256: item.sha256 }; }
async function writeRecord(store: StorageStore, key: ArtifactKey, value: unknown): Promise<void> {
  const previous = await store.read(key);
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const sha256 = revisionHash(bytes);
  if (previous?.sha256 === sha256 && revisionHash(previous.bytes) === sha256) return;
  const revision = { key, revision: randomUUID(), bytes, sha256, author: "buck-save", source: "save-attempt", createdAt: new Date().toISOString(), links: [], expectedRevision: previous?.revision ?? null };
  const written = await store.writeBatch([revision]);
  const read = await store.read(key);
  if (written.length !== 1 || read?.revision !== revision.revision || read.sha256 !== revision.sha256 || revisionHash(read.bytes) !== revision.sha256) throw new Error("Durable save evidence readback mismatch");
}
async function readState(store: StorageStore, context: BoundContext, attempt: SaveAttempt): Promise<AttemptState | null> {
  const item = await store.read(stateKey(context, attempt));
  if (!item) return null;
  const state = JSON.parse(new TextDecoder().decode(item.bytes)) as AttemptState;
  const saved = state.attempt;
  if (saved.attemptId !== attempt.attemptId || saved.runId !== attempt.runId || saved.subject !== attempt.subject
    || saved.project !== attempt.project || saved.phase !== attempt.phase || saved.receiptRel !== attempt.receiptRel) throw new Error("Durable save attempt identity mismatch");
  return state;
}
function localReceipt(state: AttemptState): SaveReceipt { return { ...state.attempt, ids: state.ids, kind: state.ids.length ? "rows" : "no-fact", probed: true }; }
function receiptFor(context: BoundContext, state: AttemptState, status: RunReceipt["status"]): RunReceipt {
  // The receipt revision set is the fact set (no-fact must remain empty).
  // Exact metadata revisions and source tombstones live in this attempt's durable evidence.
  return { projectId: context.projectId, branchId: context.branchId, worktreeId: context.worktreeId, runId: state.attempt.runId, attemptId: state.attempt.attemptId, status, artifactRevisions: state.ids, kind: state.ids.length ? "rows" : "no-fact", metadataDuties: ["save-metadata", state.ids.length ? "readback" : "probe"] };
}
function exactReceipt(actual: RunReceipt | null, expected: RunReceipt): boolean {
  return actual !== null && actual.projectId === expected.projectId && actual.branchId === expected.branchId && actual.worktreeId === expected.worktreeId && actual.runId === expected.runId && actual.attemptId === expected.attemptId && actual.status === expected.status && actual.kind === expected.kind && JSON.stringify(actual.artifactRevisions) === JSON.stringify(expected.artifactRevisions) && JSON.stringify(actual.metadataDuties) === JSON.stringify(expected.metadataDuties);
}
async function writeAttemptReceipt(store: StorageStore, context: BoundContext, state: AttemptState): Promise<void> {
  const expected = receiptFor(context, state, "attempted");
  const current = await store.readReceipt(context.projectId, state.attempt.runId);
  if (!exactReceipt(current, expected)) await store.writeReceipt(expected);
  if (!exactReceipt(await store.readReceipt(context.projectId, state.attempt.runId), expected)) throw new Error("Durable save attempted receipt readback mismatch");
}
async function ensureAttemptReceipt(store: StorageStore, context: BoundContext, state: AttemptState): Promise<void> {
  const current = await store.readReceipt(context.projectId, state.attempt.runId);
  if (current?.status !== "complete") {
    await writeAttemptReceipt(store, context, state);
    return;
  }
  if (!exactReceipt(current, receiptFor(context, state, "complete"))) throw new Error("Durable save attempted receipt readback mismatch");
}
async function confirmEvidence(store: StorageStore, state: AttemptState): Promise<void> {
  for (const evidence of [...state.facts, ...(state.metadata ?? [])]) await confirmRevision(store, evidence);
  for (const key of state.removed ?? []) if (await store.read(key)) throw new Error(`Save source remains live: ${key.logicalName}`);
}
async function confirmRevision(store: StorageStore, evidence: Evidence): Promise<void> {
  const item = await store.read(evidence.key, evidence.revision);
  if (!item || item.revision !== evidence.revision || item.sha256 !== evidence.sha256 || revisionHash(item.bytes) !== evidence.sha256) throw new Error(`SQL save revision not readable: ${evidence.revision}`);
}
async function saveFact(cwd: string, store: StorageStore, context: BoundContext, attempt: SaveAttempt, fact: SaveFact, seq: number): Promise<Evidence> {
  const body = typeof fact === "string" ? fact : fact.body;
  const supersedes = typeof fact === "string" ? undefined : fact.supersedes;
  return supersedes ? correctFact(store, context, attempt, body, supersedes, seq) : insertFact(cwd, store, context, attempt, body, seq);
}
/** A superseding fact republishes a live memory revision of this project/subject. */
async function correctFact(store: StorageStore, context: BoundContext, attempt: SaveAttempt, body: string, supersedes: string, seq: number): Promise<Evidence> {
  const visible = await store.list({ ...context, subjectId: attempt.subject, kind: "memory" });
  const previous = visible.find(item => item.revision === supersedes);
  if (!previous) throw new Error("SQL correction target is not in this project/subject");
  const bytes = new TextEncoder().encode(body);
  const key = { ...previous.key, branchId: context.branchId };
  const replacement = { ...previous, key, revision: randomUUID(), bytes, sha256: revisionHash(bytes), expectedRevision: supersedes, source: attempt.phase ?? "b-save", createdAt: new Date().toISOString() };
  const corrected = await store.correct({ key, predecessorRevision: supersedes, replacement, idempotencyKey: `${attempt.attemptId}:${seq}`, publishedRevisionIds: context.publishedRevisionIds });
  if (!corrected) throw new Error("SQL correction did not return a memory id");
  return evidenceOf(corrected);
}
/** The deterministic key makes a retry idempotent: identical body returns the same evidence. */
async function insertFact(cwd: string, store: StorageStore, context: BoundContext, attempt: SaveAttempt, body: string, seq: number): Promise<Evidence> {
  const digest = createHash("sha256").update(`${attempt.subject}:${attempt.attemptId}:${seq}`).digest("hex").slice(0, 32);
  const key: ArtifactKey = { projectId: context.projectId, branchId: context.branchId, subjectId: attempt.subject, kind: "memory", logicalName: `memory/${digest}.md` };
  const previous = await store.read(key);
  if (previous) {
    if (new TextDecoder().decode(previous.bytes) !== body) throw new Error("Save attempt fact content changed");
    return evidenceOf(previous);
  }
  const written = await executeWorkflowState({ cwd, store, context, role: "save", request: { operation: "write", ref: { subjectId: key.subjectId, kind: key.kind, logicalName: key.logicalName }, body, expectedRevision: null, source: attempt.phase ?? "b-save" } }) as { revision?: string };
  const stored = await store.read(key);
  if (!stored || stored.revision !== written?.revision || new TextDecoder().decode(stored.bytes) !== body) throw new Error("SQL save did not return a readable memory id");
  return evidenceOf(stored);
}
function readAttempt(cwd: string): SaveAttempt | null { return parseAttempt(readJson(cwd, ATTEMPT_REL)); }
function parseAttempt(value: unknown): SaveAttempt | null {
  if (!value || typeof value !== "object" || Object.keys(value).some(key => SECRET_KEY.test(key))) return null;
  const row = value as SaveAttempt;
  return [row.attemptId, row.runId, row.subject, row.project, row.receiptRel].every(value => typeof value === "string" && value.length > 0) && (row.phase === null || typeof row.phase === "string") ? row : null;
}
function projectOrigin(cwd: string): string | null {
  const origin = git(cwd, "remote", "get-url", "origin");
  if (origin) return redactRemoteCredentials(origin);
  const common = git(cwd, "rev-parse", "--git-common-dir");
  return common ? resolve(cwd, common) : null;
}
function git(cwd: string, ...args: string[]): string | null {
  try { return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || null; } catch { return null; }
}
function readJson(cwd: string, rel: string): unknown {
  const full = contained(cwd, rel);
  if (!full || !existsSync(full)) return null;
  try { return JSON.parse(readFileSync(full, "utf8")); } catch { return null; }
}
function writeJson(cwd: string, rel: string, value: unknown): void {
  const full = contained(cwd, rel);
  if (!full) throw new Error(`SQL save path escapes the project: ${rel}`);
  mkdirSync(dirname(full), { recursive: true });
  const temporary = `${full}.${randomUUID()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(temporary, full);
}
function contained(cwd: string, rel: string): string | null { const root = resolve(cwd); const full = resolve(root, rel); return full.startsWith(`${root}/`) ? full : null; }
function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
function note(sink: SqlMemoryActivitySink | undefined, ok: boolean, message: string): void { sink?.({ kind: "toolEnd", tool: "workflow_state", ok, message }); }

if (import.meta.main) {
  try {
    if (process.argv[2] !== "facts") throw new Error("Usage: sql-save.ts facts < facts.json");
    const input = JSON.parse(readFileSync(0, "utf8")) as { attemptId?: string; facts?: SaveFact[] };
    const cwd = process.cwd();
    const durable = await loadSaveAttempt(cwd);
    const attempt = durable?.attemptId === input.attemptId ? durable : readAttempt(cwd);
    if (!attempt || attempt.attemptId !== input.attemptId) throw new Error("Save attempt does not match the requested attempt");
    if (!Array.isArray(input.facts)) throw new Error("facts must be an array");
    const ids = await saveSqlFacts(cwd, attempt, input.facts);
    console.log(JSON.stringify({ attemptId: attempt.attemptId, runId: attempt.runId, subject: attempt.subject, receipt: { path: attempt.receiptRel, ids } }));
  } catch (error) {
    console.log(JSON.stringify({ error: errorMessage(error) }));
    process.exitCode = 1;
  }
}
