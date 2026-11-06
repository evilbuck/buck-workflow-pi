---
status: completed
phase: 2
order: 2
plan: plan-postgres-agent-memory.md
phases_overview: plan-postgres-agent-memory-phases.md
difficulty: hard
model_hint: strongest reasoning model available
buck_hint: /b-build-hard
goal: "Register the sql_memory OMP tool: SQL_MEMORY_URL-driven, DML-gated, with an additive-only migration runner the agent applies autonomously."
files:
  - extensions/sql-memory/index.ts
  - extensions/sql-memory/sql-gate.ts
  - extensions/sql-memory/migrations.ts
  - extensions/sql-memory/db.ts
  - extensions/index.ts
  - package.json
from_plan_steps: [tool contract]
depends_on: [1]
dependency_type: HARD
acceptance_criteria:
  - "[x] `extensions/index.ts` wires `wireSqlMemory`; tool registered only when `SQL_MEMORY_URL` is set"
  - "[x] `SELECT`/`INSERT`/`UPDATE` on schema tables succeed through the tool"
  - "[x] `DELETE`, any DDL, and statements touching other databases/schemas are rejected with a clear error"
  - "[x] Migration operation applies pending files in order, records version+checksum in `schema_migrations`, re-apply is a no-op"
  - "[x] Autonomous apply admits additive statements only; a file containing `DROP`/`TRUNCATE`/row-DELETE is refused unless the call carries an explicit destructive acknowledgment"
  - "[x] Postgres client lazily loaded (createRequire pattern) — importing the extension without `SQL_MEMORY_URL` costs no pg dependency"
  - "[x] Unit tests cover the statement gate (allow/deny matrix) and migration ordering with a fake pool"
  - "[x] Live smoke: insert → recall by project across branches → supersede → old row closed not mutated, all through the tool"
completed_at: 2026-09-28
completed_by: null
---

# Phase 2: Extension and SQL Tool

## Context

Parent goal (one line): engineers share one remote PostgreSQL memory store across projects — project/branch-scoped, skill-ranked, order- and context-preserving — replacing `.context/memory/` for new memories.

Phase 1 shipped the schema. This phase ships the runtime surface: one OMP tool, one env var, one gate. The agent gets SQL; nothing prescribes how it uses memory (Q4).

## Implementation Details

1. `extensions/sql-memory/db.ts` — lazy client: read `SQL_MEMORY_URL` at registration; `createRequire` the pg driver on first use (token-attribution precedent, `extensions/token-attribution/db.ts`). Pool with sane small limits (this is a single-agent tool, not a web app).
2. `extensions/sql-memory/sql-gate.ts` — pure function: parse statement type and target. Allow `SELECT`, `INSERT`, `UPDATE` on tables in the memory schema. Reject `DELETE`, `TRUNCATE`, all DDL, `COPY`, multi-statement strings mixing denied forms. Fail closed on unparseable input. No regex-only trust: use the driver's parse when available, else conservative keyword gate + table allowlist.
3. `extensions/sql-memory/migrations.ts` — runner: read `migrations/*.sql` ordered, checksum (sha256), check `schema_migrations`, apply pending in one transaction each with `SET LOCAL` scoping. Destructive detection: refuse file application unless the tool call includes explicit `destructive: true` acknowledgment naming the file. Additive-only is the default autonomous mode (Q10).
4. `extensions/sql-memory/index.ts` — `wire(pi)`: if `SQL_MEMORY_URL` unset, register nothing (Q18/Q19). Register tool `sql_memory` with modes: `{ op: "sql", statement }` and `{ op: "migrate", destructive?: false }`. Errors return structured messages; no silent fallbacks.
5. Wire `wireSqlMemory` in `extensions/index.ts`; declare the extension directory in `package.json` `omp`/`pi` keys if the manifest requires it.
6. Tests: gate matrix (each allowed/denied shape), runner ordering + no-op re-apply with a fake pool, checksum mismatch refusal.

## Risks

- **SQL injection through the gate is the blast radius.** The gate denies by default; the memory schema is the only allowlisted target. Destructive migration acknowledgment must name the file, not just a boolean.
- **Bun vs node:pg**: verify the driver loads under OMP's Bun runtime; if not, use `postgres` (postgres.js) with the same lazy pattern — record the choice in the file header.
- Registration must not break when the database is unreachable at startup: register the tool, fail per-call. Do not crash OMP on a bad URL.

## Verification

- Unit: gate matrix green; runner applies 001 then no-ops.
- Live: full smoke from the plan's Verification section through the tool, not psql.

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Run `/b-build-hard` for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. Out-of-plan issues route to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If the phase is incomplete, leave `status: in-progress` so the session resumes here next turn.
