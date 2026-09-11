import { mkdir, open, readFile, rename, rm, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { defaultCliOptions, defaultRunState, SCHEMA_VERSION } from "./types.js";
import type { CliOptions, GithubPrState, MergeMethod, RunState } from "./types.js";

export interface PersistencePaths {
  gitDir: string;
  directory: string;
  state: (prNumber: number) => string;
  lock: (prNumber: number) => string;
  config: string;
}

export interface LockIdentity {
  pid: number;
  sessionId: string;
}

export interface LockHandle extends LockIdentity {
  path: string;
}

export interface ReconcileObserved {
  owner: string;
  repo: string;
  prNumber: number;
  worktreeId: string;
  localHeadOid: string | null;
  remoteHeadOid: string | null;
  baseHeadOid: string | null;
  diffDigest: string | null;
  activeRebase: boolean;
  dirtyPaths: string[];
  githubState: GithubPrState;
}

export type ReconcileOutcome = "reconcile" | "blocked" | "merged";

export interface ReconcileResult {
  event: "RESUME_AND_RECONCILE";
  outcome: ReconcileOutcome;
  state: RunState;
  reason?: string;
}

export interface PersistenceConfig {
  initialDelayMs?: number;
  backoff?: number;
  maxDelayMs?: number;
  maxPolls?: number;
  mergeMethod?: MergeMethod;
  model?: string;
}

type RawRecord = Record<string, unknown>;

export async function resolvePersistencePaths(worktree: string): Promise<PersistencePaths> {
  const root = resolve(worktree);
  const gitDir = await resolveGitDir(root);
  if (isInside(gitDir, root)) throw new Error("Refusing to persist b-pr-manager state in the working tree");
  const directory = resolve(gitDir, "b-pr-manager");
  return {
    gitDir,
    directory,
    state: (prNumber) => resolve(directory, `pr-${assertPrNumber(prNumber)}.json`),
    lock: (prNumber) => resolve(directory, `pr-${assertPrNumber(prNumber)}.lock`),
    config: resolve(directory, "config.json"),
  };
}

export async function save(paths: PersistencePaths, runState: RunState): Promise<void> {
  const destination = paths.state(runState.prNumber);
  await mkdir(paths.directory, { recursive: true });
  const temporary = `${destination}.${process.pid}.${Date.now()}.tmp`;
  const file = await open(temporary, "w", 0o600);
  try {
    await file.writeFile(`${JSON.stringify(runState)}\n`, "utf8");
    await file.sync();
  } finally {
    await file.close();
  }
  await rename(temporary, destination);
}

export async function load(paths: PersistencePaths, prNumber: number): Promise<RunState | null> {
  try {
    return migrate(JSON.parse(await readFile(paths.state(prNumber), "utf8")));
  } catch (error: unknown) {
    if (isMissing(error)) return null;
    throw error;
  }
}

export async function acquireLock(paths: PersistencePaths, prNumber: number, identity: LockIdentity): Promise<LockHandle> {
  const lockPath = paths.lock(prNumber);
  await mkdir(paths.directory, { recursive: true });
  try {
    await writeLock(lockPath, identity);
    return { ...identity, path: lockPath };
  } catch (error: unknown) {
    if (!isAlreadyExists(error)) throw error;
  }
  const existing = await readLock(lockPath);
  if (existing && isProcessAlive(existing.pid)) throw new Error(`b-pr-manager lock is held by pid ${existing.pid}`);
  await removeStaleLock(lockPath, existing);
  await writeLock(lockPath, identity);
  return { ...identity, path: lockPath };
}

export async function releaseLock(lock: LockHandle): Promise<void> {
  const existing = await readLock(lock.path);
  if (!existing || existing.pid !== lock.pid || existing.sessionId !== lock.sessionId) {
    throw new Error("Refusing to release a lock owned by another session");
  }
  await rm(lock.path);
}

export function migrate(raw: unknown): RunState {
  if (!isRecord(raw)) throw new Error("Invalid persisted b-pr-manager state");
  const version = raw.schemaVersion;
  if (version === SCHEMA_VERSION) return { ...defaultRunState(), ...raw } as RunState;
  if (version === 0) return { ...defaultRunState(), ...raw, schemaVersion: SCHEMA_VERSION } as RunState;
  throw new Error(`Unsupported b-pr-manager state schema version: ${String(version)}`);
}

export function reconcile(saved: RunState, observed: ReconcileObserved): ReconcileResult {
  if (observed.githubState === "MERGED") return settled(saved, "merged");
  const mismatch = identityMismatch(saved, observed);
  if (mismatch) return blocked(saved, mismatch);
  const unknownDirty = observed.dirtyPaths.filter((path) => !saved.ownedDirtyPaths.includes(path));
  if (unknownDirty.length > 0) return blocked(saved, `Unknown dirty paths: ${unknownDirty.join(", ")}`);
  const drifted = saved.localHeadOid !== observed.localHeadOid || saved.diffDigest !== observed.diffDigest;
  const state = drifted ? clearAttestations(saved, observed) : { ...saved };
  if (observed.activeRebase) return { event: "RESUME_AND_RECONCILE", outcome: "reconcile", state, reason: "Active rebase requires reconciliation" };
  return { event: "RESUME_AND_RECONCILE", outcome: "reconcile", state };
}

export function resolveCliOptions(
  flags: Partial<CliOptions>,
  saved: Partial<CliOptions> | null | undefined,
  config: PersistenceConfig | null | undefined,
): CliOptions {
  return defaultCliOptions({ ...config, ...saved, ...flags });
}

export async function loadConfig(paths: PersistencePaths): Promise<PersistenceConfig | null> {
  try {
    return validateConfig(JSON.parse(await readFile(paths.config, "utf8")));
  } catch (error: unknown) {
    if (isMissing(error)) return null;
    throw error;
  }
}

export async function markPaused(paths: PersistencePaths, runState: RunState, reason = "Cancelled"): Promise<RunState> {
  const paused: RunState = {
    ...runState,
    currentState: "paused",
    lastEvent: "CANCEL",
    pauseReason: reason,
    blockReason: { schemaVersion: SCHEMA_VERSION, code: "api_failure", message: reason, resumeCommand: `/b-pr-manager ${runState.prNumber} --resume` },
    updatedAt: new Date().toISOString(),
  };
  await save(paths, paused);
  return paused;
}

async function resolveGitDir(worktree: string): Promise<string> {
  const dotGit = resolve(worktree, ".git");
  const metadata = await stat(dotGit);
  if (metadata.isDirectory()) return dotGit;
  const pointer = await readFile(dotGit, "utf8");
  const match = /^gitdir:\s*(.+)\s*$/m.exec(pointer);
  if (!match) throw new Error("Invalid .git worktree pointer");
  return resolve(worktree, match[1]);
}

function isInside(candidate: string, root: string): boolean {
  const path = relative(root, candidate);
  return path === "" || (!path.startsWith("..") && !isAbsolute(path));
}

function assertPrNumber(prNumber: number): number {
  if (!Number.isSafeInteger(prNumber) || prNumber < 1) throw new Error("PR number must be a positive integer");
  return prNumber;
}

async function writeLock(lockPath: string, identity: LockIdentity): Promise<void> {
  const file = await open(lockPath, "wx", 0o600);
  try {
    await file.writeFile(JSON.stringify(identity), "utf8");
    await file.sync();
  } finally {
    await file.close();
  }
}

async function readLock(lockPath: string): Promise<LockIdentity | null> {
  try {
    const value: unknown = JSON.parse(await readFile(lockPath, "utf8"));
    return isLockIdentity(value) ? value : null;
  } catch (error: unknown) {
    if (isMissing(error)) return null;
    throw error;
  }
}

async function removeStaleLock(lockPath: string, existing: LockIdentity | null): Promise<void> {
  if (existing && isProcessAlive(existing.pid)) throw new Error(`b-pr-manager lock is held by pid ${existing.pid}`);
  await rm(lockPath, { force: false });
}

function isProcessAlive(pid: number): boolean {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error: unknown) {
    return isPermissionDenied(error);
  }
}

