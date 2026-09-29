---
date: 2026-09-29
domains: [extensions, sql-memory, testing]
topics: [buck-loop, sql-save, receipts, resume, b-save-improved]
related: [sql-memory-buck-loop-phase-3-save-checkpoint-2026-09-29.md]
priority: high
status: completed
subject: 2026-09-28.sql-memory-buck-loop
artifacts: [iterate-phase-3-sql-save-truthful-completion.md, phase-3-sql-save-truthful-completion.md]
---

# SQL save review iteration

## Decisions and result

- `b-save-improved` stores the scribe's reusable record as a project-scoped SQL row; absence of reusable facts produces a connectivity-verified no-fact receipt. Same-attempt source keys reuse IDs; the apply subprocess requires the receipt before writing metadata. SQL mode writes no Markdown memory body/index and uses `sql_memory_ids` references.
- Interrupted `saving` resumes directly to commit only after receipt and same-project read-back; interrupted `committing` recognizes an already clean Git postcondition. Missing/stale receipt or database outage cannot satisfy the commit gate.
- Attempt origin uses credential redaction before persistence or prompt injection. Portable `b-save` instructions now handle existing users/projects and use SQL IDs instead of phantom memory paths.
- Existing file-mode behavior remains. The zero-row recall test now verifies child admission without treating a stubbed save as completed persistence.

## Files Modified

- `extensions/buck-loop/sql-save.ts`, `extensions/buck-loop/loop.ts`, `extensions/buck-loop/__tests__/sql-save.test.ts`, `extensions/buck-loop/__tests__/loop.test.ts`
- `extensions/b-save-improved/index.ts`, `extensions/b-save-improved/__tests__/handler.test.ts`
- `skills/b-save-improved/scripts/save-apply.ts`, `skills/b-save-improved/scripts/save-apply.test.ts`, `skills/b-save-improved/SKILL.md`
- `skills/b-save/SKILL.md`, `plugins/buck-workflow/skills/b-save/SKILL.md`
- `.context/2026-09-28.sql-memory-buck-loop/iterate-phase-3-sql-save-truthful-completion.md`, its draft commit, and this memory/index.

## Verification

- Disposable pgvector/pg18: bound apostrophe save, retry deduplication, receipt read-back, no-fact receipt, SQL-mode metadata apply without a file body, and verified interrupted-save resume to commit. Test fixtures use unique origins and remove their rows.
- Focused save/loop/apply suites: 85/85 passed before final no-fact optimization.
- Final durable `env -u SQL_MEMORY_URL npm run guardrails:check`: pass; unit gate pass, global coverage 88% vs 84% baseline, complexity pass, patch advisory, functional/lint disabled.
- Not exercised: deployed OMP child executing the portable `b-save` tool path; Phase 4 carries the operator-facing live proof.
