---
status: completed
date: 2026-09-29
updated: 2026-09-29
subject: 2026-09-28.sql-memory-buck-loop
topics: [review, iteration, sql-memory, resume]
informs: []
addresses: phase-3-sql-save-truthful-completion.md
completed: 2026-09-29
from_review: b-review
---

# Iteration: Phase 3 save-attempt and resume gate

## Source
- Reviewed after: `/b-iterate`
- Phase: `phase-3-sql-save-truthful-completion.md`
- Plan: `plan-sql-memory-buck-loop.md`
- Baseline: `7705adf` plus staged and unstaged Phase 3 work on `feat/sql-memory-tool`

## Critical Issues

### 1. A previous save receipt can authorize a later save before its attempt exists
- **Files**: `extensions/buck-loop/loop.ts:303-312,600-607,615-635`; `extensions/buck-loop/sql-save.ts:15,169-180,189-199`; `extensions/buck-loop/persist.ts:156-176`
- **Problem**: The supervisor persists `saving` before `openSqlSave` generates an attempt. If a prior cycle on this subject left the global `.context/workflow/sql-save-attempt.json` and its valid receipt, a crash at this boundary resumes `saving` and `verifySqlSave` checks the *previous* attempt. `confirmedResume` then treats the new save as complete and proceeds to commit without launching it. This violates the matching-attempt/stale-receipt and truthful-resume criteria.
- **Proposed fix**: Bind an attempt ID to the projected save transition before persisting `saving`, or persist the new attempt atomically with that transition. On resume, require that exact projected attempt ID; absence must launch a fresh save, never accept the prior cycle's receipt. Test a second save cycle interrupted between transition persistence and child launch.

### 2. Receipt-only resume skips failed or interrupted metadata work
- **Files**: `extensions/buck-loop/loop.ts:615-635`; `extensions/buck-loop/sql-save.ts:120-127`; `extensions/b-save-improved/index.ts:688-716`
- **Problem**: SQL facts are receipted before `b-save-improved` applies subject, plan/spec, backlog, and lifecycle metadata. A crash, apply failure, or DB read-back outage at this boundary leaves a valid receipt but unfinished file work. `confirmedResume` marks `saving` successful from receipt+rows alone, and `saving-confirmed-commit` can commit without ever finishing the metadata. A receipt proves SQL persistence, not the whole save stage.
- **Proposed fix**: Persist a separate save-stage completion marker only after metadata succeeds (or replay idempotent metadata on resume). Require both that marker and current-attempt SQL read-back to advance; missing marker resumes the save stage using the same source key. Add crash-after-receipt/before-apply and apply-failure resume coverage.

### 3. Portable save has no missing-tool file fallback when the URL is set
- **File**: `skills/b-save/SKILL.md:33-45`
- **Problem**: The skill selects SQL mode from `SQL_MEMORY_URL` alone and treats an unavailable `sql_memory` tool as a failed save. The plan's portable acceptance criterion requires non-OMP harnesses without a callable tool to retain the file path with a visible availability note even if that variable exists. SQL-configured OMP loops must still fail closed on tool/database failure.
- **Proposed fix**: Make the portable skill's mode selection explicitly depend on tool callability outside the OMP SQL-configured loop, document the visible fallback, and keep the loop's fail-closed path. Verify both contexts.

### 4. Alternate save writes through a second, ungated PostgreSQL surface
- **Files**: `extensions/buck-loop/sql-save.ts:94-104,331-341`; `extensions/b-save-improved/index.ts:688-700`
- **Problem**: `/b-save-improved` calls `createLazyPool(url)().query(...)` directly, bypassing the `sql_memory` tool and its stage-scoped gate. The plan explicitly limits PostgreSQL access to the existing `sql_memory` surface (`plan-sql-memory-buck-loop.md:29-33`), and the save stage policy does not constrain these direct writes. This makes the alternate path inconsistent with the declared write boundary.
- **Proposed fix**: Route alternate saves through the existing scoped SQL executor/tool policy rather than an independent raw-pool query path. Preserve bound parameters and subject receipt read-back; test stage-policy denial on the alternate entry point.

### 5. Alternate save cannot represent a correction
- **Files**: `extensions/b-save-improved/index.ts:695-700`; `extensions/buck-loop/sql-save.ts:106-157`
- **Problem**: The alternate save accepts only new fact strings and emits ordinary inserts/reused IDs. There is no input carrying the invalidated row ID and no successor insertion plus `invalid_at`/`superseded_by` update; the phase's correction criterion exists only as portable skill prose. A corrected fact saved through `/b-save-improved` leaves the old active row in recall.
- **Proposed fix**: Give the alternate save a deliberate correction representation and perform successor insertion followed by an immutable-safe invalidation update, verifying the old ID belongs to the same project; add a disposable-database correction test.

## Warnings

### 1. Full deployed-child proof is still pending
- **Files**: `phase-3-sql-save-truthful-completion.md:63-67`; `extensions/buck-loop/__tests__/sql-save.test.ts:133-162`
- **Problem**: The existing disposable PostgreSQL test is conditional on `SQL_MEMORY_TEST_URL`. The previous iteration records disposable save proof, but this review did not observe an actual deployed OMP child running the portable SQL save instruction. The full operator-facing path is explicitly Phase 4 scope, not a new Phase 3 defect.
- **Suggested approach**: Exercise the deployed child and `/buck-loop` in Phase 4 with the disposable PG target; retain the SQL row and blocked/committed state evidence.

## Recommended Workflow

Start with `/b-iterate` against this file, then re-run `/b-review` against the same Phase 3 contract. Do not treat the completed status field as proof. Durable guardrails passed on this review, but the resume boundary remains unverified by the current tests.
