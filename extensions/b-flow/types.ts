// ---------------------------------------------------------------------------
// b-flow — XState orchestration types
// ---------------------------------------------------------------------------

// --- Autonomous loop worker modes ---

export type WorkerMode = "build" | "review" | "iterate" | "save";

export type BuckState =
  | "idle"
  | "recovering"
  | "planning"
  | "decomposing"
  | "executingChunks"
  | "reviewing"
  | "saving"
  | "blocked"
  | "paused"
  | "done"
  | "aborted";

export type ChunkQueueState =
  | "idle"
  | "buildingQueue"
  | "selectingNext"
  | "checkingPhaseBoundarySafety"
  | "buildingPhase"
  | "processingBuildResult"
  | "reviewingPhase"
  | "processingReviewResult"
  | "iteratingPhase"
  | "processingIterateResult"
  | "savingPhase"
  | "processingSaveResult"
  | "phaseComplete"
  | "blockedPhase"
  | "queueExhausted";

export interface ArtifactRef {
  path: string;
  exists: boolean;
  status?: string;
  modifiedAt?: string;
}

export interface TransitionContext {
  goal: string;
  current: BuckState;
  subject: string | null;
  artifacts: {
    latestPlan?: ArtifactRef;
    phasesOverview?: ArtifactRef;
    activePhase?: ArtifactRef;
    tasksMd?: ArtifactRef;
    activeIterate?: ArtifactRef & Partial<ActiveIterateMeta>;
    activeIterateConflict?: ActiveIterateConflict;
    memoryFile?: ArtifactRef;
    backlogItems: ArtifactRef[];
    workerResults: ArtifactRef[];
  };
  git: {
    hasDiff: boolean;
    changedFiles: string[];
    sourceFilesChanged: boolean;
    contextOnlyChanged: boolean;
  };
  review: {
    passed?: boolean;
    issuesFound?: boolean;
    requiresReplan?: boolean;
    iterateFile?: string;
  };
  worker: {
    active: boolean;
    lastStatus?: "completed" | "completed_with_warnings" | "failed" | "blocked";
    lastResultFile?: string;
  };
  safety: {
    loopCount: number;
    maxLoops: number;
    workerTasksThisRun: number;
    maxWorkerTasksPerRun: number;
  };
}

// --- Review result parsing types ---

export type ReviewOutcome =
  | "pass"
  | "issues-with-iterate"
  | "requires-replan"
  | "blocking";

export interface ReviewResult {
  outcome: ReviewOutcome;
  mode: WorkerMode;
  reviewPassed: boolean;
  issuesFound: boolean;
  requiresReplan: boolean;
  iterateFile?: string;
  issueFingerprint?: string;
  parseError?: string;
}

// --- Active iterate metadata ---

export interface ActiveIterateMeta {
  path: string;
  status: string;
  phase: string;
  iteration: number;
  sourceReviewResult?: string;
  issueFingerprint?: string;
}

export interface ActiveIterateConflict {
  files: string[];
  phase: string;
}

// --- Route actions ---

export type RouteAction =
  | { type: "run-command"; command: string; prompt?: string }
  | { type: "spawn-worker"; state: BuckState; taskFile: string; mode: WorkerMode }
  | { type: "ask-user"; question: string; options: string[] }
  | { type: "block"; reason: string; missing?: string[] }
  | { type: "retry"; reason: string; maxAttempts: number }
  | { type: "compact"; then: RouteAction }
  | { type: "new-session"; bootstrap: string; then: RouteAction }
  | { type: "mark-done"; reason: string };

export interface IterationRecord {
  iteration: number;
  startedAt: string;
  completedAt?: string;
  resultFile?: string;
  status: string;
  issueFingerprint?: string;
  changedFiles?: string[];
}

export interface ChunkQueueItem {
  id: string;
  type: "phase" | "task" | "backlog" | "iterate";
  path: string;
  status:
    | "pending"
    | "in-progress"
    | "completed"
    | "completed_with_warnings"
    | "blocked"
    | "failed";
  difficulty?: "easy" | "medium" | "hard";
  workerAttempts: number;
  lastAttemptAt?: string;
  lastResultFile?: string;
  iterations?: IterationRecord[];
  blockReasonHistory?: string[];
}

export interface ActiveOrchestration {
  chunkId: string;
  phasePath?: string;
  step: "build" | "review" | "iterate" | "save";
  iteration: number;
  maxIterations: number;
  workerPid?: number;
  lastResultFile?: string;
  issueFingerprint?: string;
}

export interface OrchestrationState {
  version: number;
  goal: string;
  currentState: BuckState;
  subject: string | null;
  startedAt: string;
  updatedAt: string;
  history: Array<{ from: BuckState; to: BuckState; at: string; reason: string }>;
  queue: ChunkQueueItem[];
  workerAttemptCount: number;
  lastWorkerStatus?: string;
  active?: ActiveOrchestration;
}

export interface BuckMachineContext {
  goal: string;
  subject: string | null;
  projection: OrchestrationState;
  transitionContext: TransitionContext | null;
  routeAction: RouteAction | null;
  activeWorkerPid: number | null;
  activeWorkerSessionId: string | null;
}

export type BuckMachineEvent =
  | { type: "START"; goal: string }
  | { type: "RESUME" }
  | { type: "PAUSE" }
  | { type: "STOP" }
  | { type: "CONTINUE" }
  | { type: "SCAN_COMPLETE"; context: TransitionContext }
  | { type: "SCAN_FAILED"; error: string }
  | { type: "ROUTE_DECIDED"; action: RouteAction }
  | { type: "CLASSIFIER_RESULT"; action: RouteAction; confidence: number; reason: string }
  | { type: "CLASSIFIER_FAILED"; error: string }
  | { type: "WORKER_COMPLETED"; resultFile: string; status: string }
  | { type: "WORKER_FAILED"; error: string; exitCode?: number }
  | { type: "CHUNK_VERIFIED"; chunkId: string; status: string }
  | { type: "CHUNK_WARNINGS"; chunkId: string; warnings: string[] }
  | { type: "CHUNK_BLOCKED"; chunkId: string; reason: string }
  | { type: "CHUNK_FAILED"; chunkId: string; reason: string }
  | { type: "QUEUE_EXHAUSTED" }
  | { type: "QUEUE_BUILT"; queue: ChunkQueueItem[] }
  | { type: "QUEUE_EMPTY" }
  | { type: "USER_CONFIRMED"; action: string }
  | { type: "USER_CANCELLED" }
  | { type: "USER_INPUT"; value: string }
  | { type: "SAVE_COMPLETE" }
  | { type: "REVIEW_COMPLETE"; passed: boolean; issuesFound: boolean; iterateFile?: string }
  | { type: "RECOVERY_COMPLETE"; context: TransitionContext }
  | { type: "RECOVERY_CONFLICT"; conflicts: string[] };