function identityMismatch(saved: RunState, observed: ReconcileObserved): string | null {
  if (saved.owner !== observed.owner || saved.repo !== observed.repo) return "Repository identity changed";
  if (saved.prNumber !== observed.prNumber) return "Pull request number changed";
  if (saved.worktreeId !== observed.worktreeId) return "Worktree changed";
  if (saved.remoteHeadOid !== observed.remoteHeadOid) return "Remote head changed";
  if (saved.baseHeadOid !== observed.baseHeadOid) return "Base head changed";
  return null;
}

function clearAttestations(saved: RunState, observed: ReconcileObserved): RunState {
  return {
    ...saved,
    localHeadOid: observed.localHeadOid,
    remoteHeadOid: observed.remoteHeadOid,
    baseHeadOid: observed.baseHeadOid,
    diffDigest: observed.diffDigest,
    buildAttestation: null,
    reviewAttestation: null,
    verificationAttestation: null,
    verifiedPushOid: null,
  };
}

function blocked(saved: RunState, reason: string): ReconcileResult {
  return {
    event: "RESUME_AND_RECONCILE",
    outcome: "blocked",
    state: { ...saved, currentState: "blocked", blockReason: { schemaVersion: SCHEMA_VERSION, code: "unknown_dirty_paths", message: reason } },
    reason,
  };
}

