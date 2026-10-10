export const STORAGE_ADAPTERS = ["repo-files", "external-files", "sqlite", "postgres"] as const;
export type StorageAdapter = (typeof STORAGE_ADAPTERS)[number];
export type ArtifactKind =
  | "brainstorm" | "capture" | "grill" | "research" | "spec" | "plan" | "phase"
  | "review" | "iterate" | "memory" | "backlog" | "subject-index" | "receipt"
  | "run-state" | "checkpoint" | "activity" | "audit" | "attachment" | "attribution";

export interface ArtifactKey {
  projectId: string;
  subjectId: string;
  kind: ArtifactKind;
  logicalName: string;
  branchId?: string;
  worktreeId?: string;
  runId?: string;
}

export interface ArtifactRevision {
  key: ArtifactKey;
  revision: string;
  bytes: Uint8Array;
  sha256: string;
  author: string;
  source: string;
  createdAt: string;
  links: readonly ArtifactKey[];
  expectedRevision?: string | null;
}

export interface ArtifactQuery {
  projectId: string;
  subjectId?: string;
  kind?: ArtifactKind;
  logicalNamePrefix?: string;
  branchId: string;
  publishedRevisionIds: readonly string[];
  worktreeId?: string;
  runId?: string;
  limit?: number;
  cursor?: string;
}

export interface ScopedCorrection {
  key: ArtifactKey;
  predecessorRevision: string;
  replacement: ArtifactRevision | null;
  idempotencyKey: string;
}

export interface LifecycleTransition {
  subjectId: string;
  fromRevision: string;
  expectedState: string;
  nextState: string;
  evidence: readonly string[];
}

export interface RunReceipt {
  projectId: string;
  branchId: string;
  worktreeId: string;
  runId: string;
  attemptId: string;
  status: "attempted" | "complete";
  artifactRevisions: readonly string[];
}

export interface CheckpointSeal {
  projectId: string;
  branchId: string;
  commit: string;
  integrationTip: string;
  revisionSet: readonly { revision: string; sha256: string }[];
}

export interface StorageStore {
  read(key: ArtifactKey, revision?: string): Promise<ArtifactRevision | null>;
  list(query: ArtifactQuery): Promise<readonly ArtifactRevision[]>;
  search(query: ArtifactQuery & { text: string }): Promise<readonly ArtifactRevision[]>;
  writeBatch(revisions: readonly ArtifactRevision[]): Promise<readonly ArtifactRevision[]>;
  correct(correction: ScopedCorrection): Promise<ArtifactRevision | null>;
  transition(transition: LifecycleTransition): Promise<string>;
  writeReceipt(receipt: RunReceipt): Promise<void>;
  readReceipt(projectId: string, runId: string): Promise<RunReceipt | null>;
  sealCheckpoint(checkpoint: CheckpointSeal): Promise<string>;
  bindCheckpoint(checkpointId: string, commit: string): Promise<void>;
  reconcile(integrationTip: string): Promise<void>;
  exportArtifacts(query: ArtifactQuery): AsyncIterable<ArtifactRevision>;
  importArtifacts(revisions: AsyncIterable<ArtifactRevision>): Promise<void>;
}
