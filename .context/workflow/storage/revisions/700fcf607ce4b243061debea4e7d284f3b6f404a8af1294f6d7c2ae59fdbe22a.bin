## Plan Path Review: Phase 2 TypeSafe Model Picker

### Plan Source
- File: `.context/2026-09-22.buck-loop-model-config/phase-2-typesafe-model-picker.md`
- Goal: Choose one available configured model from stage context, with deterministic failure handling and no host-model fallback.
- Baseline: `d5cff6c` (phase 1) plus untracked `extensions/buck-models/`. `extensions/typed-output/evaluator.ts` is unchanged.

### Evidence Sources
- Git status: new `extensions/buck-models/`; phase checkbox edits only in `.context/`.
- Modified files: `picker.ts`, `picker.test.ts`.
- Plan affected files verified: picker and tests present. Evaluator was not modified; the picker calls `createTypeSafeEvaluator`.

### Completion Matrix

| Step | Status | Evidence |
|------|--------|----------|
| Parent picker with injected evaluator and random seams | ✅ complete | `createBuckModelPicker` in `extensions/buck-models/picker.ts:44-51` |
| Choice request: stage, ids/notes, skill, caller context | ✅ complete | `choiceRequest` at `picker.ts:66-89`; test asserts the payload |
| Decode only remaining ids; confidence is not a threshold | ✅ complete | `memberChoice` at `picker.ts:99-108`; low-confidence test selects `provider/gamma` at `0.02` |
| Unavailable/error/no-answer uses injected uniform random, not first-id fallback | ✅ complete | `randomIndex` at `picker.ts:112-115`; positions `0`, `0.4`, `0.999` map to alpha/beta/gamma; injected `1` stops |
| Re-pick excludes failed id without mutating the resolution; exhaustion is a named-stage stop | ✅ complete | `pickModel` filters a copy at `picker.ts:123-128`; exhausted stop names `build` and lists excluded ids |
| Result carries resolved thinking, default `off` | ✅ complete | `thinking` copied from `ResolvedBuckStage`; phase 1 type documents omitted thinking as `off` (`omp-models.ts:213-216`); tests cover `off` and `high` |
| Focused Vitest | ✅ complete | `npx vitest run extensions/buck-models/picker.test.ts --reporter=verbose` — 5/5 passed |
| Guardrails | ✅ complete | durable contract v2, `status: pass` |

### Review Axes
- Spec axis worst finding: none
- Standards axis worst finding: none (sequential fallback; no background dispatch). Diff-scoped smells checked: duplicate code, primitive obsession, speculative generality, dead code. The repeated empty-note check in `choiceRequest` is local and not a defect. `context: unknown` is correct because the picker forwards caller context and does not inspect it.
- Cross-axis ranking: none

### Verification Status
- Goal achieved: yes
- User goal: partially met — this phase only selects a model. Profile switching remains later phases.
- Scope adhered: yes
- Out-of-scope changes: none. Runtime adapters are untouched.

### Guardrails Verdict
- Contract: durable
- Contract version: 2
- Status: pass
- Gates: unit_test_gate=pass, functional_test_gate=skipped, lint_gate=skipped, patch_gate=pass, global_ratchet=pass, complexity_gate=pass
- Coverage 86 vs baseline 84. `ratchet_update.baseline_coverage_rewrites: true` is a proposal only; this review did not write it.

### User Goal Analysis
- Goal: an engineer switches a named profile that maps stage groups to model-id sets and thinking levels.
- Met: selection policy for one resolved stage.
- Partial: no runtime cutover, command, or docs yet.
- Missing: phases 3–6, by plan.
- Verdict: partially met, as scoped for this phase.

### Documentation Impact
- No documentation impact
- The picker is not wired, and phase 6 owns the living-doc cutover.
- Recommended: none

### How-to Impact
- No how-to impact
- Recommended: none

### Issue Classification
- In-plan issues: none
- Out-of-plan issues: one. A single remaining candidate still builds a Choice request. `validateChoiceCriteria` requires at least two labels (`evaluator.ts:109-119`), so that call always fails and the last id is taken from `Math.random()`. Real `Math.random()` still selects that id. Short-circuiting a singleton would avoid the invalid request. Not this phase's acceptance contract.

### Verdict
Pass — no in-plan defects.

### Recommended Next Step
`/b-save`, then `/b-commit`. Do not run `/b-iterate` or `/b-docs`.

Summary
Documentation impact: none
How-to impact: none
Suggested next step: `/b-save` → `/b-commit`
