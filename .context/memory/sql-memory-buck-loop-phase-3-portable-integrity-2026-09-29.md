---
date: 2026-09-29
domains: [extensions, sql-memory, testing]
topics: [buck-loop, portable-save, correction-atomicity, receipts]
related: [../2026-09-28.sql-memory-buck-loop/iterate-phase-3-portable-save-integrity-2026-09-29.md]
priority: high
status: completed
subject: 2026-09-28.sql-memory-buck-loop
artifacts: [iterate-phase-3-portable-save-integrity-2026-09-29.md]
---

# Phase 3 portable-save integrity

## Decision and outcome

- Portable save children use the save-role `sql_memory` `correct` operation instead of separate SQL calls. The gated transaction claims an active predecessor within the directive project, inserts/reuses the source-key successor, and links it; failed links roll back both changes. Direct/recall roles cannot invoke it.
- Both portable instructions and the alternate save path require active same-project read-back of every ID before writing a rows receipt. A failed read-back leaves no receipt; supervisor also verifies it independently before commit.
- Shared SQL memory recall returned zero active matches for this project and subject; current phase and review artifacts governed the work. Deployed child/full loop proof remains Phase 4.

## Files Modified

- `extensions/sql-memory/index.ts`, `extensions/sql-memory/index.test.ts`, `extensions/buck-loop/sql-save.ts`, `extensions/buck-loop/__tests__/sql-save.test.ts`.
- `skills/b-save/SKILL.md`, `plugins/buck-workflow/skills/b-save/SKILL.md`, `docs/sql-memory.md`.
- Phase 3 portable iterate artifact, draft commit, this memory, and memory index.

## Verification

- Disposable PostgreSQL: `npx vitest run extensions/sql-memory/index.test.ts extensions/buck-loop/__tests__/sql-save.test.ts` — 18 passed, covering correction retry, superseded predecessor, rolled-back failed link, and missing read-back withholding a receipt.
- `npm run guardrails:check` — durable contract pass; unit pass, coverage 88.2% vs 84% baseline, complexity pass; lint/functional disabled.
