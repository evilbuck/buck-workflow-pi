---
date: 2026-09-29
domains: [docs, sql-memory, testing]
topics: [buck-loop, sql-memory, bootstrap-policy, receipts, live-proof]
related: [../2026-09-28.sql-memory-buck-loop/phase-4-policy-docs-live-proof.md]
priority: high
status: active
subject: 2026-09-28.sql-memory-buck-loop
artifacts: [../2026-09-28.sql-memory-buck-loop/phase-4-policy-docs-live-proof.md]
---

# SQL memory Buck-loop Phase 4 checkpoint

Updated installable bootstrap and project guidance for SQL-configured OMP `/buck-loop` versus callable-tool/non-OMP file fallback. Updated SQL memory docs, recall how-to, workflow save policy, and importer guidance. The importer regression fixture places JSON and Markdown receipt artifacts under a subject receipt directory and confirms the default memory-only scan returns only `.context/memory` records. Historical Markdown is explicitly read-only/not auto-migrated in SQL mode.

The prior shared SQL recall observation is accepted as a successful zero-active-match result; it was not repeated. Disposable target was independently observed as database `buckloop`, PostgreSQL 18.0, with Docker container `buck-loop-sql-disposable` running `pgvector/pgvector:pg18`. SQL-backed nested loop integration suites passed (96 tests, including SQL-save loop cases); importer suite passed (24 tests). Full guardrails initially identified new `verifySqlSave` complexity 11; factored the project identity postcondition into a helper without changing behavior. Re-run focused save/loop tests passed (65 tests), then durable guardrails v2 passed: unit, global ratchet (88.2% vs 84%), patch advisory, complexity; functional and lint disabled.

Still incomplete: no actual OMP `/buck-loop` nested session was launched. The only established live evidence is database identity and integration tests; neither proves real restricted-tool admission, deployed child recall/save, receipt behavior, or actual blocked/committed supervisor states. Phase stays `in-progress`; those acceptance criteria remain unchecked. Guardrails pass. No isolated disposable project fixture was available to safely run a real loop without modifying the current branch's active workflow artifacts.

Files changed by this assignment: `GLOBAL_OR_PROJECT-AGENTS.md`, `AGENTS.md`, `docs/sql-memory.md`, `docs/howto/recall-project-memories.md`, `docs/buck-workflow.md`, `skills/b-memory-import/SKILL.md`, `skills/b-memory-import/scripts/import-context-memory.test.ts`, `extensions/buck-loop/sql-save.ts`, this memory, `.context/memory/index.md`, and the Phase 4 artifact.
