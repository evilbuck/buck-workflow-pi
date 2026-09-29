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

# Iteration: Phase 1 SQL failure must block

## Source
- Reviewed after: `/b-iterate`
- Phase: `phase-1-tool-contract-child-seam.md`
- Plan: `plan-sql-memory-buck-loop.md`

## Critical Issues

### 1. Failed SQL calls trigger model fallback rather than blocking
- **File**: `extensions/buck-loop/run-step.ts:404-407,454-457,268-271,489`
- **Problem**: `sqlMemoryTool` marks `sqlFailed`, so `runOneSession` returns a failed result with `retain: false`. `runStep` treats every `retain: false` as a model failure and selects another model. With two available models, a child can execute an SQL write and later encounter a denied query or DB error; the retry can succeed without SQL, and the configured loop advances despite the failure. Repeating a write on the retry can also duplicate effects. The Phase 1 criterion requires configured SQL tool/DB failures to block without fallback.
- **Proposed fix**: Distinguish SQL operation failure from retryable provider failure in `SessionAttempt` and return the SQL failure immediately from `runStep`, without invoking another model. Add a deterministic two-model regression case: the first child calls the scoped tool and receives an error; verify the second child is never created and the returned stage is failed. Preserve existing provider-error model fallback.

## Warnings

None.

## Recommended Workflow

Start with `/b-iterate` on this artifact, then re-run `/b-review` against the same phase. This review did not change application code.

## Resolution

- `runStep` returns the failed attempt immediately after a scoped SQL tool failure or SQL pool shutdown failure. Provider-only failures retain model fallback.
- Two-model regression verifies the denied SQL call never creates a second child; the pool-shutdown case also verifies no retry.
- `env -u SQL_MEMORY_URL npx vitest run extensions/buck-loop/__tests__/run-step.test.ts`: 29 passed. `env -u SQL_MEMORY_URL npm run guardrails:check`: durable pass; unit and coverage ratchet required gates pass, lint disabled.
