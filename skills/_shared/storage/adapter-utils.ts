import { createHash } from "node:crypto";
import type { ArtifactKey, ArtifactRevision } from "./contract.js";
import { isRevisionVisible } from "./visibility.js";

export function keyId(key: ArtifactKey): string {
  return JSON.stringify([key.projectId, key.subjectId, key.kind, key.logicalName, key.branchId ?? "", key.worktreeId ?? "", key.runId ?? ""]);
}

export function revisionHash(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function cloneRevision(value: ArtifactRevision): ArtifactRevision {
  return { ...value, key: { ...value.key }, bytes: new Uint8Array(value.bytes), links: value.links.map((link) => ({ ...link })) };
}

export function visible(revision: ArtifactRevision, query: { projectId: string; branchId: string; publishedRevisionIds: readonly string[]; worktreeId?: string; runId?: string }): boolean {
  return isRevisionVisible(revision, { ...query, publishedRevisionIds: new Set(query.publishedRevisionIds) });
}

export function validateRevision(revision: ArtifactRevision): void {
  if (!revision.key.branchId) throw new Error("artifact revision requires a branch identity");
  if (revisionHash(revision.bytes) !== revision.sha256) throw new Error("artifact revision sha256 does not match its bytes");
  if (!revision.revision || !revision.key.logicalName) throw new Error("artifact revision identity is incomplete");
}
