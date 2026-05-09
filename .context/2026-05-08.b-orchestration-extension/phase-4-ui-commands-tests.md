---
status: completed
phase: 4
order: 4
plan: plan-b-flow-mvp.md
phases_overview: plan-b-flow-mvp-phases.md
difficulty: medium
model_hint: capable general model; UI wiring and integration testing with moderate cross-module reasoning
buck_hint: /b-build
goal: "Wire confirmation UI, footer status, compaction hooks, and add integration tests"
files: [extensions/b-flow/index.ts, extensions/b-flow/ui.ts, extensions/b-flow/__tests__/integration.test.ts]
from_plan_steps: [13, 14, 15]
depends_on: [3]
dependency_type: HARD
acceptance_criteria:
  - "[ ] Confirmation UI prompts user before mutating transitions in guided mode"
  - "[ ] Autonomous mode skips confirmation when policy allows"
  - "[ ] Footer status widget shows current BuckState, active chunk, and queue progress"
  - "[ ] Compaction hook injects orchestration state summary into context before compaction"
  - "[ ] Integration test: /b-flow start → planning → decomposing → executingChunks → reviewing → saving → done"
  - "[ ] Integration test: worker failure → retry → block → user resolve → resume"
  - "[ ] Integration test: stale worker detected on startup → recovery → continue"
  - "[ ] All existing /b-* commands still work with b-flow extension loaded"
completed_at: null
completed_by: null
---

# Phase 4: UI, Commands & Tests

## Context

Phases 1-3 built the full machine, persistence, guards, and worker loop. This phase adds the user-facing surfaces — confirmation dialogs, status display, compaction integration — and validates everything with integration tests. This is the polish and verification phase.

## Implementation Details

### Step 13: Implement confirmation UI

Create `extensions/b-flow/ui.ts` or extend `index.ts`:

**Guided mode** (default):
- Before any mutating transition (planning → decomposing → executingChunks → reviewing → saving), show the user:
  - Current state and what's about to happen
  - The route action that will be taken
  - A confirmation prompt: `Proceed? [Y/n/edit]`
- `Y` or Enter → send `USER_CONFIRMED`
- `n` → send `USER_CANCELLED` (stays in current state or goes to `paused`)
- `edit` → allow user to modify the goal/parameters before proceeding

**Autonomous mode** (`/b-flow run --autonomous`):
- Skip confirmation for safe transitions
- Still block and ask for: high-risk chunks, blocked chunks, low-confidence classifier results
- Log all autonomous decisions to audit trail

Use the Pi `sendUserMessage` API for prompts and the TUI `SelectList` for option picking if needed. Follow the pattern from `b-grill-auto/` for interactive prompts.

### Step 14: Add footer status and compaction context injection

**Footer status widget**:

Register a Pi status widget that shows:
```
b-flow: executingChunks | Phase 2/4 (api-endpoints) | Worker: running | Queue: 3/7
```

Use the Pi extension API for status widgets (check existing `tmux-window-status.ts` and Pi extension docs for the widget API surface).

**Compaction hook**:

Register a compaction hook that injects a compact orchestration summary before context compaction occurs:

```markdown
## b-flow State Summary
- Goal: <goal>
- State: <currentState>
- Subject: <subject>
- Queue: <N>/<total> completed
- Last action: <last transition>
- Active worker: <pid or none>
- Projection: .context/workflow/orchestration.json
```

This ensures that after compaction, the supervisor still knows what's happening without re-reading all artifacts.

### Step 15: Tests

#### Unit tests (guards — if not already done in Phase 2):

```ts
// extensions/b-flow/__tests__/guards.test.ts
describe("guards", () => {
  test("hasPlan returns true when latestPlan exists", ...);
  test("hasPhasesOverview returns false when no phases file", ...);
  test("loopLimitReached returns true when loopCount >= maxLoops", ...);
  // etc.
});
```

#### Unit tests (queue builder):

```ts
// extensions/b-flow/__tests__/queue-builder.test.ts
describe("queue builder", () => {
  test("orders phases by number", ...);
  test("skips completed phases", ...);
  test("includes tasks.md unchecked items", ...);
  test("includes backlog items", ...);
});
```

#### Unit tests (verify result):

```ts
// extensions/b-flow/__tests__/verify-result.test.ts
describe("verifyResult", () => {
  test("marks completed when all criteria met", ...);
  test("marks completed_with_warnings when warnings present", ...);
  test("marks blocked when status is blocked", ...);
  test("handles malformed result file gracefully", ...);
});
```

#### Integration tests:

```ts
// extensions/b-flow/__tests__/integration.test.ts
describe("b-flow full lifecycle", () => {
  test("happy path: start → plan → decompose → execute → review → save → done", async () => {
    // 1. Create a test subject folder with a plan and 2 phases
    // 2. /b-flow start "test goal"
    // 3. Machine transitions: idle → recovering → planning → decomposing → executingChunks
    // 4. Worker executes phase 1 (can use a mock worker that writes result files)
    // 5. Worker executes phase 2
    // 6. Machine transitions: executingChunks → reviewing → saving → done
    // 7. Verify projection shows completed state
    // 8. Verify all audit files written
  });

  test("worker failure → retry → block → user resolve → resume", async () => {
    // 1. Start flow with a failing worker
    // 2. Worker fails, retry fires
    // 3. Second failure blocks the chunk
    // 4. User sends resolve event
    // 5. Flow resumes
  });

  test("stale worker detected on startup", async () => {
    // 1. Create projection with in-progress queue item
    // 2. Start b-flow (triggers recovery)
    // 3. Recovery detects stale worker (PID not alive)
    // 4. Marks chunk as failed, allows retry
    // 5. Flow continues
  });
});
```

#### Non-regression test:

```ts
describe("b-flow coexistence", () => {
  test("existing /b-* commands still work with b-flow loaded", () => {
    // Verify that /b-plan, /b-build, /b-save, etc. still register and run
    // b-flow should not interfere with existing commands
  });
});
```

### Wire everything together

Update `extensions/b-flow/index.ts` `wire()` function to:
1. Register `/b-flow` commands
2. Register footer status widget
3. Register compaction hook
4. Initialize machine on first `/b-flow start` call
5. Restore machine from snapshot on `/b-flow status` / `/b-flow continue` if snapshot exists

Update `extensions/index.ts` to import and wire b-flow.

## Risks

- **Integration test complexity**: Full lifecycle tests require mocking the worker subprocess. Use dependency injection so `runWorker` can accept a mock worker function in tests.
- **Footer widget API**: The Pi status widget API surface needs verification against current Pi docs. If the API differs, adapt accordingly.
- **Compaction hook timing**: The hook must fire before compaction happens. Verify the Pi compaction hook lifecycle.

## Verification

- `/b-flow start "test"` shows confirmation prompt in guided mode
- `/b-flow status` shows footer with current state
- Full lifecycle integration test passes
- Worker failure recovery integration test passes
- Stale worker recovery integration test passes
- Existing `/b-*` commands still register and work
