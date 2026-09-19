---
date: 2026-09-18
domains: [extensions, testing, state-machine, review]
topics: [buck-loop, transition-table, phase-1, frozen-contract, b-review]
related: [buck-loop-extension-phasing-2026-09-18.md]
priority: high
status: completed
subject: 2026-09-18.buck-loop-extension
artifacts:
  - phase-1-transition-contract.md
  - plan-buck-loop-extension.md
  - plan-buck-loop-extension-phases.md
  - draft-commit.md
---

# buck-loop Phase 1: Transition Contract (build + review + save)

Built and reviewed the frozen pure contract for `extensions/buck-loop/` per
`.context/2026-09-18.buck-loop-extension/phase-1-transition-contract.md`.

`/b-review` against the phase file: **Pass**. No in-plan issues, no iterate
artifact, no documentation or how-to impact this phase (ADR/living docs are
Phase 7).

## What exists now

- `extensions/buck-loop/types.ts` — `LoopState` (11 user-visible states),
  `Snapshot` (identity + safety counters + artifact facts + lastChoice + history),
  closed `Choice` (iterate|document|save|retry|advance|block), `Effect`
  (none | run-skill | choose | await-operator), `PlanFacts`/`WorkFacts`/`ReviewFacts`
  discriminated unions. Zero imports.
- `extensions/buck-loop/table.ts` — pure `legalChoices(state, snapshot)`,
  `next(snapshot)`, `applyChoice(choice, snapshot)`, `limitsExceeded`,
  operator-edge helpers `start()`/`userConfirmed()`/`stopFrom()`,
  `MAX_ITERATE_CYCLES_PER_PHASE = 3`. Imports only `./types.js`.
- `extensions/buck-loop/__tests__/table.test.ts` — 66 tests, TDD red→green
  (64 failed against the throwing stub before implementation).

## Frozen design decisions (later phases must not fork)

- **Limits gating rule**: `loopCount >= maxLoops` or `iterateCyclesOnPhase >= 3`
  blocks before any `run-skill`/`choose` effect is emitted; transitions to
  `done` pass through ungated. `legalChoices` returns `[]` under limits, so
  `applyChoice` throws for every choice there — accepted choices never need
  re-gating.
- **Review priority**: iterate artifact > docs/howto impact > save; choose set
  `[iterate, document, save, block]` fires only when report unparseable AND no
  iterate artifact AND no trusted impact flags.
- **Postcondition choose set** `[retry, advance, block]` applies to the five
  non-review work states; reviewing decides through `ReviewFacts` instead.
- **`next()` throws `IllegalTransitionError`** for idle/blocked/done/aborted —
  operator edges (START, USER_CONFIRMED, STOP) are command-layer property,
  exposed as pure helpers. No default advance anywhere.
- **Dispatch**: `next` uses `Record<LoopState, handler|null>` (compile-time
  exhaustive) instead of a switch — lizard complexity gate caps new functions
  at 10; the 11-case switch scored 12.
- **Scan contracts encoded in types.ts docs**: unparseable report ⇒ impact
  flags false; ok session ⇒ postcondition confirmed|ambiguous; facts reset per
  phase cycle. Phase 2 implements against these.

## Review (2026-09-18)

- Spec axis: all six acceptance criteria met with current-state evidence.
- Standards axis (non-blocking): fake `ALL_CHOICES` exhaustiveness guard;
  `ReviewFacts` product type allows `{ parseable: false, docsImpact: true }`;
  `legalChoices(state, s)` split vs `s.state`; `WORK_SKILL` is `Partial`;
  unreachable empty-choice branches; purity regex misses `node:fs/promises`.
- Guardrails: durable v2 pass — unit, ratchet (79.7 ≥ 79.4), complexity.
  Patch advisory (null; untracked new tree vs origin/master).
- Focused tests 66/66; full suite 803/803.

## Environment note

Worktree `autonomous-loop.wt` had no `node_modules` symlink; linked to
`../buck-workflow-pi/node_modules` (bare-`node_modules` gitignore rule held —
not committed).

## Next

`/b-commit` using `.context/2026-09-18.buck-loop-extension/draft-commit.md`.
After that commit, Phases 2–4 are unblocked and parallelizable.
