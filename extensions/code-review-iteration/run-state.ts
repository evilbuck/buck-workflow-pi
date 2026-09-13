/**
 * run-state — durable, resumable run state and immutable pass artifacts
 * under `<git-common-dir>/code-review-iteration/<branch-key>/<run-id>/`.
 *
 * `state.json` is the only mutable file (atomic tmp+rename); pass
 * directories are immutable once complete and never feed back into the
 * reviewed diff. Runtime survives worktree removal until an explicit prune.
 */

import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
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
  effective_model: string | null;
  requested_temperature: number | null;
  effective_temperature: number | null;
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

export function createRun(commonDir: string, state: Omit<RunState, "schema_version">): { dir: string; state: RunState } {
  const dir = runDirFor(commonDir, state.branch, state.run_id);
  if (existsSync(dir)) throw new StateError(`run directory already exists: ${dir}`);
  mkdirSync(join(dir, "passes"), { recursive: true });
  const full: RunState = { ...state, schema_version: RUN_STATE_SCHEMA };
  saveState(dir, full);
  return { dir, state: full };
}

/** Atomic write: serialize to a sibling temp file, then rename over. */
export function saveState(runDir: string, state: RunState): void {
  state.updated_at = new Date().toISOString();
  const target = join(runDir, "state.json");
  const tmp = join(runDir, "state.json.tmp");
  writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`, "utf-8");
  renameSync(tmp, target);
}

export function loadState(runDir: string): RunState {
  const target = join(runDir, "state.json");
  if (!existsSync(target)) throw new StateError(`no state.json in ${runDir}`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(target, "utf-8"));
  } catch (e: unknown) {
    throw new StateError(`state.json is not valid JSON in ${runDir}: ${(e as Error).message}`);
  }
  if (typeof parsed !== "object" || parsed === null) throw new StateError(`state.json is not an object in ${runDir}`);
  const state = parsed as RunState;
  if (state.schema_version !== RUN_STATE_SCHEMA) {
    throw new StateError(`unsupported state schema_version ${String(state.schema_version)} in ${runDir}`);
  }
  return state;
}

export interface ListedRun {
  dir: string;
  state: RunState;
}

/** All runs for a branch, newest run_id first (ids are timestamp-prefixed). */
export function listRuns(commonDir: string, branch: string | null): ListedRun[] {
  const branchDir = join(runtimeRoot(commonDir), branchKey(branch));
  if (!existsSync(branchDir)) return [];
  const runs: ListedRun[] = [];
  for (const entry of readdirSync(branchDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = join(branchDir, entry.name);
    try {
      runs.push({ dir, state: loadState(dir) });
    } catch {
      // unreadable run directories are preserved but never resumed
    }
  }
  return runs.sort((a, b) => (a.state.run_id > b.state.run_id ? -1 : 1));
}

/** Newest resumable (non-clean) run for the branch, or null. */
export function findResumable(commonDir: string, branch: string | null): ListedRun | null {
  for (const run of listRuns(commonDir, branch)) {
    if ((RESUMABLE_STATUSES as readonly string[]).includes(run.state.status)) return run;
  }
  return null;
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

function writeImmutable(path: string, content: string): void {
  if (existsSync(path)) throw new StateError(`refusing to overwrite immutable artifact: ${path}`);
  writeFileSync(path, content, "utf-8");
}

export function writePassReview(runDir: string, pass: number, record: PassReviewRecord): void {
  const dir = passDirFor(runDir, pass);
  mkdirSync(dir, { recursive: true });
  writeImmutable(join(dir, "review.json"), `${JSON.stringify(record, null, 2)}\n`);
}

export function writePassReviewMarkdown(runDir: string, pass: number, markdown: string): void {
  writeImmutable(join(passDirFor(runDir, pass), "review.md"), markdown);
}

export function writePassFixer(runDir: string, pass: number, record: PassFixerRecord, markdown: string): void {
  const dir = passDirFor(runDir, pass);
  mkdirSync(dir, { recursive: true });
  writeImmutable(join(dir, "fixer.json"), `${JSON.stringify(record, null, 2)}\n`);
  writeImmutable(join(dir, "fixer.md"), `${markdown}\n`);
}

export function appendCommandRecord(runDir: string, pass: number, record: CommandRecord): void {
  const dir = passDirFor(runDir, pass);
  mkdirSync(dir, { recursive: true });
  appendFileSync(join(dir, "commands.jsonl"), `${JSON.stringify(record)}\n`, "utf-8");
}

export function readCommandRecords(runDir: string, pass: number): CommandRecord[] {
  const target = join(passDirFor(runDir, pass), "commands.jsonl");
  if (!existsSync(target)) return [];
  return readFileSync(target, "utf-8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as CommandRecord);
}
