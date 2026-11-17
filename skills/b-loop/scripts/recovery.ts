/**
 * Checkpoint-first recovery, plan-completion Git-proof gap detection,
 * and shared four-milestone (`starting` / `working` / `finished` / `verified`)
 * stage orchestration for `/b-loop <subject>`.
 */

import { randomUUID } from "node:crypto";
import {
  assertCheckpointBinding,
  CHECKPOINT_LOGICAL_NAME,
  createInitialCheckpoint,
  emitLoopProgress,
  persistCheckpointWithReadback,
} from "./checkpoint.js";
import type {
  BlockerRecord,
  BuckLoopResult,
  CheckpointBackend,
  CommitStageProof,
  LoopCheckpoint,
  LoopStage,
  Milestone,
  PinnedPhase,
  PinnedPlan,
  StageAdapter,
  StageAdapters,
  StageContext,
  StageProof,
  StageVerifyResult,
  ValidatedBridges,
} from "./types.js";
import { runSh, shellQuote } from "./validation.js";

export const STAGE_SEQUENCE: readonly LoopStage[] = ["build", "review", "save", "commit"];
const COMMIT_SHA_RE = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/i;

interface LoopSession {
  cwd: string;
  pinnedPlan: PinnedPlan;
  bridges: ValidatedBridges;
  backend: CheckpointBackend;
  checkpoint: LoopCheckpoint;
  revision: string | null;
  xdgConfigHome?: string;
  configPath?: string;
}

function isPhaseMarkedCompleted(phase: PinnedPhase): boolean {
  if (phase.status === "completed") return true;
  if (phase.acceptanceCriteria.length === 0) return false;
  return phase.acceptanceCriteria.every((item) => /^\s*(?:[-*]\s*)?\[[xX]\]/.test(item));
}

async function verifyReachableCommit(
  cwd: string,
  sh: ValidatedBridges["sh"],
  commitSha: string,
): Promise<boolean> {
  if (!COMMIT_SHA_RE.test(commitSha)) return false;
  const qCwd = shellQuote(cwd);
  try {
    const typeOut = (await runSh(sh, `git -C ${qCwd} cat-file -t ${shellQuote(commitSha)}`)).trim();
    if (typeOut !== "commit") return false;
  } catch {
    return false;
  }
  try {
    await runSh(sh, `git -C ${qCwd} merge-base --is-ancestor ${shellQuote(commitSha)} HEAD`);
    return true;
  } catch {
    return false;
  }
}

function hasCompletePhaseStageProofs(checkpoint: LoopCheckpoint | null, phaseName: string, commitSha: string): boolean {
  const phaseState = checkpoint?.phases?.[phaseName];
  if (!phaseState) return false;
  return Boolean(
    phaseState.build &&
    phaseState.review &&
    phaseState.save &&
    phaseState.commit?.commitId === commitSha,
  );
}

/** Detect phases marked completed whose Git commit proof or full stage proofs are missing/unreachable. */
export async function detectPlanCompletionGap(
  pinned: PinnedPlan,
  checkpoint: LoopCheckpoint | null,
  cwd: string,
  sh: ValidatedBridges["sh"],
): Promise<string | null> {
  for (const phase of pinned.phases) {
    const recordedSha = checkpoint?.completedPhaseCommits?.[phase.logicalName];
    if (recordedSha) {
      if (!hasCompletePhaseStageProofs(checkpoint, phase.logicalName, recordedSha)) {
        return `Phase ${phase.order} (${phase.logicalName}) records commit ${recordedSha} without matching stage proofs; inspect checkpoint before continuing.`;
      }
      if (!(await verifyReachableCommit(cwd, sh, recordedSha))) {
        return `Phase ${phase.order} (${phase.logicalName}) commit proof ${recordedSha} is missing or unreachable from HEAD; inspect Git history before continuing.`;
      }
      continue;
    }
    if (isPhaseMarkedCompleted(phase)) {
      return `Phase ${phase.order} (${phase.logicalName}) is marked complete in plan metadata without verified Git commit proof; inspect Git history or reset phase status before continuing.`;
    }
  }
  return null;
}

function findFirstStageMissingProof(checkpoint: LoopCheckpoint, phase: PinnedPhase): LoopStage {
  const phaseState = checkpoint.phases[phase.logicalName];
  if (!phaseState) return "build";
  for (const stage of STAGE_SEQUENCE) {
    if (!phaseState[stage]) return stage;
  }
  return "commit";
}

