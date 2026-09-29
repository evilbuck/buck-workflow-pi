---
date: 2026-09-29
domains: [extensions, sql-memory, testing]
topics: [buck-loop, correction-atomicity, save-attempt-projection]
related: [../2026-09-28.sql-memory-buck-loop/iterate-phase-3-correction-and-attempt-binding-2026-09-29.md]
priority: high
status: completed
subject: 2026-09-28.sql-memory-buck-loop
artifacts: [iterate-phase-3-correction-and-attempt-binding-2026-09-29.md]
---

# Phase 3 correction and attempt binding

## Decisions and result

- Corrections use one gated transaction: claim an active predecessor by project, insert/reuse the successor, then link `superseded_by`; a failed link or insert rolls back the claim and successor. An already invalidated target only accepts an existing same-run successor already linked to it.
- Persist the expected save-attempt ID in the loop projection before running the save. Both live postcondition and resume compare it to the current attempt; an unrelated later save cannot authorize the projected transition. A mismatch blocks rather than borrowing a receipt.
- Shared-memory recall returned zero active project matches; phase/review and source remained authoritative.

## Files Modified

- `extensions/sql-memory/index.ts`; `extensions/buck-loop/sql-save.ts`, `types.ts`, `persist.ts`, `loop.ts`; `extensions/buck-loop/__tests__/sql-save.test.ts`, `loop.test.ts`.
- `docs/sql-memory.md`; Phase 3 correction iterate artifact and draft commit; this memory and index.

## Verification

- Disposable PostgreSQL integration: correction retry, rejection of an already-superseded target without an orphan, injected link-update error with transaction rollback. Loop resume test rejects a later no-fact receipt for an earlier projected attempt.
- Focused Vitest: 79 passed across sql-save, loop, persist tests.
- Durable `npm run guardrails:check`: pass; unit pass, coverage 88.2% against 84% baseline, complexity pass; lint and functional gates disabled.
- `npx tsc --noEmit` remains failing with unrelated repo-wide diagnostics (including pre-existing test-fixture types); no new error observed in the changed runtime modules.
