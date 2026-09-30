---
date: 2026-09-29
domains: [extensions, database, testing]
topics: [sql-memory, buck-loop, model-fallback, iteration]
related: [../2026-09-28.sql-memory-buck-loop/iterate-phase-1-sql-failure-retry.md]
priority: high
status: completed
subject: 2026-09-28.sql-memory-buck-loop
artifacts: [iterate-phase-1-sql-failure-retry.md, draft-commit.md]
---

# SQL-failure retry iteration

## Decision

A configured SQL tool failure is a terminal stage failure, not a provider failure. The same applies to SQL pool shutdown. `runOneSession` returns a non-retryable signal for either, while provider-only failures remain eligible for model fallback. The session pointer in `.context/workflow/current-session.json` belongs to another subject and was left untouched.

## Files Modified

- `extensions/buck-loop/run-step.ts`
- `extensions/buck-loop/__tests__/run-step.test.ts`
- `.context/2026-09-28.sql-memory-buck-loop/iterate-phase-1-sql-failure-retry.md`, `.context/2026-09-28.sql-memory-buck-loop/draft-commit.md`
- `.context/memory/index.md`, this file

## Verification

- Regression failed before implementation: SQL denial retried the second candidate, ultimately returning `BuckModelStop` instead of `SqlMemoryError`.
- `env -u SQL_MEMORY_URL npx vitest run extensions/buck-loop/__tests__/run-step.test.ts`: 29 passed, including two-model SQL denial and pool-shutdown checks plus provider fallback.
- `env -u SQL_MEMORY_URL npm run guardrails:check`: durable pass; required unit, coverage ratchet, complexity gates passed; lint disabled.
- Test SQL URL points to `test.invalid`; denied SQL never connects. No shared database queried.

## Next

Re-run `/b-review` on Phase 1, then `/b-save` and `/b-commit` in the supervising loop. Review previously flagged optional values documentation impact for `/b-docs`.
