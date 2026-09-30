## Plan Path Review: Phase 2 Extension and SQL Tool

### Plan Source
- File: `.context/2026-09-28.postgres-agent-memory/phase-2-extension-sql-tool.md`
- Goal: Register `sql_memory` when `SQL_MEMORY_URL` is set, gate DML, and apply additive migrations autonomously.
- Baseline: source on `feat/sql-memory-tool` versus `115f964`. Checkboxes in the phase file were not treated as evidence.

### Evidence Sources
- Git status: phase 2 extension, tests, migration 001, and `package.json` `pg` dependency are in the index. Unrelated `site/` changes are also staged.
- Modified files verified: `extensions/sql-memory/{index,sql-gate,migrations,db}.ts`, `extensions/index.ts`, `migrations/001_initial_schema.sql`.
- Probes: gate/migration matrix, 45 focused Vitest tests, import-without-`pg`, disposable Postgres 18 tool smoke, durable guardrails.

### Completion Matrix

| Step | Status | Evidence |
|---|---|---|
| Wire `wireSqlMemory`; register only when `SQL_MEMORY_URL` is set | ✅ complete | `extensions/index.ts:14,31`; `wire` returns immediately when unset (`extensions/sql-memory/index.ts:55-57`). Test: register skipped without the env var. |
| `SELECT`/`INSERT`/`UPDATE` on schema tables succeed through the tool | ✅ complete | Live tool smoke: user, project, and two branch memories inserted; `rowCount: 1` on supersede update. |
| `DELETE`, DDL, and other databases/schemas rejected | ✅ complete | Gate probe denies those shapes. Live `DROP TABLE memories` returned `DROP statements are not allowed through sql_memory` and did not run. |
| Migrations apply in order, record checksum, re-apply no-ops | ✅ complete | Fake-pool test orders `001`, `002`, `999`, `1000` and no-ops. Live migrate applied `001_initial_schema.sql`, then `{ applied: [] }`. Bootstrap checksum matches `4e76b01d…ced716`. |
| Autonomous apply is additive-only; `DROP`/`TRUNCATE`/row-`DELETE` need the exact filename | ✅ complete | Grammar refuses rename, replace, dynamic SQL, and `999_review_drop.sql` unless `destructive` equals that filename. Live refusal left `memories` queryable (`count = 3`). |
| Lazy `pg` load | ✅ complete | `createRequire("pg")` is inside the pool factory. Bun import of the extension left `pg` unloaded. |
| Unit tests for the gate and fake-pool runner | ✅ complete | `extensions/sql-memory/*.test.ts`: 45/45 passed. |
| Live smoke: insert, cross-branch recall, supersede, old row closed not mutated | ✅ complete | Recall returned `main` and `feature/smoke`. Supersede set `invalid_at` and `superseded_by` while `body` stayed `original body`. Body update failed with the immutability trigger; the row was unchanged. |

### Review Axes
- Spec axis worst finding: none.
- Standards axis worst finding: none. Sequential fallback — this harness has no background `task` tool. Applied the TypeScript review guide, security-guide injection rule, review best practices, and the long-method smell to this diff. The lexer is bespoke, but it fails closed and the known desync payloads are denied.
- Cross-axis ranking: none.

### Verification Status
- Goal achieved: yes.
- User goal: partially met — this phase is the runtime surface. Recall docs remain Phase 3.
- Scope adhered: yes for the phase file list.
- Out-of-scope changes: staged `site/` deletion/rename is unrelated. Do not include it in the phase commit. Prior Codex bundle parity edits are outside the phase file list; they are what made the required unit gate pass.

### Guardrails Verdict
- Contract: durable
- Contract version: 2
- Status: pass
- Gates: unit_test_gate=pass, functional_test_gate=skipped, lint_gate=skipped, patch_gate=pass, global_ratchet=pass, complexity_gate=pass

### User Goal Analysis
- Goal: one shared remote PostgreSQL memory store, project/branch scoped, for new memories.
- Met: registered SQL tool, DML gate, additive migration runner, live insert/recall/supersede.
- Partial: usage docs are Phase 3, as planned.
- Missing: nothing in this phase's acceptance list.
- Verdict: met for Phase 2.

### Documentation Impact
- No documentation impact for this phase. Tool-contract docs are Phase 3 acceptance (`docs/sql-memory.md`, howto).
- Recommended: none before `/b-save`.

### How-to Impact
- No how-to impact for this phase. `docs/howto/recall-project-memories.md` is Phase 3.
- Recommended: none.

### Issue Classification
- In-plan issues: none.
- Out-of-plan issues: `package.json` `files` omits `migrations/`, so a published install cannot see the runner's default directory. In-repo resolution works and was smoked. `SELECT * FROM ONLY public.memories` is false-denied (`ONLY` parsed as the table). Fail-closed; ordinary `SELECT`/`INSERT`/`UPDATE` succeed.

### Verdict
Pass — in-plan acceptance holds. Out-of-plan notes do not change it.

### Recommended Next Step
`/b-save` → `/b-commit` for this phase only. Leave the unrelated `site/` index changes out of that commit. Phase 3 is already queued. The publish-files gap can be a separate `/b-plan` if a package install is in scope.

Summary
Documentation impact: none
How-to impact: none
Suggested next step: `/b-save` → `/b-commit`

No review files were written, so there was nothing to stage.
