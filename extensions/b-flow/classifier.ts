import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { TransitionContext, RouteAction } from "./types.js";
export interface ClassifierResult {
  action: RouteAction;
  confidence: number;
  reason: string;
  evidence: string[];
}
export interface ClassifierAudit {
  id: string;
  timestamp: string;
  goal: string;
  currentState: string;
  subject: string | null;
  context: {
    hasPlan: boolean;
    hasPhasesOverview: boolean;
    hasActivePhase: boolean;
    workerActive: boolean;
    artifactCount: number;
  };
  decision: {
    action: RouteAction;
    confidence: number;
    reason: string;
    evidence: string[];
  };
}
/**
 * Write classifier audit to disk.
 * Audit files go to: .context/<subject>/transition-audits/
 */
function writeClassifierAudit(
  projectRoot: string,
  subject: string | null,
  audit: ClassifierAudit,
): void {
  if (!subject) return;
  const auditDir = join(projectRoot, ".context", subject, "transition-audits");
  try {
    mkdirSync(auditDir, { recursive: true });
    const fileName = `audit-${audit.id}.json`;
    writeFileSync(join(auditDir, fileName), JSON.stringify(audit, null, 2) + "\n", "utf-8");
  } catch (e) {
    console.error("[b-flow] Failed to write classifier audit:", e);
  }
}
/**
 * Stub classifier for MVP.
 * Returns safe default routes for all cases.
 * Full implementation will call a model directly via SDK in Phase 3+.
 */
/**
 * Stub classifier for MVP.
 * Returns safe default routes for all cases.
 * Full implementation will call a model directly via SDK in Phase 3+.
 */
export function evaluateModelGuard(
  projectRoot: string,
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
  const result: ClassifierResult = {
    action,
    confidence: 0.6, // low confidence since this is a stub
    reason: "MVP stub classifier: deterministic fallback routing",
    evidence,
  };
  // Write audit file
  const audit: ClassifierAudit = {
    id: generateAuditId(),
    timestamp: new Date().toISOString(),
    goal: ctx.goal,
    currentState: ctx.current,
    subject: ctx.subject,
    context: {
      hasPlan: hasPlan(ctx),
      hasPhasesOverview: hasPhasesOverview(ctx),
      hasActivePhase: hasActivePhase(ctx),
      workerActive: ctx.worker.active,
      artifactCount: ctx.artifacts.backlogItems.length,
    },
    decision: result,
  };
  writeClassifierAudit(projectRoot, ctx.subject, audit);
  return result;
}
function generateAuditId(): string {
  const now = new Date();
  const datePart = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `${datePart}-${randomPart}`;
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