function pickStartPosition(
  pinned: PinnedPlan,
  checkpoint: LoopCheckpoint,
): { phaseIndex: number; stage: LoopStage } | null {
  for (let i = 0; i < pinned.phases.length; i++) {
    const phase = pinned.phases[i];
    if (checkpoint.completedPhaseCommits[phase.logicalName]) continue;
    if (checkpoint.currentPhaseLogicalName === phase.logicalName) {
      return { phaseIndex: i, stage: checkpoint.currentStage };
    }
    return { phaseIndex: i, stage: findFirstStageMissingProof(checkpoint, phase) };
  }
  return null;
}

async function saveTransition(session: LoopSession, patch: Partial<LoopCheckpoint>): Promise<void> {
  const next: LoopCheckpoint = {
    ...session.checkpoint,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  const stored = await persistCheckpointWithReadback(session.backend, {
    cwd: session.cwd,
    subjectId: session.pinnedPlan.subjectId,
    branchRef: session.pinnedPlan.branchRef,
    logicalName: CHECKPOINT_LOGICAL_NAME,
    checkpoint: next,
    expectedRevision: session.revision,
    configPath: session.configPath,
  });
  session.checkpoint = stored.checkpoint;
  session.revision = stored.revision;
  emitLoopProgress(
    session.bridges,
    next.currentPhaseOrder,
    next.currentStage,
    next.currentMilestone,
    next.blocker,
  );
}

async function recordBlocker(
  session: LoopSession,
  phase: PinnedPhase,
  stage: LoopStage,
  milestone: Milestone,
  details: { reason: string; nextSafeAction: string; attemptId?: string; proof?: StageProof },
): Promise<BuckLoopResult> {
  const blocker: BlockerRecord = {
    lastMilestone: milestone,
    stage,
    reason: details.reason,
    nextSafeAction: details.nextSafeAction,
    ...(details.attemptId ? { attemptId: details.attemptId } : {}),
    recordedAt: new Date().toISOString(),
  };
  const proofUpdates = details.proof
    ? setStageProof(session.checkpoint, phase, stage, details.proof)
    : {};
  await saveTransition(session, {
    ...proofUpdates,
    currentPhaseOrder: phase.order,
    currentPhaseLogicalName: phase.logicalName,
    currentStage: stage,
    currentMilestone: milestone,
    ...(details.attemptId !== undefined ? { attemptId: details.attemptId } : {}),
    blocker,
  });
  return {
    ok: false,
    state: "blocked",
    subject: session.pinnedPlan.subjectId,
    branch: session.pinnedPlan.branchName,
    phase: phase.logicalName,
    stage,
    milestone,
    blocker,
    checkpointRevision: session.revision ?? undefined,
    completedPhaseCommits: session.checkpoint.completedPhaseCommits,
    message: details.reason,
  };
}

function setStageProof(
  checkpoint: LoopCheckpoint,
  phase: PinnedPhase,
  stage: LoopStage,
  proof: StageProof,
  commitId?: string,
): Pick<LoopCheckpoint, "phases" | "completedPhaseCommits"> {
  const prevPhase = checkpoint.phases[phase.logicalName] ?? {
    order: phase.order,
    logicalName: phase.logicalName,
    phaseRevision: phase.revision,
    phaseSha256: phase.sha256,
  };
  const nextPhases = {
    ...checkpoint.phases,
    [phase.logicalName]: { ...prevPhase, [stage]: proof },
  };
  const nextCommits =
    stage === "commit" && commitId
      ? { ...checkpoint.completedPhaseCommits, [phase.logicalName]: commitId }
      : checkpoint.completedPhaseCommits;
  return { phases: nextPhases, completedPhaseCommits: nextCommits };
}

function makeStageContext(session: LoopSession, phase: PinnedPhase, stage: LoopStage, attemptId: string): StageContext {
  return {
    cwd: session.cwd,
    phase,
    stage,
    pinnedPlan: session.pinnedPlan,
    checkpoint: session.checkpoint,
    attemptId,
    bridges: session.bridges,
    xdgConfigHome: session.xdgConfigHome,
  };
}

async function applyVerifiedResult(
  session: LoopSession,
  phase: PinnedPhase,
  stage: LoopStage,
  attemptId: string,
  verdict: StageVerifyResult,
): Promise<BuckLoopResult | null> {
  if (verdict.status === "blocked") {
    return recordBlocker(session, phase, stage, "finished", {
      reason: verdict.reason,
      nextSafeAction: verdict.nextSafeAction,
      attemptId,
      proof: verdict.proof,
    });
  }
  if (verdict.status === "stale_or_missing") {
    return null;
  }
  if (stage === "commit") {
    const commitProof = verdict.proof as CommitStageProof | undefined;
    const validSha = typeof verdict.commitId === "string" && COMMIT_SHA_RE.test(verdict.commitId);
    const matchingProof = commitProof?.commitId === verdict.commitId;
    if (!validSha || !matchingProof) {
      return recordBlocker(session, phase, stage, "finished", {
        reason: "Commit stage verified without a valid 40/64-char commit SHA matching proof.",
        nextSafeAction: "Inspect git HEAD and verify commit proof before retrying.",
        attemptId,
      });
    }
  }
  const updates = setStageProof(session.checkpoint, phase, stage, verdict.proof, verdict.commitId);
  await saveTransition(session, {
    ...updates,
    currentPhaseOrder: phase.order,
    currentPhaseLogicalName: phase.logicalName,
    currentStage: stage,
    currentMilestone: "verified",
    attemptId,
    jobHandle: null,
    blocker: null,
  });
  return { ok: true, state: "pinned" };
}

type StageRunOutcome = { result: BuckLoopResult; rewound?: boolean };

function clearProofsFromStage(
  checkpoint: LoopCheckpoint,
  phase: PinnedPhase,
  targetStage: LoopStage,
): Pick<LoopCheckpoint, "phases"> {
  const prev = checkpoint.phases[phase.logicalName];
  if (!prev) return { phases: checkpoint.phases };
  const idx = STAGE_SEQUENCE.indexOf(targetStage);
  const next = { ...prev };
  for (let i = idx; i < STAGE_SEQUENCE.length; i++) {
    delete next[STAGE_SEQUENCE[i]];
  }
  return {
    phases: {
      ...checkpoint.phases,
      [phase.logicalName]: next,
    },
  };
}

async function rewindPhaseToStage(
  session: LoopSession,
  phase: PinnedPhase,
  targetStage: LoopStage,
  reason: string,
): Promise<StageRunOutcome> {
  session.bridges.log(`[b-loop rewind] Phase ${phase.order} (${phase.logicalName}) -> ${targetStage}: ${reason}`);
  const cleared = clearProofsFromStage(session.checkpoint, phase, targetStage);
  await saveTransition(session, {
    ...cleared,
    currentPhaseOrder: phase.order,
    currentPhaseLogicalName: phase.logicalName,
    currentStage: targetStage,
    currentMilestone: "starting",
    attemptId: null,
    jobHandle: null,
    blocker: null,
  });
  return { result: { ok: true, state: "pinned" }, rewound: true };
}

async function finalizeStageVerification(
  session: LoopSession,
  phase: PinnedPhase,
  stage: LoopStage,
  attemptId: string,
  verified: StageVerifyResult,
  adapters?: StageAdapters,
): Promise<StageRunOutcome> {
  if (verified.status === "stale_or_missing") {
    const canRewind = verified.rewindTo && STAGE_SEQUENCE.indexOf(verified.rewindTo) < STAGE_SEQUENCE.indexOf(stage) && adapters;
    if (canRewind && verified.rewindTo) {
      return rewindPhaseToStage(session, phase, verified.rewindTo, verified.reason);
    }
    return {
      result: await recordBlocker(session, phase, stage, "finished", {
        reason: verified.reason,
        nextSafeAction: `Re-run /b-loop ${session.pinnedPlan.subjectId} to rebuild/reverify ${stage}.`,
        attemptId,
      }),
    };
  }
  const applied = await applyVerifiedResult(session, phase, stage, attemptId, verified);
  if (applied) return { result: applied };
  return {
    result: await recordBlocker(session, phase, stage, "finished", {
      reason: "Stage verification failed",
      nextSafeAction: `Re-run /b-loop ${session.pinnedPlan.subjectId} to rebuild/reverify ${stage}.`,
      attemptId,
    }),
  };
}

async function dispatchAndVerifyStage(
  session: LoopSession,
  phase: PinnedPhase,
  stage: LoopStage,
  adapter: StageAdapter,
  existingAttemptId?: string,
  adapters?: StageAdapters,
): Promise<StageRunOutcome> {
  const attemptId = existingAttemptId ?? randomUUID();
  const ctx = makeStageContext(session, phase, stage, attemptId);

  if (adapter.prepareStarting) await adapter.prepareStarting(ctx);
  await saveTransition(session, {
    currentPhaseOrder: phase.order,
    currentPhaseLogicalName: phase.logicalName,
    currentStage: stage,
    currentMilestone: "starting",
    attemptId,
    jobHandle: null,
    blocker: null,
  });

  const dispatched = await adapter.dispatchWorking(ctx);
  await saveTransition(session, {
    currentMilestone: "working",
    attemptId,
    jobHandle: dispatched.jobHandle ?? null,
    blocker: null,
  });

  if (adapter.awaitFinished) await adapter.awaitFinished(ctx, dispatched);
  await saveTransition(session, {
    currentMilestone: "finished",
    attemptId,
    jobHandle: null,
    blocker: null,
  });

  const verified = await adapter.verifyResult(ctx);
  return finalizeStageVerification(session, phase, stage, attemptId, verified, adapters);
}

async function resumeStarting(
  session: LoopSession,
  phase: PinnedPhase,
  stage: LoopStage,
  adapter: StageAdapter,
  adapters: StageAdapters,
): Promise<StageRunOutcome> {
  const attemptId = session.checkpoint.attemptId ?? randomUUID();
  const ctx = makeStageContext(session, phase, stage, attemptId);
  const check = adapter.checkStarting ? await adapter.checkStarting(ctx) : { status: "dispatch" as const };

  if (check.status === "rewind") {
    return rewindPhaseToStage(session, phase, check.targetStage, check.reason);
  }
  if (check.status === "blocked") {
    return {
      result: await recordBlocker(session, phase, stage, "starting", {
        reason: check.reason,
        nextSafeAction: check.nextSafeAction,
        attemptId,
      }),
    };
  }
  if (check.status === "already-finished") {
    await saveTransition(session, { currentMilestone: "finished", attemptId, blocker: null });
    return resumeFinished(session, phase, stage, adapter, adapters);
  }
  return dispatchAndVerifyStage(session, phase, stage, adapter, attemptId, adapters);
}

async function resumeWorking(
  session: LoopSession,
  phase: PinnedPhase,
  stage: LoopStage,
  adapter: StageAdapter,
  adapters: StageAdapters,
): Promise<StageRunOutcome> {
  const attemptId = session.checkpoint.attemptId ?? randomUUID();
  const ctx = makeStageContext(session, phase, stage, attemptId);
  const rec = adapter.recoverWorking
    ? await adapter.recoverWorking(ctx)
    : { status: "uncertain" as const, reason: "Interrupted while working", nextSafeAction: "Inspect stage output before retrying" };

  if (rec.status === "uncertain") {
    return {
      result: await recordBlocker(session, phase, stage, "working", {
        reason: rec.reason,
        nextSafeAction: rec.nextSafeAction,
        attemptId,
      }),
    };
  }
  if (rec.status === "finished") {
    await saveTransition(session, { currentMilestone: "finished", attemptId, jobHandle: null, blocker: null });
    return resumeFinished(session, phase, stage, adapter, adapters);
  }
  return dispatchAndVerifyStage(session, phase, stage, adapter, undefined, adapters);
}

async function resumeFinished(
  session: LoopSession,
  phase: PinnedPhase,
  stage: LoopStage,
  adapter: StageAdapter,
  adapters: StageAdapters,
): Promise<StageRunOutcome> {
  const attemptId = session.checkpoint.attemptId ?? randomUUID();
  const ctx = makeStageContext(session, phase, stage, attemptId);
  const verified = await adapter.verifyResult(ctx);
  if (verified.status === "stale_or_missing" && verified.rewindTo && STAGE_SEQUENCE.indexOf(verified.rewindTo) < STAGE_SEQUENCE.indexOf(stage)) {
    return rewindPhaseToStage(session, phase, verified.rewindTo, verified.reason);
  }
  const applied = await applyVerifiedResult(session, phase, stage, attemptId, verified);
  if (applied) return { result: applied };

  return dispatchAndVerifyStage(session, phase, stage, adapter, undefined, adapters);
}

async function runStageWithRecovery(
  session: LoopSession,
  phase: PinnedPhase,
  stage: LoopStage,
  adapters: StageAdapters,
  isExactCheckpointTarget: boolean,
): Promise<StageRunOutcome> {
  const adapter = adapters[stage];
  if (!isExactCheckpointTarget) {
    return dispatchAndVerifyStage(session, phase, stage, adapter, undefined, adapters);
  }
  const m = session.checkpoint.currentMilestone;
  if (m === "verified") {
    if (session.checkpoint.phases[phase.logicalName]?.[stage]) return { result: { ok: true, state: "pinned" } };
    return dispatchAndVerifyStage(session, phase, stage, adapter, undefined, adapters);
  }
  if (m === "finished") return resumeFinished(session, phase, stage, adapter, adapters);
  if (m === "working") return resumeWorking(session, phase, stage, adapter, adapters);
  return resumeStarting(session, phase, stage, adapter, adapters);
}

async function runPhaseFromStage(
  session: LoopSession,
  phase: PinnedPhase,
  startStage: LoopStage,
  adapters: StageAdapters,
  hasPriorCheckpoint: boolean,
): Promise<StageRunOutcome> {
  const startIdx = STAGE_SEQUENCE.indexOf(startStage);
  for (let i = startIdx; i < STAGE_SEQUENCE.length; i++) {
    const stage = STAGE_SEQUENCE[i];
    const isExactTarget =
      hasPriorCheckpoint &&
      session.checkpoint.currentPhaseLogicalName === phase.logicalName &&
      session.checkpoint.currentStage === stage;
    const outcome = await runStageWithRecovery(session, phase, stage, adapters, isExactTarget);
    if (!outcome.result.ok || outcome.rewound) return outcome;
  }
  return { result: { ok: true, state: "pinned" } };
}

async function loadValidatedSession(options: {
  cwd: string;
  pinnedPlan: PinnedPlan;
  bridges: ValidatedBridges;
  backend: CheckpointBackend;
  xdgConfigHome?: string;
  configPath?: string;
}): Promise<{ session?: LoopSession; hasPrior: boolean; blocked?: BuckLoopResult }> {
  const { cwd, pinnedPlan, bridges, backend, xdgConfigHome, configPath } = options;
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

  const gapReason = await detectPlanCompletionGap(pinnedPlan, existing?.checkpoint ?? null, cwd, bridges.sh);
  if (gapReason) {
    bridges.log(`[b-loop blocked] ${gapReason}`);
    return {
      hasPrior: Boolean(existing),
      blocked: { ok: false, state: "blocked", subject: pinnedPlan.subjectId, branch: pinnedPlan.branchName, message: gapReason },
    };
  }

  return {
    hasPrior: Boolean(existing),
    session: {
      cwd,
      pinnedPlan,
      bridges,
      backend,
      checkpoint: existing?.checkpoint ?? createInitialCheckpoint(cwd, pinnedPlan),
      revision: existing?.revision ?? null,
      xdgConfigHome,
      configPath,
    },
  };
}

/**
 * Load checkpoint first, validate binding & plan drift, check completion/Git gaps,
 * then drive phases and stages using CAS readback and shared four-milestone progression.
 */
export async function executeCheckpointLoop(options: {
  cwd: string;
  pinnedPlan: PinnedPlan;
  bridges: ValidatedBridges;
  backend: CheckpointBackend;
  adapters: StageAdapters;
  xdgConfigHome?: string;
  configPath?: string;
}): Promise<BuckLoopResult> {
  const loaded = await loadValidatedSession(options);
  if (loaded.blocked) return loaded.blocked;
  const session = loaded.session!;

  const rewindsByPhase = new Map<string, number>();
  const MAX_PHASE_REWINDS = 3;

  for (;;) {
    const pos = pickStartPosition(options.pinnedPlan, session.checkpoint);
    if (!pos) break;
    const activePhase = options.pinnedPlan.phases[pos.phaseIndex];
    const hasPrior = loaded.hasPrior || session.revision !== null;
    const phaseRes = await runPhaseFromStage(session, activePhase, pos.stage, options.adapters, hasPrior);
    if (!phaseRes.result.ok) return phaseRes.result;
    if (phaseRes.rewound) {
      const count = (rewindsByPhase.get(activePhase.logicalName) ?? 0) + 1;
      rewindsByPhase.set(activePhase.logicalName, count);
      if (count > MAX_PHASE_REWINDS) {
        return recordBlocker(session, activePhase, session.checkpoint.currentStage, "starting", {
          reason: `Phase ${activePhase.order} (${activePhase.logicalName}) exceeded ${MAX_PHASE_REWINDS} rewinds because worktree/upstream proofs keep drifting.`,
          nextSafeAction: "Stop external file mutations in the worktree and re-run /b-loop.",
        });
      }
    }
  }

  return {
    ok: true,
    state: "done",
    subject: options.pinnedPlan.subjectId,
    branch: options.pinnedPlan.branchName,
    checkpointRevision: session.revision ?? undefined,
    completedPhaseCommits: session.checkpoint.completedPhaseCommits,
    message: `All ${options.pinnedPlan.phases.length} phases verified for ${options.pinnedPlan.subjectId}`,
  };
}
