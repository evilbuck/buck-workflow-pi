---
status: completed
date: 2026-09-28
updated: 2026-09-28
subject: 2026-09-28.postgres-agent-memory
topics: [review, iteration]
informs: []
addresses: phase-2-extension-sql-tool.md
completed: 2026-09-28
from_review: b-review
---

# Iteration: postgres-agent-memory

## Source
- Reviewed after: `/b-build-hard`
- Plan: `plan-postgres-agent-memory.md`
- Phase: `phase-2-extension-sql-tool.md`

## Critical Issues

### 1. Ordinary-string backslash desync lets DELETE and DROP through the tool
- **File**: `extensions/sql-memory/sql-gate.ts`
- **Problem**: `scanQuoted` treats `\` as an escape inside ordinary `'...'` strings. PostgreSQL 18 with `standard_conforming_strings = on` does not. The gate therefore hides a second statement that the server executes. Proven on `pgvector/pgvector:pg18` through `sqlMemoryTool` and `applyMigrations`:
  - `SELECT 'foo\' FROM memories; DELETE FROM memories --'` → `checkSqlStatement` returns `{ allowed: true }`; the tool query deleted the inserted row (`remaining = 0`). The tool then threw `undefined is not an object (evaluating 'result.rows.length')` because `pg` returned a multi-statement result, after the DELETE had already run.
  - `SELECT 'foo\'; DROP TABLE IF EXISTS memories; --'` → `containsDestructiveMigration` returned `false`; `applyMigrations` applied `009_hidden.sql` with no destructive acknowledgment and dropped `public.memories` (`to_regclass` became null).
- **Proposed fix**: Do not treat `\` as an escape in ordinary single-quoted strings. Fail closed on `E'...'`, `U&'...'`, and dollar quotes unless the scanner matches PostgreSQL's lexer. Add regression tests for both payloads above, asserted denied by the gate and refused by the migration runner without an exact filename acknowledgment. Re-run the phase live smoke after the fix: insert, recall by project across branches, supersede, confirm the old body is unchanged, all through `sql_memory`.

### 2. SQL mode does not reject other-database and session-mutating calls
- **File**: `extensions/sql-memory/sql-gate.ts`, `extensions/sql-memory/index.ts`
- **Problem**: Acceptance requires rejection of statements that touch other databases or schemas. These calls have no `FROM`/`JOIN`/`INTO`/`UPDATE` and are not in `DENIED`, so the gate allows them: `SELECT set_config('search_path', 'pg_temp, public', false)`, `SELECT dblink_connect('host=127.0.0.1 dbname=postgres')`, `SELECT pg_ls_dir('/')`. Migrations pin `search_path` with `SET LOCAL`; the SQL tool path does not, so a pooled connection can keep a poisoned `search_path`.
- **Proposed fix**: Fail closed unless every called function is on an explicit allowlist, or reject known side-effect, file, and remote-query functions including `set_config`, `dblink_*`, and `pg_ls_dir`. Set `search_path` to `public` on the SQL connection before executing an allowed statement, same scoping idea as the migration transaction. Add deny-matrix rows for those three calls.

## Iteration Evidence (2026-09-28)

- Critical 1 fixed: reject backslashes and unsupported string forms in SQL mode; migration scanner recognizes dollar-quoted function bodies and conservatively treats destructive keywords inside them as requiring acknowledgment. Regression cases for the DELETE and DROP payloads pass.
- Critical 2 fixed: unrecognized functions are denied, including `set_config`, `dblink_connect`, and `pg_ls_dir`. SQL requests use a transaction with `SET LOCAL search_path = public` and `SET LOCAL standard_conforming_strings = on`, releasing the connection on either outcome.
- Focused tests: 36/36 pass. Live disposable PostgreSQL 18 tool smoke passed migration, insert, cross-branch recall, supersession with unchanged old body, all four unsafe-call denials, and migration replay; disposable container and script removed.
- Warning resolved: synchronized the two stale Codex bundle skill copies with their canonical files. Refactored three SQL gate helpers to satisfy the complexity ceiling without changing gate behavior. Focused SQL-memory tests pass (36/36), Codex bundle tests pass (7/7), and the durable guardrails runner passes all required gates (unit, global ratchet at 88% vs 84%, complexity); lint is disabled and patch is advisory. Fresh review remains the supervisor's next step.

## Warnings

### 1. Required guardrails unit gate was red — resolved
- **File**: `plugins/buck-workflow/skills/b-grill-me/SKILL.md`, `plugins/buck-workflow/skills/b-grill-with-docs/SKILL.md`
- **Resolution**: Matched canonical copies byte-for-byte without modifying their source skills or weakening the parity test. Required unit, ratchet, and complexity gates now pass; `extensions/sql-memory/sql-gate.ts` helper extraction removed three new complexity violations.

## Recommended Workflow

Start with `/b-iterate` — it will pick up this file automatically.
Then re-run `/b-review` against `.context/2026-09-28.postgres-agent-memory/phase-2-extension-sql-tool.md`.
Inside an OMP execution session, the iterate artifact is not done until it is completed, review passes, and `/b-save` has recorded durable state.
