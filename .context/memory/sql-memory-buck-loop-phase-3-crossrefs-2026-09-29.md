---
date: 2026-09-29
domains: [extensions, sql-memory, testing]
topics: [buck-loop, sql-save, cross-references]
related: [../2026-09-28.sql-memory-buck-loop/iterate-phase-3-sql-crossrefs-2026-09-29.md]
priority: high
status: completed
subject: 2026-09-28.sql-memory-buck-loop
artifacts: [iterate-phase-3-sql-crossrefs-2026-09-29.md]
---

# Phase 3 SQL cross-reference repair

## Decision and outcome

- A non-`memory` cross-reference key takes precedence over historical `**memory:**` body style. SQL save writes `sql_memory_ids` into frontmatter and leaves the old Markdown link intact. File-mode `memory` references retain the legacy behavior.
- Shared SQL recall succeeded with zero active project matches; review artifact and phase supplied the requirements.

## Files Modified

- `skills/b-save-improved/scripts/save-apply.ts`, `skills/b-save-improved/scripts/save-apply.test.ts`.
- `iterate-phase-3-sql-crossrefs-2026-09-29.md`, `draft-commit.md`, this memory and memory index.

## Verification

- `npx vitest run skills/b-save-improved/scripts/save-apply.test.ts`: 27 passed, including a disposable PostgreSQL SQL save with legacy bold-line plan and spec, idempotent replay, unchanged links, and no file memory/index entry.
- `npm run guardrails:check`: durable v2 pass; unit, global coverage ratchet (88.2% vs 84%), patch, complexity pass; lint and functional disabled.
