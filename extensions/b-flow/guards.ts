import type { TransitionContext } from "./types.js";

export function hasGoal(ctx: TransitionContext): boolean {
  return ctx.goal.length > 0;
}

export function hasActiveSubject(ctx: TransitionContext): boolean {
  return ctx.subject !== null && ctx.subject.length > 0;
}

export function hasPlan(ctx: TransitionContext): boolean {
  return ctx.artifacts.latestPlan?.exists === true;
}

export function hasPhasesOverview(ctx: TransitionContext): boolean {
  return ctx.artifacts.phasesOverview?.exists === true;
}

export function hasActivePhase(ctx: TransitionContext): boolean {
  const phase = ctx.artifacts.activePhase;
  return phase?.exists === true && phase.status !== "completed";
}

export function hasQueueItems(ctx: TransitionContext): boolean {
  return ctx.artifacts.backlogItems.length > 0;
}

export function allChunksCompleted(ctx: TransitionContext): boolean {
  return (
    ctx.worker.lastStatus === "completed" ||
    ctx.worker.lastStatus === "completed_with_warnings"
  );
}

export function hasBlockedChunks(ctx: TransitionContext): boolean {
  return ctx.worker.lastStatus === "blocked";
}

export function hasWarnings(ctx: TransitionContext): boolean {
  return ctx.worker.lastStatus === "completed_with_warnings";
}

export function requiresReview(ctx: TransitionContext): boolean {
  if (ctx.review.requiresReplan) return true;
  if (ctx.review.issuesFound) return true;
  if (hasWarnings(ctx)) return true;
  return false;
}

export function isHighRisk(ctx: TransitionContext): boolean {
  // Static metadata check: if active phase difficulty is hard
  const phase = ctx.artifacts.activePhase;
  if (phase?.status === "hard") return true;
  // High-risk file patterns could be added here
  return false;
}

export function hasGitChanges(ctx: TransitionContext): boolean {
  return ctx.git.hasDiff;
}

export function onlyContextChanged(ctx: TransitionContext): boolean {
  return ctx.git.contextOnlyChanged && !ctx.git.sourceFilesChanged;
}

export function loopLimitReached(ctx: TransitionContext): boolean {
  return ctx.safety.loopCount >= ctx.safety.maxLoops;
}

export function workerLimitReached(ctx: TransitionContext): boolean {
  return ctx.safety.workerTasksThisRun >= ctx.safety.maxWorkerTasksPerRun;
}

export function hasWorkerActive(ctx: TransitionContext): boolean {
  return ctx.worker.active;
}

export function requiresReplan(ctx: TransitionContext): boolean {
  return ctx.review.requiresReplan === true;
}
