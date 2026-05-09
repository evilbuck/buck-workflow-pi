---
status: completed
phase: 3
order: 3
plan: plan-b-flow-mvp.md
phases_overview: plan-b-flow-mvp-phases.md
difficulty: hard
model_hint: strongest reasoning model; external worker subprocess, retry logic, result parsing, and queue management are complex and failure-sensitive
buck_hint: /b-build-hard
goal: "Implement the chunk queue machine, worker invocation, result verification, and retry/block policy"
files: [extensions/b-flow/chunk-queue-machine.ts, extensions/b-flow/worker.ts, extensions/b-flow/queue-builder.ts, extensions/b-flow/verify-result.ts]
from_plan_steps: [9, 10, 11, 12]
depends_on: [2]
dependency_type: HARD
acceptance_criteria:
  - "[ ] Queue builder scans phase files, tasks.md checkboxes, backlog items, and iterate bundles"
  - "[ ] Chunk queue child machine implements all 12 states from spec"
  - "[ ] runWorker actor spawns an external subagent process for one chunk"
  - "[ ] Worker result file contract enforced: .context/<subject>/worker-results/<timestamp>-<state>-<slug>.md"
  - "[ ] verifyResult actor parses worker result file and updates queue item status"
  - "[ ] Blocked chunks pause orchestration and ask user"
  - "[ ] Retry policy handles: runtime crash (retry once), format failure (retry stricter), verification failure (completed_with_warnings), user blocker (pause)"
  - "[ ] Worker audit files written per attempt"
  - "[ ] Parent machine correctly delegates to child machine during executingChunks"
  - "[ ] Stale worker detection on startup (recovers running workers that died)"
completed_at: null
completed_by: null
---

# Phase 3: Worker Loop & Verification

## Context

Phase 2 built the parent machine skeleton with guards and scanContext. This phase implements the "muscle" — the chunk queue child machine, worker spawning, result parsing, and the retry/block policy. This is the highest-risk phase because it involves external process management and failure recovery.

**Key design references**: spec sections on "Chunk definition", "Blocked chunk behavior", "Chunk completion", "Worker retry policy", and "Worker transport".

## Implementation Details

### Step 9: Implement queue builder

Create `extensions/b-flow/queue-builder.ts`:

The queue builder scans artifacts and produces `ChunkQueueItem[]`:

1. **Phase files**: Scan subject folder for `phase-N-*.md` files. Read frontmatter for status/difficulty. Add each non-completed phase as a chunk.
2. **tasks.md**: Parse the active subject's `tasks.md` for unchecked items. Each unchecked item becomes a chunk.
3. **Backlog items**: Read `.context/backlog/todo.md` for linked items. Each active item becomes a chunk.
4. **Iterate bundles**: Scan for `iterate-*.md` review-fix bundles. Each becomes a chunk.

Queue ordering:
1. Phases in order (phase 1, then 2, etc.)
2. Tasks after phases
3. Backlog items after tasks
4. Iterate bundles last

Return `ChunkQueueItem[]` sorted by execution priority.

### Step 10: Implement `runWorker` actor

Create `extensions/b-flow/worker.ts`:

This is the most complex actor. It:

1. Takes a `ChunkQueueItem` and spawns an external subagent process.
2. **Worker transport**: Use `pi --mode rpc` or equivalent subprocess invocation (this was an open decision in tasks.md; resolve during implementation by testing available transports).
3. Constructs a prompt for the worker containing:
   - The chunk's phase/task file path
   - The current goal and subject
   - Expected acceptance criteria from the chunk's frontmatter
   - Instructions to write a result file
4. Manages the subprocess lifecycle:
   - Capture stdout/stderr
   - Handle timeouts (configurable, default 10 minutes)
   - Handle process exit codes
5. On completion, sends `WORKER_COMPLETED` or `WORKER_FAILED` event.
6. Writes a worker audit file per attempt.

**Worker result file contract** (from spec):

```markdown
---
chunk_id: <id>
chunk_type: phase | task | backlog | iterate
status: completed | completed_with_warnings | failed | blocked
started_at: <timestamp>
completed_at: <timestamp>
worker_attempt: <N>
model_used: <model id or name>
changed_files: [list]
acceptance_criteria_met: [list of criteria that passed]
acceptance_criteria_missed: [list of criteria that failed, if any]
warnings: [list of warnings, if any]
---

# Worker Result: <chunk name>

## Summary
<one paragraph>

## What was done
<details>

## Verification
<details>
```

### Step 11: Implement `verifyResult` actor

Create `extensions/b-flow/verify-result.ts`:

This actor:

1. Reads the worker result file from disk.
2. Parses the frontmatter and body.
3. Cross-checks against the chunk's original acceptance criteria:
   - All criteria in `acceptance_criteria_met` → `completed`
   - Some criteria in `acceptance_criteria_missed` but warnings present → `completed_with_warnings`
   - Critical criteria missed or status `failed` → `failed`
   - Status `blocked` → `blocked`
4. Checks changed files against expected scope (from chunk frontmatter `files:` list).
5. Updates the queue item status in the projection.
6. Sends appropriate event back to the child machine.

