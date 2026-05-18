---
status: completed
phase: 3
order: 3
plan: plan-autonomous-b-flow-loop.md
phases_overview: plan-autonomous-b-flow-loop-phases.md
difficulty: hard
model_hint: "Strongest reasoning model available; this phase changes orchestration ownership, XState flow, persistence, and recovery projection."
buck_hint: /b-build-hard
goal: "Refactor the chunk queue actor into the per-phase lifecycle owner and persist active build/review/iterate/save projection state."
files: ["extensions/b-flow/chunk-queue-machine.ts", "extensions/b-flow/machine.ts", "extensions/b-flow/persistence.ts", "extensions/b-flow/types.ts", "extensions/b-flow/__tests__/machine.test.ts"]
from_plan_steps: [6, 7, 11]
depends_on: [1, 2]
dependency_type: HARD
acceptance_criteria:
  - "[x] chunk-queue-machine has explicit lifecycle states for selecting, boundary safety check, build, review, iterate, save, phase complete, blocked, and exhausted."
  - "[x] Deterministic routing handles build success, review pass, review issues with active iterate, review requires replan, iterate success, save success, and queue exhaustion."
  - "[x] Iteration count increments on review → iterate → review cycles and is persisted."
  - "[x] orchestration.json active projection updates after meaningful lifecycle transitions."
  - "[x] Recovery reconciliation uses phase frontmatter, worker results, worker audits, and projection state conservatively."
  - "[x] Lifecycle machine tests cover pass-through and iterate-loop happy paths."
completed_at: 2026-05-18
completed_by: pi
---

# Phase 3: Lifecycle Actor and Runtime Projection

## Context

This is the main architecture-touching phase. The existing generic worker queue flow becomes an explicit per-phase lifecycle actor that owns selection and build/review/iterate/save progression while the parent machine remains the coarse workflow owner.

## Implementation Details

1. In `extensions/b-flow/chunk-queue-machine.ts`, replace the generic `spawningWorker → readingResult → verifyingChunk → completedChunk` flow with explicit lifecycle states:
   - `selectingNext`
   - `checkingPhaseBoundarySafety`
   - `buildingPhase`
   - `reviewingPhase`
   - `iteratingPhase`
   - `savingPhase`
   - `phaseComplete`
   - `blockedPhase`
   - `queueExhausted`
2. Keep the parent `createBuckMachine` as the coarse workflow owner; the child lifecycle actor should report final queue/progress back to the parent.
3. Route deterministically:
   - build success → review;
   - review passed → save;
   - review requires replan → block;
   - review issues + active iterate → iterate;
   - iterate success → review;
   - save success → mark phase completed → next phase.
4. Increment iteration count on each `review → iterate → review` cycle.
5. In `extensions/b-flow/persistence.ts`, `machine.ts`, and lifecycle actor code, persist active step/iteration/progress after each meaningful transition.
6. Keep parent `executingChunks` as the coarse state while child `active.step` shows build/review/iterate/save.
7. Implement conservative recovery reconciliation:
   - phase file frontmatter wins for completed/not-completed;
   - worker result files reconcile completed attempts;
   - orphaned worker audits block with useful reasons;
   - stale projection without matching artifacts is corrected or blocked.
8. Add lifecycle tests for build → review pass → save → next phase and build → review issues → iterate → review pass → save.

## Risks

- XState actor persistence can become fragile if parent and child state disagree. Keep the persisted projection minimal and artifact-backed.
- This phase touches critical orchestration flow. Prefer small commits/checkpoints and targeted tests around each transition.
- Recovery logic can overreach. When uncertain, block with a useful reason rather than guessing success.

## Verification

Run lifecycle-focused tests first, then broader b-flow tests:

```bash
npm test -- extensions/b-flow/__tests__/machine.test.ts
npm test -- extensions/b-flow
```

Inspect generated or fixture `orchestration.json` state to confirm `active.step`, `iteration`, and result links match lifecycle transitions.
