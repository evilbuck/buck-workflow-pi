---
date: 2026-09-28
domains: [extensions, database, testing, security]
topics: [postgres-agent-memory, sql-tool, migration-runner, sql-gate, additive-grammar, guardrails]
related: [.context/2026-09-28.postgres-agent-memory/phase-2-extension-sql-tool.md, .context/2026-09-28.postgres-agent-memory/iterate-postgres-agent-memory.md, .context/2026-09-28.postgres-agent-memory/iterate-postgres-agent-memory-additive-migrations.md]
priority: medium
status: completed
subject: 2026-09-28.postgres-agent-memory
artifacts: [extensions/sql-memory/index.ts, extensions/sql-memory/sql-gate.ts, extensions/sql-memory/migrations.ts, extensions/sql-memory/db.ts, extensions/index.ts, migrations/001_initial_schema.sql, iterate-postgres-agent-memory.md, iterate-postgres-agent-memory-additive-migrations.md]
---

# PostgreSQL agent memory SQL tool — Phase 2 (completed)

Implemented and wired the `sql_memory` OMP tool. Registration requires `SQL_MEMORY_URL`; the `pg` module is required lazily at first database operation via `createRequire`. SQL mode admits one `SELECT`, `INSERT`, or `UPDATE` against allowlisted public memory tables inside a transaction with `SET LOCAL search_path = public` and `SET LOCAL standard_conforming_strings = on`. Migration mode reads ordered numbered files, applies each in its own transaction with local public search-path scope, records SHA-256 checksums, rejects checksum drift, and requires `destructive` to exactly match a file name when a migration contains non-additive statements.

## Acceptance verification

All eight acceptance criteria in `phase-2-extension-sql-tool.md` are checked and verified:

- Wire `wireSqlMemory`; register only when `SQL_MEMORY_URL` is set — `extensions/index.ts:14,31`; `wire` returns immediately when unset.
- `SELECT`/`INSERT`/`UPDATE` through the tool — live PostgreSQL 18 tool smoke: user, project, and two branch memories inserted; `rowCount: 1` on supersede update.
- `DELETE`, DDL, and other databases/schemas rejected — gate deny matrix; live `DROP TABLE memories` returned `DROP statements are not allowed through sql_memory` and did not run; `set_config`, `dblink_connect`, `pg_ls_dir` all denied.
- Migrations apply in order, record checksum, re-apply no-ops — fake-pool test orders `001`/`002`/`999`/`1000` and no-ops; live migrate applied `001_initial_schema.sql` then `{ applied: [] }`; bootstrap checksum matches `4e76b01d…ced716`.
- Autonomous apply is additive-only; `DROP`/`TRUNCATE`/row-`DELETE` need the exact filename — additive grammar refuses rename, replace, dynamic SQL, and `999_review_drop.sql` unless `destructive` equals that filename; live refusal left `memories` queryable.
- Lazy `pg` load — `createRequire("pg")` is inside the pool factory; Bun import of the extension left `pg` unloaded.
- Unit tests for the gate and fake-pool runner — `extensions/sql-memory/*.test.ts` 45/45 passed.
- Live smoke through the tool — insert → recall by project across branches → supersede → old row closed not mutated, all through `sql_memory`; recall returned `main` and `feature/smoke`; supersede set `invalid_at` and `superseded_by` while `body` stayed `original body`; body update failed with the immutability trigger.

## Review iterations

Two iterations ran against Phase 2 before pass:

1. `iterate-postgres-agent-memory.md` — `scanQuoted` treated `\` as an escape inside ordinary strings, allowing `SELECT 'foo\' FROM memories; DELETE FROM memories --'` to delete rows. Migration scanning also missed a `DROP` hidden by the same lexical desync. Fixed by removing the false-escape, denying `E'…'`/`U&'…'`/dollar quotes in SQL mode, handling dollar-quoted function bodies in migration scanning, and requiring exact-filename acknowledgment for destructive content. SQL mode now admits only explicit safe function calls.
2. `iterate-postgres-agent-memory-additive-migrations.md` — destructive-keyword scanner still allowed non-additive rename and dynamically assembled SQL (`ALTER TABLE memories RENAME TO retired_memories`, `DO $$ BEGIN EXECUTE 'TRU' || 'NCATE memories'; END $$`). Replaced the autonomous admission path with a small explicit grammar for basic additive `CREATE`/`ADD COLUMN` statements; any procedural, replacement, rename, or unparsed migration now needs exact-file acknowledgment. Migration 001's PL/pgSQL trigger definitions remain autonomous only at the reviewed SHA-256 checksum `4e76b01d169ceb8d4d940fbc9373953b77304cc5a9b0dab018d8843979ced716`. Writes without `RETURNING` now report the driver's `rowCount` instead of returned-row length.

## Verification chain

- 45 focused Vitest tests pass; focused SQL-memory suite 36/36 and Codex bundle parity 7/7.
- Three disposable `pgvector/pgvector:pg18` tool smokes: initial happy path; post-lexical-fix path including the four unsafe-call denials and migration replay; post-additive-grammar path including bootstrap, additive `ADD COLUMN`, modified-bootstrap refusal, and migration replay. All containers and smoke scripts removed.
- Final review at `review-zz-buck-loop-2026-09-28T22-03-22-182Z.md` — Pass; in-plan acceptance holds; out-of-plan notes (publish `files` gap, `ONLY` parsing) do not change the verdict.
- Durable guardrails v2 pass: unit, global ratchet 88% vs 84%, complexity; lint and functional skipped; patch pass under advisory. No threshold was weakened.

## Out-of-plan notes (not addressed in this phase)

- `package.json` `files` omits `migrations/`; in-repo resolution works but a published install cannot see the runner's default directory. Review classified this as a separate `/b-plan` candidate, not in scope for Phase 2.
- `SELECT * FROM ONLY public.memories` is false-denied (`ONLY` parsed as the table). Fail-closed; ordinary `SELECT`/`INSERT`/`UPDATE` succeed.
