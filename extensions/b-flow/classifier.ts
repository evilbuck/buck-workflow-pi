import type { TransitionContext, RouteAction } from "./types.js";

export interface ClassifierResult {
  action: RouteAction;
  confidence: number;
  reason: string;
  evidence: string[];
}

/**
 * Stub classifier for MVP.
 * Returns safe default routes for all cases.
 * Full implementation will call a model directly via SDK in Phase 3+.
 */
export function evaluateModelGuard(
  ctx: TransitionContext,
): ClassifierResult {
  const evidence: string[] = [];
  let action: RouteAction;

  // Simple deterministic fallback routing
  if (!hasPlan(ctx)) {
    evidence.push("No plan artifact found");
    action = {
      type: "run-command",
      command: "b-plan",
      prompt: `Create a plan for: ${ctx.goal}`,
    };
  } else if (!hasPhasesOverview(ctx)) {
    evidence.push("Plan exists but no phases overview");
    action = {
      type: "run-command",
      command: "b-phase",
      prompt: `Break plan into phases for: ${ctx.goal}`,
    };
  } else if (!hasActivePhase(ctx)) {
    evidence.push("All phases completed or no active phase");
    action = { type: "mark-done", reason: "All work completed" };
  } else if (ctx.worker.active) {
    evidence.push("Worker is currently active");
    action = { type: "block", reason: "Waiting for active worker to complete" };
  } else {
    evidence.push("Active phase ready for execution");
    const phase = ctx.artifacts.activePhase;
    action = {
      type: "spawn-worker",
      state: ctx.current,
      taskFile: phase?.path ?? "",
      mode: "build",
    };
  }

  return {
    action,
    confidence: 0.6, // low confidence since this is a stub
    reason: "MVP stub classifier: deterministic fallback routing",
    evidence,
  };
}

// --- Local helpers (mirrors guards) ---

function hasPlan(ctx: TransitionContext): boolean {
  return ctx.artifacts.latestPlan?.exists === true;
}

function hasPhasesOverview(ctx: TransitionContext): boolean {
  return ctx.artifacts.phasesOverview?.exists === true;
}

function hasActivePhase(ctx: TransitionContext): boolean {
  const phase = ctx.artifacts.activePhase;
  return phase?.exists === true && phase.status !== "completed";
}
