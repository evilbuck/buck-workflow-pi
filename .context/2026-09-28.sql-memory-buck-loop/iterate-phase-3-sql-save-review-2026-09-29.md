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
- Baseline: `7705adf` plus staged/unstaged working tree on `feat/sql-memory-tool`; Phase 3 status fields are not treated as proof.
- Shared SQL recall of this project's active rows returned zero matches for this review query; the phase and source remain authoritative.

## Critical Issues

### 1. Previous-cycle receipt can authorize a new saving transition
- **Files**: `extensions/buck-loop/loop.ts:303-312,600-607,615-635`, `extensions/buck-loop/sql-save.ts:15,169-180`, `extensions/buck-loop/persist.ts:156-176`
- **Problem**: The supervisor persists `saving` before preparing its new attempt. An interruption between these operations leaves the old global attempt and receipt readable. `reconcileSqlSave` verifies that old receipt and `confirmedResume` marks the new save complete without running the child. This violates the matching-attempt and stale-receipt criteria.
- **Proposed fix**: Project/persist a fresh attempt with the saving transition, then require its identity on resume. If no attempt belongs to the projected transition, restart the save rather than accepting a previous receipt. Cover a second cycle interrupted at this boundary.

### 2. SQL receipt precedes metadata apply and does not prove save completion
- **Files**: `extensions/buck-loop/loop.ts:615-635`, `extensions/buck-loop/sql-save.ts:120-127`, `extensions/b-save-improved/index.ts:688-729`
- **Problem**: The alternate save writes its receipt before `save-apply` updates metadata. If apply fails or the process exits after receipt but before apply, resume verifies SQL only and advances to commit. The matching SQL fact exists but the specified phase/spec/backlog/lifecycle work can be missing.
- **Proposed fix**: Complete metadata idempotently on resume or persist a separate completion marker after successful apply and require it plus current-attempt SQL read-back before committing. Test failure/crash between receipt and apply.

### 3. Alternate save bypasses the scoped sql_memory write surface
- **Files**: `extensions/buck-loop/sql-save.ts:93-104,331-341`, `extensions/b-save-improved/index.ts:688-700`
- **Problem**: The alternate entry point opens its own pool and executes SQL directly, without the `sql_memory` tool or stage policy. Parent plan scope requires `sql_memory` as the only PostgreSQL access surface.
- **Proposed fix**: Reuse the scoped SQL executor/tool policy for alternate saves; prove denial of a non-save-stage write at that entry point while preserving bound values and read-back.

### 4. Alternate save cannot supersede an existing active memory
- **Files**: `extensions/b-save-improved/index.ts:695-700`, `extensions/buck-loop/sql-save.ts:106-157`
- **Problem**: It accepts fact strings only. No old ID or correction action reaches `saveSqlFacts`, so it never inserts a successor and updates the old row's `invalid_at`/`superseded_by`. A correction through this entry point leaves contradictory active rows.
- **Proposed fix**: Carry an explicit correction request and project-verify its target, insert the successor, then invalidate only the old row's allowed columns. Exercise a disposable-DB correction and recall exclusion.

### 5. Portable non-OMP fallback is missing when SQL URL exists but tool does not
- **File**: `skills/b-save/SKILL.md:33-45`
- **Problem**: The skill chooses SQL mode solely from `SQL_MEMORY_URL` and fails on an unavailable `sql_memory` tool. The parent plan explicitly requires a visible file-mode fallback for a non-OMP harness without a callable tool even if the variable is present; the configured OMP loop must remain fail-closed.
- **Proposed fix**: Gate portable mode selection on tool callability outside configured OMP loop execution, document the availability note, and test both contexts.

### 6. Required guardrails fail in the configured SQL environment
- **Files**: `extensions/b-save-improved/__tests__/wire.test.ts:305`, SQL-mode test setup across save suites
- **Problem**: With this session's `SQL_MEMORY_URL` set, `npm run guardrails:check` returned `status: fail`: required unit gate failed (the wire golden parity expectation for a Markdown `memory` cross-reference is one reported failure); the coverage command exited 1, so the required global ratchet also failed. Without that variable, the same durable v2 contract passed: unit and ratchet pass, coverage 88 against baseline 84. This is an environment-dependent contract failure, not permission to silently switch the verification environment.
- **Proposed fix**: Make file-mode test fixtures explicitly select file mode and SQL-mode tests explicitly select SQL mode, then run the durable gate with SQL configured and unset. Preserve behavior tests; do not weaken gates or delete them.

## Warnings

### 1. Retry source key changes when a new attempt is prepared
- **Files**: `extensions/buck-loop/loop.ts:600-607`, `extensions/buck-loop/sql-save.ts:189-199,137-156`
- **Problem**: A retry calls `prepareSaveAttempt` again, generating a fresh `runId`; the source key includes that `runId`. A save which inserted a fact but failed after insert may insert a duplicate on retry. Existing retry coverage reuses the same attempt only.
- **Suggested approach**: Keep a stable run-scoped source key across retries while rotating the attempt ID. Test failure after insert followed by supervisor retry.

### 2. Deployed-child proof remains Phase 4 scope
- **File**: `phase-3-sql-save-truthful-completion.md:63-67`
- **Problem**: The existing disposable PG test is conditional on `SQL_MEMORY_TEST_URL`; no deployed OMP child exercising portable `b-save` was run in this review. Phase 4 explicitly owns the operator-facing live proof.
- **Suggested approach**: Exercise the restricted child and `/buck-loop` using only a disposable PostgreSQL target during Phase 4.

## Recommended Workflow

Route these in-plan defects to `/b-iterate`, then rerun `/b-review` against Phase 3. The completed phase frontmatter is not a substitute for the failing configured guardrails gate or a matching save-stage postcondition. Do not choose the supervisor's next loop state from this artifact.
