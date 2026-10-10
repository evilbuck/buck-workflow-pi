import type { ArtifactRevision } from "./contract.js";

export interface VisibilityContext {
  projectId: string;
  branchId: string;
  publishedRevisionIds: ReadonlySet<string>;
  worktreeId?: string;
  runId?: string;
}

export function isRevisionVisible(revision: ArtifactRevision, context: VisibilityContext): boolean {
  const key = revision.key;
  if (key.projectId !== context.projectId) return false;
  if (key.runId !== undefined) {
    return key.branchId === context.branchId
      && key.worktreeId === context.worktreeId
      && key.runId === context.runId
      && context.worktreeId !== undefined
      && context.runId !== undefined;
  }
  return key.branchId === context.branchId || context.publishedRevisionIds.has(revision.revision);
}
