/**
 * Trusted private checkpoint persistence (versioned CAS + SHA-256 & deep readback),
 * writer serialization lock with PID-start-tick / symlink / reclaim guards,
 * derived phase milestones, and live OMP progress emitters.
 */

import { createHash, randomUUID } from "node:crypto";
import { linkSync, lstatSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  BlockerRecord,
  CheckpointBackend,
  LoopCheckpoint,
  LoopStage,
  Milestone,
  PinnedPlan,
  RunStateBackend,
  StoredCheckpointRecord,
  ValidatedBridges,
  WriterLockOwner,
} from "./types.js";
import { runSh, shellQuote } from "./validation.js";

export const CHECKPOINT_LOGICAL_NAME = "b-loop/checkpoint.json";

const CLI_PATH = fileURLToPath(new URL("./checkpoint-cli.ts", import.meta.url));
const VALID_STAGES = new Set<LoopStage>(["build", "review", "save", "commit"]);
const VALID_MILESTONES = new Set<Milestone>(["starting", "working", "finished", "verified"]);

export function canonicalWorktreeRoot(cwd: string): string {
  try {
    return realpathSync(cwd);
  } catch (error) {
    throw new Error(`Unable to canonicalize worktree root "${cwd}": ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function privateBindingHash(cwd: string, subjectId: string, branchRef: string): string {
  return createHash("sha256")
    .update(`${subjectId}\0${branchRef}\0${canonicalWorktreeRoot(cwd)}`)
    .digest("hex");
}

export function writerLockPath(
  cwd: string,
  subjectId: string,
  branchRef: string,
  xdgConfigHome?: string,
): string {
  const xdg = xdgConfigHome?.trim() || process.env.XDG_CONFIG_HOME?.trim() || join(homedir(), ".config");
  return join(xdg, "buck-workflow", "b-loop-locks", `${privateBindingHash(cwd, subjectId, branchRef)}.lock`);
}

function readPidStartTicks(pid: number): string | undefined {
  const procStatPath = join("/", "proc", String(pid), "stat");
  try {
    const stat = readFileSync(procStatPath, "utf8");
    const rparen = stat.lastIndexOf(")");
    if (rparen < 0) return undefined;
    const fields = stat.slice(rparen + 2).trim().split(" ");
    // field 22 in /proc/<pid>/stat is index 19 after "(comm) "
    return fields[19] || undefined;
  } catch {
    return undefined;
  }
}

function checkLockOwnerAlive(owner: WriterLockOwner, isPidAliveOverride?: (pid: number) => boolean): boolean {
  if (isPidAliveOverride) return isPidAliveOverride(owner.pid);
  try {
    process.kill(owner.pid, 0);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ESRCH") return false;
    return !(code === "EPERM" && owner.pidStartTicks);
  }
  if (!owner.pidStartTicks) return true;
  const liveTicks = readPidStartTicks(owner.pid);
  return !liveTicks || liveTicks === owner.pidStartTicks;
}

function isValidLockOwner(parsed: Partial<WriterLockOwner>): parsed is WriterLockOwner {
  const hasOwner = typeof parsed.ownerId === "string" && parsed.ownerId.length > 0;
  const hasPid = typeof parsed.pid === "number" && Number.isInteger(parsed.pid) && parsed.pid > 0;
  return hasOwner && hasPid;
}

function readExistingLockOwner(lockFile: string): WriterLockOwner | null {
  let raw: string;
  try {
    const lst = lstatSync(lockFile);
    if (lst.isSymbolicLink() || !lst.isFile()) {
      throw new Error(`Writer lock ${lockFile} is not a regular file; blocking to protect safety.`);
    }
    raw = readFileSync(lockFile, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    if (error instanceof Error && error.message.includes("not a regular file")) throw error;
    throw new Error(`Writer lock ${lockFile} is corrupt or unreadable; active writer liveness is uncertain.`);
  }
  let parsed: Partial<WriterLockOwner>;
  try {
    parsed = JSON.parse(raw) as Partial<WriterLockOwner>;
  } catch {
    throw new Error(`Writer lock ${lockFile} is corrupt or unreadable; active writer liveness is uncertain.`);
  }
  if (isValidLockOwner(parsed)) return parsed;
  throw new Error(`Writer lock ${lockFile} has invalid owner metadata; active writer liveness is uncertain.`);
}

function tryAtomicLinkLock(targetFile: string, ownerId: string, payloadJson: string): boolean {
  const tmpFile = `${targetFile}.${ownerId}.tmp`;
  writeFileSync(tmpFile, payloadJson, { flag: "wx", mode: 0o600 });
  let linked = false;
  try {
    linkSync(tmpFile, targetFile);
    linked = true;
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return false;
    throw error;
  } finally {
    try {
      rmSync(tmpFile, { force: true });
    } catch {
      if (linked) {
        // targetFile already created cleanly
      }
    }
  }
}

function unlinkSafeNoSymlink(filePath: string): void {
  try {
    rmSync(filePath, { force: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

function releaseLockIfOwned(lockFile: string, ownerId: string): void {
  let lst;
  try {
    lst = lstatSync(lockFile);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  if (lst.isSymbolicLink()) return;
  const parsed = JSON.parse(readFileSync(lockFile, "utf8")) as Partial<WriterLockOwner>;
  if (parsed.ownerId === ownerId) {
    unlinkSafeNoSymlink(lockFile);
  }
}

function tryReclaimDeadLock(
  lockFile: string,
  expectedOwnerId: string,
  isPidAliveOverride?: (pid: number) => boolean,
): void {
  const reclaimFile = `${lockFile}.reclaim`;
  const reclaimOwner = randomUUID();
  if (!tryAtomicLinkLock(reclaimFile, reclaimOwner, `${reclaimOwner}\n`)) {
    return;
  }
  try {
    const fresh = readExistingLockOwner(lockFile);
    if (fresh && fresh.ownerId === expectedOwnerId && !checkLockOwnerAlive(fresh, isPidAliveOverride)) {
      unlinkSafeNoSymlink(lockFile);
    }
  } finally {
    unlinkSafeNoSymlink(reclaimFile);
  }
}

export type WriterLockResult =
  | { acquired: true; ownerId: string; release: () => void }
  | { acquired: false; owner: WriterLockOwner };

/**
 * Serialize active `/b-loop <subject>` writers per `(subject, branch, worktree)`.
 * Live owner causes immediate non-mutating yield; dead-PID stale lock is reclaimed under a reclaim lock.
 */
export function acquireWriterLock(options: {
  cwd: string;
  subjectId: string;
  branchRef: string;
  xdgConfigHome?: string;
  isPidAlive?: (pid: number) => boolean;
}): WriterLockResult {
  const lockFile = writerLockPath(options.cwd, options.subjectId, options.branchRef, options.xdgConfigHome);
  mkdirSync(dirname(lockFile), { recursive: true, mode: 0o700 });
  const ownerId = randomUUID();
  const payload: WriterLockOwner = {
    ownerId,
    pid: process.pid,
    pidStartTicks: readPidStartTicks(process.pid),
    subjectId: options.subjectId,
    branchRef: options.branchRef,
    worktreeRoot: canonicalWorktreeRoot(options.cwd),
    startedAt: new Date().toISOString(),
  };
  const serialized = `${JSON.stringify(payload)}\n`;

  for (let attempt = 0; attempt < 4; attempt++) {
    if (tryAtomicLinkLock(lockFile, ownerId, serialized)) {
      return { acquired: true, ownerId, release: () => releaseLockIfOwned(lockFile, ownerId) };
    }
    const existing = readExistingLockOwner(lockFile);
    if (!existing) continue;
    if (checkLockOwnerAlive(existing, options.isPidAlive)) {
      return { acquired: false, owner: existing };
    }
    if (attempt < 3) {
      tryReclaimDeadLock(lockFile, existing.ownerId, options.isPidAlive);
    }
  }
  throw new Error(`Unable to acquire writer lock ${lockFile} cleanly.`);
}

function parseCliJson(raw: string, op: string): unknown {
  try {
    return JSON.parse(raw.trim());
  } catch (error) {
    const preview = raw.trim().slice(0, 160);
    throw new Error(`Invalid JSON from checkpoint-cli ${op}: ${error instanceof Error ? error.message : String(error)} (${preview})`);
  }
}

function createPrivateRecordClient<T>(
  kind: "checkpoint" | "run-state",
  sh: ValidatedBridges["sh"],
  options: { xdgConfigHome?: string; configPath?: string } = {},
) {
  const xdgTrimmed = options.xdgConfigHome?.trim();
  const envPrefix = xdgTrimmed ? `XDG_CONFIG_HOME=${shellQuote(xdgTrimmed)} ` : "";
  const cfgSuffix = (configPath?: string) => {
    const resolved = configPath ?? options.configPath;
    return resolved ? ` --config-path ${shellQuote(resolved)}` : "";
  };

  return {
    async read(input: { cwd: string; subjectId: string; branchRef: string; logicalName: string; configPath?: string }) {
      const cmd = [
        `${envPrefix}bun`,
        shellQuote(CLI_PATH),
        "read",
        "--kind",
        kind,
        "--cwd",
        shellQuote(canonicalWorktreeRoot(input.cwd)),
        "--subject",
        shellQuote(input.subjectId),
        "--branch-ref",
        shellQuote(input.branchRef),
        "--logical-name",
        shellQuote(input.logicalName),
      ].join(" ") + cfgSuffix(input.configPath);
      const parsed = parseCliJson(await runSh(sh, cmd), "read") as {
        found?: boolean;
        revision?: string;
        sha256?: string;
        checkpoint?: T;
      };
      if (!parsed.found) return null;
      if (!parsed.revision || !parsed.sha256 || parsed.checkpoint === undefined) {
        throw new Error(`Checkpoint CLI returned an incomplete ${kind} read payload.`);
      }
      return { revision: parsed.revision, sha256: parsed.sha256, data: parsed.checkpoint };
    },

    async write(input: {
      cwd: string;
      subjectId: string;
      branchRef: string;
      logicalName: string;
      data: T;
      expectedRevision: string | null;
      configPath?: string;
    }) {
      const eof = `__BLOOP_CKPT_${randomUUID().replace(/-/g, "")}__`;
      const expectedArg = input.expectedRevision === null ? "null" : input.expectedRevision;
      const jsonLine = JSON.stringify(input.data);
      const cliCmd = [
        `${envPrefix}bun`,
        shellQuote(CLI_PATH),
        "write",
        "--kind",
        kind,
        "--cwd",
        shellQuote(canonicalWorktreeRoot(input.cwd)),
        "--subject",
        shellQuote(input.subjectId),
        "--branch-ref",
        shellQuote(input.branchRef),
        "--logical-name",
        shellQuote(input.logicalName),
        "--expected-revision",
        shellQuote(expectedArg),
        "--payload-stdin",
        "json",
      ].join(" ") + cfgSuffix(input.configPath);
      const fullCmd = `${cliCmd} <<'${eof}'\n${jsonLine}\n${eof}`;
      const parsed = parseCliJson(await runSh(sh, fullCmd), "write") as {
        revision?: string;
        sha256?: string;
        checkpoint?: T;
      };
      if (!parsed.revision || !parsed.sha256 || parsed.checkpoint === undefined) {
        throw new Error(`Checkpoint CLI ${kind} write response missing revision readback.`);
      }
      return { revision: parsed.revision, sha256: parsed.sha256, data: parsed.checkpoint };
    },
  };
}

/** Build the default production checkpoint backend backed by `checkpoint-cli.ts` (`FileStorageStore`). */
export function createWorkflowCliCheckpointBackend(
  sh: ValidatedBridges["sh"],
  options: { xdgConfigHome?: string; configPath?: string } = {},
): CheckpointBackend {
  const client = createPrivateRecordClient<LoopCheckpoint>("checkpoint", sh, options);
  return {
    async read(input) {
      const res = await client.read(input);
      return res ? { revision: res.revision, sha256: res.sha256, checkpoint: res.data } : null;
    },
    async write(input) {
      const res = await client.write({ ...input, data: input.checkpoint });
      return { revision: res.revision, sha256: res.sha256, checkpoint: res.data };
    },
  };
}

/** Build the private `run-state` backend backed by `checkpoint-cli.ts` (`FileStorageStore`, never `.context/`). */
export function createWorkflowCliRunStateBackend(
  sh: ValidatedBridges["sh"],
  options: { xdgConfigHome?: string; configPath?: string } = {},
): RunStateBackend {
  return {
    readRunState<T = unknown>(input: Parameters<RunStateBackend["readRunState"]>[0]) {
      return createPrivateRecordClient<T>("run-state", sh, options).read(input);
    },
    writeRunState<T = unknown>(input: {
      cwd: string;
      subjectId: string;
      branchRef: string;
      logicalName: string;
      data: T;
      expectedRevision: string | null;
      configPath?: string;
    }) {
      return createPrivateRecordClient<T>("run-state", sh, options).write(input);
    },
  };
}

function stableNormalize(val: unknown): unknown {
  if (Array.isArray(val)) return val.map(stableNormalize);
  if (val && typeof val === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(val as Record<string, unknown>).sort()) {
      const child = (val as Record<string, unknown>)[key];
      if (child !== undefined) out[key] = stableNormalize(child);
    }
    return out;
  }
  return val;
}

/** Compute SHA-256 digest matching JSON checkpoint serialization. */
export function checkpointDigest(checkpoint: LoopCheckpoint): string {
  return createHash("sha256").update(JSON.stringify(checkpoint), "utf8").digest("hex");
}

function isInFlightCommitStage(
  checkpoint: LoopCheckpoint,
  logicalName: string,
  commitProof: NonNullable<LoopCheckpoint["phases"][string]["commit"]>,
): boolean {
  if (checkpoint.currentStage !== "commit" || checkpoint.currentPhaseLogicalName !== logicalName) {
    return false;
  }
  return Boolean(commitProof.expectedTree || commitProof.expectedPhaseSha256);
}

function commitAuthorizedPhaseUpdate(
  checkpoint: LoopCheckpoint,
  logicalName: string,
  phase: PinnedPlan["phases"][number],
): boolean {
  const commitProof = checkpoint.phases[logicalName]?.commit;
  if (!commitProof) return false;
  const landed = Boolean(checkpoint.completedPhaseCommits[logicalName]);
  if (!landed && !isInFlightCommitStage(checkpoint, logicalName, commitProof)) return false;
  if (
    commitProof.completedPhaseRevision === phase.revision &&
    commitProof.completedPhaseSha256 === phase.sha256
  ) {
    return true;
  }
  return !landed && commitProof.expectedPhaseSha256 === phase.sha256;
}

function commitAuthorizedPlanUpdate(checkpoint: LoopCheckpoint, plan: PinnedPlan): boolean {
  if (!plan.overviewLogicalName || plan.planLogicalName !== plan.overviewLogicalName) return false;
  let latestOverviewSha: string | undefined;
  for (const entry of checkpoint.phaseOrder) {
    const commitProof = checkpoint.phases[entry.logicalName]?.commit;
    if (!commitProof?.expectedOverviewSha256) continue;
    const landed = Boolean(checkpoint.completedPhaseCommits[entry.logicalName]);
    const inFlight =
      checkpoint.currentStage === "commit" && checkpoint.currentPhaseLogicalName === entry.logicalName;
    if (landed || inFlight) {
      latestOverviewSha = commitProof.expectedOverviewSha256;
    }
  }
  return latestOverviewSha === plan.planSha256;
}

function planHeaderMatchesPin(checkpoint: LoopCheckpoint, plan: PinnedPlan): boolean {
  if (checkpoint.planLogicalName !== plan.planLogicalName) return false;
  if (checkpoint.planRevision === plan.planRevision && checkpoint.planSha256 === plan.planSha256) return true;
  return commitAuthorizedPlanUpdate(checkpoint, plan);
}

function phaseEntryMatchesPin(
  checkpoint: LoopCheckpoint,
  entry: LoopCheckpoint["phaseOrder"][number],
  phase: PinnedPlan["phases"][number] | undefined,
): boolean {
  if (!phase || entry.order !== phase.order || entry.logicalName !== phase.logicalName) return false;
  if (entry.revision === phase.revision && entry.sha256 === phase.sha256) return true;
  return commitAuthorizedPhaseUpdate(checkpoint, entry.logicalName, phase);
}

function assertPlanMatches(checkpoint: LoopCheckpoint, plan: PinnedPlan): void {
  const samePlan = planHeaderMatchesPin(checkpoint, plan);
  const sameLength = checkpoint.phaseOrder.length === plan.phases.length;
  const samePhases =
    sameLength &&
    checkpoint.phaseOrder.every((entry, idx) => phaseEntryMatchesPin(checkpoint, entry, plan.phases[idx]));
  if (!samePlan || !samePhases) {
    throw new Error(
      `Pinned plan or phase sequence drifted since checkpoint (${checkpoint.planLogicalName}@${checkpoint.planRevision} vs ${plan.planLogicalName}@${plan.planRevision}).`,
    );
  }
}

/** Verify stored checkpoint enums, bound `(subject, branch, worktree)` identity, and plan order consistency. */
export function assertCheckpointBinding(
  checkpoint: LoopCheckpoint,
  expected: { cwd: string; subjectId: string; branchRef: string; pinnedPlan?: PinnedPlan },
): void {
  const worktree = canonicalWorktreeRoot(expected.cwd);
  const scopeMatches =
    checkpoint.schemaVersion === 1 &&
    checkpoint.subjectId === expected.subjectId &&
    checkpoint.branchRef === expected.branchRef &&
    checkpoint.worktreeRoot === worktree;
  if (!scopeMatches) {
    throw new Error(
      `Checkpoint scope mismatch: expected (${expected.subjectId}, ${expected.branchRef}, ${worktree}), got (${checkpoint.subjectId}, ${checkpoint.branchRef}, ${checkpoint.worktreeRoot})`,
    );
  }
  if (!VALID_STAGES.has(checkpoint.currentStage) || !VALID_MILESTONES.has(checkpoint.currentMilestone)) {
    throw new Error(`Corrupt checkpoint state (${checkpoint.currentStage}/${checkpoint.currentMilestone})`);
  }
  if (expected.pinnedPlan) assertPlanMatches(checkpoint, expected.pinnedPlan);
}

function assertReadbackMatches(written: LoopCheckpoint, readback: StoredCheckpointRecord): void {
  const expectedSha = checkpointDigest(written);
  if (!readback.revision || readback.sha256 !== expectedSha) {
    throw new Error(
      `Checkpoint readback digest mismatch: expected ${expectedSha}, got ${readback.sha256 || "missing"}`,
    );
  }
  const left = JSON.stringify(stableNormalize(written));
  const right = JSON.stringify(stableNormalize(readback.checkpoint));
  if (left !== right) {
    throw new Error("Checkpoint readback payload mismatch after write; blocking next side effect.");
  }
}

/** Persist checkpoint with CAS (`expectedRevision`) and cryptographic + deep-equality readback verification. */
export async function persistCheckpointWithReadback(
  backend: CheckpointBackend,
  input: {
    cwd: string;
    subjectId: string;
    branchRef: string;
    logicalName: string;
    checkpoint: LoopCheckpoint;
    expectedRevision: string | null;
    configPath?: string;
  },
): Promise<StoredCheckpointRecord> {
  const result = await backend.write(input);
  assertReadbackMatches(input.checkpoint, result);
  return result;
}

/** Construct an initial checkpoint from the validated pinned plan. */
export function createInitialCheckpoint(cwd: string, pinned: PinnedPlan): LoopCheckpoint {
  if (pinned.phases.length === 0) {
    throw new Error("Cannot initialize checkpoint for an empty phase list.");
  }
  const firstPhase = pinned.phases[0];
  const phases: LoopCheckpoint["phases"] = {};
  for (const phase of pinned.phases) {
    phases[phase.logicalName] = {
      order: phase.order,
      logicalName: phase.logicalName,
      phaseRevision: phase.revision,
      phaseSha256: phase.sha256,
    };
  }
  return {
    schemaVersion: 1,
    subjectId: pinned.subjectId,
    branchRef: pinned.branchRef,
    branchName: pinned.branchName,
    worktreeRoot: canonicalWorktreeRoot(cwd),
    planLogicalName: pinned.planLogicalName,
    planRevision: pinned.planRevision,
    planSha256: pinned.planSha256,
    phaseOrder: pinned.phases.map((p) => ({
      order: p.order,
      logicalName: p.logicalName,
      revision: p.revision,
      sha256: p.sha256,
    })),
    completedPhaseCommits: {},
    currentPhaseOrder: firstPhase.order,
    currentPhaseLogicalName: firstPhase.logicalName,
    currentStage: "build",
    currentMilestone: "starting",
    attemptId: null,
    jobHandle: null,
    blocker: null,
    phases,
    updatedAt: new Date().toISOString(),
  };
}

/** Derive the enclosing phase milestone from the current stage and stage milestone. */
export function derivePhaseMilestone(stage: LoopStage, stageMilestone: Milestone): Milestone {
  if (stage === "build" && stageMilestone === "starting") return "starting";
  if (stage === "commit" && stageMilestone === "finished") return "finished";
  if (stage === "commit" && stageMilestone === "verified") return "verified";
  return "working";
}

export function formatStageProgress(
  phaseOrder: number,
  stage: LoopStage,
  milestone: Milestone,
  blocker?: Pick<BlockerRecord, "reason"> | null,
): string {
  const base = `Phase ${phaseOrder} · b-${stage} ${milestone}`;
  return blocker ? `${base} · blocked` : base;
}

export function emitLoopProgress(
  bridges: ValidatedBridges,
  phaseOrder: number,
  stage: LoopStage,
  milestone: Milestone,
  blocker?: BlockerRecord | null,
): void {
  const phaseMilestone = derivePhaseMilestone(stage, milestone);
  const stageLabel = formatStageProgress(phaseOrder, stage, milestone, blocker);
  bridges.phase(`Phase ${phaseOrder} · ${phaseMilestone}`);
  const detail = blocker ? `${stageLabel}: ${blocker.reason} (next: ${blocker.nextSafeAction})` : stageLabel;
  bridges.log(detail);
}
