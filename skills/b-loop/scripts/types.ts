/**
 * Shared types for the repaired `/b-loop` OMP eval runner.
 * Zero external package dependencies so OMP's Bun worker links cleanly.
 */

export type LoopStage = "build" | "review" | "save" | "commit";

export type Milestone = "starting" | "working" | "finished" | "verified";

export type PhaseDifficulty = "easy" | "medium" | "hard";

export type BuckBuildHint = "/b-build" | "/b-build-hard";

export type WorkflowStateTool = (args: Record<string, unknown>) => Promise<unknown>;

export interface EvalBridges {
  agent?: (prompt: string, options?: Record<string, unknown>) => Promise<unknown>;
  wait?: (handles: unknown[], options?: Record<string, unknown>) => Promise<unknown>;
  judge?: (
    state: unknown,
    questions: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => Promise<unknown>;
  sh?: (cmd: string | TemplateStringsArray, ...args: unknown[]) => Promise<unknown>;
  phase?: (title: string) => void;
  log?: (message: string) => void;
  budget?: { remaining?: () => Promise<number | undefined> };
  tool?: {
    workflow_state?: WorkflowStateTool;
    [key: string]: unknown;
  };
}

export type ValidatedBridges = Required<Omit<EvalBridges, "budget" | "tool">> & {
  budget?: EvalBridges["budget"];
  tool: {
    workflow_state: WorkflowStateTool;
    [key: string]: unknown;
  };
};

export interface BranchValidationResult {
  branchRef: string;
  branchName: string;
  headCommit: string;
}

export interface PinnedPhase {
  phaseNum: number;
  order: number;
  logicalName: string;
  slug: string;
  token: string;
  revision: string;
  sha256: string;
  status: string;
  difficulty: PhaseDifficulty;
  buckHint: BuckBuildHint;
  files: string[];
  acceptanceCriteria: string[];
}

export interface PinnedPlan {
  subjectId: string;
  branchRef: string;
  branchName: string;
  headCommit: string;
  adapter: "repo-files";
  planLogicalName: string;
  planRevision: string;
  planSha256: string;
  overviewLogicalName?: string;
  phases: PinnedPhase[];
}

export interface BlockerRecord {
  lastMilestone: Milestone;
  stage: LoopStage;
  reason: string;
  nextSafeAction: string;
  attemptId?: string;
  recordedAt: string;
}

export interface BuildStageProof {
  phaseRevision: string;
  worktreeFingerprint: string;
  acceptanceEvidence: string[];
  verifiedAt: string;
}

export interface ReviewStageProof {
  phaseRevision: string;
  worktreeFingerprint: string;
  reportLogicalName?: string;
  reportRevision?: string;
  verdict: "clean" | "actionable";
  verifiedAt: string;
}

export interface SaveStageProof {
  attemptId: string;
  runId?: string;
  receiptStatus: "attempted" | "complete" | "ambiguous";
  artifactRevisions: string[];
  verifiedAt?: string;
}

export interface CommitStageProof {
  baselineHead: string;
  expectedTree?: string;
  commitId?: string;
  closeoutApplied?: boolean;
  verifiedAt?: string;
}

export type StageProof =
  | BuildStageProof
  | ReviewStageProof
  | SaveStageProof
  | CommitStageProof;

export interface PhaseCheckpointState {
  order: number;
  logicalName: string;
  phaseRevision: string;
  phaseSha256: string;
  build?: BuildStageProof;
  review?: ReviewStageProof;
  save?: SaveStageProof;
  commit?: CommitStageProof;
}

export interface LoopCheckpoint {
  schemaVersion: 1;
  subjectId: string;
  branchRef: string;
  branchName: string;
  worktreeRoot: string;
  planLogicalName: string;
  planRevision: string;
  planSha256: string;
  phaseOrder: Array<{ order: number; logicalName: string; revision: string; sha256: string }>;
  completedPhaseCommits: Record<string, string>;
  currentPhaseOrder: number;
  currentPhaseLogicalName: string;
  currentStage: LoopStage;
  currentMilestone: Milestone;
  attemptId: string | null;
  jobHandle: string | null;
  blocker: BlockerRecord | null;
  phases: Record<string, PhaseCheckpointState>;
  updatedAt: string;
}

export interface StoredCheckpointRecord {
  revision: string;
  sha256: string;
  checkpoint: LoopCheckpoint;
}

export interface RunStateBackend {
  readRunState<T = unknown>(input: {
    cwd: string;
    subjectId: string;
    branchRef: string;
    logicalName: string;
    configPath?: string;
  }): Promise<{ revision: string; sha256: string; data: T } | null>;
  writeRunState<T = unknown>(input: {
    cwd: string;
    subjectId: string;
    branchRef: string;
    logicalName: string;
    data: T;
    expectedRevision: string | null;
    configPath?: string;
  }): Promise<{ revision: string; sha256: string; data: T }>;
}

export interface CheckpointBackend {
  read(input: {
    cwd: string;
    subjectId: string;
    branchRef: string;
    logicalName: string;
    configPath?: string;
  }): Promise<StoredCheckpointRecord | null>;
  write(input: {
    cwd: string;
    subjectId: string;
    branchRef: string;
    logicalName: string;
    checkpoint: LoopCheckpoint;
    expectedRevision: string | null;
    configPath?: string;
  }): Promise<StoredCheckpointRecord>;
}

export interface WriterLockOwner {
  ownerId: string;
  pid: number;
  pidStartTicks?: string;
  subjectId: string;
  branchRef: string;
  worktreeRoot: string;
  startedAt: string;
}

export interface StageContext {
  cwd: string;
  phase: PinnedPhase;
  stage: LoopStage;
  pinnedPlan: PinnedPlan;
  checkpoint: LoopCheckpoint;
  attemptId: string;
  bridges: ValidatedBridges;
  xdgConfigHome?: string;
}

export type StartingCheckResult =
  | { status: "dispatch"; jobHandle?: string }
  | { status: "already-finished" }
  | { status: "rewind"; targetStage: LoopStage; reason: string }
  | { status: "blocked"; reason: string; nextSafeAction: string };

export type WorkingRecoveryResult =
  | { status: "finished" }
  | { status: "retry" }
  | { status: "uncertain"; reason: string; nextSafeAction: string };

export type StageVerifyResult =
  | { status: "verified"; proof: StageProof; commitId?: string }
  | { status: "stale_or_missing"; reason: string; rewindTo?: LoopStage }
  | { status: "blocked"; reason: string; nextSafeAction: string; proof?: StageProof };

export interface StageAdapter {
  checkStarting?(ctx: StageContext): Promise<StartingCheckResult>;
  prepareStarting?(ctx: StageContext): Promise<void>;
  dispatchWorking(ctx: StageContext): Promise<{ jobHandle?: string | null; handle?: unknown }>;
  recoverWorking?(ctx: StageContext): Promise<WorkingRecoveryResult>;
  awaitFinished?(ctx: StageContext, dispatched: { jobHandle?: string | null; handle?: unknown }): Promise<void>;
  verifyResult(ctx: StageContext): Promise<StageVerifyResult>;
}

export type StageAdapters = Record<LoopStage, StageAdapter>;

export interface BuckLoopOptions {
  args?: string;
  subject?: string;
  cwd?: string;
  bridges?: EvalBridges;
  configPath?: string;
  xdgConfigHome?: string;
  checkpointBackend?: CheckpointBackend;
  runStateBackend?: RunStateBackend;
  stageAdapters?: Partial<StageAdapters>;
  isPidAlive?: (pid: number) => boolean;
}

export interface BuckLoopResult {
  ok: boolean;
  state: "pinned" | "blocked" | "done" | "yielded";
  subject?: string;
  branch?: string;
  message?: string;
  pinnedPlan?: PinnedPlan;
  phase?: string;
  stage?: LoopStage;
  milestone?: Milestone;
  blocker?: BlockerRecord | null;
  checkpointRevision?: string;
  completedPhaseCommits?: Record<string, string>;
}
