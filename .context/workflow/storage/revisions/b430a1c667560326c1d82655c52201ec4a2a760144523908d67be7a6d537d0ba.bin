## Plan Path Review: Phase 1 Profile Config and Resolution

### Plan Source
- File: `.context/2026-09-22.buck-loop-model-config/phase-1-profile-config-and-resolution.md`
- Goal: Lossless, deterministic source of active Buck profile stages and available candidates. No runtime caller cutover.
- Baseline: uncommitted work on `fd778e3`. Phase evidence is `extensions/omp-models.ts`, `extensions/omp-models.test.ts`, and the `yaml` dependency. `extensions/buck-loop/*` is dirty and out of this phase.

### Evidence Sources
- Git status: phase files modified; buck-loop files also dirty; phase artifacts untracked.
- Recent commits: none for this phase.
- Modified phase files: `extensions/omp-models.ts`, `extensions/omp-models.test.ts`, `package.json`, `package-lock.json`.
- Plan affected files verified: those four. Buck-loop diffs were not treated as phase 1.

### Completion Matrix

| Step | Status | Evidence |
|------|--------|----------|
| 1. Typed `buckModels` and the twelve stage keys | ✅ complete | `BUCK_STAGE_KEYS` at `extensions/omp-models.ts:187-200`. Unknown keys skipped in `parseProfile` (`:312-314`). |
| 2. Independent parse; `modelRoles` unchanged | ✅ complete | `parseBuckModels` (`:319-333`). Existing role tests still pass (30/30). |
| 3. Active name, then stage, project-then-global; presence is the key | ✅ complete | `resolveActiveName` (`:396-404`); `lookupStage` uses `hasOwnProperty` (`:349-356`); empty project stage wins in `resolveBuckStage` (`:434-438`) and in the empty-list test. |
| 4. Availability filter does not mutate saved ids | ✅ complete | `filterAvailable` (`:406-417`); test keeps `provider/gone` on the parsed stage. |
| 5. Structured stops and messages | ✅ complete | `BuckResolveStop` (`:230-234`); `formatBuckStop` (`:335-346`) includes the profile, stage, or excluded ids. |
| 6. Lossless read-modify-write; direct `yaml` dep | ✅ complete | `writeBuckProfile` uses `parseDocument` and `doc.set("buckModels", …)` (`:498-508`). `package.json` depends on `yaml`. Write test keeps `theme` and `modelRoles`. |
| 7. Behavioral tests plus role regression | ✅ complete | `npx vitest run extensions/omp-models.test.ts --reporter=verbose`: 30 passed. |
| Guardrails before completion | ⚠️ not-verifiable as a phase-1 defect | Contract v2 `status: fail` only from `extensions/buck-loop/choice.ts` `promptFor` (15) and `choice.test.ts` anonymous functions (13, 18). No new violation in phase files. This phase forbids editing those callers. |

### Review Axes
- Spec axis worst finding: none. Precedence, empty-vs-omitted, stops, filter, and lossless sibling-key writes match the phase.
- Standards axis worst finding: `writeBuckProfile` rebuilds the whole `buckModels` node from the parsed model, so non-stage keys under a profile are dropped on save. Sibling keys such as `modelRoles` are kept. Sequential fallback; no background sub-agent in this harness.
- Cross-axis ranking: none.

### Verification Status
- Goal achieved: yes, for this phase's config boundary.
- User goal: partially met. Profiles can be parsed, resolved, and written. Switching them at runtime is later phases.
- Scope adhered: yes for phase 1 files.
- Out-of-scope changes: dirty `extensions/buck-loop/*` and tests. Not introduced as this phase's cutover.

### Guardrails Verdict
- Contract: durable
- Contract version: 2
- Status: fail
- Gates: unit_test_gate=pass, functional_test_gate=skipped, lint_gate=skipped, patch_gate=pass, global_ratchet=pass, complexity_gate=fail

The failure is outside the phase file list. It does not reopen phase 1's resolver.

### User Goal Analysis
- Goal: Not defined on the phase file. Parent user goal is switching a named profile instead of one phase-wide role chain.
- Met: config parse, resolve, filter, and lossless write.
- Partial: no runtime switch yet.
- Missing: picker, loop cutover, command, docs. Those are phases 2–6.
- Verdict: partially met for the parent goal; met for phase 1.

### Documentation Impact
- No documentation impact
- Command and workflow docs are phase 6.
- Recommended: none

### How-to Impact
- No how-to impact
- No new user-facing action in this phase.
- Recommended: none

### Issue Classification
- In-plan issues (implementation defects → `/b-iterate`): none
- Out-of-plan issues (scope discoveries → fresh `/b-plan`): whole-tree `complexity_gate` still fails in `extensions/buck-loop/choice.ts` and `extensions/buck-loop/__tests__/choice.test.ts`. Do not fix that inside phase 1.

### Verdict
Pass with warnings. In-plan work is complete. The dirty-tree guardrails failure is follow-up, not a phase 1 defect.

### Recommended Next Step
Do not start phase 2 from this review. Close accepted phase 1 work with `/b-save` → `/b-commit` only if that commit excludes the unrelated buck-loop diffs. Those diffs still fail the required complexity gate, so a mixed-tree commit will not pass guardrails. Route the buck-loop complexity separately; do not `/b-iterate` it against this phase.

Summary
Documentation impact: none
How-to impact: none
Suggested next step: `/b-save` → `/b-commit` for phase 1 files only. Leave `extensions/buck-loop/*` out of that commit.
