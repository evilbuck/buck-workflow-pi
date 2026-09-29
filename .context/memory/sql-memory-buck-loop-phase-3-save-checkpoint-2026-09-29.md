---
date: 2026-09-29
domains: [extensions, sql-memory, testing]
topics: [buck-loop, save-postcondition, fail-closed]
related: [../2026-09-28.sql-memory-buck-loop/phase-3-sql-save-truthful-completion.md]
priority: high
status: active
subject: 2026-09-28.sql-memory-buck-loop
artifacts: [../2026-09-28.sql-memory-buck-loop/phase-3-sql-save-truthful-completion.md, ../../extensions/buck-loop/scan.ts, ../../extensions/buck-loop/__tests__/scan.test.ts]
---

# SQL save checkpoint

## Result

Partial fail-closed correction: SQL-configured saves can no longer pass the supervisor's scan postcondition merely because `.context/memory/` changed. `scan()` now requires the explicit `sqlSaveVerified` signal in SQL mode; legacy file mode still confirms from a changed memory path. This signal is not wired to a receipt verifier yet, so SQL save currently remains ambiguous and cannot advance to commit. Phase 3 remains in progress and its acceptance criteria remain unchecked.

## Verification

- `npx vitest run extensions/buck-loop/__tests__/scan.test.ts`: 56 passed.
- `npm run guardrails:check`: failed. Existing unit gate failed in `loop.test.ts` resume scenario (expected `done`, received `blocked`, message `heavy lift: test default: heavy lift...`). Complexity gate also identified `scanWorkFacts` at 12; that added complexity was refactored into `savePostcondition`. Runner reported coverage command failure and global ratchet failure; patch coverage unknown. Guardrails were not re-run after the extraction.

## Remaining phase work

Receipt creation/read-back, attempt ID lifecycle, SQL save statements and corrections, no-fact probe/receipt, resume reconciliation, `b-save-improved` SQL-mode cutover, and supervisor receipt verification are not implemented here. Do not mark Phase 3 completed based on this checkpoint.