function settled(saved: RunState, outcome: "merged"): ReconcileResult {
  return { event: "RESUME_AND_RECONCILE", outcome, state: { ...saved, currentState: outcome } };
}

function validateConfig(raw: unknown): PersistenceConfig {
  if (!isRecord(raw)) throw new Error("Invalid b-pr-manager config");
  assertAllowedConfigKeys(raw);
  assertConfigMergeMethod(raw.mergeMethod);
  assertTimingValues(raw);
  if (raw.model !== undefined && typeof raw.model !== "string") throw new Error("Invalid config model");
  return raw;
}

function assertAllowedConfigKeys(raw: RawRecord): void {
  const allowed = new Set(["initialDelayMs", "backoff", "maxDelayMs", "maxPolls", "mergeMethod", "model"]);
  for (const key of Object.keys(raw)) if (!allowed.has(key)) throw new Error(`Unsupported b-pr-manager config key: ${key}`);
}

function assertConfigMergeMethod(value: unknown): void {
  if (value !== undefined && !isMergeMethod(value)) throw new Error("Invalid merge method");
}

function assertTimingValues(raw: RawRecord): void {
  for (const key of ["initialDelayMs", "backoff", "maxDelayMs", "maxPolls"]) {
    const value = raw[key];
    if (value !== undefined && (typeof value !== "number" || !Number.isFinite(value))) throw new Error(`Invalid config ${key}`);
  }
}

function isRecord(value: unknown): value is RawRecord { return typeof value === "object" && value !== null && !Array.isArray(value); }
function isLockIdentity(value: unknown): value is LockIdentity { return isRecord(value) && typeof value.pid === "number" && typeof value.sessionId === "string"; }
function isMergeMethod(value: unknown): value is MergeMethod { return value === "squash" || value === "rebase" || value === "merge"; }
function isMissing(error: unknown): boolean { return isRecord(error) && error.code === "ENOENT"; }
function isAlreadyExists(error: unknown): boolean { return isRecord(error) && error.code === "EEXIST"; }
function isPermissionDenied(error: unknown): boolean { return isRecord(error) && error.code === "EPERM"; }
