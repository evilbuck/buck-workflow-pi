---
status: completed
date: 2026-05-08
subject: 2026-05-08.b-orchestration-extension
topics: [b-flow, xstate, orchestration, state-machine, subagents, guards]
type: technical-spec
priority: high
dependencies: [research-xstate-for-b-flow.md, plan-b-flow-mvp.md, grill-session-state-machine.md]
plans: [plan-b-flow-mvp.md]
memory: [b-orchestration-extension-2026-05-08.md, b-flow-mvp-2026-05-09.md, b-flow-start-debug-2026-05-09.md, b-flow-unit-tests-2026-05-09.md]
---

# Spec: b-flow XState Orchestration State Machine

## Goal

Design `/b-flow` as a durable XState-powered supervisor that can keep processing Buck workflow tasks across context limits by delegating decomposed chunks to isolated worker subagents outside the main Pi conversation context.

## Core Architecture

```text
Main Pi session: supervisor / control plane only
XState parent machine: workflow lifecycle + routing
Nested child machine: chunk queue lifecycle
Classifier model call: route recommendation only, no state mutation
External worker subagent: executes exactly one chunk per invocation
.context artifacts: durable source of truth
```

## Key Decisions From Grilling

1. **Progress model**: Hybrid.
   - Parent machine owns coarse workflow state.
   - Nested child machine owns chunk queue lifecycle.
   - Worker invocation is an attempt, not authoritative progress.
2. **Chunk definition**: One small independently executable unit of work.
   - `phase-N-*.md`
   - one `tasks.md` checkbox
   - one backlog item
   - one `iterate-*.md` review-fix bundle
3. **Blocked chunk behavior**: Pause and ask user by default.
4. **Chunk completion**: All evidence matters.
   - worker result status
   - task/phase artifact status
   - verification recorded/passing
   - changed files match expected scope
5. **Warnings**: `completed_with_warnings` is allowed; review catches remaining issues.
6. **Review timing**: Policy-based.
   - hard/high-risk chunks and warnings trigger immediate review
   - easy/medium independent chunks can wait until queue exhaustion
7. **Risk/independence evaluation**: Hybrid.
   - static metadata first
   - programmatic checks second
   - model guard only when ambiguous
   - user policy overrides defaults
8. **Classifier**: Separate direct SDK/model call, not main chat context.
9. **Classifier authority**: Routing recommendation only; supervisor mutates state.
10. **Worker transport**: External subagent process/RPC; classifier can use SDK directly.
11. **Classifier failure policy**:
    - invalid JSON → retry once
    - low confidence → ask user
    - unavailable → obvious safe programmatic route or block
12. **Audits**:
    - transition classifier decisions: inline summary + full audit JSON
    - worker attempts: inline summary + full audit JSON
13. **Worker retry policy**: Based on failure type.
14. **Parallelism**: Future yes, MVP serial, schema leaves room.
15. **Restart truth**: Layered recovery.
    - load XState snapshot
    - load orchestration projection
    - reconcile against artifacts
    - artifacts win
    - unsafe conflicts block and ask user
16. **Top-level state count**: Keep parent machine states limited to durable workflow/user-visible modes; scanning/routing/classifying are internal substates or invoked actors.
17. **Planning/decomposing execution location**: Hybrid.
    - guided/manual mode: main supervisor session for visibility
    - autonomous mode: external worker sessions, supervisor receives artifact summaries only
    - chunk execution stays external once chunks exist
18. **Threshold assessment**: Q20 grilling found the design cohesive around one state-machine concern; no separate design specs needed.

## Proposed Parent Machine

The first draft listed too many top-level states and mixed durable workflow modes with internal implementation steps. The corrected design keeps top-level states limited to modes that are meaningful to persist, resume, and show to the user.

### Top-level states

```text
idle
recovering
planning
decomposing
executingChunks
reviewing
saving
blocked
paused
done
aborted
```

### Why these states exist

