---
status: completed
date: 2026-09-18
updated: 2026-09-18
subject: 2026-09-18.buck-loop-extension
topics: [review, iteration]
informs: []
addresses: phase-5-loop-supervisor.md
completed: 2026-09-18
from_review: b-review
---

# Iteration: buck-loop loop supervisor

## Source
- Reviewed after: `/b-build-hard`
- Plan: `phase-5-loop-supervisor.md`
- Parent plan: `plan-buck-loop-extension.md`

## Critical Issues

### 1. Make real clean and documentation reviews produce artifact facts
- **File**: `extensions/buck-loop/loop.ts:178-199` (test seam: `extensions/buck-loop/__tests__/loop.test.ts:69-76`)
- **Problem**: `executeSkill()` discards `runStep()`'s review text and immediately rescans disk. The canonical `b-review` skill writes `iterate-*.md` only when it finds in-plan defects; on clean or documentation-impact reviews it returns the report to the caller and does not create `review-*.md`. The test double hides this integration gap by writing `review-clean.md` itself. In a real clean/docs run, `scanReviewFacts()` therefore remains `pending`, so the table blocks instead of routing to save or docs.
- **Proposed fix**: Establish a durable, structured review-result artifact as part of the nested review contract before the postcondition rescan, without letting unvalidated worker prose directly choose state. Update the supervisor test double to match that real contract rather than inventing an artifact unavailable in production, and cover clean plus docs routing through it.

### 2. Keep the built phase active through review, save, and commit
- **File**: `extensions/buck-loop/loop.ts:178-229` (test seam: `extensions/buck-loop/__tests__/loop.test.ts:141-156`)
- **Problem**: After a build marks phase 1 completed, `rescan()` adopts the scanner's newly selected `phasePath` immediately. With another pending phase, that is phase 2; with no remaining phase, it is `null`. The next `b-review` therefore receives phase 2 (or the whole plan) instead of the phase just built, and phase identity advances before commit. The current two-phase test checks only two build calls, not their ordering or the paths passed to review.
- **Proposed fix**: Preserve the current phase identity throughout its build → review → optional iterate/docs → save → commit cycle, and adopt the scanner's next incomplete phase only after the commit postcondition is confirmed. Extend the two-phase test to assert phase 1 is reviewed/saved/committed before phase 2 build starts and that each review receives the phase it follows.

### 3. Let a later resume confirm a previously blocked projection
- **File**: `extensions/buck-loop/loop.ts:106-119`
- **Problem**: `resumeRun()` reconciles a blocked projection and passes it straight to `drive()`, whose terminal check immediately returns `blocked`. The public API has no other confirmation command, even though the state contract reserves `USER_CONFIRMED: blocked → resolving` for the command layer. Once a run blocks, `/buck-loop --resume` can never restart it.
- **Proposed fix**: When the persisted projection was already `blocked` before this resume invocation, append and persist `userConfirmed()` and continue from `resolving`. Do not auto-confirm a new unsafe disagreement discovered during the same reconciliation; persist and return that block first. Add a blocked-then-resume test proving work restarts only on the later explicit resume.

### 4. Persist the actual diagnostic after the second work failure
- **File**: `extensions/buck-loop/loop.ts:178-199`
- **Problem**: `runStep()` returns failure detail in `result.text`, but `executeSkill()` discards it. After the retry also fails, the durable history contains only the generic table message (for example, `building session failed again after one retry`), not the thrown/empty/timeout diagnostic required by the phase contract.
- **Proposed fix**: Carry the failed step's returned diagnostic into the terminal blocked transition/history while retaining the table as the authority for retry-vs-block. Add an assertion that the second failure's diagnostic survives in both the returned reason and persisted history.

## Warnings

### 1. Exercise the per-phase iterate ceiling through the supervisor
- **File**: `extensions/buck-loop/__tests__/loop.test.ts:252-271`
- **Problem**: The focused supervisor suite covers `loopCount >= maxLoops` but never drives three iterate cycles on one phase, so the phase's second safety counter is not proven at the integration boundary.
- **Suggested approach**: Add a mocked review/iterate loop that reaches exactly three iterate cycles, asserts no later nested work launches, and checks the durable blocked reason and counter.

## Recommended Workflow

Start with `/b-iterate` — it will pick up this file automatically.
Then re-run `/b-review` against `.context/2026-09-18.buck-loop-extension/phase-5-loop-supervisor.md`.
Inside an OMP execution session, the iterate artifact is not done until it is completed, review passes, and `/b-save` has recorded durable state.
For larger rework, use `/b-build` or `/b-build-hard`.
