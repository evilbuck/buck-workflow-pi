## Phase 1 review: Needs work

The restricted `sql_memory` child seam is implemented, but the save-stage policy does not meet the phase contract. I recorded the in-plan findings in [iterate-phase-1-tool-contract-child-seam.md](.context/2026-09-28.sql-memory-buck-loop/iterate-phase-1-tool-contract-child-seam.md) and staged **only that review artifact**. Pre-existing staged changes were left untouched.

| Acceptance criterion | Status | Evidence |
|---|---|---|
| Bound SQL values keep quotes as data | ✅ Complete | `index.ts:7-12,38`; contract test at `index.test.ts:17-34` |
| Recall read-only; save-stage allowlist | 🔄 Partial | Recall uses `SET TRANSACTION READ ONLY` (`index.ts:37`), but the save gate accepts `UPDATE users SET skill_weight = 100`—a prohibited mutation (`sql-gate.ts:38-55`; direct gate probe). |
| Restricted child admission and SELECT | ✅ Complete | `run-step.ts:425-436`; recorded deployed-OMP `runStep` SELECT returned `proof=7` from disposable PostgreSQL. This review did not rerun the live child. |
| Bounded pool and explicit lifetime | 🔄 Partial | Pool maximum is two (`db.ts:8`), but a rejection from `pool.end()` at `run-step.ts:475` bypasses child disposal and the normal stage-result contract. |
| No SQL tool for `b-commit` | ✅ Complete | `run-step.ts:145,148-156,433-436`; `run-step.test.ts:57-78` |
| SQL failure blocks the stage | 🔄 Partial | Tool failures set `sqlFailed` (`run-step.ts:435,456-458`); teardown failure does not return a controlled failed-stage result. |

**Review axes.** Spec-axis worst finding: save children can change `users.skill_weight`, contrary to the phase’s explicit restriction. Standards-axis worst finding, from a separate sequential pass using the TypeScript review guide and relevant code-smell guidance: pool teardown can skip session disposal. The iteration artifact also records a narrower warning: the save gate rejects `public.memories` although the general gate permits that qualified table.

**Guardrails:** durable v2 **pass** (`env -u SQL_MEMORY_URL npm run guardrails:check`). Unit, patch and global-ratchet, and complexity gates passed; functional and lint gates were skipped. The shared SQL endpoint was not used.

**Scope and follow-through:** These are in-plan defects; no out-of-plan finding is needed to explain the verdict. `docs/sql-memory.md` does not yet describe bound values or child-stage restrictions, so documentation impact is flagged for the planned docs phase, not treated as a correctness blocker. No new user-facing action needs a how-to in Phase 1. The parent goal of SQL-backed recall and saves remains beyond this phase. The staged iteration artifact gives the supervisor the concrete fixes and verification targets; this review does not select the loop’s next state.
