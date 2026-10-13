## Plan Path Review: Phase 3 — SQL save and truthful completion

**Verdict: Needs work.** SQL saves, receipts, read-back, and resume handling are present, but two in-plan defects prevent a truthful completion claim.

**Contract:** `.context/2026-09-28.sql-memory-buck-loop/phase-3-sql-save-truthful-completion.md`  
**Baseline:** `7705adf` plus the current staged and unstaged implementation. The phase’s `completed` status was not treated as proof. Shared-memory recall supplied by the supervisor had zero active matches.

| Phase 3 deliverable | Status | Current-state evidence |
|---|---|---|
| Bound writes, source-key reuse, and corrections | 🔄 Partial | `sql-save.ts:126-209` implements them, but a failed correction can leave its newly inserted successor active. |
| Subject receipt without a new Markdown memory body | ✅ Complete | `sql-save.ts:92-103,145-147`; `save-apply.ts:189-220` skips the body and memory index in SQL mode. |
| Matching-attempt proof before commit and on resume | 🔄 Partial | `loop.ts:645-658` verifies the mutable global attempt pointer; the projected transition stores no expected attempt ID. |
| No-fact and failure handling | ✅ Complete for exercised paths | `sql-save.ts:183-187,222-275`; the focused tests passed, including disposable-PostgreSQL cases. |
| Portable file fallback | ✅ Complete in the inspected contract | `skills/b-save/SKILL.md:33-47` distinguishes a configured OMP loop from a harness without a callable SQL tool. |

**Review axes:** Spec worst finding: failed corrections can publish an active orphan successor (`sql-save.ts:151-180`). Standards worst finding, from the sequential fallback pass: newly added, unused `secretKey()` duplicates `hasSecretKey()` (`sql-save.ts:331-338`). The axes were not reranked together.

**Guardrails verdict:** Durable v2 **pass** with `SQL_MEMORY_URL` unset: unit pass; global ratchet pass at 88.1% versus 84%; complexity pass; patch advisory; functional and lint skipped. A separate focused run passed **88 tests across three files**, including conditional disposable-SQL tests. Neither run covers the two failure scenarios above.

**User goal:** Partially met for this phase. SQL is the new memory-body path, but correction integrity and proof of the *projected* save attempt remain unestablished. The deployed OMP child and full loop proof belong to Phase 4.

**Issue classification:** Two in-plan defects; no out-of-plan issue. Living-doc and how-to alignment remains non-blocking Phase 4 work.

**Next step:** `/b-iterate` using the staged, assignment-only artifact `.context/2026-09-28.sql-memory-buck-loop/iterate-phase-3-correction-and-attempt-binding-2026-09-29.md`, then re-review Phase 3. The supervisor retains the next-loop-state decision.
