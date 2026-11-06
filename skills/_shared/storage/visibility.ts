import type { ArtifactKey, ArtifactRevision } from "./contract.js";

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
  if (key.worktreeId !== undefined) return key.branchId === context.branchId && key.worktreeId === context.worktreeId;
  return key.branchId === context.branchId || context.publishedRevisionIds.has(revision.revision);
}
export function overlayPublishedRevisions<T extends { key: ArtifactKey; revision: string }>(revisions: readonly T[], branchId: string): T[] {
  const branchKeys = new Set(
    revisions
      .filter((item) => item.key.branchId === branchId && item.key.runId === undefined)
      .map((item) => JSON.stringify([item.key.projectId, item.key.subjectId, item.key.kind, item.key.logicalName, item.key.worktreeId ?? ""])),
  );
  return revisions.filter((item) => item.key.branchId === branchId
    || item.key.runId !== undefined
    || !branchKeys.has(JSON.stringify([item.key.projectId, item.key.subjectId, item.key.kind, item.key.logicalName, item.key.worktreeId ?? ""])));
}
