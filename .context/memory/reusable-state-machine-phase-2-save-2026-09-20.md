---
date: 2026-09-20
domains: [extensions, testing, refactor]
topics: [state-machine, buck-loop, machine, table-cutover, phase-2]
related:
  - reusable-state-machine-phase-2-iterate-2026-09-20.md
  - reusable-state-machine-phase-1-build-2026-09-20.md
priority: high
status: completed
subject: 2026-09-19.reusable-state-machine
artifacts:
  - phase-2-buck-machine-migration.md
  - iterate-reusable-state-machine.md
  - plan-reusable-state-machine.md
  - plan-reusable-state-machine-phases.md
  - draft-commit.md
---

# Phase 2 save: Buck machine migration

Cutover complete. `extensions/buck-loop/machine.ts` is the only module combining the generic evaluator with Buck states, facts, skills, choices, events, and effects. `loop.ts` remains the sole effect interpreter. `table.ts` and `table.test.ts` are gone.

Iterate closed the complexity-gate fail by splitting `reviewingState` / `committingState` into named helpers. Repeat review accepted the phase.

## Decisions

- Buck priority is mutually exclusive guards (iterate else docs/how-to else save). No declaration-order priority in the evaluator.
- Evaluator failures map at the supervisor boundary to durable `blocked` with an operational reason.
- `extensions/b-flow/**` untouched.

## Verification (from iterate + review)

- Focused machine + loop tests: 89/89
- `npm run guardrails:check`: `status: pass`, `complexity_gate: pass`

## Next

`/b-commit` using `draft-commit.md`. Phase 3 remains pending; subject lifecycle stays `active` (`close-verified` blocked on phase 3).
