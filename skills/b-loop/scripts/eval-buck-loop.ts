/**
 * Autonomous Buck phased loop runner for OMP's Bun `eval` kernel.
 * Imported explicitly via module URL from `prompts/b-loop.md` (no bare npm imports).
 */

export {
  countAcceptanceCriteria,
  parseAcceptanceCriteria,
  parseFrontmatter,
  unwrapToolResult,
} from "./frontmatter.js";
export {
  acquireWriterLock,
  assertCheckpointBinding,
  canonicalWorktreeRoot,
  CHECKPOINT_LOGICAL_NAME,
  checkpointDigest,
  createInitialCheckpoint,
  createWorkflowCliCheckpointBackend,
  derivePhaseMilestone,
  emitLoopProgress,
  formatStageProgress,
  persistCheckpointWithReadback,
  privateBindingHash,
  writerLockPath,
} from "./checkpoint.js";
export { detectPlanCompletionGap, executeCheckpointLoop, STAGE_SEQUENCE } from "./recovery.js";
export type * from "./types.js";
export {
  parseSubjectArgument,
  resolveAndPinPlan,
  runSh,
  shellQuote,
  validateBridges,
  validateNamedBranch,
  validateStorageConfig,
} from "./validation.js";

import {
  acquireWriterLock,
  assertCheckpointBinding,
  CHECKPOINT_LOGICAL_NAME,
  createWorkflowCliCheckpointBackend,
} from "./checkpoint.js";
import { detectPlanCompletionGap, executeCheckpointLoop } from "./recovery.js";
import type {
  BuckLoopOptions,
  BuckLoopResult,
  CheckpointBackend,
  PinnedPlan,
  StageAdapters,
  ValidatedBridges,
} from "./types.js";
import {
  parseSubjectArgument,
  resolveAndPinPlan,
  tryReadGitOrigin,
  validateBridges,
  validateNamedBranch,
  validateStorageConfig,
} from "./validation.js";

function blockFailure(options: Pick<BuckLoopOptions, "bridges">, message: string): BuckLoopResult {
  if (typeof options.bridges?.log === "function") {
    options.bridges.log(`[b-loop blocked] ${message}`);
  }
  return { ok: false, state: "blocked", message };
}

function unconfiguredStageAdapter(stage: "build" | "review" | "save" | "commit") {
  return {
    async dispatchWorking(): Promise<{ jobHandle?: string | null; handle?: unknown }> {
      throw new Error(`Stage adapter for ${stage} is not configured.`);
    },
    async verifyResult(): Promise<never> {
      throw new Error(`Stage adapter for ${stage} is not configured.`);
    },
  };
}

function resolveRunAdapters(overrides?: Partial<StageAdapters>): StageAdapters | null {
  if (!overrides) return null;
  return {
    build: overrides.build ?? unconfiguredStageAdapter("build"),
    review: overrides.review ?? unconfiguredStageAdapter("review"),
    save: overrides.save ?? unconfiguredStageAdapter("save"),
    commit: overrides.commit ?? unconfiguredStageAdapter("commit"),
  };
}

function yieldResult(
  pinnedPlan: PinnedPlan,
  branchName: string,
  owner: { pid: number; ownerId: string },
  bridges: ValidatedBridges,
): BuckLoopResult {
  const firstOrder = pinnedPlan.phases[0]?.order ?? 1;
  const yieldMsg = `Yielding to live writer (pid ${owner.pid}, owner ${owner.ownerId})`;
  bridges.phase(`Phase ${firstOrder} · yielded`);
  bridges.log(`[b-loop yielded] ${yieldMsg}`);
  return {
    ok: true,
    state: "yielded",
    subject: pinnedPlan.subjectId,
    branch: branchName,
    message: yieldMsg,
  };
}

