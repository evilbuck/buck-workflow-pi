## Plan Path Review: Fix buck-loop deferred-docs routing and in-cycle resume

### Plan Source
- File: `.context/2026-09-22.fix-buck-loop-deferred-docs-and-in-cycle-resume/plan-fix-buck-loop-deferred-docs-and-in-cycle-resume.md`
- Goal: Route explicit deferred documentation work directly to save and safely resume staged loop-owned work.
- Baseline: `a14daf3` plus the current worktree diff.

### Evidence Sources
- Modified implementation: `extensions/buck-loop/{scan.ts,loop.ts}`
- Modified tests: `extensions/buck-loop/__tests__/{scan.test.ts,loop.test.ts}`
- Focused suite: **153/153 passed**
- Guardrails: durable v2 contract, **pass**
- Existing iteration artifact reopened with the remaining defect:
  `.context/2026-09-22.fix-buck-loop-deferred-docs-and-in-cycle-resume/iterate-fix-buck-loop-deferred-docs-and-in-cycle-resume.md`

### Completion Matrix

| Step | Status | Evidence |
|---|---|---|
| 1. Freeze incident reproductions | ✅ complete | Exact Teleport wording and public `handleLoop` routing are covered in `scan.test.ts:384-421` and `loop.test.ts:401-416`. |
| 2. Current-impact classifier | 🔄 partial | Phase-aware matching exists at `scan.ts:346-400`, but the shared deferral regex accepts cross-domain prefixes and can clear the wrong impact flag. |
| 3. Documenting recovery | ✅ complete | `scan.ts:438-475`; corrected clean facts confirm the postcondition. Public regression at `loop.test.ts:418-434`. |
| 4. Durable ownership boundary | ✅ complete | `loop.ts:622-635` stages work before returning an in-cycle block and persists staging failures. |
| 5. Projection-aware resume | ✅ complete | `loop.ts:208-242,546-581` preserves protected-branch ordering, projection validation, staged-only provenance, and identity reconciliation. |
| 6. Public safety matrix | ✅ complete | Public tests cover successful staged resume and rejection of untracked, unstaged, mixed, non-blocked, protected, and unreadable states. |
| 7. Verification | ✅ complete | Focused suite passed 153 tests; durable guardrails passed. |

### Review Axes
- **Spec axis worst finding:** Cross-domain deferral wording can suppress the wrong impact flag.
- **Standards axis worst finding:** None beyond the spec defect; sequential fallback used with the TypeScript, universal-quality, error-handling, Long Method, and Duplicate Code guides.
- Cross-axis ranking: none.

### Finding

`extensions/buck-loop/scan.ts:363-394`

`NAMED_PHASE_DEFERRAL` accepts documentation, living-document, and how-to prefixes. The same expression is passed to both impact classifiers. During Phase 2:

- Documentation Impact: `How-to coverage is deferred to Phase 5.` incorrectly clears `docsImpact`.
- How-to Impact: `Documentation work is deferred to Phase 5.` incorrectly clears `howtoImpact`.

That violates the fail-closed requirement: the corresponding section never deferred its own domain, yet the report can route directly to save.

The iteration artifact proposes domain-specific deferral matching while retaining an explicitly prefixless `Deferred to Phase N` form.

### Verification Status
- Goal achieved: **partial**
- User goal: Resume safety is met; conservative deferred-impact routing remains incomplete.
- Scope adhered: yes
- Out-of-scope changes: none found

### Guardrails Verdict
- Contract: durable
- Contract version: 2
- Status: pass
- Gates: `unit_test_gate=pass`, `functional_test_gate=skipped`, `lint_gate=skipped`, `patch_gate=pass`, `global_ratchet=pass`, `complexity_gate=pass`
- Coverage: 85.6%
- Complexity: no new violations

### Documentation Impact
- No documentation impact.

### How-to Impact
- No how-to impact.

### Issue Classification
- In-plan issues: **1** — fail-closed current-impact classifier defect.
- Out-of-plan issues: none.

### Verdict
**Needs work**

### Recommended Next Step
Return the reopened iteration artifact to `/b-iterate`, then re-run `/b-review` against the same plan.