| State | Reason to be top-level |
|---|---|
| `idle` | No active orchestration. |
| `recovering` | Startup/reload path that reconciles XState snapshot, projection JSON, workers, and artifacts. Durable because recovery can block. |
| `planning` | Runs/monitors `/b-plan`; produces or updates a plan artifact. |
| `decomposing` | Runs/monitors `/skill:b-phase` or task breakdown; produces chunk queue source. |
| `executingChunks` | Invokes the nested chunk queue machine; can run for many worker attempts. |
| `reviewing` | Runs review policy after chunks or high-risk/warning chunks. |
| `saving` | Runs `/b-save` and reconciles memory/backlog/spec/phase state. |
| `blocked` | Safe stop requiring user input or manual repair. |
| `paused` | User-requested pause; resumable. |
| `done` | Successful terminal state. |
| `aborted` | User/system-aborted terminal state. |

### Not top-level states

These are implementation details and should be nested/invoked within durable states:

| Internal step | Where it belongs |
|---|---|
| `initializing` | Command handler or entry action before `recovering`/`planning`. |
| `scanning` | Invoked actor inside `recovering` or a `decidingNext` substate. |
| `routing` | Pure guarded transition after scan/classifier result is in context. |
| `classifying` | Invoked actor only when deterministic guards are ambiguous. |
| `awaitingUser` | Substate of `blocked` or transition action that prompts user. |
| `reconciling` | Part of `recovering` and `saving`, not a standalone user-visible mode. |

### Nested active-state pattern

Most workflow states should share the same internal structure:

```text
<workflowState>
  ├─ scanningContext
  ├─ maybeClassifying
  ├─ running
  ├─ verifying
  └─ routingNext
```

This keeps the parent graph understandable while preserving the guard/action lifecycle.

## Proposed Child Chunk Queue Machine

```text
idle
buildingQueue
selectingNext
spawningWorker
awaitingWorker
readingResult
verifyingChunk
completedChunk
completedWithWarnings
blockedChunk
queueExhausted
failed
```

## Transition Context

Before routing, the supervisor builds a compact context snapshot from disk/runtime state:

```ts
interface TransitionContext {
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
```

## Route Action Types

```ts
type RouteAction =
  | { type: "run-command"; command: string; prompt?: string }
  | { type: "spawn-worker"; state: BuckState; taskFile: string; mode: "build" | "review" | "save" }
  | { type: "ask-user"; question: string; options: string[] }
  | { type: "block"; reason: string; missing?: string[] }
  | { type: "retry"; reason: string; maxAttempts: number }
  | { type: "compact"; then: RouteAction }
  | { type: "new-session"; bootstrap: string; then: RouteAction }
  | { type: "mark-done"; reason: string };
```

## Persistence Files

```text
.context/workflow/orchestration.json           # human-readable projection
.context/workflow/orchestration.snapshot.json  # XState persisted snapshot
.context/<subject>/transition-audits/*.json    # classifier/model routing audits
.context/<subject>/worker-audits/*.json        # worker attempt audits
.context/<subject>/worker-results/*.md         # semantic worker outcomes
```

## Grilling Boundary Assessment

The Q20 threshold assessment in `grill-session-state-machine.md` found the decisions cohesive:

- Parent/child machine structure
- Transition guards and classifier routing
- Worker lifecycle and audits
- Retry/block/recovery policy
- Top-level state shape

These are one technical design concern: `/b-flow` orchestration. Implementation may still be phased, but the design should remain in this single spec.

## MVP Constraints

- One worker at a time.
- Classifier can recommend only; no direct mutation.
- Worker transcripts do not enter main chat context by default.
- Main supervisor reads compact worker result files.
- On unsafe uncertainty: block and ask user.

## Acceptance Criteria

- `/b-flow start` creates projection and snapshot files.
- `/b-flow run` starts/resumes the XState actor.
- Parent machine invokes chunk queue machine when decomposed chunks exist.
- Chunk queue runs one external worker at a time.
- Worker result and audit files are written and parsed.
- Classifier audits are written when model routing is used.
- Restart/reload performs layered recovery and reconciles against artifacts.
- Blocked chunks pause orchestration and ask user.
