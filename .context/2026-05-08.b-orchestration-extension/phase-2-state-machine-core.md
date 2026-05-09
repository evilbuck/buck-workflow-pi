---
status: completed
phase: 2
order: 2
plan: plan-b-flow-mvp.md
phases_overview: plan-b-flow-mvp-phases.md
difficulty: medium
model_hint: capable general model; XState machine design requires careful reasoning
buck_hint: /b-build
goal: "Build the XState parent machine, scan/guard actors, and command registration skeleton"
files: [extensions/b-flow/machine.ts, extensions/b-flow/guards.ts, extensions/b-flow/scan-context.ts, extensions/b-flow/index.ts]
from_plan_steps: [5, 6, 7, 8]
depends_on: [1]
dependency_type: HARD
acceptance_criteria:
  - "[ ] XState parent machine defined with all 11 top-level states from spec"
  - "[ ] scanContext invoked actor reads artifacts, git diff, and worker results from disk"
  - "[ ] Pure XState guards implemented for deterministic routing (has plan, has phases, has active phase, etc.)"
  - "[ ] evaluateModelGuard placeholder exists (can be stub for MVP)"
  - "[ ] /b-flow command registered with start, run, continue, status, pause, resume, jump, stop subcommands"
  - "[ ] Machine transitions correctly from idle → planning when /b-flow start <goal> is called"
  - "[ ] Machine persists snapshot and projection after each transition"
  - "[ ] Unit tests for guards pass"
completed_at: null
completed_by: null
---

# Phase 2: State Machine Core

## Context

Phase 1 established the types and persistence layer. This phase builds the actual XState parent machine with its state graph, guards, and the scanContext actor. By the end of this phase, the machine should be able to start, scan the project context, and make routing decisions — but it won't yet execute workers or build queues.

## Implementation Details

### Step 5: Register `/b-flow` command

In `extensions/b-flow/index.ts`, use the Pi ExtensionAPI to register the `/b-flow` command with subcommands:

```
/b-flow start <goal>   → send START event with goal
/b-flow status          → read and display projection
/b-flow run             → send RESUME + CONTINUE
/b-flow continue        → send CONTINUE
/b-flow pause           → send PAUSE
/b-flow resume          → send RESUME
/b-flow jump <state>    → force transition (admin/debug)
/b-flow stop            → send STOP
```

The `wire(api)` function should register these commands and manage the XState actor lifecycle.

### Step 6: Implement `scanContext` invoked actor

Create `extensions/b-flow/scan-context.ts`:

This is an invoked actor that:
1. Scans `.context/` for artifacts:
   - Latest plan file in subject folders
   - Phases overview file
   - Active phase file (first non-completed phase)
   - `tasks.md` in active subject
   - Active iterate artifact
   - Latest memory file
   - Backlog items from `.context/backlog/todo.md`
   - Worker result files in `.context/<subject>/worker-results/`
2. Runs `git diff --stat` and `git status --porcelain` for git context
3. Builds a complete `TransitionContext` object
4. Sends `SCAN_COMPLETE` or `SCAN_FAILED` event back to the machine

The scan function should be deterministic and file-system based. No model calls here.

### Step 7: Implement pure XState guards

Create `extensions/b-flow/guards.ts`:

Implement guards as pure functions over `TransitionContext`:

```ts
// Example guards:
hasGoal(context): boolean           // goal is set
hasActiveSubject(context): boolean  // subject folder exists
hasPlan(context): boolean           // latestPlan artifact exists
hasPhasesOverview(context): boolean // phasesOverview artifact exists
hasActivePhase(context): boolean    // activePhase exists and status !== completed
hasQueueItems(context): boolean     // queue has pending items
allChunksCompleted(context): boolean
hasBlockedChunks(context): boolean
hasWarnings(context): boolean
requiresReview(context): boolean    // based on difficulty/warning policy
isHighRisk(context): boolean        // phase difficulty === hard or high-risk file patterns
hasGitChanges(context): boolean
onlyContextChanged(context): boolean
loopLimitReached(context): boolean
workerLimitReached(context): boolean
hasWorkerActive(context): boolean
```

Guards must be **synchronous and deterministic** — no async, no model calls, no side effects.

### Step 8: Implement `evaluateModelGuard` (stub for MVP)

Create `extensions/b-flow/classifier.ts`:

For MVP, this can be a stub that:
1. Returns a default safe route for all ambiguous cases
2. Logs a warning that the classifier is not yet implemented
3. Still writes audit records to `.context/<subject>/transition-audits/`

The stub interface should match what Phase 3 will need:

```ts
interface ClassifierResult {
  action: RouteAction;
  confidence: number;
  reason: string;
  evidence: string[];
}
```

### Build the parent machine

Create `extensions/b-flow/machine.ts`:

The XState v5 machine using `setup()` from Phase 1 types:

```ts
const buckMachine = setup({
  types: { context: {}, events: {} as BuckMachineEvent[] },
  guards: { /* import from guards.ts */ },
  actors: { scanContext, evaluateModelGuard },
}).createMachine({
  id: "buck-flow",
  initial: "idle",
  context: { /* default context */ },
  states: {
    idle: { on: { START: { target: "recovering" } } },
    recovering: {
      invoke: { src: "scanContext" },
      on: {
        SCAN_COMPLETE: { target: "planning", actions: assign(/* ... */) },
        SCAN_FAILED: { target: "blocked" }
      }
    },
    planning: {
      // entry: run b-plan or wait for plan artifact
      invoke: { src: "scanContext" },
      on: {
        SCAN_COMPLETE: [
          { guard: "hasPhasesOverview", target: "decomposing" },
          { guard: "hasActivePhase", target: "executingChunks" },
          { target: "decomposing" }
        ]
      }
    },
    decomposing: {
      // entry: run b-phase or task breakdown
      on: {
        CONTINUE: { target: "executingChunks" }
      }
    },
    executingChunks: {
      // delegate to child chunk queue machine
      // Phase 3 will flesh this out
      on: {
        QUEUE_EXHAUSTED: { target: "reviewing" },
        CHUNK_BLOCKED: { target: "blocked" }
      }
    },
    reviewing: {
      on: {
        REVIEW_COMPLETE: [
          { guard: "requiresReplan", target: "planning" },
          { target: "saving" }
        ]
      }
    },
    saving: {
      on: { SAVE_COMPLETE: { target: "done" } }
    },
    blocked: { on: { USER_CONFIRMED: { target: "recovering" } } },
    paused: { on: { RESUME: { target: "recovering" } } },
    done: { type: "final" },
    aborted: { type: "final" }
  },
  on: {
    PAUSE: { target: "paused" },
    STOP: { target: "aborted" }
  }
});
```

This is the skeleton — exact transition logic will be refined during implementation. The key is getting the state graph and guard wiring correct.

### Persistence on transition

After each transition, the machine should:
1. Update `OrchestrationState` projection with new state + history entry
2. Write updated projection to `.context/workflow/orchestration.json`
3. Persist XState snapshot to `.context/workflow/orchestration.snapshot.json`

## Risks

- XState v5 API details may require reference lookups (use `code_search` or existing research in `research-xstate-for-b-flow.md`)
- Guard naming must stay consistent between machine definition and guards module
- The machine graph is complex; recommend implementing transitions incrementally and testing after each batch

## Verification

- `/b-flow start "test goal"` transitions from idle → recovering → planning
- `/b-flow status` shows the current projection state
- Guards correctly identify whether a plan/phase/task exists on disk
- Snapshot and projection files are written after each transition
- Unit tests for individual guards pass
