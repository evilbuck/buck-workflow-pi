## Plan Path Review: Phase 3 — SQL save and truthful completion

**Verdict: Needs work.** The receipt and SQL read-back paths exist, but a receipt can still authorize commit without proving that the current save stage finished.

**Contract:** `.context/2026-09-28.sql-memory-buck-loop/phase-3-sql-save-truthful-completion.md`  
**Baseline:** `7705adf` plus the existing staged and unstaged implementation. The phase’s completed status was not treated as proof. Shared SQL recall returned zero active matches; this review used the phase and current source.

| Deliverable | Status | Evidence |
|---|---|---|
| Bound writes, retry deduplication, corrections | 🔄 Partial | `sql-save.ts:106-157` binds inserts and reuses a source key within one attempt. A new attempt changes that key; the alternate path has no correction target. |
| Subject receipt without a Markdown memory body | ✅ Complete for the inspected alternate path | `sql-save.ts:80-90,120-127` writes the receipt; `save-apply.ts:189-220` skips the memory body and index in SQL mode. |
| Current-attempt proof before commit, including resume | 🔄 Partial | `loop.ts:303-312` persists `saving` before a new attempt is prepared; `loop.ts:615-635` can accept the previous receipt or skip unfinished metadata work. |
| Failure blocking and no-fact probe | 🔄 Partial | `sql-save.ts:130-135,213-233` probes and reads back rows, but receipt-only resume does not prove save-stage completion. |
| Portable file fallback | 🔄 Partial | `skills/b-save/SKILL.md:33-45` selects SQL by URL even when a non-OMP harness has no callable tool. |
| Deterministic verification | ❌ Missing | The durable v2 guardrails verdict is **fail**: required unit and global-ratchet gates fail; complexity passes, patch is advisory, functional and lint are skipped. |

**Review axes:** Spec worst finding: a previous-cycle receipt can satisfy a new `saving` transition. Standards worst finding, from a separately scoped sequential pass: `/b-save-improved` opens a raw PostgreSQL pool in `sql-save.ts:94-104`, bypassing the declared `sql_memory` stage policy. The axes are not reranked together.

**Goal and scope:** The SQL-only memory-body goal is partially met. Current-state evidence does not establish truthful resume-to-commit or the required portable fallback. No attributable out-of-scope change or new out-of-plan issue was identified. Deployed OMP child proof remains Phase 4 scope.

**Documentation impact:** SQL save and resume conventions need living-doc alignment; non-blocking. **How-to impact:** The user-facing SQL save procedure warrants a how-to; non-blocking.

Five in-plan defects and two warnings are recorded in the **staged, assignment-only** artifact `.context/2026-09-28.sql-memory-buck-loop/iterate-phase-3-postcondition-review-2026-09-29.md`. Recommended route: `/b-iterate`, then review Phase 3 again. The supervisor retains the next-state decision.
