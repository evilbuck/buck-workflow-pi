/**
 * run-state — durable, resumable run state and immutable pass artifacts
 * under `<git-common-dir>/code-review-iteration/<branch-key>/<run-id>/`.
 *
 * `state.json` is the only mutable file (atomic tmp+rename); pass
 * directories are immutable once complete and never feed back into the
 * reviewed diff. Runtime survives worktree removal until an explicit prune.
 */

import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { commitConsumerBatch, consumerKey, flushConfiguredRetains, scheduleConfiguredRetain } from "../../skills/_shared/storage/consumers.js";
import { resolveConsumerContext, withBoundStore } from "../../skills/_shared/scripts/workflow-state.js";
import { createRunId } from "../../skills/_shared/storage/identity.js";
import type { CommandRecord } from "./policy.js";
import type { ValidatedFinding } from "./findings.js";

export const RUN_STATE_SCHEMA = 1;

export type RunStatus = "running" | "clean" | "blocked" | "exhausted" | "cancelled" | "failed";

/** Non-clean outcomes retain their runtime for automatic resume. */
export const RESUMABLE_STATUSES: readonly RunStatus[] = ["running", "blocked", "exhausted", "cancelled", "failed"];

export type MinBlocking = "medium" | "high" | "critical";

export interface FixerDisposition {
  finding_id: string;
  disposition: "valid" | "invalid" | "already_fixed" | "blocked";
  note: string;
}

export interface PassFixerRecord {
  model: string | null;
  requested_hardness: string | null;
  dispositions: FixerDisposition[];
  changed_paths: string[];
  checks: { command: string; exit_code: number | null; passed: boolean };
  checkpoint_commit: string | null;
}

export interface PassReviewRecord {
  persona: string;
  requested_model: string | null;
  requested_temperature: number | null;
  thinking_level: string | null;
  reviewed_head: string;
  findings: ValidatedFinding[];
  errors: string[];
}

export interface RunState {
  schema_version: number;
  run_id: string;
  status: RunStatus;
  branch: string | null;
  base_branch: string;
  base_commit: string | null;
  start_head: string;
  checkpoint_commit: string | null;
  pass: number;
  persona: string;
  reviewer_model: string | null;
  fixer_model: string | null;
  requested_temperature: number | null;
  /** Last HEAD the run observed; resume validates against this. */
  last_head: string;
  min_blocking: MinBlocking;
  max_passes: number;
  created_worktree: string | null;
  worktree_fingerprint: string;
  started_at: string;
  updated_at: string;
  terminal: { reason: string; at: string } | null;
  checkout_root?: string;
}

export class StateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StateError";
  }
}

export function branchKey(branch: string | null): string {
  const raw = branch ?? "detached";
  const sanitized = raw.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  return sanitized === "" ? "detached" : sanitized;
}

export function newRunId(now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "");
  const rand = Math.random().toString(36).slice(2, 8);
  return `${stamp}-${rand}`;
}

export function runtimeRoot(commonDir: string): string {
  return join(commonDir, "code-review-iteration");
}

export function runDirFor(commonDir: string, branch: string | null, runId: string): string {
  return join(runtimeRoot(commonDir), branchKey(branch), runId);
}

export function passDirFor(runDir: string, pass: number): string {
  return join(runDir, "passes", String(pass).padStart(2, "0"));
}

const runRoots = new Map<string, string>();

function checkoutFor(runDir: string): string {
  const cwd = runRoots.get(runDir);
  if (!cwd) throw new StateError(`review run is not bound to a checkout: ${runDir}`);
  return cwd;
}

export async function createRun(commonDir: string, state: Omit<RunState, "schema_version">, cwd: string): Promise<{ dir: string; state: RunState }> {
  const dir = runDirFor(commonDir, state.branch, state.run_id);
  const full: RunState = { ...state, checkout_root: cwd, schema_version: RUN_STATE_SCHEMA };
  runRoots.set(dir, cwd);
  await saveState(dir, full, null);
  return { dir, state: full };
}

/** Retain first, then atomically refresh the optional state export. */
export async function saveState(runDir: string, state: RunState, expectedRevision?: string | null): Promise<string | null> {
  state.updated_at = new Date().toISOString();
  const body = `${JSON.stringify(state, null, 2)}\n`;
  const cwd = checkoutFor(runDir);
  const retained = await scheduleConfiguredRetain({
    kind: "run-state", subjectId: "code-review", logicalName: `runs/${state.run_id}/state.json`,
    bytes: new TextEncoder().encode(body), cwd, source: "code-review-iteration", expectedRevision,
  });
  mkdirSync(runDir, { recursive: true });
  const target = join(runDir, "state.json");
  const tmp = join(runDir, "state.json.tmp");
  writeFileSync(tmp, body, "utf-8");
  renameSync(tmp, target);
  return retained;
}

