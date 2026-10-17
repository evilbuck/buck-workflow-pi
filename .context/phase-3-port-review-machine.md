---
status: completed
phase: 3
order: 3
plan: plan-state-machine-module-cutover.md
phases_overview: plan-state-machine-module-cutover-phases.md
difficulty: medium
model_hint: capable general model; rule-for-edge port with a small loop.ts touchpoint
buck_hint: /b-build
goal: "Port reviewMachine onto extensions/state_machine with outputs and rule labels unchanged; the review/fix loop behaves identically."
files: [extensions/code-review-iteration/machine.ts, extensions/code-review-iteration/loop.ts, extensions/code-review-iteration/__tests__/machine.test.ts, extensions/code-review-iteration/__tests__/loop-machine-failure.test.ts]
from_plan_steps: [11, 12, 13, 14]
depends_on: [1]
dependency_type: SOFT
acceptance_criteria:
  - "[x] Machine edges map rule-for-edge; outputs unchanged including rule labels (A-6 validated by truth-table tests pinning to + output.rule for all 13 legacy rules (corrected source count))"
  - "[x] Terminal states final with targets: []; cancelled reached by a manual edge from every non-final state"
  - "[x] decide(facts) exported: exactly one available → { to, output }; otherwise ReviewMachineError(NO_ROUTE | AMBIGUOUS_ROUTE, context)"
  - "[x] machineFailureReason formats as 'review machine <code>: <context>'"
  - "[x] loop.ts uses decide(facts) and imports ReviewMachineError (no MachineFailure)"
  - "[x] __tests__/loop.test.ts diff empty and green; exclusivity sweep green against ReviewMachineError"
completed_at: "2026-10-01T14:16:17.944615+00:00"
completed_by: b-build
---

# Phase 3: Port reviewMachine

## Context

Parent User Goal: one engine, behavior unchanged — the code-review-iteration Reviewer → Fixer → Reviewer loop runs on the new module with identical outputs and status reporting.

**Deferred assumption owner:** A-6 (rule-for-edge mapping except the `initializing` self-loop) is validated here via the truth-table tests.

**Execution hazard:** like Phase 2, this edits the code-review-iteration supervisor. Run outside `/buck-loop` or restart OMP after; verify in a fresh process.

Note: HARD-depends only on Phase 1; it SOFT-depends on Phase 2 (could start after Phase 1 with independent suites), but the plan sequences it after Phase 2 to keep each cutover commit isolated and revertible.

## Implementation Details

11. Rewrite `extensions/code-review-iteration/machine.ts`: edges per current rules (outputs unchanged, including `rule` labels); terminal states final with `targets: []`; `cancelled` reached by a `manual` edge from every non-final state (mirrors STOP; satisfies reachability).
12. Export adapter `decide(facts)`: `restore(facts.state)`, `available(facts)`; exactly one → `{ to, output }`; otherwise throw `ReviewMachineError(code: "NO_ROUTE" | "AMBIGUOUS_ROUTE", context)`. `machineFailureReason` formats it as `review machine <code>: <context>`.
13. `loop.ts`: replace `reviewMachine.advance` + `decision.kind` check with `decide(facts)`; replace the `MachineFailure` import with `ReviewMachineError`.
14. Port `__tests__/machine.test.ts` (row layer + exclusivity sweep against `ReviewMachineError`) and `__tests__/loop-machine-failure.test.ts` (throw `ReviewMachineError("NO_ROUTE", …)`; report still contains `review machine NO_ROUTE`).

## Risks

- Review-loop status drift → ported truth table + exclusivity sweep; `loop.test.ts` (24 scenarios) diff must be empty.
- Same stale-module hazard as Phase 2 → fresh process verification.

## Verification

- `npx vitest run extensions/code-review-iteration`
- `git diff extensions/code-review-iteration/__tests__/loop.test.ts` empty
- `npx tsc --noEmit -p .`

## Per-Phase Execution Loop

1. Run `/b-build` for this phase only (outside `/buck-loop` or after an OMP restart).
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact, run `/b-iterate`, then re-run `/b-review`. Out-of-plan issues → separate `/b-plan` → `/b-build` follow-up. Doc impact → `/b-docs` before `/b-save`.
4. Run `/b-save`, then `/b-commit`.
5. If incomplete, leave `status: in-progress`.
