// ---------------------------------------------------------------------------
// b-flow — XState orchestration types
// ---------------------------------------------------------------------------

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
  | "spawningWorker"
  | "awaitingWorker"
  | "readingResult"
  | "verifyingChunk"
  | "completedChunk"
  | "completedWithWarnings"
  | "blockedChunk"
  | "queueExhausted"
  | "failed";

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
    activeIterate?: ArtifactRef;
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

export type RouteAction =
  | { type: "run-command"; command: string; prompt?: string }
  | { type: "spawn-worker"; state: BuckState; taskFile: string; mode: "build" | "review" | "save" }
  | { type: "ask-user"; question: string; options: string[] }
  | { type: "block"; reason: string; missing?: string[] }
  | { type: "retry"; reason: string; maxAttempts: number }
  | { type: "compact"; then: RouteAction }
  | { type: "new-session"; bootstrap: string; then: RouteAction }
  | { type: "mark-done"; reason: string };

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
