# Plan: Autonomous Buck Workflow → Buck Loop (Two-Phase Approach)

## What we're building

### Phase 1 (immediate): Autonomous Sub-Loop Inside b-Flow
An inner-loop state machine in the b-flow extension that can autonomously cycle through **build → review → iterate → re-review → save** within a single phase, using artifacts as the handoff protocol and a proper classifier to decide the next action.

### Phase 2 (deferred): Buck Loop Outer Orchestration
An outer loop that runs the autonomous b-flow across all phases of a multi-phase plan, detecting stagnation, checkpointing progress, and surfacing a dashboard.

Phase 2 depends on Phase 1 — without autonomous execution inside a phase, the outer loop can't advance anything.

---

## Phase 1: Autonomous Sub-Loop

### Why This Must Come First

Currently b-flow's `executingChunks` state runs a worker once, then jumps to `reviewing` and blocks. There's no autonomous cycle. The classifier stub only handles pre-execution routing (no plan → plan it, no phases → phase it). It cannot route post-execution decisions.

Without autonomous mode, no outer loop can advance through build → review → iterate → save — every step would block waiting for user input.

### What Needs Building

#### 1a. New XState States Inside `executingChunks`

Replace the flat `executingChunks → reviewing → saving` flow with an inner-loop sub-machine:

```
executingChunks (parent state)
│
├─ buildingPhase
│   └─ Spawn worker (b-build)
│   └─ On done: → reviewingPhase
│   └─ On error: → blockedPhase
│
├─ reviewingPhase
│   └─ Spawn worker (b-review)
│   └─ Read iterate-*.md artifact
│   └─ [no issues] → savingPhase
│   └─ [issues found] → iteratingPhase
│   └─ [max iterations exhausted] → blockedPhase
│
├─ iteratingPhase
│   └─ Spawn worker (b-iterate)
│   └─ On done: → reviewingPhase (re-check)
│   └─ [max 5 iterations] → blockedPhase
│
├─ savingPhase
│   └─ Spawn worker (b-save)
│   └─ On done: → phaseComplete → selectingNext (next phase)
│
├─ blockedPhase
│   └─ Escalate to user
│   └─ On USER_CONFIRMED: → buildingPhase or recovering
│
├─ phaseComplete
│   └─ Mark chunk done in queue
│   └─ → selectingNext (if more phases) or queueExhausted (if done)
```

#### 1b. Real Classifier / Router

Replace the stub `evaluateModelGuard()` with deterministic logic that reads artifacts and returns the next action:

```typescript
function decideNextStep(ctx: TransitionContext): RouteAction {
  const phase = ctx.artifacts.activePhase;
  
  // No build result yet → build
  if (!phase || phase.status === "pending")
    return spawnWorker("b-build", phase.path);
  
  // Build done, no review yet → review
  if (phase.status === "in-progress" && !ctx.artifacts.activeIterate)
    return spawnWorker("b-review", phase.path);
  
  // Review found issues → iterate
  if (ctx.artifacts.activeIterate?.exists && ctx.artifacts.activeIterate.status !== "completed")
    return spawnWorker("b-iterate", ctx.artifacts.activeIterate.path);
  
  // Iterate complete → review again
  if (ctx.artifacts.activeIterate?.status === "completed")
    return spawnWorker("b-review", phase.path);
  
  // Review clean → save
  if (ctx.review.passed)
    return spawnWorker("b-save", phase.path);
  
  // Fallback
  return block("Cannot determine next step");
}
```

#### 1c. Autonomous Mode Wiring

- Extend the existing `autonomous` mode (currently just `skipSafeTransitions: true`) to:
  - Auto-route through inner-loop states without blocking
  - Continue to next phase automatically when current phase completes
  - On max iterations → auto-escalate (block)
  - On stagnation → auto-escalate
- `/b-flow run --autonomous` triggers this mode
- `before_agent_start` injection shows current state and iteration progress

#### 1d. Guardrails

