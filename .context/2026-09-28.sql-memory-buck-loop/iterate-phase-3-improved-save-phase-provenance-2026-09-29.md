---
status: completed
date: 2026-09-29
updated: 2026-09-29
subject: 2026-09-28.sql-memory-buck-loop
topics: [review, iteration, sql-memory, phase-provenance]
informs: []
addresses: phase-3-sql-save-truthful-completion.md
completed: 2026-09-29
from_review: b-review
---

# Iteration: Improved-save phase provenance

## Source
- Reviewed after: `/b-iterate`
- Phase: `phase-3-sql-save-truthful-completion.md`
- Baseline: `7705adf` plus staged Phase 3 changes on `feat/sql-memory-tool`

## Critical Issues

### 1. Improved save drops the active phase from SQL memory context
- **Files**: `extensions/b-save-improved/index.ts:693-708`; `extensions/buck-loop/sql-save.ts:60-68,209-216`
- **Problem**: `/b-save-improved` calls `prepareSaveAttempt(ctx.cwd, subject.name, reuse)` without the phase argument, which defaults to `null`. `saveSqlFacts` persists that null in `memories.context.phase` even for a phased subject. In a projected `saving` loop with a non-null phase, it also rotates the projected attempt instead of reusing it, so the supervisor rejects the receipt. Phase 3 requires subject/phase/source context in both save paths and attempt-bound postconditions.
- **Proposed fix**: Derive the active phase path from the authoritative subject/phase state (or the projected phase when explicitly resuming that same subject), pass it to `prepareSaveAttempt`, and fail closed if a projected save cannot match its attempt ID. Add a phased improved-save integration test that reads the stored context and verifies the projected receipt can be accepted; retain explicit null for unphased subjects.

## Warnings

- Full deployed-child `/buck-loop` proof remains Phase 4 scope. The focused disposable PostgreSQL save tests and durable guardrails passed, but do not exercise the phase-provenance path in `/b-save-improved`.

## Recommended Workflow

Start with `/b-iterate` against this artifact, then re-run `/b-review` against Phase 3. Do not treat the completed phase status as proof. The supervisor owns the next loop state.
