## Phase 3 review: Needs work

**One in-plan defect remains.** In SQL mode, `/b-save-improved` passes a `sql_memory_ids` reference, but `save-apply.ts:223-233` ignores that key when a plan uses the legacy `**memory:**` line. It appends `[UUID](UUID)` as a Markdown memory link instead of recording the SQL ID. The SQL integration fixture covers a YAML-style plan, not this legacy style.

| Phase 3 deliverable | Status | Evidence |
|---|---|---|
| Bound saves, correction, and retry identity | ✅ Complete | `sql-save.ts:132-226`; transactional correction in `sql-memory/index.ts:125-150` |
| Receipt read-back, no-fact outcome, and attempt-bound resume | ✅ Complete | `sql-save.ts:239-319`; `loop.ts:632-671` |
| File-mode fallback and no SQL-mode memory body | ✅ Complete | `b-save/SKILL.md:33-47`; `save-apply.ts:189-220` |
| SQL ID cross-references in the alternate save path | 🔄 Partial | `save-apply.ts:223-233` writes a phantom Markdown link for legacy bold-line plans |

**Review axes:** Spec worst finding: incorrect SQL cross-reference. Standards worst finding, sequential fallback pass: the cross-reference branch discards the caller’s reference key. No cross-axis ranking. No separate out-of-plan finding or documentation/how-to impact identified in this phase review.

**Guardrails:** Durable v2 **pass** with SQL configured and unset; unit, coverage ratchet, patch, and complexity passed. Functional and lint were skipped. This review did not exercise a deployed OMP child; that proof is assigned to Phase 4.

The in-plan fix proposal is staged at `.context/2026-09-28.sql-memory-buck-loop/iterate-phase-3-sql-crossrefs-2026-09-29.md`. Route it through `/b-iterate`, then re-review Phase 3.