| Guard | Default | Behavior on hit |
|-------|---------|-----------------|
| Max iterations per phase | 5 | Block + escalate to user |
| Stagnation (no phase progress) | 3 consecutive failing iterations | Block + escalate |
| Git safety (uncommitted changes across phases) | Check before each phase transition | Block if uncommitted |

#### 1e. Dashboard / Progress

- **Tmux window status**: `buck: phase N (build|review|iterate|save) i3/5`
- **Orchestration JSON**: Add `iterations[]` to `ChunkQueueItem` for each pass through the inner loop
- **Session compaction**: Include inner-loop state summary

### Existing Assets (Reuse)

| Component | What to Reuse | Status |
|-----------|---------------|--------|
| `b-flow/machine.ts` | XState machine skeleton | Add new states inside executingChunks |
| `b-flow/worker.ts` | Spawns `pi -p` subprocess | Reuse as-is |
| `b-flow/scan-context.ts` | Reads artifacts, git state | Reuse — add iterate-*.md scanning |
| `b-flow/verify-result.ts` | Parses worker result files | Reuse as-is |
| `b-flow/guards.ts` | Guard functions | Add new guards (maxIterations, stagnation, etc.) |
| `b-flow/queue-builder.ts` | Builds queue from phase files | Reuse as-is |
| `b-flow/persistence.ts` | Reads/writes projection | Reuse — add iterations[] field |
| `b-flow/types.ts` | Types | Extend with inner-loop types |
| `extensions/index.ts` | `autonomous` mode flag | Extend — add auto-routing |
| `tmux-window-status.ts` | Tmux status bar | Extend for iteration count |

### What's New

1. Inner-loop XState states (`buildingPhase`, `reviewingPhase`, `iteratingPhase`, `savingPhase`, `blockedPhase`, `phaseComplete`)
2. Real classifier router (`decideNextStep()` that reads artifacts)
3. `iterations[]` field on `ChunkQueueItem` type
4. Autonomous mode auto-routing (no blocking on transitions)
5. Guardrails (max iterations, stagnation, git safety)
6. Tmux dashboard with iteration count
7. Iterate artifact awareness in scan-context

---

## Phase 2: Buck Loop (Deferred)

The Buck Loop from the original brainstorm — a wrapper around autonomous b-flow that:
- Runs across all phases of a plan
- Detects stagnation across multiple plan runs
- Provides a dashboard showing per-phase iteration history
- Supports `/b-flow stop --loop` cancellation

Phase 2 becomes significantly simpler once Phase 1 is complete: it's just an entrypoint that says "run autonomous b-flow, and when it finishes, check if all phases are done and re-run if not."

---

## Design Decision Log

| Question | Decision |
|----------|----------|
| Where does the inner loop live? | Inside b-flow's XState machine, as a sub-machine of `executingChunks` |
| How does it decide the next step? | Deterministic function reading artifacts (iterate-*.md, phase status, review result) |
| Modes? | Existing `--autonomous` flag extended; default guided mode unchanged |
| Max iterations per phase? | 5 — on exhaustion: block + escalate |
| What triggers the autonomous cycle? | `/b-flow run --autonomous` |
| Dashboard? | Tmux status bar + orchestration.json `iterations[]` |
| Does this change existing b-flow behavior? | No — guided mode continues as before; autonomous mode is opt-in |

## Open Questions (All Closed)

| Question | Decision | Evidence |
|----------|----------|----------|
| Should the inner loop handle no-plan scenarios? | **No — reuse existing b-flow routing.** The machine already handles this: `recovering → planning → [hasActivePhase? → executingChunks]` or `[hasPhasesOverview? → decomposing]` or `[neither → decomposing to create phases]`. The autonomous inner loop starts *after* phasing is decided. | `guards.ts` has `hasActivePhase`, `hasPhasesOverview`; `machine.ts` routes through all three paths before reaching `executingChunks` |
| How much context in `before_agent_start` digest? | **Summary digest with artifact links:** Current phase N, iteration M/5, step (build/review/iterate/save), previous iteration results (from `iterations[]`), links to phase file, plan overview, last result file, active iterate artifact. Extends what the existing b-flow `before_agent_start` hook already injects. |
