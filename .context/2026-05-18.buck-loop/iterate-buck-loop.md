---
status: completed
date: 2026-05-18
updated: 2026-05-18
subject: 2026-05-18.buck-loop
topics: [review, iteration]
informs: []
addresses: phase-3-lifecycle-projection.md
completed: 2026-05-18
from_review: b-review
---

# Iteration: buck-loop

## Source
- Reviewed after: `/b-build-hard`
- Plan: `plan-autonomous-b-flow-loop.md`
- Phase: `phase-3-lifecycle-projection.md`
- Spec: none

## Critical Issues

### 1. Recovery can skip pending review/iterate/save work and block on stale prior-step results
- **File**: `extensions/b-flow/chunk-queue-machine.ts`
- **Problem**: When the machine transitions `build -> review`, `review -> iterate`, or `review -> save`, it updates `currentMode` but keeps the previous step's `currentResultFile` and `lastVerification`. The recovery guards (`hasRecoveredReviewResult`, `hasRecoveredIterateResult`, `hasRecoveredSaveResult`) only check `currentMode` plus `lastVerification`, so a restart between states can incorrectly treat an old build/review result as proof that the next step already finished. Reproduction: resuming with `active.step = review` and `lastResultFile = <build-result>` immediately lands in `blockedPhase` without running the review worker; resuming with `active.step = save` and `lastResultFile = <review-result>` also blocks before the save worker runs.
- **Proposed fix**: Clear `currentResultFile` and `lastVerification` whenever advancing into a new worker mode that has not run yet, or persist enough step-specific metadata to distinguish "entered step" from "completed step". Add regression tests for recovery at the boundaries before review, iterate, and save worker execution.

## Warnings

### 1. Boundary reconciliation re-runs the same mutating helper multiple times in one entry action
- **File**: `extensions/b-flow/chunk-queue-machine.ts`
- **Problem**: `checkingPhaseBoundarySafety` calls `reconcileCurrentItem(...)` separately for each assigned field. The helper mutates queue state via `replaceCurrentItem`, so repeated calls are harder to reason about and make future recovery changes risky.
- **Suggested approach**: Compute reconciliation once, store the result, then assign fields from that single snapshot.

## Recommended Workflow

Start with `/b-iterate` — it will pick up this file automatically.
For larger rework, use `/b-build-hard`.
