---
status: completed
date: 2026-09-29
updated: 2026-09-29
subject: 2026-09-28.sql-memory-buck-loop
topics: [review, iteration, sql-memory, save-resume]
informs: []
addresses: phase-3-sql-save-truthful-completion.md
completed: 2026-09-29
from_review: b-review
---

# Iteration: Phase 3 SQL save postcondition

## Source
- Reviewed after: `/b-iterate`
- Phase: `phase-3-sql-save-truthful-completion.md`
- Baseline: `7705adf` plus the existing staged/unstaged Phase 3 implementation. Shared SQL recall returned zero active matches; source and phase files are the evidence.

## Critical Issues

### 1. Previous-cycle receipt can authorize an interrupted new save
- **Files**: `extensions/buck-loop/loop.ts:303-312,600-607,615-635`; `extensions/buck-loop/sql-save.ts:15,169-180`
- **Problem**: The loop persists `saving` before `prepareSaveAttempt` overwrites the global attempt. A crash between those operations lets resume verify the prior cycle's receipt and `confirmedResume` skip the new save. No attempt ID is bound to the projected save transition.
- **Proposed fix**: Bind and persist the attempt with the `saving` transition; on resume require that exact attempt. If it was never prepared, rerun the save, not the previous receipt. Test an interruption between transition persistence and child launch after a prior completed save.

### 2. Receipt-only resume skips interrupted metadata work
- **Files**: `extensions/buck-loop/loop.ts:615-635`; `extensions/b-save-improved/index.ts:688-729`; `extensions/buck-loop/sql-save.ts:120-127`
- **Problem**: The alternate path receipts SQL rows before `save-apply` changes phase/spec/backlog/lifecycle metadata. If apply fails or the process exits, receipt verification resumes directly to commit. SQL row persistence alone does not prove the save stage finished.
- **Proposed fix**: Persist a distinct completion marker only after successful metadata apply or replay metadata idempotently with the same source key. Require both metadata completion and SQL read-back for resume-to-commit; test apply failure and crash after receipt.

### 3. Alternate save bypasses sql_memory stage policy and cannot supersede
- **Files**: `extensions/buck-loop/sql-save.ts:94-104,137-157`; `extensions/b-save-improved/index.ts:688-700`
- **Problem**: `saveSqlFacts` opens its own pool and executes SQL without the `sql_memory` stage policy, despite the parent plan's sole SQL surface. Its input contains only strings and never carries a prior row ID, so `/b-save-improved` cannot invalidate a corrected memory.
- **Proposed fix**: Route alternate writes through the scoped SQL executor/tool policy and carry an explicit correction target. Verify its project, insert the successor, then update only `invalid_at` and `superseded_by`; test stage-policy denial and correction against disposable PostgreSQL.

### 4. Portable fallback still depends on URL alone
- **File**: `skills/b-save/SKILL.md:33-45`
- **Problem**: A non-OMP harness with `SQL_MEMORY_URL` set but no callable `sql_memory` tool is ordered to use SQL mode, then to fail rather than visibly using the portable file path. Configured OMP loop failures must still fail closed.
- **Proposed fix**: Select SQL in portable execution only when the tool is callable; issue an availability note and retain file mode otherwise. Preserve fail-closed configured OMP loop behavior; verify both paths.

### 5. Configured durable guardrails fail
- **File**: `extensions/b-save-improved/__tests__/wire.test.ts:305`
- **Problem**: `npm run guardrails:check` returned `status: fail`: unit gate fails on file-mode cross-reference expectation when SQL_MEMORY_URL is set; coverage command exits 1, so required global ratchet fails. The complexity gate passes and patch coverage is advisory. The prior review observed the same environment-dependent fixture issue.
- **Proposed fix**: Make file-mode fixtures explicitly select file mode and SQL-mode fixtures explicitly select SQL mode; run the durable contract both with SQL configured and unset. Do not weaken the gates.

## Warnings

### 1. New attempts rotate retry source keys
- **Files**: `extensions/buck-loop/sql-save.ts:189-199,137-156`; `extensions/buck-loop/loop.ts:600-607`
- **Problem**: A retry opens a fresh `runId`, which is part of `source_key`. A fact inserted before a later save-stage failure can be inserted again on retry. Current integration coverage reuses one attempt rather than retrying through the supervisor.
- **Suggested approach**: Preserve a stable run-scoped source key across attempts, rotate only attempt ID, and test failure after insert followed by retry.

### 2. Deployed OMP proof remains Phase 4
- **File**: `.context/2026-09-28.sql-memory-buck-loop/phase-4-policy-docs-live-proof.md`
- **Problem**: Current conditional disposable-DB test does not exercise the deployed child executing portable `b-save`; Phase 4 owns the operator-facing live proof. Do not treat this as Phase 3 verification.
- **Suggested approach**: Exercise the actual OMP child and `/buck-loop` against disposable PostgreSQL in Phase 4.

## Iteration evidence
- Attempt prepared before the projected saving transition; interrupted receipt without metadata completion now re-enters save rather than committing. A new cycle rotates run/attempt IDs; a retry retains the run source key.
- Alternate SQL writes use the save-scoped SQL executor; explicit `supersedes_id` checks the predecessor project before inserting the successor and invalidating the predecessor. Portable mode falls back to files when the SQL tool is unavailable outside a configured loop.
- Disposable PostgreSQL correction and interrupted-save scenarios passed. `npm run guardrails:check` passed with SQL configured and with the URL unset (unit, ratchet, complexity); patch advisory, functional/lint disabled. Deployed child proof remains Phase 4.

## Recommended Workflow

Start with `/b-iterate` against this artifact; rerun `/b-review` against Phase 3 afterward. Do not infer a pass from the phase status or completion checkboxes. The supervisor owns the next loop state.
