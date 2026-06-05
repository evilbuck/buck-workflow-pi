/**
 * b-flow — Layered Recovery & Reconciliation
 *
 * Implements the "artifacts win" principle for restart recovery:
 * 1. Load XState snapshot
 * 2. Load orchestration projection
 * 3. Scan actual artifacts on disk
 * 4. Reconcile differences
 * 5. Artifacts win (disk truth)
 * 6. Unsafe conflicts block and ask user
 */

import type { OrchestrationState, TransitionContext, ChunkQueueItem, BuckState } from "./types.js";

export interface ReconciliationResult {
  type: "ok" | "conflict" | "unsafe";
  projection: OrchestrationState;
  conflicts: ReconciliationConflict[];
  blocked?: { reason: string; missing?: string[] };
}

export interface ReconciliationConflict {
  field: string;
  snapshotValue: unknown;
  diskValue: unknown;
  severity: "safe" | "unsafe";
  resolution: "use_disk" | "use_snapshot" | "ask_user";
}

/**
 * Reconcile the orchestration projection against actual disk state.
 * Artifacts on disk always win for content; snapshots win for structural state.
 */
export function reconcileProjection(
  projection: OrchestrationState,
  transitionContext: TransitionContext,
): ReconciliationResult {
  const conflicts: ReconciliationConflict[] = [];

  // Check 1: Queue item completion status
  const queueConflicts = reconcileQueueItems(projection.queue, transitionContext);
  conflicts.push(...queueConflicts);

  // Check 2: Phase status vs machine state
  const phaseConflicts = reconcilePhaseStatus(projection, transitionContext);
  conflicts.push(...phaseConflicts);

  // Check 3: Subject folder existence
  const subjectConflicts = reconcileSubject(projection, transitionContext);
  conflicts.push(...subjectConflicts);

  // Classify conflicts
  const unsafeConflicts = conflicts.filter((c) => c.severity === "unsafe");
  const safeConflicts = conflicts.filter((c) => c.severity === "safe");

  // Build updated projection (artifacts win for content)
  let updatedProjection = projection;

  // Apply disk truth for queue items
  if (safeConflicts.some((c) => c.field.startsWith("queue."))) {
    updatedProjection = reconcileQueueFromDisk(updatedProjection, transitionContext);
  }

  // Check for unsafe conflicts
  if (unsafeConflicts.length > 0) {
    const missing = extractMissingArtifacts(unsafeConflicts);
    return {
      type: "unsafe",
      projection: updatedProjection,
      conflicts: unsafeConflicts,
      blocked: {
        reason: `Unsafe recovery conflict: ${unsafeConflicts.map((c) => c.field).join(", ")}`,
        missing,
      },
    };
  }

  // Safe conflicts are resolved by using disk truth
  return {
    type: safeConflicts.length > 0 ? "conflict" : "ok",
    projection: updatedProjection,
    conflicts: safeConflicts,
  };
}

function reconcileQueueItems(
  queue: ChunkQueueItem[],
  ctx: TransitionContext,
): ReconciliationConflict[] {
  const conflicts: ReconciliationConflict[] = [];

  if (!ctx.subject) return conflicts;

  for (const item of queue) {
    // Check if phase file status changed
    if (item.type === "phase" && item.path) {
      const diskStatus = getPhaseStatusFromDisk(item.path);
      if (diskStatus && diskStatus !== item.status) {
        conflicts.push({
          field: `queue.${item.id}.status`,
          snapshotValue: item.status,
          diskValue: diskStatus,
          severity: "safe", // Phase completion is safe - artifacts win
          resolution: "use_disk",
        });
      }
    }

    // Check if task is still pending
    if (item.type === "task" && item.path) {
      const diskStatus = getTaskStatusFromDisk(item.path);
      if (diskStatus !== item.status) {
        conflicts.push({
          field: `queue.${item.id}.status`,
          snapshotValue: item.status,
          diskValue: diskStatus,
          severity: "safe",
          resolution: "use_disk",
        });
      }
    }
  }

  return conflicts;
}