async function runPinnedPreflightResult(options: {
  cwd: string;
  pinnedPlan: PinnedPlan;
  branchName: string;
  bridges: ValidatedBridges;
  backend: CheckpointBackend;
  configPath?: string;
}): Promise<BuckLoopResult> {
  const { cwd, pinnedPlan, branchName, bridges, backend, configPath } = options;
  const existing = await backend.read({
    cwd,
    subjectId: pinnedPlan.subjectId,
    branchRef: pinnedPlan.branchRef,
    logicalName: CHECKPOINT_LOGICAL_NAME,
    configPath,
  });
  if (existing) {
    assertCheckpointBinding(existing.checkpoint, {
      cwd,
      subjectId: pinnedPlan.subjectId,
      branchRef: pinnedPlan.branchRef,
      pinnedPlan,
    });
  }

  const gap = await detectPlanCompletionGap(pinnedPlan, existing?.checkpoint ?? null, cwd, bridges.sh);
  if (gap) return blockFailure({ bridges }, gap);

  bridges.phase(`Pinned ${pinnedPlan.subjectId} (${pinnedPlan.phases.length} phases on ${branchName})`);
  bridges.log(
    `[b-loop pinned] subject=${pinnedPlan.subjectId} branch=${branchName} phases=${pinnedPlan.phases.map((p) => p.logicalName).join(",")}`,
  );
  return {
    ok: true,
    state: "pinned",
    subject: pinnedPlan.subjectId,
    branch: branchName,
    pinnedPlan,
    checkpointRevision: existing?.revision,
    message: `Pinned ${pinnedPlan.phases.length} discrete phases for ${pinnedPlan.subjectId}`,
  };
}

async function runWithAcquiredLock(
  options: BuckLoopOptions,
  cwd: string,
  pinnedPlan: PinnedPlan,
  branchName: string,
  bridges: ValidatedBridges,
): Promise<BuckLoopResult> {
  const backend = options.checkpointBackend ?? createWorkflowCliCheckpointBackend(bridges.sh, {
    xdgConfigHome: options.xdgConfigHome,
    configPath: options.configPath,
  });
  const adapters = resolveRunAdapters(options.stageAdapters);
  if (!adapters) {
    return runPinnedPreflightResult({
      cwd,
      pinnedPlan,
      branchName,
      bridges,
      backend,
      configPath: options.configPath,
    });
  }
  return executeCheckpointLoop({
    cwd,
    pinnedPlan,
    bridges,
    backend,
    adapters,
    xdgConfigHome: options.xdgConfigHome,
    configPath: options.configPath,
  });
}

function safeReleaseLock(release: () => void, primaryError: unknown): void {
  try {
    release();
  } catch (releaseErr) {
    if (!primaryError) throw releaseErr;
  }
}

/**
 * Validate bridges, target subject, named Git branch, `repo-files` storage configuration,
 * discrete phase plan via `workflow_state`, acquire per-(subject, branch, worktree) writer lock,
 * and execute the checkpoint-driven milestone & recovery loop.
 */
export async function runBuckLoop(options: BuckLoopOptions = {}): Promise<BuckLoopResult> {
  const cwd = options.cwd ?? (typeof process !== "undefined" ? process.cwd() : ".");
  const rawArgs = options.args ?? "";

  try {
    const subjectId = parseSubjectArgument(rawArgs, options.subject);
    const bridges = validateBridges(options.bridges);
    const branch = await validateNamedBranch(cwd, bridges.sh);
    const origin = await tryReadGitOrigin(cwd, bridges.sh);
    validateStorageConfig({
      configPath: options.configPath,
      xdgConfigHome: options.xdgConfigHome,
      origin,
    });

    const pinnedPlan = await resolveAndPinPlan(bridges.tool.workflow_state, subjectId, branch);
    const lock = acquireWriterLock({
      cwd,
      subjectId: pinnedPlan.subjectId,
      branchRef: branch.branchRef,
      xdgConfigHome: options.xdgConfigHome,
      isPidAlive: options.isPidAlive,
    });
    if (!lock.acquired) {
      return yieldResult(pinnedPlan, branch.branchName, lock.owner, bridges);
    }

    let primaryError: unknown;
    try {
      return await runWithAcquiredLock(options, cwd, pinnedPlan, branch.branchName, bridges);
    } catch (error) {
      primaryError = error;
      throw error;
    } finally {
      safeReleaseLock(lock.release, primaryError);
    }
  } catch (error) {
    return blockFailure(options, error instanceof Error ? error.message : String(error));
  }
}
