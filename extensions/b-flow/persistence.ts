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

export function readProjection(projectRoot: string): OrchestrationState | null {
  try {
    const path = join(ensureWorkflowDir(projectRoot), PROJECTION_FILE);
    if (!existsSync(path)) return null;
    const raw = readFileSync(path, "utf-8");
    return JSON.parse(raw) as OrchestrationState;
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
    writeFileSync(path, JSON.stringify(state, null, 2) + "\n", "utf-8");
  } catch (e) {
    console.error("[b-flow] Failed to write projection:", e);
  }
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