function reconcilePhaseStatus(
  projection: OrchestrationState,
  ctx: TransitionContext,
): ReconciliationConflict[] {
  const conflicts: ReconciliationConflict[] = [];

  // If machine thought it was in executingChunks but activePhase is gone/completed on disk
  if (projection.currentState === "executingChunks") {
    const activePhase = ctx.artifacts.activePhase;
    if (!activePhase || activePhase.status === "completed") {
      // Safe: artifacts show work is done, machine can catch up
      conflicts.push({
        field: "currentState",
        snapshotValue: "executingChunks",
        diskValue: activePhase ? activePhase.status : "not_found",
        severity: "safe",
        resolution: "use_disk",
      });
    }
  }

  return conflicts;
}

function reconcileSubject(
  projection: OrchestrationState,
  ctx: TransitionContext,
): ReconciliationConflict[] {
  const conflicts: ReconciliationConflict[] = [];

  // Check if subject folder still exists
  if (projection.subject && ctx.subject !== projection.subject) {
    conflicts.push({
      field: "subject",
      snapshotValue: projection.subject,
      diskValue: ctx.subject,
      severity: "unsafe", // Subject mismatch is potentially unsafe
      resolution: "ask_user",
    });
  }

  return conflicts;
}

function reconcileQueueFromDisk(
  projection: OrchestrationState,
  ctx: TransitionContext,
): OrchestrationState {
  // Rebuild queue from disk truth
  // This is a simplified version - the actual queue rebuild happens in chunk-queue-machine
  return {
    ...projection,
    queue: projection.queue.map((item) => {
      if (item.type === "phase" && item.path) {
        const diskStatus = getPhaseStatusFromDisk(item.path);
        if (diskStatus) {
          return { ...item, status: diskStatus };
        }
      }
      if (item.type === "task" && item.path) {
        const diskStatus = getTaskStatusFromDisk(item.path);
        if (diskStatus) {
          return { ...item, status: diskStatus };
        }
      }
      return item;
    }),
  };
}

function extractMissingArtifacts(conflicts: ReconciliationConflict[]): string[] {
  const missing: string[] = [];
  for (const conflict of conflicts) {
    if (conflict.resolution === "ask_user") {
      missing.push(conflict.field);
    }
  }
  return [...new Set(missing)];
}

// --- Disk status helpers ---

import { existsSync, readFileSync } from "node:fs";

function getPhaseStatusFromDisk(path: string): ChunkQueueItem["status"] | null {
  try {
    if (!existsSync(path)) return null;
    const content = readFileSync(path, "utf-8");
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return null;
    const fm = parseFrontmatter(match[1]);
    if (fm.status === "completed") return "completed";
    if (fm.status === "in_progress") return "pending"; // Treat in_progress as pending for recovery
    return "pending";
  } catch {
    return null;
  }
}

function getTaskStatusFromDisk(path: string): ChunkQueueItem["status"] | null {
  try {
    if (!existsSync(path)) return null;
    const content = readFileSync(path, "utf-8");
    // Check for - [x] (completed) vs - [ ] (pending)
    if (content.match(/^- \[x\]/m)) return "completed";
    if (content.match(/^- \[ \]/m)) return "pending";
    return null;
  } catch {
    return null;
  }
}

function parseFrontmatter(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = raw.split("\n");
  let currentKey: string | null = null;
  let currentValue = "";

  for (const line of lines) {
    const keyMatch = line.match(/^(\w+):\s*(.*)$/);
    if (keyMatch) {
      if (currentKey) {
        result[currentKey] = currentValue.trim();
      }
      currentKey = keyMatch[1];
      currentValue = keyMatch[2];
    } else if (line.match(/^\s+\|/)) {
      // Continuation (list item)
      currentValue += "\n" + line.trim();
    } else if (line.match(/^\s*-\s+/)) {
      // Array item
      currentValue += "\n" + line.trim();
    }
  }

  if (currentKey) {
    result[currentKey] = currentValue.trim();
  }

  return result;
}
