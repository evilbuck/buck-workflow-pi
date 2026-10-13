## Plan Path Review: Phase 1 — Generic Evaluator Contract

### Plan Source
- File: `.context/2026-09-19.reusable-state-machine/phase-1-generic-evaluator-contract.md`
- Goal: Define a domain-neutral, synchronous, fail-closed evaluator before Buck migration.
- Baseline: `3b72889`; implementation files are untracked, so review used current-source inspection rather than commit diff.

### Evidence Sources
- Git status: `extensions/state-machine.ts` and `extensions/state-machine.test.ts` are untracked; broader pre-existing workflow/context changes are also present.
- Recent relevant commit: `083eb29 docs(planning): plan reusable state machine core`
- Modified implementation files:
  - `extensions/state-machine.ts`
  - `extensions/state-machine.test.ts`
- No `extensions/buck-loop/**` changes found.
- Focused tests: 11/11 passed.
- Runtime probe: a same-key forged choice changed output from declared `"reviewer"` to supplied `"admin"`.

### Completion Matrix

| Step | Status | Evidence |
|---|---|---|
| Inventory automatic, choice, event, validation, and failure paths | Complete | All categories are represented in `extensions/state-machine.ts:115-247` and focused tests. |
| Add contract tests | Partial | `extensions/state-machine.test.ts:99-227` covers listed paths, but forgery coverage only uses an unknown key. Same-key tampering is untested. |
| Add a non-Buck fixture | Complete | Publishing fixture exercises automatic, choice, event, failure, and opaque output paths at `extensions/state-machine.test.ts:4-86`. |
| Implement `defineMachine`, `advance`, `choose`, and `send` | Partial | Operations exist at `extensions/state-machine.ts:115-247`, but `choose()` validates by key and then passes untrusted candidate data to output at lines 208-217. |
| Provide structured typed failures without host/runtime concerns | Complete | `MachineFailure` and contexts are defined at `extensions/state-machine.ts:9-46`; dependency scan found no forbidden imports or host APIs. |
| Reject automatic ambiguity without declaration-order precedence | Complete | Cardinality checks exist at `extensions/state-machine.ts:157-173` and `191-207`; focused tests pass. |
| Verification | Partial | Focused suite and guardrails pass, but the runtime forgery probe violates an acceptance criterion. |

### Review Axes
- **Spec axis worst finding:** `choose()` accepts a candidate whose key matches a legal declaration but whose remaining fields are forged, then feeds those forged fields into `rule.output` (`extensions/state-machine.ts:208-217`).
- **Standards axis worst finding:** Caller-controlled choice data crosses the validation boundary after only partial identity validation. Sequential fallback pass used the TypeScript and universal-quality guides plus relevant duplicate-code/long-method/long-parameter/speculative-generality criteria.
- **Standards warning:** Automatic/choice route evaluation is duplicated between `advance()` and `choose()`, creating drift risk.
- Cross-axis ranking: none.

### Verification Status
- Goal achieved: **partial**
- User goal: **partially met** — the pure reusable evaluator exists, but closed-choice validation is not yet fully fail-closed.
- Scope adhered: **yes** for implementation scope.
- Out-of-scope changes: none attributable to this phase; no `extensions/buck-loop/**` file changed.

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
- Coverage: 81.7% versus 79.4% baseline; patch coverage unavailable (`null`).

### User Goal Analysis
- Goal: Extension authors can define deterministic, fail-closed state machines without rebuilding dispatch and closed-choice validation.
- Met: Pure synchronous evaluator, generic outputs, automatic ambiguity handling, choice derivation, event dispatch, target validation, typed failures.
- Partial: Closed-choice validation trusts undeclared fields on a same-key candidate.
- Missing: Regression coverage and behavior preventing same-key choice-data injection.
- Verdict: **partially met**

### Documentation Impact
- The new module boundary will require living-documentation updates, but Phase 3 explicitly owns that work.
- Recommended: none during this phase.

### How-to Impact
- No how-to impact.
- Recommended: none.

### Issue Classification
- In-plan issues:
  1. Same-key forged choices can inject undeclared output data.
  2. Automatic/choice route evaluation is duplicated and can drift.
  3. Phase and overview currently claim completion despite an active review iteration.
- Out-of-plan issues: none.

### Verdict
**Needs work**

### Recommended Next Step
Run `/b-iterate` using:

`.context/2026-09-19.reusable-state-machine/iterate-reusable-state-machine.md`

The artifact includes the reproduction, proposed correction, regression-test requirement, route-evaluation warning, and phase-status reopening requirement. The supervisor retains authority over the next loop state.
