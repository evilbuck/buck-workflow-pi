---
status: pending
phase: 5
order: 5
plan: plan-buck-loop-extension.md
phases_overview: plan-buck-loop-extension-phases.md
difficulty: hard
model_hint: strongest reasoning model available — this phase joins artifact truth, model validation, nested effects, retries, counters, and durable transitions
buck_hint: /b-build-hard
goal: "Integrate the transition table, artifact scan, choice boundary, work runner, and projection into one bounded happy-path supervisor."
files:
  - extensions/buck-loop/loop.ts
  - extensions/buck-loop/__tests__/loop.test.ts
from_plan_steps: [5]
depends_on: [2, 3, 4]
dependency_type: HARD
acceptance_criteria:
  - "[ ] The supervisor repeatedly performs `next(scan(snapshot))` → one effect → postcondition rescan → persisted transition; worker prose never selects state."
  - "[ ] Failed, empty, thrown, or timed-out work sessions retry once and then transition to `blocked` with a durable reason."
  - "[ ] `loopCount >= maxLoops` and three iterate cycles on one phase block further work."
  - "[ ] Ambiguous cases call the closed-set choice helper and apply only an accepted legal choice."
  - "[ ] `--stop` support writes `aborted`; resume reconciles artifacts before work; every accepted transition appends durable history."
  - "[ ] After commit, the next incomplete phase returns to `building`; no remaining phase returns `done`."
  - "[ ] Focused supervisor tests pass with mocked work and choice sessions, including artifact-wins resume."
completed_at: null
completed_by: null
---

# Phase 5: Loop Supervisor

## Context

Parent user goal: An operator can leave a well-scoped Buck plan running unattended through build → review → iterate-if-needed → docs-if-needed → save → commit → next phase, without XState. Every transition is either a deterministic disk/git check or a closed-set LLM choice the machine validates.

This is the integration join. Phases 2–4 must be complete. `loop.ts` coordinates their narrow contracts; it must not duplicate scanning, model validation, or skill execution logic.

## Implementation Details

1. Create `loop.ts` as a hand-rolled bounded `while` loop in the same family as `extensions/code-review-iteration/loop.ts`; do not add an FSM dependency.
2. For each cycle:
   - rescan authoritative artifacts;
   - reconcile the projection;
   - call Phase 1 `next()`;
   - execute exactly one returned effect;
   - rescan postconditions;
   - append transition history and persist the projection.
3. Map work states to the exact Buck skills from the parent plan. Build uses phase `buck_hint`; review, iterate, docs/how-to, save, and commit use their corresponding injected skill.
4. Handle ambiguous choice effects only through Phase 3. Apply an accepted legal value; otherwise transition to `blocked`.
5. Retry a failed work effect once. After the second failure, persist `blocked` with the step and diagnostic reason. Never retry indefinitely.
6. Enforce both safety counters before launching more work: maximum total loops and three iterate cycles on one phase.
7. After commit, rescan for the next incomplete phase. Reset the per-phase iterate counter only when the active phase changes. Return `building` for the next phase or `done` when no work remains.
8. Provide supervisor operations needed by the command layer: start from an explicit target, resume from projection plus rescan, status without work, and stop that persists `aborted`.
9. Add mocked integration tests for the clean path, iterate/re-review path, documentation path, retry-then-block, illegal choice block, stop, safety limits, next-phase continuation, completion, and artifact-wins resume.

## Risks

- Duplicating transition conditions in `loop.ts` would let table and runtime disagree. The loop executes effects; `table.ts` decides legality.
- Persisting only at the end loses the last accepted transition on crash. Persist each transition and terminal block/abort.
- Resetting iterate counters on every scan makes loops unbounded; reset only when phase identity changes.
- Retrying non-idempotent steps blindly can duplicate commits. The postcondition rescan must run before deciding whether a retry is legal.

## Verification

- Run `vitest run extensions/buck-loop/__tests__/loop.test.ts` plus all Phase 1–4 focused tests.
- Prove with mocks that no worker text is parsed for next-state selection and no choice outside the table's legal set is applied.
- Exercise projection `building` + completed artifacts and confirm terminal `done` without launching a nested session.

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Run the indicated Buck build command (`buck_hint`) for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. Route out-of-plan findings to a separate `/b-plan` → `/b-build` follow-up. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If incomplete, leave `status: in-progress` so the session resumes here next turn.
