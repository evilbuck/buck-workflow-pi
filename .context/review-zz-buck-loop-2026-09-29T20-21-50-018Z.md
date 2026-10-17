## Plan Path Review: Phase 3 — SQL save and truthful completion

### Plan Source
- File: `.context/2026-09-28.sql-memory-buck-loop/phase-3-sql-save-truthful-completion.md`
- Goal: Save reusable facts to SQL, require receipt-backed verification before commit, and avoid a parallel memory body.
- Baseline: `7705adf` plus the current staged and unstaged Phase 3 work. The mixed working tree makes commit-based attribution noisy.

### Evidence Sources
- Git status: Phase 3 code, tests, skills, and artifacts are staged; other subject work is also present.
- Recent commits: `7705adf` is the latest commit.
- Modified files inspected: `sql-save.ts`, `loop.ts`, `scan.ts`, `machine.ts`, `sql-gate.ts`, `sql-memory/index.ts`, `b-save/SKILL.md`, and the improved-save path and tests.
- Plan affected files verified: save skill, improved-save path, supervisor, scan, and machine. The phase-specific checks below rely on current source and the guardrails run, not status checkboxes.

### Completion Matrix

| Deliverable | Status | Evidence |
|---|---|---|
| Bound save, source-key retry, atomic correction | 🔄 partial | `sql-save.ts:132-226` and `sql-memory/index.ts:125-150` implement them, but save-role SQL still permits immutable-field updates (`sql-gate.ts:40-53,80-88`). |
| Metadata-only receipt and same-project read-back | ✅ complete | `sql-save.ts:239-319` verifies receipt IDs; `save-apply.ts:189-220` skips the file memory and index in SQL mode. |
| Attempt-bound supervisor and resume | ✅ complete | `loop.ts:621-671` binds the projected attempt and reconciles it before commit; `machine.ts:354-359` removes SQL-mode ambiguous advance. |
| No-fact save after connectivity probe | ✅ complete | `sql-save.ts:195-200,292-300` probes before issuing or accepting the receipt. |
| Subject/phase/source context | 🔄 partial | `sql-save.ts:209-215` stores source key, subject, and source, but no phase. The portable instructions at `b-save/SKILL.md:43-44` omit it too. |
| File-mode fallback | ✅ complete | `b-save/SKILL.md:33-47` retains the portable path when SQL mode does not apply. |
| Deployed OMP child/full-loop proof | ⚠️ not-verifiable | This review did not exercise a deployed child; that proof belongs to Phase 4. |

### Review Axes
- **Spec axis worst finding:** Save-role SQL can update immutable memory fields. A direct call to `checkSqlForRole` returned `{allowed:true}` for both `UPDATE memories SET body = $1 WHERE id = $2` and a category update.
- **Standards axis worst finding:** The table-level save gate does not constrain update columns despite the immutable correction contract. Sequential fallback pass; no background `task` tool was available. TypeScript and universal quality guides and a diff-relevant smells subset were consulted.
- Cross-axis ranking: none.

### Verification Status
- Goal achieved: **partial**.
- User goal: SQL-backed persistence and receipt checks are present; immutable-write enforcement and phase provenance are incomplete.
- Scope adhered: No Phase 3 scope violation established. Other staged subject work was not attributed to this review.

### Guardrails Verdict
- Contract: **durable**, version **2**; status: **pass**.
- Gates: unit **pass**, functional **skipped**, lint **skipped**, patch **pass** (advisory), global ratchet **pass**, complexity **pass**.

### User Goal Analysis
- Goal: Shared SQL memories without a competing new Markdown body.
- Met: SQL save, read-back, receipt, and resume paths are implemented.
- Partial: Save policy does not enforce immutable content; rows lack phase context.
- Missing: Enforcement and provenance fixes described in the iteration artifact.
- Verdict: **partially met**.

### Documentation Impact
- No separate documentation impact identified; the required portable-skill correction is part of the in-plan fix.
- Recommended: none separately.

### How-to Impact
- No how-to impact identified.
- Recommended: none.

### Issue Classification
- **In-plan → `/b-iterate`:** Restrict save-role updates so immutable fields cannot change; include phase provenance in both SQL save paths.
- **Out-of-plan → fresh `/b-plan`:** none.

### Verdict
**Needs work.** The two in-plan defects are recorded in the staged artifact `.context/2026-09-28.sql-memory-buck-loop/iterate-phase-3-immutable-save-and-phase-context-2026-09-29.md`. No other files were staged for this assignment.

### Recommended Next Step
Run `/b-iterate` against that artifact, then re-review Phase 3.
