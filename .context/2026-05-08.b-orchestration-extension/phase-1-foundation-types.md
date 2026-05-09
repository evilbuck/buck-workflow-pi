---
status: completed
phase: 1
order: 1
plan: plan-b-flow-mvp.md
phases_overview: plan-b-flow-mvp-phases.md
difficulty: easy
model_hint: smaller/faster general model; mostly mechanical scaffolding
buck_hint: /b-build
goal: "Establish module skeleton, types, and persistence layer for b-flow"
files: [extensions/b-flow/index.ts, extensions/b-flow/types.ts, extensions/b-flow/persistence.ts, package.json]
from_plan_steps: [1, 2, 3, 4]
depends_on: []
dependency_type: NONE
acceptance_criteria:
  - "[ ] xstate v5 added as dependency in package.json"
  - "[ ] extensions/b-flow/ directory exists with index.ts, types.ts, persistence.ts"
  - "[ ] All types from spec defined: BuckState, TransitionContext, OrchestrationState, RouteAction, queue item types"
  - "[ ] persistence.ts exports read/write for orchestration.json and orchestration.snapshot.json"
  - "[ ] TypeScript compiles without errors"
  - "[ ] extensions/index.ts has a placeholder wire import for b-flow (can be no-op)"
completed_at: null
completed_by: null
---

# Phase 1: Foundation & Types

## Context

The spec (`spec-b-flow-state-machine.md`) defines the full architecture but nothing exists in code yet. This phase creates the module skeleton, type definitions, and persistence layer so that Phase 2 can build the XState machine on top of concrete types rather than `any`.

## Implementation Details

### Step 1: Add xstate dependency

```bash
npm install xstate
```

Or add to `package.json` dependencies if the project uses a different package manager.

### Step 2: Create `extensions/b-flow/` module

Create the directory and three initial files:

- `extensions/b-flow/index.ts` — entry point with `export function wire(api: ExtensionAPI)` (can be a no-op placeholder for now, just needs to compile)
- `extensions/b-flow/types.ts` — all type definitions
- `extensions/b-flow/persistence.ts` — read/write orchestration state

### Step 3: Define types in `types.ts`

Implement these types from the spec:

```ts
// Top-level parent machine states
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

// Child chunk queue states
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

// Transition context (from spec)
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

export interface ArtifactRef {
  path: string;
  exists: boolean;
  status?: string;
  modifiedAt?: string;
}

// Route action types (from spec)
export type RouteAction =
  | { type: "run-command"; command: string; prompt?: string }
  | { type: "spawn-worker"; state: BuckState; taskFile: string; mode: "build" | "review" | "save" }
  | { type: "ask-user"; question: string; options: string[] }
  | { type: "block"; reason: string; missing?: string[] }
  | { type: "retry"; reason: string; maxAttempts: number }
  | { type: "compact"; then: RouteAction }
  | { type: "new-session"; bootstrap: string; then: RouteAction }
  | { type: "mark-done"; reason: string };

// Orchestration projection (human-readable)
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

export interface ChunkQueueItem {
  id: string;
  type: "phase" | "task" | "backlog" | "iterate";
  path: string;
  status: "pending" | "in-progress" | "completed" | "completed_with_warnings" | "blocked" | "failed";
  difficulty?: "easy" | "medium" | "hard";
  workerAttempts: number;
  lastAttemptAt?: string;
  lastResultFile?: string;
}

// Machine context (for XState)
export interface BuckMachineContext {
  goal: string;
  subject: string | null;
  projection: OrchestrationState;
  transitionContext: TransitionContext | null;
  routeAction: RouteAction | null;
  activeWorkerPid: number | null;
  activeWorkerSessionId: string | null;
}

// Machine events
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
  | { type: "CHUNK_BLOCKED"; chunkId: string; reason: string }
  | { type: "QUEUE_EXHAUSTED" }
  | { type: "USER_CONFIRMED"; action: string }
  | { type: "USER_CANCELLED" }
  | { type: "USER_INPUT"; value: string }
  | { type: "SAVE_COMPLETE" }
  | { type: "REVIEW_COMPLETE"; passed: boolean; issuesFound: boolean; iterateFile?: string }
  | { type: "RECOVERY_COMPLETE"; context: TransitionContext }
  | { type: "RECOVERY_CONFLICT"; conflicts: string[] };
```

### Step 4: Implement persistence in `persistence.ts`

```ts
// Key functions to implement:
// - readProjection(projectRoot: string): OrchestrationState | null
// - writeProjection(projectRoot: string, state: OrchestrationState): void
// - readSnapshot(projectRoot: string): any | null
// - writeSnapshot(projectRoot: string, snapshot: any): void
// - ensureWorkflowDir(projectRoot: string): void
```

All writes should go to `.context/workflow/` under the project root. Create the directory if it doesn't exist.

### Step 5: Add placeholder wire to `extensions/index.ts`

Add an import and wire call for b-flow (can be a no-op for now):

```ts
import { wire as wireBFlow } from "./b-flow/index.js";
// ... in the main wire function:
wireBFlow(api);
```

## Risks

- Minimal risk — this phase is mechanical scaffolding.
- Type definitions may need adjustment once the state machine is built, but that's expected iteration.

## Verification

- `npx tsc --noEmit` passes (or equivalent TypeScript check)
- `extensions/b-flow/types.ts` exports all types listed above
- `extensions/b-flow/persistence.ts` can create `.context/workflow/` and round-trip a projection
