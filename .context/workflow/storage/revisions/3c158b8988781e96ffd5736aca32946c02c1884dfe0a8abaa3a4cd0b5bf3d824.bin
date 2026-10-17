---
status: completed
date: 2026-09-29
updated: 2026-09-29
subject: 2026-09-28.sql-memory-buck-loop
topics: [review, iteration, sql-memory, save-postcondition]
informs: []
addresses: phase-3-sql-save-truthful-completion.md
completed: 2026-09-29
from_review: b-review
---

# Iteration: Phase 3 correction integrity and save-attempt binding

## Source
- Reviewed after: `/b-iterate`
- Phase: `phase-3-sql-save-truthful-completion.md`
- Baseline: `7705adf` plus staged/unstaged Phase 3 implementation; review of current code, not completed status fields.
- Shared-memory recall supplied by the supervisor returned zero active matches; source and phase files were used.

## Critical Issues

### 1. A failed correction leaves an active successor without invalidating its predecessor
- **Files**: `extensions/buck-loop/sql-save.ts:151-180,190-209`; `extensions/sql-memory/index.ts:21-46,48-53`
- **Problem**: `storeCorrectedFact` checks only that the old ID belongs to the project, inserts an active successor, then tries to invalidate the old row. Each `sqlMemoryRows` call opens and commits its own transaction. When the old row was already superseded, or the update fails after the insert, the function throws but the new row remains active without a receipt. Subsequent recall can surface the invalid correction as a fact. Retry deduplication can reuse the orphan by source key, so the failed correction cannot cleanly recover.
- **Proposed fix**: Make successor insertion and predecessor invalidation one atomic correction operation using the existing gated SQL surface; require an active project-matching predecessor, and roll back the new row if invalidation fails. Preserve same-run retry behavior when the predecessor already points to this successor. Add a disposable-PostgreSQL regression test for an already-invalidated target and an update failure; assert neither leaves a new active row.

### 2. The supervisor has no persisted identity for the save attempt it verifies
- **Files**: `extensions/buck-loop/loop.ts:303-318,338-342,640-658`; `extensions/buck-loop/sql-save.ts:17,58-67,223-233`; `extensions/b-save-improved/index.ts:693-707`
- **Problem**: Preparing an attempt before persisting `saving` fixed the old crash gap, but the projection contains no attempt ID. `verifySqlSave` reads the mutable global `.context/workflow/sql-save-attempt.json`, not an ID bound to the projected save transition. A separate SQL save on the same subject after that transition (for example `/b-save-improved` while the projection is `committing`, which prepares a new attempt) can replace the pointer and finish a different receipt. On resume, the loop may accept that receipt as the prior save's proof; it cannot establish the contract's matching-attempt invariant.
- **Proposed fix**: Persist the expected attempt ID in the saving/committing projection, carry it across resume and retry transitions, and verify the receipt against that ID rather than accepting the current global pointer. Exercise an interrupted projected save followed by a second completed save on the same subject: the second receipt must not authorize the first transition.

## Warnings

### 1. Remove a dead helper introduced with the save module
- **File**: `extensions/buck-loop/sql-save.ts:336-338`
- **Problem**: `secretKey()` duplicates the immediately preceding `hasSecretKey()` and has no callers. The independent standards pass identified this as newly added dead code.
- **Suggested approach**: Delete `secretKey()`; keep the single used check.

### 2. Deployed OMP end-to-end proof is reserved for Phase 4
- **File**: `phase-4-policy-docs-live-proof.md:22-27`
- **Problem**: The focused disposable-PostgreSQL suites and guardrails pass, but this review did not exercise an actual deployed OMP child performing the portable save and subsequent `/buck-loop` commit. Phase 4 owns that full proof; do not treat Phase 3 unit/integration tests as the deployed proof.
- **Suggested approach**: Run the deployed child/loop against the disposable PG target during Phase 4.

## Verification
- `env -u SQL_MEMORY_URL npm run guardrails:check`: durable v2 pass; unit and global ratchet pass (88.1% vs 84%), complexity pass, patch advisory, functional and lint skipped.
- `env -u SQL_MEMORY_URL npx vitest run extensions/buck-loop/__tests__/sql-save.test.ts extensions/buck-loop/__tests__/loop.test.ts skills/b-save-improved/scripts/save-apply.test.ts`: 88 tests passed in 3 files, including the conditional disposable SQL tests. The two critical failure scenarios above have no regression coverage yet.

## Resolution
- Correction claims the active predecessor, inserts the successor, and links it in one gated PostgreSQL transaction; failures roll back both updates and inserts. Already-superseded targets reject new successors; same-attempt retries return the linked successor.
- The projected `saving`/`committing` state carries the expected attempt ID. Resume and post-save verification reject a different global attempt pointer; old projections without an ID cannot borrow a later receipt.
- Removed the unused `secretKey()` helper.
- Disposable PostgreSQL regression exercises invalid targets, injected update failure/rollback, and retry; a resume regression rejects a later no-fact receipt. Focused suite: 79 passed. Durable guardrails: pass (unit, coverage ratchet, complexity); lint and functional disabled. `npx tsc --noEmit` reports existing repository-wide errors, including prior test fixture typing errors.

## Recommended Workflow

Start with `/b-iterate` against this file, then re-run `/b-review` against Phase 3. The supervisor, not this review, chooses the next loop state.
