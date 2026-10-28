---
date: 2026-10-27
domains: [tooling, testing]
topics: [sql-memory, save-binding, immutable-provenance, buck-loop]
subject: 2026-10-27.sql-memory-save-failure
artifacts: [plan-sql-memory-save-failure.md, research-sql-memory-save-failure.md, research-verification.md, review-sql-memory-save-failure.md]
related: []
priority: high
status: completed
---

# SQL memory save-attempt binding repair

Fixed the neighboring tab's `/buck-loop` save failure: attempt binding updated immutable `memories.context`, rejected by PostgreSQL's `reject_memory_content_update()` trigger (`P0001`). Live reproduction confirmed the exact error before the fix.

Binding now uses idempotent `tags`/`memory_tags` membership with reserved `sql-memory-save:<attemptId>` tags (`extensions/sql-memory/remember.ts`). The supervisor reconstructs receipt ids from same-project active membership (`STAMPED_ATTEMPT_SQL`); child tag writes stay denied at the save gate. Same active memory id is reused across retries and later attempts without duplicating content.

Verification: real-PostgreSQL smoke (fresh save, retry reuse, correction + linkage, project/attempt isolation, supervisor receipt reconstruction) exits 0; focused regressions 74 passed, 1 skipped; authoritative guardrails pass (coverage 89.3% vs 84% baseline). Independent source review confirmed no repair-introduced issues and behavioral equivalence of the approved `machine.ts::next` choice-transition extraction (user selected "Fix hotspot too").

Docs updated (`docs/buck-workflow.md`, `docs/CHANGELOG.md`). Runtime handoff: the other pane loads the main checkout via config + plugin symlink; its running OMP process predates the fix. User chose to restart it personally — no loop resumed, no checkpoint touched, no commit made.

Shared SQL memory: file-mode save used; no callable `sql_memory` save directive was active in this session outside the Buck loop.