### Step 12: Implement the chunk queue child machine

Create `extensions/b-flow/chunk-queue-machine.ts`:

```text
States: idle → buildingQueue → selectingNext → spawningWorker → awaitingWorker → readingResult → verifyingChunk → completedChunk | completedWithWarnings | blockedChunk → queueExhausted | failed
```

Key transitions:

```ts
const chunkQueueMachine = setup({
  types: { context: {}, events: {} },
  actors: { buildQueue, runWorker, verifyResult },
}).createMachine({
  id: "chunk-queue",
  initial: "idle",
  context: {
    queue: [] as ChunkQueueItem[],
    currentIndex: -1,
    currentItem: null,
    attemptCount: 0,
  },
  states: {
    idle: {
      on: { START_QUEUE: "buildingQueue" }
    },
    buildingQueue: {
      invoke: { src: "buildQueue" },
      on: {
        QUEUE_BUILT: { target: "selectingNext", actions: assign(/* set queue */) },
        QUEUE_EMPTY: "queueExhausted"
      }
    },
    selectingNext: {
      // Pick next pending item, skip completed
      always: [
        { guard: "hasNextPending", target: "spawningWorker" },
        { target: "queueExhausted" }
      ]
    },
    spawningWorker: {
      // Set currentItem, increment attemptCount
      invoke: { src: "runWorker" },
      on: {
        WORKER_COMPLETED: "readingResult",
        WORKER_FAILED: { target: "blockedChunk", guard: "maxRetriesReached" },
        WORKER_FAILED_RETRY: "spawningWorker"  // retry
      }
    },
    awaitingWorker: {
      // Timeout guard
      on: {
        WORKER_COMPLETED: "readingResult",
        WORKER_FAILED: "blockedChunk",
        TIMEOUT: "blockedChunk"
      }
    },
    readingResult: {
      invoke: { src: "verifyResult" },
      on: {
        CHUNK_VERIFIED: { target: "completedChunk", guard: "isCompleted" },
        CHUNK_WARNINGS: "completedWithWarnings",
        CHUNK_BLOCKED: "blockedChunk",
        CHUNK_FAILED: "blockedChunk"
      }
    },
    verifyingChunk: { /* alias or substate */ },
    completedChunk: {
      always: "selectingNext"  // loop back for next chunk
    },
    completedWithWarnings: {
      // Decide: continue or review based on policy
      always: [
        { guard: "requiresImmediateReview", target: "blockedChunk" },
        { target: "selectingNext" }
      ]
    },
    blockedChunk: {
      // Escalate to parent machine
      on: { RETRY: "spawningWorker", SKIP: "selectingNext" }
    },
    queueExhausted: { type: "final" },
    failed: { type: "final" }
  }
});
```

### Wire child machine into parent

Update `executingChunks` state in the parent machine to invoke the child machine:

```ts
executingChunks: {
  invoke: {
    src: chunkQueueMachine,
    onDone: { target: "reviewing" },
    onError: { target: "blocked" }
  }
}
```

### Retry policy implementation

```ts
function shouldRetry(chunk: ChunkQueueItem, error: WorkerError): { retry: boolean; strategy: string } {
  switch (error.type) {
    case "runtime_crash":
      return chunk.workerAttempts < 1 ? { retry: true, strategy: "same" } : { retry: false, strategy: "block" };
    case "format_failure":
      return chunk.workerAttempts < 1 ? { retry: true, strategy: "stricter_prompt" } : { retry: false, strategy: "block" };
    case "verification_failure":
      return { retry: false, strategy: "completed_with_warnings" };
    case "timeout":
      return chunk.workerAttempts < 2 ? { retry: true, strategy: "longer_timeout" } : { retry: false, strategy: "block" };
    case "user_blocker":
      return { retry: false, strategy: "pause" };
    default:
      return { retry: false, strategy: "block" };
  }
}
```

### Stale worker detection

On startup/recovery:
1. Check projection for any queue items with status `in-progress`.
2. Check if the worker PID/session is still alive.
3. If dead → mark as `failed` and allow retry.
4. If alive → ask user whether to wait or kill.

## Risks

- **Worker transport**: The subprocess/RPC transport is the biggest unknown. May need to test multiple approaches (`pi --mode rpc`, `spawn` with JSON protocol, etc.). Budget extra time.
- **Result parsing brittleness**: Workers may not always produce perfectly formatted result files. Parser should be resilient — fail closed but with clear error messages.
- **Stale worker detection**: Process management varies by OS. Keep detection simple (check PID alive) and escalate to user on ambiguity.
- **Retry loops**: Bad retry logic can loop forever. The `safety.maxLoops` and `safety.maxWorkerTasksPerRun` from `TransitionContext` must be enforced as hard limits.

## Verification

- Queue builder correctly identifies and orders chunks from a test subject folder with phase files.
- Worker spawns for a test chunk and writes a result file.
- verifyResult parses the result file and updates queue status correctly.
- Chunk queue machine transitions through all states for a 2-chunk test queue.
- Retry policy correctly blocks after max attempts.
- Stale worker detection identifies a killed process.