export async function loadState(runDir: string): Promise<RunState> {
  const cwd = checkoutFor(runDir);
  const context = await resolveConsumerContext(cwd);
  return withBoundStore(cwd, context, async (store) => {
    const key = consumerKey({ ...context, worktreeId: context.worktreeId!, runId: context.runId! }, "run-state", "code-review", `runs/${basename(runDir)}/state.json`);
    const stored = await store.read(key);
    if (!stored) throw new StateError(`no retained state in ${runDir}`);
    return parseState(new TextDecoder().decode(stored.bytes), runDir);
  });
}

function parseState(body: string, runDir: string): RunState {
  let parsed: unknown;
  try { parsed = JSON.parse(body); }
  catch (error) { throw new StateError(`state.json is not valid JSON in ${runDir}: ${(error as Error).message}`); }
  if (typeof parsed !== "object" || parsed === null) throw new StateError(`state.json is not an object in ${runDir}`);
  const state = parsed as RunState;
  if (state.schema_version !== RUN_STATE_SCHEMA) throw new StateError(`unsupported state schema_version ${String(state.schema_version)} in ${runDir}`);
  if (state.run_id !== basename(runDir)) throw new StateError(`retained run identity mismatch in ${runDir}`);
  return state;
}

export interface ListedRun {
  dir: string;
  state: RunState;
}

/** All runs for a branch, newest run_id first (ids are timestamp-prefixed). */
export async function listRuns(commonDir: string, branch: string | null, cwd: string): Promise<ListedRun[]> {
  const context = await resolveConsumerContext(cwd);
  return withBoundStore(cwd, context, async (store) => {
    const retained = await store.list({ ...context, worktreeId: context.worktreeId!, runId: context.runId!, subjectId: "code-review", kind: "run-state", logicalNamePrefix: "runs/" });
    const runs: ListedRun[] = [];
    for (const item of retained) {
      if (!/^runs\/[^/]+\/state\.json$/u.test(item.key.logicalName)) continue;
      const id = item.key.logicalName.split("/")[1]!;
      const dir = runDirFor(commonDir, branch, id);
      try {
        const state = parseState(new TextDecoder().decode(item.bytes), dir);
        if (state.branch !== branch) continue;
        runRoots.set(dir, cwd);
        runs.push({ dir, state });
      } catch (error) {
        if (!(error instanceof StateError)) throw error;
        // Invalid retained state is preserved but cannot authorize resume.
      }
    }
    return runs.sort((a, b) => b.state.run_id.localeCompare(a.state.run_id));
  });
}

/** Newest resumable (non-clean) run for the branch, or null. */
export async function findResumable(commonDir: string, branch: string | null, cwd: string): Promise<ListedRun | null> {
  for (const run of await listRuns(commonDir, branch, cwd)) {
    if ((RESUMABLE_STATUSES as readonly string[]).includes(run.state.status)) return run;
  }
  return null;
}

export async function pruneRetainedRun(cwd: string, runId: string): Promise<void> {
  const context = await resolveConsumerContext(cwd);
  await withBoundStore(cwd, context, async (store) => {
    const artifacts = await store.list({ ...context, worktreeId: context.worktreeId!, runId: context.runId!, subjectId: "code-review" });
    for (const item of artifacts) {
      if (item.key.logicalName !== `runs/${runId}/state.json` && !item.key.logicalName.startsWith(`${runId}/passes/`)) continue;
      await store.correct({ key: item.key, predecessorRevision: item.revision, replacement: null, idempotencyKey: `prune-review:${item.revision}` });
    }
  });
}

export interface ResumeCheck {
  ok: boolean;
  reason: string | null;
}

/**
 * Validate that a stored run still matches the working tree before resuming:
 * same HEAD, same status fingerprint, and no git operation in progress.
 * On mismatch the old run is preserved for inspection, never overwritten.
 */
