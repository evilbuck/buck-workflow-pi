---
title: "Phase 2: Extension and SQL Tool"
status: completed
priority: high
created: 2026-09-28
updated: 2026-09-28
completed: 2026-09-28
related:
  - .context/2026-09-28.postgres-agent-memory/phase-2-extension-sql-tool.md
  - .context/2026-09-28.postgres-agent-memory/plan-postgres-agent-memory-phases.md
  - .context/2026-09-28.postgres-agent-memory/iterate-postgres-agent-memory.md
  - .context/2026-09-28.postgres-agent-memory/iterate-postgres-agent-memory-additive-migrations.md
---

# Phase 2: Extension and SQL Tool (completed)

`extensions/sql-memory/` ships the `sql_memory` OMP tool. Registration is gated by `SQL_MEMORY_URL`; `pg` loads lazily through `createRequire` only on first call. SQL mode admits one `SELECT`/`INSERT`/`UPDATE` against allowlisted public memory tables inside a transaction with `SET LOCAL search_path = public` and `SET LOCAL standard_conforming_strings = on`; non-allowlisted relations, DDL, `DELETE`, multi-statement SQL, and unknown or unsafe function calls (`set_config`, `dblink_connect`, `pg_ls_dir`) are denied. Migration mode reads ordered numbered files from `migrations/`, applies each in its own transaction with local public search-path scope, records SHA-256 checksums, refuses drift, and requires `destructive` to exactly match a file name when a migration contains non-additive statements. Autonomous apply admits only a small additive grammar; bootstrap `001_initial_schema.sql` is pinned at checksum `4e76b01d…ced716`.

Two review iterations closed the lexical backslash desync and the destructive-keyword scanner gaps before the final review at `review-zz-buck-loop-2026-09-28T22-03-22-182Z.md` passed. Verification: 45 focused Vitest tests; three disposable `pgvector/pgvector:pg18` tool smokes covering happy path, lexical-fix denials, additive-grammar refusals, and migration replay; durable guardrails v2 pass (unit, ratchet 88% vs 84%, complexity). No guardrail threshold was weakened.

## Acceptance criteria

- [x] Tool registered only when env var is set; lazy pg load
- [x] Gate allows SELECT/INSERT/UPDATE; rejects DELETE, DDL, other schemas
- [x] Runner applies pending migrations with checksums; destructive files need explicit acknowledgment
- [x] Unit tests for gate matrix and runner ordering; live smoke through the tool
