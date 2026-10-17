## Plan Path Review: Phase 2 Extension and SQL Tool

### Plan Source
- File: `.context/2026-09-28.postgres-agent-memory/phase-2-extension-sql-tool.md`
- Goal: Register `sql_memory`: `SQL_MEMORY_URL`-driven, DML-gated, additive-only migrations the agent applies.
- Baseline: branch `feat/sql-memory-tool` at `0a82064`; phase 2 evidence is the staged working tree, not the phase `status: completed` checkbox.

### Evidence Sources
- Git status: phase 2 sources staged (`extensions/sql-memory/*`, `extensions/index.ts`, `package.json`). Unstaged phase frontmatter flips `status` to `completed`. That flip is not evidence.
- Modified files verified: `extensions/sql-memory/{index,sql-gate,migrations,db}.ts` and tests, `extensions/index.ts`, `package.json`.
- Live proof: disposable `pgvector/pgvector:pg18` on `127.0.0.1:55432`, removed after the probe.
- Goal mode: `.context/workflow/current-session.json` has no `goal`. Not in goal mode.

### Completion Matrix

| Step | Status | Evidence |
|------|--------|----------|
| Wire `wireSqlMemory`; register only when `SQL_MEMORY_URL` is set | ✅ complete | `extensions/index.ts:14,31`; `extensions/sql-memory/index.ts:43-45`; `index.test.ts` asserts no register without the env var |
| `SELECT`/`INSERT`/`UPDATE` on schema tables succeed through the tool | 🔄 partial | Gate allows those shapes (`sql-gate.test.ts`). Tool forwards an allowed statement to `pool.query` (`index.ts:32-35`). This review did not replay insert → cross-branch recall → supersede |
| `DELETE`, DDL, and other database/schema statements rejected | ❌ missing | Direct `DELETE` is rejected. Ordinary-string `\'` desync is not. `set_config`, `dblink_connect`, and `pg_ls_dir` are allowed |
| Migrations apply in order, record checksum, re-apply no-ops | ✅ complete | `migrations.ts:36-86`; `migrations.test.ts` orders `001`/`002`/`999`/`1000`, records sha256, second apply is `[]` |
| Additive-only apply; `DROP`/`TRUNCATE`/row-`DELETE` need an exact filename acknowledgment | ❌ missing | Keyword cases are tested and refused. A `DROP` hidden by the same `\'` desync applied with no acknowledgment and dropped `public.memories` |
| Lazy `createRequire("pg")`; import without `SQL_MEMORY_URL` does not load `pg` | ✅ complete | `db.ts:8-16`; `wire` returns before `createLazyPool` when the env var is unset (`index.ts:44-46`). `package.json` `pi`/`omp` already point at `./extensions/index.ts` |
| Unit tests for the gate matrix and fake-pool migration ordering | 🔄 partial | Existing matrix and runner tests exist. They do not cover the lexical bypass that the acceptance criteria require to be denied |
| Live smoke through the tool | ⚠️ not-verifiable | Prior session memory claims a smoke and says the scripts were removed. This review did not replay insert/recall/supersede. It only proved the bypass path |
| Registration must not connect at startup | ✅ complete | Pool is created on first `query`/`connect`, not in `wire` |
| Destructive acknowledgment names the file | ✅ complete | `destructive` is a string that must equal the filename (`migrations.ts:68-69`), matching the phase risk, not a bare boolean |

### Review Axes
- Spec axis worst finding: `scanQuoted` treats `\` as an escape in ordinary `'...'` strings. PostgreSQL 18 with `standard_conforming_strings=on` does not. The gate allows a second statement that the server executes.
- Standards axis worst finding: the allow/deny tests never feed a standard-conforming string escape, so the security boundary is untested for the lexical case that changes statement boundaries. Sequential fallback. This harness has no background `task` tool.
- Cross-axis ranking: none.

Proven payload, through `sqlMemoryTool` against live Postgres:

`SELECT 'foo\' FROM memories; DELETE FROM memories --'`

`checkSqlStatement` returned `{ allowed: true }`. The tool query deleted the row (`remaining = 0`), then threw `undefined is not an object (evaluating 'result.rows.length')` because `pg` returned a multi-statement result after the `DELETE` had already run.

`SELECT 'foo\'; DROP TABLE IF EXISTS memories; --'`

`containsDestructiveMigration` returned `false`. `applyMigrations` applied `009_hidden.sql` with no acknowledgment. `to_regclass('public.memories')` became null.

### Verification Status
- Goal achieved: no
- User goal: partially met. The tool registers and can run allowed DML, but the gate does not keep `DELETE`/`DROP` out.
- Scope adhered: yes for phase 2 files. No out-of-scope product changes in this phase's diff.
- Out-of-scope changes: none in the phase 2 implementation.

### Guardrails Verdict
- Contract: durable
- Contract version: 2
- Status: fail
- Gates: `unit_test_gate=fail`, `functional_test_gate=skipped`, `lint_gate=skipped`, `patch_gate=advisory`, `global_ratchet=fail`, `complexity_gate=pass`
- Cause: `scripts/codex-plugin.test.ts` canonical-bundle parity (`b-grill-me`). Coverage never ran, so the required ratchet failed too. That test is outside this phase's files. A required-gate fail still makes verification missing.

### User Goal Analysis
- Goal: one remote Postgres memory store, project/branch-scoped, with the agent applying additive migrations.
- Met: registration, lazy `pg`, ordered checksummed migrations, explicit filename acknowledgment for obvious `DROP`/`TRUNCATE`/`DELETE`.
- Partial: DML forwarding works for statements the gate allows.
- Missing: the gate does not reject every `DELETE`, DDL statement, or other-database call.
- Verdict: not met

### 6-step audit
1. Deliverables are the eight acceptance criteria in the phase file.
2. Wiring, lazy load, and the happy-path runner have file and test evidence. The deny criteria do not.
3. Current state was read and executed. Checkboxes were not trusted. The unstaged `status: completed` flip is false.
4. Live claim was matched with a live `pg` probe for the deny path. The insert/recall/supersede smoke was not replayed.
5. Unreplayed smoke is not-verifiable, not complete.
6. Review was not truncated.

### Documentation Impact
- New tool contract (`SQL_MEMORY_URL`, `sql_memory` modes, destructive filename acknowledgment) is not in living docs. Phase 3 already owns that write-up.
- Recommended: `/b-docs` only after this phase passes review. Not before `/b-iterate`.

### How-to Impact
- No how-to for calling `sql_memory`. Phase 3 is the planned home.
- Recommended: none until the gate fix lands.

### Issue Classification
- In-plan issues: ordinary-string `\'` desync (tool `DELETE` and unacknowledged migration `DROP`); `set_config` / `dblink_connect` / `pg_ls_dir` allowed and SQL path does not pin `search_path`; required guardrails unit gate red.
- Out-of-plan issues: none.

### Verdict
Needs work

### Recommended Next Step
`/b-iterate` on `.context/2026-09-28.postgres-agent-memory/iterate-postgres-agent-memory.md`, then `/b-review` against this same phase file.

Staged only `.context/2026-09-28.postgres-agent-memory/iterate-postgres-agent-memory.md`.
