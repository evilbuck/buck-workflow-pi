## Plan Path Review: Phase 3 — SQL save and truthful completion

**Verdict: Needs work.** The supervisor’s attempt-bound commit gate and the alternate save path have direct implementation and test evidence. The portable `/b-save` SQL procedure still has two in-plan defects.

| Phase 3 deliverable | Status | Evidence |
|---|---|---|
| Bound save, source-key retry, and correction | 🔄 Partial | `extensions/buck-loop/sql-save.ts:132-225` implements these for the alternate path. The portable correction in `skills/b-save/SKILL.md:42-44` uses separately committed calls and can strand an active successor. |
| Receipt after same-project read-back; no-fact outcome | 🔄 Partial | `sql-save.ts:237-309` verifies alternate-path receipts and probes no-fact saves. The portable instruction at `skills/b-save/SKILL.md:45` permits writing a rows receipt before read-back. |
| Matching attempt, failure-before-commit, and resume | ✅ Complete | `extensions/buck-loop/loop.ts:632-671` binds the projected attempt and reconciles it on resume; `machine.ts:345-359` excludes SQL-mode ambiguous advance. Focused resume scenarios passed. |
| File-mode fallback and no competing SQL-mode memory body | ✅ Complete | `skills/b-save/SKILL.md:33-37` defines the portable fallback; `skills/b-save-improved/scripts/save-apply.ts:189-220` skips memory-body and index writes in SQL mode. |

**Review axes:** Spec-axis worst finding: portable correction can leave an active orphan. Standards-axis worst finding, sequential fallback pass: correction semantics are duplicated between portable instructions and the transactional TypeScript path, and have diverged. No cross-axis ranking.

**Verification:** Durable guardrails v2 **passed**: unit, coverage ratchet (88.2% versus 84%), patch, and complexity gates passed; functional and lint gates were skipped. Focused save, loop, and apply suites passed **89/89** with the configured disposable SQL test URL. A deployed OMP-child `/buck-loop` proof was not exercised in this review; Phase 4 owns it. The broader user goal is therefore only partially met.

**Issue classification:** Two in-plan defects; no out-of-plan findings. No how-to impact identified. Bootstrap and living-documentation alignment remains Phase 4 work, not a Phase 3 correctness finding.

The two fixes are recorded in the **staged** `iterate-phase-3-portable-save-integrity-2026-09-29.md` artifact. Recommended route for the supervisor: `/b-iterate`, then repeat the Phase 3 review.
