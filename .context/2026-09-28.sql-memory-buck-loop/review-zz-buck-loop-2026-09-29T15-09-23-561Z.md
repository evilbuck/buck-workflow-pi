## Phase 1 review: Needs work

**In-plan defect:** `runStep` can repeat completed child work. If a child finishes and then `unsubscribe()` or `dispose()` throws, `runOneSession` returns a failure with `blockRetry: false`; `runStep` selects another model and runs the stage again (`extensions/buck-loop/run-step.ts:269-273,478-494`). For a save or commit, that can repeat side effects. The fix and a two-candidate regression are recorded in the **staged** `.context/2026-09-28.sql-memory-buck-loop/iterate-phase-1-cleanup-retry.md`. No pre-existing changes were staged by this assignment.

| Phase 1 criterion | Status | Evidence |
|---|---|---|
| Bound SQL values remain data | ✅ complete | `extensions/sql-memory/index.ts:7-12,38`; quoted-input test at `index.test.ts:17-34` |
| Recall transaction and save-stage policy | ✅ complete | `index.ts:27-38,63-70`; `sql-gate.ts:40-61`; policy smoke allowed bound recall/save SQL and denied skill-weight and `memory_ranks` writes |
| Restricted child admission | ✅ complete | `run-step.ts:427-439`; recorded deployed-OMP child SELECT returned `proof=7` |
| Bounded pool and child lifetime | 🔄 partial | Pool is capped at two (`db.ts:4-12`) and cleanup is attempted independently (`run-step.ts:487-493`), but cleanup failure can retry completed work |
| No SQL tool in `b-commit` | ✅ complete | `run-step.ts:146,149-157,428-438`; `run-step.test.ts:67-88` |
| SQL failure blocks fallback | ✅ complete | `run-step.ts:458-460,269-272`; two-model regression at `run-step.test.ts:115-146` |

**Review axes:** Spec worst finding: completed work can be re-executed after cleanup failure. Standards worst finding: none in the separate, sequential TypeScript/quality pass. Findings were not cross-ranked.

**Verification:** Durable v2 guardrails **pass**—unit, coverage ratchet, patch, and complexity pass; functional and lint skipped. The SQL-policy smoke passed. The deployed-child database proof is from the recorded Phase 1 run, not repeated in this review. The broader shared-memory goal remains partial because this review covers only Phase 1.

**Documentation impact:** `docs/sql-memory.md:9` still omits optional `values` and the distinction between direct-tool and child-stage permissions. Non-blocking; `/b-docs` after the defect is fixed. No how-to impact. No out-of-plan issue.

**Next assigned work:** `/b-iterate` on the staged artifact, then re-review this phase. I did not choose or change the supervisor’s loop state.
