---
status: completed
date: 2026-09-29
updated: 2026-09-29
subject: 2026-09-28.sql-memory-buck-loop
topics: [review, iteration, sql-memory, buck-loop]
informs: []
addresses: phase-1-tool-contract-child-seam.md
completed: 2026-09-29
from_review: b-review
---

# Iteration: Phase 1 child cleanup retry

## Source
- Reviewed after: `/b-iterate`
- Phase: `phase-1-tool-contract-child-seam.md`
- Plan: `plan-sql-memory-buck-loop.md`

## Critical Issues

### 1. Successful child work re-executes when disposal fails
- **File**: `extensions/buck-loop/run-step.ts:478-494,269-273`
- **Problem**: After `session.prompt()` completes with assistant text, an `unsubscribe()` or `session.dispose()` error changes `outcome` to failure, but `sqlFailed` stays false. The returned `{ retain: false, blockRetry: false }` makes `runStep` select another model and repeat already-performed build/save/commit side effects. Before the cleanup refactor, a disposal error after successful work returned immediately instead of retrying. The new cleanup tests cover pool shutdown and an already-failed prompt, but not a successful prompt followed by child disposal failure.
- **Proposed fix**: Preserve the failed result and independent cleanup attempts, but mark cleanup failure after completed work as non-retryable (without mislabeling it as SQL failure). Add a two-candidate regression where the first child finishes work and `dispose()` or `unsubscribe()` throws; assert the second child is never started and the result remains a failure. Retain provider-only fallback when no completed work occurred.
- **Resolution**: Record whether the prompt produced a successful result before cleanup. A later cleanup error still fails the stage and attempts all teardown, but blocks candidate fallback after completed work. Two-candidate unsubscribe/dispose regressions pass; provider failure fallback remains covered.

## Warnings

None.

## Recommended Workflow

Start with `/b-iterate` on this phase, then re-run `/b-review` against the same phase. Stage only the files modified by the iteration; other staged work predates this review.
