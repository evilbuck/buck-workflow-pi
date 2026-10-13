## Plan Path Review: Phase 3 — SQL save and truthful completion

**Verdict: Needs work.** The phase file marks all criteria complete, but current code does not establish a durable SQL save through both entry points or a truthful resume-to-commit path.

### Plan source and evidence
- Contract: `.context/2026-09-28.sql-memory-buck-loop/phase-3-sql-save-truthful-completion.md`
- Baseline: `7705adf` plus existing staged and unstaged work. Source inspection, receipt tests, and the durable guardrails run were used; the completion checkboxes were not treated as proof.
- Existing staged and unrelated changes were left untouched. **Only** `iterate-phase-3-sql-save-truthful-completion.md` was created and staged for this assignment.

### Completion matrix

| Deliverable | Status | Current-state evidence |
|---|---|---|
| Bound SQL fact writes, source-key retry safety, correction | 🔄 Partial | `skills/b-save/SKILL.md:33-45` specifies them; no end-to-end write was verified. The alternate entry point performs no SQL insert. |
| Subject receipt; no competing Markdown body | 🔄 Partial | `sql-save.ts:79-90` defines receipt writing and `save-apply.ts:167-199` skips Markdown writes. `b-save-improved` instead discards the body and writes references to the absent file (`index.ts:472-498`). |
| Matching attempt and same-project read-back before commit | 🔄 Partial | `sql-save.ts:103-165` verifies receipt IDs, but a verified interrupted save is not restored as confirmed work on resume (`loop.ts:244-259`). |
| DB failures and stale receipts block; no-fact probe | 🔄 Partial | Receipt tests cover stubbed queries (`sql-save.test.ts:44-108`); the specified live save and resume scenarios were not observed. |
| File-mode fallback | ✅ Complete for the inspected path | `save-apply.ts:167-199` retains file writes when SQL mode is unset. |
| Deterministic verification | ❌ Missing | `npm run guardrails:check` failed required unit, coverage-ratchet, and complexity gates. |

### Review axes
- **Spec axis worst finding:** `/b-save-improved` can report success without storing its SQL-mode memory body, while adding dangling Markdown cross-references.
- **Standards axis worst finding:** `sql-save.ts:223-229` persists a Git origin without the credential redaction used by `project-memory.ts:86-96`; credentials in an HTTPS origin can enter the attempt file and child directive. This was a separately scoped **sequential fallback** pass using the TypeScript, code-quality, and SQL-security guides plus relevant dead/duplicate-code smells.
- No cross-axis reranking.

### Guardrails verdict
Durable contract v2: **fail**. Unit **fail**; global ratchet **fail** (coverage command exited 1); complexity **fail** (`resumeRun` 12, `confirmReceipt` 36); patch **advisory**; functional and lint **skipped**.

### Goal and scope
The parent goal—SQL as the new memory body store without a parallel Markdown body—is **partially met**, not completed. Receipt and postcondition components exist, but the alternate save path loses facts, and verified resume can launch another save. The disposable PG container was available; a full live SQL-save/OMP loop proof was not observed. No out-of-plan issue was identified.

**Documentation impact:** SQL-mode save conventions need living-doc alignment, planned for Phase 4; non-blocking. **How-to impact:** SQL save/configuration procedure may need a how-to; non-blocking.

**In-plan issues:** four critical defects and one live-proof warning are recorded in the staged iteration artifact. **Out-of-plan issues:** none.

**Next step for supervisor:** route the in-plan defects to `/b-iterate`, then review Phase 3 again. This review does not choose the loop’s next state or authorize committing the phase as complete.
