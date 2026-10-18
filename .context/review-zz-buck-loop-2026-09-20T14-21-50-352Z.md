## Plan Path Review: Phase 1 — Generic Evaluator Contract

### Plan Source
- File: `.context/2026-09-19.reusable-state-machine/phase-1-generic-evaluator-contract.md`
- Goal: Define a domain-neutral synchronous evaluator with deterministic, fail-closed routing.
- Baseline: Current working tree against `3b72889`; source-state verification used because the branch contains unrelated concurrent changes.

### Evidence Sources
- Git status: `extensions/state-machine.ts` and `extensions/state-machine.test.ts` are new; no `extensions/buck-loop/**` file changed.
- Recent baseline: `3b72889 Merge pull request #44`.
- Plan affected files verified:
  - `extensions/state-machine.ts`
  - `extensions/state-machine.test.ts`
- Live reproduction: mutating an offered `SharedArrayBuffer` choice changed both the caller-owned declaration and subsequent `choose()` output to `9`.

### Completion Matrix

| Criterion | Status | Evidence |
|---|---|---|
| Domain-neutral, synchronous core with no platform imports | ✅ complete | `extensions/state-machine.ts:1-326` has no imports or async host behavior. |
| Operational interface limited to `advance`, `choose`, and `send` | ✅ complete | `CompiledMachine` at `extensions/state-machine.ts:104-108`. |
| Automatic ambiguity and no-route behavior fail closed | ✅ complete | `evaluateRoutes()` and `advance()` at lines 167-228; covered by focused tests. |
| Derived choices and `choose()` share rules; stale and forged choices fail closed | 🔄 partial | Rule revalidation exists at lines 231-255, but `SharedArrayBuffer` bypasses canonical choice isolation. |
| Event, terminal, missing-state, and target validation | ✅ complete | Lines 142-165 and 257-283; corresponding tests at `extensions/state-machine.test.ts:329-373`. |
| Non-Buck fixture proves automatic, choice, event, failure, and generic output paths | ✅ complete | Publishing fixture and contract tests at `extensions/state-machine.test.ts:4-374`. |

### Review Axes
- **Spec axis worst finding:** `cloneChoice()` accepts `SharedArrayBuffer`, whose structured clone shares underlying memory. This violates the phase’s closed-choice isolation guarantee.
- **Standards axis worst finding:** Same data-integrity defect; sequential fallback pass used with the TypeScript guide and relevant long-method, duplicate-code, primitive-obsession, and speculative-generality smell guides.
- **Cross-axis ranking:** None.

### Verification Status
- Goal achieved: **Partial**
- User goal: **Partially met** — the generic evaluator exists, but legal-choice authority is not fully isolated.
- Scope adhered: **Yes**
- Out-of-scope changes: None attributable to Phase 1. The dirty tree contains unrelated documentation and workflow changes.

### Guardrails Verdict
- Contract: `durable`
- Contract version: `2`
- Status: `pass`
- Gates:
  - `unit_test_gate=pass`
  - `functional_test_gate=skipped`
  - `lint_gate=skipped`
  - `patch_gate=pass` advisory; patch coverage unavailable
  - `global_ratchet=pass`
  - `complexity_gate=pass`
- Coverage: 81.8% against 79.4% baseline.

### Finding

**SharedArrayBuffer choices bypass snapshot isolation** — in-plan.

`cloneChoice()` at `extensions/state-machine.ts:304-317` assumes successful `structuredClone()` means independent storage. `SharedArrayBuffer` clones share their backing memory. An offered choice can therefore mutate the internal canonical snapshot and the original declaration.

Observed reproduction:

```json
{"caller":9,"output":9}
```

The active iteration artifact was updated:

`.context/2026-09-19.reusable-state-machine/iterate-reusable-state-machine.md`

### Documentation Impact
- The evaluator introduces a new architectural seam, but architecture documentation is explicitly assigned to Phase 3.
- No Phase 1 documentation action recommended.

### How-to Impact
- No how-to impact.

### Issue Classification
- In-plan issues: **1** — incomplete closed-choice isolation.
- Out-of-plan issues: **none**.

### Verdict

**Needs work** — guardrails pass, but one Phase 1 acceptance invariant remains violated.

### Supervisor Handoff
The contract routes this finding to `/b-iterate`; loop-state selection remains with the supervisor.
