import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { OrchestrationState } from "./types.js";

const WORKFLOW_DIR = ".context/workflow";
const PROJECTION_FILE = "orchestration.json";
const SNAPSHOT_FILE = "orchestration.snapshot.json";

export function ensureWorkflowDir(projectRoot: string): string {
  const dir = join(projectRoot, WORKFLOW_DIR);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function normalizeProjection(raw: Partial<OrchestrationState> | null | undefined): OrchestrationState | null {
  if (!raw) return null;

  const now = new Date().toISOString();
  return {
    version: raw.version ?? 1,
    goal: raw.goal ?? "",
    currentState: raw.currentState ?? "idle",
    subject: raw.subject ?? null,
    startedAt: raw.startedAt ?? now,
    updatedAt: raw.updatedAt ?? now,
    history: Array.isArray(raw.history) ? raw.history : [],
    queue: Array.isArray(raw.queue)
      ? raw.queue.map((item) => ({
          ...item,
          iterations: Array.isArray(item.iterations) ? item.iterations : [],
          blockReasonHistory: Array.isArray(item.blockReasonHistory)
            ? item.blockReasonHistory.map((reason) => String(reason))
            : [],
        }))
      : [],
    workerAttemptCount: typeof raw.workerAttemptCount === "number" ? raw.workerAttemptCount : 0,
    lastWorkerStatus: raw.lastWorkerStatus,
    active: raw.active
      ? {
          chunkId: raw.active.chunkId,
          phasePath: raw.active.phasePath,
          step: raw.active.step ?? "build",
          iteration: raw.active.iteration ?? 0,
          maxIterations: raw.active.maxIterations ?? 5,
          workerPid: raw.active.workerPid,
          lastResultFile: raw.active.lastResultFile,
          issueFingerprint: raw.active.issueFingerprint,
        }
      : undefined,
  };
}

export function readProjection(projectRoot: string): OrchestrationState | null {
  try {
    const path = join(ensureWorkflowDir(projectRoot), PROJECTION_FILE);
    if (!existsSync(path)) return null;
    const raw = readFileSync(path, "utf-8");
    return normalizeProjection(JSON.parse(raw) as Partial<OrchestrationState>);
  } catch {
    return null;
  }
}

export function writeProjection(
  projectRoot: string,
  state: OrchestrationState,
): void {
  try {
    const path = join(ensureWorkflowDir(projectRoot), PROJECTION_FILE);
    const normalized = normalizeProjection(state) ?? state;
    writeFileSync(path, JSON.stringify(normalized, null, 2) + "\n", "utf-8");
  } catch (e) {
    console.error("[b-flow] Failed to write projection:", e);
  }
}

export function updateProjection(
  projectRoot: string,
  updater: (state: OrchestrationState) => OrchestrationState,
  fallback?: Partial<OrchestrationState>,
): OrchestrationState {
  const base =
    readProjection(projectRoot) ??
    normalizeProjection(fallback ?? { currentState: "idle", goal: "", subject: null })!;
  const next = normalizeProjection(updater(base)) ?? base;
  writeProjection(projectRoot, next);
  return next;
}

export function readSnapshot(projectRoot: string): unknown | null {
  try {
    const path = join(ensureWorkflowDir(projectRoot), SNAPSHOT_FILE);
    if (!existsSync(path)) return null;
    const raw = readFileSync(path, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeSnapshot(
  projectRoot: string,
  snapshot: unknown,
): void {
  try {
    const path = join(ensureWorkflowDir(projectRoot), SNAPSHOT_FILE);
    writeFileSync(path, JSON.stringify(snapshot, null, 2) + "\n", "utf-8");
  } catch (e) {
    console.error("[b-flow] Failed to write snapshot:", e);
  }
}
