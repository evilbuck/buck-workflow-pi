## Plan Path Review: Phase 2 Extension and SQL Tool

### Plan Source
- File: `.context/2026-09-28.postgres-agent-memory/phase-2-extension-sql-tool.md`
- Goal: an env-gated `sql_memory` tool with DML restrictions and additive-only autonomous migrations.
- Baseline: current staged implementation against `115f964`. The working tree also contains unrelated site changes; they were not attributed to this phase.

### Completion Matrix

| Deliverable | Status | Evidence |
|---|---|---|
| Env-gated registration and lazy `pg` loading | ✅ complete | `extensions/index.ts:14,31`; `extensions/sql-memory/index.ts:55-64`; `db.ts:8-16` |
| SELECT, INSERT, UPDATE through the tool | 🔄 partial | SQL is forwarded at `index.ts:32-40`, but a successful UPDATE without `RETURNING` reports `rowCount: 0`; a tool probe reproduced it. |
| Reject DELETE, DDL, and other-schema access in SQL mode | ✅ complete | Gate checks at `sql-gate.ts:131-231`; deny cases in `sql-gate.test.ts:14-38` passed under guardrails. |
| Ordered, checksummed migrations and no-op replay | ✅ complete | `migrations.ts:36-86`; ordering, checksum, and replay tests at `migrations.test.ts:6-64`. |
| Additive-only autonomous migration apply | ❌ missing | `ALTER TABLE memories RENAME TO retired_memories` passed `containsDestructiveMigration`; a fake-pool probe showed `applyMigrations` executing it without acknowledgment. Split-keyword dynamic SQL also evades the filter. Fix proposal is staged in the iteration artifact. |
| Exact-filename acknowledgment for detected destructive files | 🔄 partial | `migrations.ts:68-69` enforces the filename, but the detection gap means some destructive files never require it. |
| Gate and runner unit coverage | 🔄 partial | Existing tests pass; they omit non-additive rename and dynamic-SQL cases. |
| Current live insert → cross-branch recall → supersede smoke | ⚠️ not-verifiable | Session memory records an earlier PostgreSQL smoke after the prior fix, but its disposable fixture was removed; this review did not replay the full path. |

### Review Axes
- **Spec axis worst finding:** autonomous migration apply is not additive-only (`sql-gate.ts:234-240`).
- **Standards axis worst finding:** the tool derives affected-row count from returned rows rather than the driver’s `rowCount` (`index.ts:39-41`). Sequential fallback pass, using TypeScript, security, and diff-relevant code-smell guides; no background `task` tool was available.
- Findings remain separate by axis; neither was reranked against the other.

### Guardrails Verdict
Durable contract v2: **pass**. Unit, global ratchet (88% versus 84%), and complexity passed; functional and lint skipped; patch passed under advisory enforcement. This does not establish the untested migration invariant.

### Verification and Impact
- **Phase goal:** not met. Registration and ordinary queries are present, but autonomous migration safety fails.
- **Scope:** no phase-attributable out-of-scope implementation change identified.
- **User goal:** partially met; the shared memory tool exists, but its migration boundary is unsafe.
- **Documentation impact:** the new tool contract needs living documentation; Phase 3 owns that work.
- **How-to impact:** tool usage needs a procedure; Phase 3 owns it.
- **Goal mode:** no active goal in `.context/workflow/current-session.json`.

### Issue Classification and Verdict
- **In-plan:** additive-migration bypass; misleading write count.
- **Out-of-plan:** none.
- **Verdict: Needs work.** The staged artifact `.context/2026-09-28.postgres-agent-memory/iterate-postgres-agent-memory-additive-migrations.md` records reproduction and fixes. No pre-existing or unrelated files were staged by this assignment.

**Recommended route:** `/b-iterate` on that artifact, then re-review this phase.
