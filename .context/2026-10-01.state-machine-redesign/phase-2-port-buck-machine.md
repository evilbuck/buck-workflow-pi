---
status: pending
phase: 2
order: 2
plan: plan-state-machine-module-cutover.md
phases_overview: plan-state-machine-module-cutover-phases.md
difficulty: hard
model_hint: strongest reasoning model; high-blast-radius routing port of the buck-loop supervisor
buck_hint: /b-build-hard
goal: "Port buckMachine onto extensions/state_machine with exported API and persisted vocabulary unchanged; buck-loop behavior identical."
files: [extensions/buck-loop/machine.ts, extensions/buck-loop/__tests__/machine.test.ts]
from_plan_steps: [5, 6, 7, 8, 9, 10]
depends_on: [1]
dependency_type: HARD
acceptance_criteria:
  - "[ ] Exports unchanged: next, applyChoice, legalChoices, start, userConfirmed, stopFrom, limitsExceeded, MAX_ITERATE_CYCLES_PER_PHASE, BuckEvent/BuckOutput as used"
  - "[ ] Ported machine.test.ts pins identical to/effect/why for every former rule; MachineFailure replaced by new error types"
  - "[ ] Test asserts every non-final state has a manual edge to aborted"
  - "[ ] next(s) adapter policy: one target → transition; >1 only when a decision is open (ambiguousChoiceOpen / reviewUnparseable) → choose effect with legal Choice[] (A-2 mapping); otherwise typed error naming state and targets"
  - "[ ] git diff --stat extensions/buck-loop/types.ts extensions/buck-loop/loop.ts extensions/buck-loop/choice.ts is empty (A-1 validated)"
  - "[ ] buck-loop/__tests__/loop.test.ts and persist.test.ts pass unmodified"
  - "[ ] Ported truth table covers every former rule's wording difference via facts-derived reasons (A-3 validated)"
completed_at: null
completed_by: null
---

# Phase 2: Port buckMachine

## Context

Parent User Goal: one engine, behavior unchanged — a developer reads states/edges/guards/effects in one place; buck-loop runs on the new module identically.

**Deferred assumption owner:** A-1 (no persisted-format change) and A-3 (wording derivable from facts) are validated in this phase — see acceptance criteria.

**Execution hazard:** this phase edits the loop's own supervisor. Run outside `/buck-loop`, or restart OMP after; verify in a fresh process, never via `/reload`.

## Implementation Details

5. Rewrite `extensions/buck-loop/machine.ts` over `../state_machine/index.js`. Graph per research table (`research-buck-loop-mapping.md`); `idle` initial; `done`, `aborted` final with `targets: []`.
6. Machine facts = `Snapshot & { sqlMemoryConfigured: boolean }`, built inside the adapter (replaces the `process.env.SQL_MEMORY_URL` read in a guard; no `Snapshot` change).
7. Multi-rule edges: one guard per edge (OR of former `when`s) plus reason functions (`blockReason`, `rerunReason`, …) used by both guard and effect, preserving every former `why` string verbatim.
8. Operator edges: `const STOP = { name: "aborted", manual: true }` spread into every non-final state; `idle → resolving` manual (START); `blocked → reviewing` / `blocked → resolving` manual with guards `completedBlockedWork` / negation (USER_CONFIRMED).
9. Adapter policy in `next(s)`: `restore(s.state)`, `available(facts)`; one → transition; more than one **and** a decision is open per facts → `choose` effect with legal `Choice[]` mapped from targets (self = `retry`; `reviewing`: iterating/documenting/saving = iterate/document/save; other non-self = `advance`); otherwise throw a typed error naming state and targets. `applyChoice` maps `Choice` → target, validates against `available`, transitions. `stopFrom` keeps the `done`/`aborted` special case.
10. Port `__tests__/machine.test.ts`: identical `to`/`effect`/`why` expectations; replace `MachineFailure` with the new error types; add a test that every non-final state has a manual edge to `aborted`.

## Risks

- Routing drift (wrong stage or `why`) → the truth table with identical expectations plus unchanged `loop.test.ts` (1443 lines) is the safety net.
- In-flight saved run breaks after upgrade → A-1: no persisted format change; `persist.test.ts` + resume scenarios pass unmodified.
- Stale-module hazard → restart OMP; verify fresh.

## Verification

- `npx vitest run extensions/buck-loop` (machine, loop, persist suites)
- `git diff --stat extensions/buck-loop/{types,loop,choice}.ts` empty; `git diff extensions/buck-loop/__tests__/loop.test.ts extensions/buck-loop/__tests__/persist.test.ts` empty
- `npx tsc --noEmit -p .`

## Per-Phase Execution Loop

1. Run `/b-build-hard` for this phase only (outside `/buck-loop` or after an OMP restart).
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact, run `/b-iterate`, then re-run `/b-review`. Out-of-plan issues → separate `/b-plan` → `/b-build` follow-up. Doc impact → `/b-docs` before `/b-save`.
4. Run `/b-save`, then `/b-commit`.
5. If incomplete, leave `status: in-progress`.
