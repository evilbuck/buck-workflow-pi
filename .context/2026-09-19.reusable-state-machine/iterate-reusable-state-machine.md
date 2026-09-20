---
status: completed
date: 2026-09-20
updated: 2026-09-20
subject: 2026-09-19.reusable-state-machine
topics: [review, iteration, state-machine, closed-choice]
informs: []
addresses: phase-1-generic-evaluator-contract.md
completed: 2026-09-20
from_review: b-review
---

# Iteration: Reusable state-machine Phase 1

## Source

- Reviewed after: `/b-build`
- Plan: `plan-reusable-state-machine.md`
- Phase: `phase-1-generic-evaluator-contract.md`

## Critical Issues

### 1. SharedArrayBuffer choices bypass snapshot isolation

- **File**: `extensions/state-machine.ts:304-317`
- **Problem**: `cloneChoice()` treats every successful `structuredClone()` as an isolated snapshot, but cloning a `SharedArrayBuffer` produces a distinct object over the same shared memory. A supported choice containing a `SharedArrayBuffer` therefore lets either the caller-owned declaration or an offered choice mutate the evaluator's canonical snapshot. The live reproduction changed the offered choice's byte and then observed both the original declaration and `choose()` output change to `9`, violating the phase's fail-closed closed-choice contract.
- **Proposed fix**: Reject `SharedArrayBuffer` anywhere in a declared choice before accepting the snapshot, or implement a traversal that copies shared bytes into non-shared storage while preserving the declared `Choice` contract. Add a regression proving mutation of caller-owned and offered supported choices cannot alter the canonical output; retain definition-time `UNSUPPORTED_CHOICE` for representations the evaluator cannot isolate.
- **Resolution**: `cloneChoice()` now traverses each structured clone, including nested object properties, `Map` keys/values, `Set` entries, direct `SharedArrayBuffer` values, and array-buffer views. Any shared backing memory fails definition with `UNSUPPORTED_CHOICE` before the clone becomes canonical. The regression failed before the fix and now passes.

## Warnings

None.

## Recommended Workflow

Start with `/b-iterate` — it will pick up this file automatically.
Then re-run `/b-review` against `phase-1-generic-evaluator-contract.md`.
Inside an OMP execution session, the iterate artifact is not done until it is completed, review passes, and `/b-save` has recorded durable state.
For larger rework, use `/b-build` or `/b-build-hard`.

## Previous Iteration Resolution

- `choose()` now uses the enabled declaration's canonical `rule.choice` after key matching, so caller-supplied non-key fields cannot reach output callbacks.
- `advance()` and `choose()` now share one internal route evaluator for automatic ambiguity, legal choices, unique keys, and automatic/choice overlap.
- Added a same-key tampering regression: declared `"reviewer"` remains authoritative over submitted `"admin"`.
- Reopened Phase 1 and its overview to `in-progress` pending repeat review.
- `defineMachine()` now snapshots every declared choice with structured cloning, precomputes its canonical key, and returns a fresh isolated clone from `advance()`.
- `choose()` matches against the compiled key and passes a fresh clone of the canonical snapshot to output callbacks; neither offered-choice nor output-callback mutation can alter later decisions.
- Choices that structured cloning cannot isolate, including functions and proxies, fail at definition time with `UNSUPPORTED_CHOICE`.
- Added regressions covering unchanged caller definitions, mutable nested objects, `Date`, `Map`, canonical output behavior, and unsupported choices.
- Verification: focused suite 15/15; full Vitest unit gate 987/987; targeted strict TypeScript check passed. The durable contract disables lint.