export function validateResume(state: RunState, current: {
  head: string;
  fingerprint: string;
  gitOperationInProgress: boolean;
}): ResumeCheck {
  if (current.gitOperationInProgress) {
    return { ok: false, reason: "a git operation (rebase/merge) is in progress" };
  }
  if (state.worktree_fingerprint !== current.fingerprint) {
    return { ok: false, reason: "worktree fingerprint changed since the stored run state" };
  }
  const expectedHead = state.last_head ?? state.start_head;
  if (current.head !== expectedHead) {
    return { ok: false, reason: `HEAD is ${current.head.slice(0, 12)} but the run expects ${expectedHead.slice(0, 12)}` };
  }
  return { ok: true, reason: null };
}

function retainPassArtifact(runDir: string, pass: number, file: string, bytes: Uint8Array): Promise<string | null> {
  return scheduleConfiguredRetain({
    kind: "audit", subjectId: "code-review", logicalName: `${basename(runDir)}/passes/${String(pass).padStart(2, "0")}/${file}`,
    bytes, cwd: checkoutFor(runDir), source: "code-review-iteration",
    expectedRevision: null,
  });
}

export async function writePassReview(runDir: string, pass: number, record: PassReviewRecord): Promise<string | null> {
  const body = `${JSON.stringify(record, null, 2)}\n`;
  const retained = await retainPassArtifact(runDir, pass, "review.json", new TextEncoder().encode(body));
  const dir = passDirFor(runDir, pass);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "review.json"), body, "utf-8");
  return retained;
}

export async function writePassReviewMarkdown(runDir: string, pass: number, markdown: string): Promise<string | null> {
  const retained = await retainPassArtifact(runDir, pass, "review.md", new TextEncoder().encode(markdown));
  const dir = passDirFor(runDir, pass);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "review.md"), markdown, "utf-8");
  return retained;
}

export async function writePassFixer(runDir: string, pass: number, record: PassFixerRecord, markdown: string): Promise<Array<string | null>> {
  const dir = passDirFor(runDir, pass);
  mkdirSync(dir, { recursive: true });
  const json = `${JSON.stringify(record, null, 2)}\n`;
  const text = `${markdown}\n`;
  const retained = await Promise.all([
    retainPassArtifact(runDir, pass, "fixer.json", new TextEncoder().encode(json)),
    retainPassArtifact(runDir, pass, "fixer.md", new TextEncoder().encode(text)),
  ]);
  writeFileSync(join(dir, "fixer.json"), json, "utf-8");
  writeFileSync(join(dir, "fixer.md"), text, "utf-8");
  return retained;
}

let commandTail: Promise<void> = Promise.resolve();

export function appendCommandRecord(runDir: string, pass: number, record: CommandRecord): Promise<string | null> {
  const cwd = checkoutFor(runDir);
  const binding = resolveConsumerContext(cwd);
  void binding.catch(() => undefined);
  const retained = commandTail.then(async () => withBoundStore(cwd, await binding, async (store, context) => {
    const scope = { ...context, worktreeId: context.worktreeId!, runId: context.runId! };
    const logicalName = `${basename(runDir)}/passes/${String(pass).padStart(2, "0")}/commands.jsonl`;
    const previous = await store.read(consumerKey(scope, "audit", "code-review", logicalName));
    const body = `${previous ? new TextDecoder().decode(previous.bytes) : ""}${JSON.stringify(record)}\n`;
    const receiptRun = createRunId();
    await commitConsumerBatch(store, scope, [{ kind: "audit", subjectId: "code-review", logicalName, bytes: new TextEncoder().encode(body), expectedRevision: previous?.revision ?? null, source: "code-review-iteration" }], { attemptId: receiptRun, runId: receiptRun, status: "attempted" });
    const dir = passDirFor(runDir, pass);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "commands.jsonl"), body, "utf-8");
    return context.runId!;
  }));
  commandTail = retained.then(() => undefined, () => undefined);
  return retained;
}

export { flushConfiguredRetains };

export async function readPassArtifact(runDir: string, pass: number, file: string): Promise<string | null> {
  const cwd = checkoutFor(runDir);
  const context = await resolveConsumerContext(cwd);
  return withBoundStore(cwd, context, async (store) => {
    const key = consumerKey({ ...context, worktreeId: context.worktreeId!, runId: context.runId! }, "audit", "code-review", `${basename(runDir)}/passes/${String(pass).padStart(2, "0")}/${file}`);
    const stored = await store.read(key);
    return stored ? new TextDecoder().decode(stored.bytes) : null;
  });
}

export async function readCommandRecords(runDir: string, pass: number): Promise<CommandRecord[]> {
  const body = await readPassArtifact(runDir, pass, "commands.jsonl");
  return (body ?? "").split("\n").filter(Boolean).map((line) => JSON.parse(line) as CommandRecord);
}
