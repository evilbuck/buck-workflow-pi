## Plan Path Review: Phase 1 — Generic Evaluator Contract

### Plan Source
- File: `.context/2026-09-19.reusable-state-machine/phase-1-generic-evaluator-contract.md`
- Goal: Define and prove a domain-neutral synchronous evaluator before Buck migration.
- Baseline: Current `HEAD` `3b72889`; source-state verification used because the working tree contains concurrent unrelated changes.

### Evidence Sources
- Implementation: `extensions/state-machine.ts`
- Contract tests: `extensions/state-machine.test.ts`
- Focused verification: 12/12 tests passed.
- Buck scope check: no `extensions/buck-loop/**` changes.
- Forbidden dependency scan: no imports or async/platform globals found.
- Durable guardrails: passed.

### Completion Matrix

| Step | Status | Evidence |
|---|---|---|
| Inventory required edge categories | ✅ complete | Tests cover automatic routes, ambiguity, no-route, choices, events, terminal paths, missing states, and invalid targets. |
| Add contract tests | 🔄 partial | Core cases pass, but no test covers mutation of an object returned by `advance()`. |
| Add non-Buck fixture | ✅ complete | Publishing fixture at `extensions/state-machine.test.ts:4-85` exercises automatic, choice, event, failure, and opaque-output behavior. |
| Implement `defineMachine`, `advance`, `choose`, `send` | 🔄 partial | API exists, but `advance()` leaks authoritative choice objects by reference at `extensions/state-machine.ts:182-184`. |
| Return structured typed failures | ✅ complete | `MachineFailure` supplies stable codes and context at `extensions/state-machine.ts:9-46`. |
| Reject automatic ambiguity without declaration priority | ✅ complete | Shared route evaluation rejects multiple automatic routes and automatic/choice overlap at `extensions/state-machine.ts:143-169`. |

### Review Axes
- **Spec axis worst finding:** Offered choices expose mutable machine declarations. A consumer can mutate an object returned by `advance()`, changing the canonical object later passed to `rule.output` by `choose()` (`extensions/state-machine.ts:182-184`, `195-205`). This reopens the forged-choice injection path.
- **Standards axis worst finding:** Same mutable-alias boundary; a public result exposes internal configuration state without defensive isolation. Sequential fallback pass used with the TypeScript guide and relevant long-method/duplicate-code smell guides.
- **Cross-axis ranking:** None.

### Verification Status
- Goal achieved: **No**
- User goal: **Partially met by design** — generic evaluator exists, but Phase 1’s closed-choice invariant is incomplete; Buck migration belongs to Phase 2.
- Scope adhered: **Yes**
- Out-of-scope changes attributable to this phase: **None**
- Concurrent unrelated dirty paths exist outside the phase and were excluded from the verdict.

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
- Coverage: 81.7% versus 79.4% baseline.
- Focused suite: 1 file, 12/12 tests passed.

### User Goal Analysis
- Goal: Extension authors can define deterministic, fail-closed state machines while preserving `/buck-loop`.
- Met: Pure synchronous evaluator, three-operation interface, typed failures, domain-neutral fixture.
- Partial: Closed-choice authority remains externally mutable.
- Missing: Buck preservation is intentionally deferred to Phase 2.
- Verdict: **Partially met**

### Documentation Impact
- The evaluator/adapter architecture requires living-documentation updates, already assigned to Phase 3.
- Recommended: Do not expand Phase 1; retain the Phase 3 documentation work.

### How-to Impact
- No how-to impact.

### Issue Classification
- In-plan issues:
  1. `advance()` returns rule-owned choice objects by reference, allowing callers to mutate the declaration later trusted by `choose()`.
- Out-of-plan issues: None.

### Verdict
**Needs work**

The active iteration artifact was reopened and updated:

`.context/2026-09-19.reusable-state-machine/iterate-reusable-state-machine.md`

### Recommended Next Step
Supervisor should route the active iteration through `/b-iterate`, then repeat `/b-review` against the same Phase 1 file.
