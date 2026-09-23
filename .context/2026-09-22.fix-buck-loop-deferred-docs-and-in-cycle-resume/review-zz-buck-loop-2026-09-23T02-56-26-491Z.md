## Plan Path Review: Fix buck-loop deferred-docs routing and in-cycle resume

### Plan Source
- File: `.context/2026-09-22.fix-buck-loop-deferred-docs-and-in-cycle-resume/plan-fix-buck-loop-deferred-docs-and-in-cycle-resume.md`
- Goal: Route explicit current-phase no-impact reviews directly to save and safely resume staged loop-owned work.
- Baseline: `a14daf3`; reviewed current unstaged implementation diff.

### Evidence Sources
- Modified implementation:
  - `extensions/buck-loop/scan.ts`
  - `extensions/buck-loop/loop.ts`
  - `extensions/buck-loop/__tests__/scan.test.ts`
  - `extensions/buck-loop/__tests__/loop.test.ts`
- Focused verification: 3 files, 148 tests passed.
- Guardrails: durable v2 contract passed; 929 tests passed through the unit gate.
- Unrelated `.context/2026-09-22.buck-loop-model-config/` work was excluded from this review.

### Completion Matrix

| Step | Status | Evidence |
|---|---|---|
| 1. Freeze incident reproductions | 🔄 partial | Exact Teleport wording and positive controls exist at `scan.test.ts:384-450`; missing mismatched/same/earlier phase-number controls. |
| 2. Current-impact classifier | ❌ missing | `scan.ts:328-358` accepts any `Phase N` without comparing it to the active phase. |
| 3. Documenting recovery | ✅ complete | `scan.ts:396-433`; public regression at `loop.test.ts:418-435`. |
| 4. Durable ownership boundary | ✅ complete | `loop.ts:613-635`; staging failure persists a non-resumable `blocked → blocked` transition. |
| 5. Projection-aware resume | ✅ complete | `loop.ts:208-218,539-581`; protected branch, projection, provenance, and staged-only checks remain ordered and fail closed for covered dirt states. |
| 6. Public safety matrix | ✅ complete | `loop.test.ts:632-737`; staged resume succeeds while untracked, unstaged, and mixed work is refused. |
| 7. Verification and closeout | ✅ complete | Focused suite and durable guardrails pass; backlog item archived. |

### Review Axes
- **Spec axis worst finding:** Phase-qualified clean wording is not validated against the active phase.
- **Standards axis worst finding:** None. Sequential fallback pass used the TypeScript, universal-quality, error-handling, Long Method, and Duplicate Code guides.
- **Cross-axis ranking:** None.

### Finding

**In-plan — phase-number validation is missing**

`NO_CURRENT_DOCS_IMPACT` and `NAMED_PHASE_DEFERRAL` in `extensions/buck-loop/scan.ts:328-358` accept any phase number.

While Phase 2 is active:

- `No Phase 5 documentation impact` incorrectly becomes `docsImpact: false`.
- `How-to coverage is deferred to Phase 1` incorrectly becomes `howtoImpact: false`.

This violates the plan’s requirement that `No Phase N` identify the current phase and that a deferral identify a later phase. A stale or mistyped review can silently skip required documentation.

The iteration artifact was reopened with the proposed fix:

`.context/2026-09-22.fix-buck-loop-deferred-docs-and-in-cycle-resume/iterate-fix-buck-loop-deferred-docs-and-in-cycle-resume.md`

### Verification Status
- Goal achieved: **Partial**
- User goal: Exact Teleport incident and staged resume behavior work; general phase-qualified routing remains unsafe.
- Scope adhered: Yes.
- Out-of-scope changes: None attributable to this implementation.

### Guardrails Verdict
- Contract: `durable`
- Contract version: `2`
- Status: `pass`
- Gates:
  - `unit_test_gate=pass`
  - `functional_test_gate=skipped`
  - `lint_gate=skipped`
  - `patch_gate=pass`
  - `global_ratchet=pass`
  - `complexity_gate=pass`
- Coverage: 85.6%; no new complexity violations.

### Documentation Impact
- No documentation impact.
- Recommended: none.

### How-to Impact
- No how-to impact.
- Recommended: none.

### Issue Classification
- In-plan issues: 1 — active-phase/later-phase number validation.
- Out-of-plan issues: none.

### Verdict
**Needs work**

### Recommended Next Step
`/b-iterate` should pass the active phase number into review-impact classification, require equality for `No Phase N`, require a strictly greater number for deferrals, and add public `scan` regressions for mismatched, same-phase, and earlier-phase wording.
