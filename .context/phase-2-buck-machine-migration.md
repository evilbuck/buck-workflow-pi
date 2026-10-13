---
status: completed
phase: 2
order: 2
plan: plan-reusable-state-machine.md
phases_overview: plan-reusable-state-machine-phases.md
difficulty: hard
model_hint: strongest reasoning model available — this replaces a live fail-closed state graph while preserving supervisor behavior and concurrent Buck changes
buck_hint: /b-build-hard
goal: "Express Buck policy over the generic evaluator, migrate every caller, and remove the legacy table without observable behavior drift."
files:
  - extensions/buck-loop/machine.ts
  - extensions/buck-loop/__tests__/machine.test.ts
  - extensions/buck-loop/types.ts
  - extensions/buck-loop/loop.ts
  - extensions/buck-loop/index.ts
  - extensions/buck-loop/__tests__/
  - extensions/buck-loop/table.ts
  - extensions/buck-loop/__tests__/table.test.ts
from_plan_steps: [3, 4, 5, 6]
depends_on: [1]
dependency_type: HARD
acceptance_criteria:
  - "[x] `extensions/buck-loop/machine.ts` is the only module combining generic evaluator rules with Buck states, facts, skills, choices, events, and effects."
  - "[x] Existing automatic transitions, START / USER_CONFIRMED / STOP edges, retry and safety ceilings, completion behavior, and iterate > docs/how-to > save priority remain behaviorally identical."
  - "[x] Buck automatic priorities are mutually exclusive guards; no declaration-order priority enters the generic evaluator."
  - "[x] `loop.ts` remains the sole effect interpreter and retains scanning, persistence, timestamps, counters, model calls, nested sessions, retries, and durable block conversion."
  - "[x] Ambiguous, no-route, illegal-choice, and invalid-event decisions become the existing durable `blocked` outcome with an operationally useful reason."
  - "[x] Every legacy table export caller is migrated; `table.ts`, `table.test.ts`, aliases, re-exports, and dead comments are removed."
  - "[x] `extensions/b-flow/**` remains untouched and unwired; no dependency is added."
  - "[x] Focused core and Buck-loop suites pass."
completed_at: 2026-09-20
completed_by: b-build-hard
---

# Phase 2: Buck Machine Migration

## Context

Parent user goal: Extension authors can define and test deterministic, fail-closed state machines without rebuilding dispatch and closed-choice validation, while `/buck-loop` keeps its current behavior.

Phase 1 supplies the real generic contract. This phase performs the load-bearing cutover: Buck policy moves into a domain adapter while the existing supervisor keeps ownership of all host work and persistence.

## Implementation Details

1. Refresh the implementation baseline from current HEAD. Preserve commit `478dc6b` and compatible changes landed after the parent plan, especially around chooser context, artifact scanning, lifecycle hooks, loop behavior, and guardrails. The separate context-free chooser-stall item remains out of scope.

2. Before changing exports, run LSP references for every exported symbol from `extensions/buck-loop/table.ts`. Use that inventory to identify all runtime, test, and comment callers; do not rely on the parent plan's file list alone.

3. Create `extensions/buck-loop/machine.ts` with named pure Buck guards and outputs over the Phase 1 evaluator. Keep Buck facts, state names, work skills, choices, events, effects, retry gates, and safety ceilings out of the generic core.

4. Encode Buck priority with mutually exclusive guards:
   - iterate when review requires in-plan iteration;
   - otherwise docs/how-to when documentation work is required;
   - otherwise clean save;
   - preserve retry, loop, and iterate ceilings;
   - preserve ungated terminal completion exactly as the current table does.

5. Route automatic decisions through `advance`, closed choices through `choose`, and START / USER_CONFIRMED / STOP through `send`. Adapt typed evaluator failures at the supervisor boundary into the existing durable `blocked` behavior with useful reasons.

6. Keep `loop.ts` as the sole effect interpreter. Do not move scanning, persistence, timestamps, counter updates, choice-model calls, nested sessions, cancellation, retries, or effect execution into machine callbacks or generic hooks.

7. Port the behavioral transition truth table into `extensions/buck-loop/__tests__/machine.test.ts`. Delete regex/source-text purity checks; retain consumer-observable state, output, legal-choice, limit, retry, priority, and failure assertions.

8. Migrate all remaining Buck tests and callers. Remove `table.ts`, `table.test.ts`, aliases, re-exports, and obsolete comments only after the LSP caller inventory is empty.

## Risks

- **Priority regression:** several guards can become simultaneously true after declarative migration. Make Buck guards mutually exclusive and keep core ambiguity failure enabled.
- **Supervisor leakage:** evaluator callbacks that touch persistence or I/O recreate the rejected async supervisor. Keep outputs as data and execute them only in `loop.ts`.
- **Operational drift:** persisted reasons and blocked state are operator-facing behavior. Assert useful reason categories and the durable blocked transition, not incidental exact prose.
- **Moving baseline:** stale source reconstruction could erase concurrent chooser or lifecycle fixes. Re-read and adapt; never reset those files to plan-era contents.
- **Partial cutover:** compatibility wrappers would leave two interfaces. Migrate every caller and delete the old path in the same phase.

## Verification

- `npx vitest run extensions/state-machine.test.ts extensions/buck-loop/__tests__/machine.test.ts extensions/buck-loop/__tests__/loop.test.ts extensions/buck-loop/__tests__/persist.test.ts`
- `npx vitest run extensions/buck-loop/__tests__`
- LSP reference inventory covers every old `table.ts` export before deletion; after migration, no legacy import, alias, re-export, or comment remains.
- Confirm `loop.ts` still owns every effect-execution and persistence branch.
- Confirm `extensions/b-flow/**`, dependency manifests, and lockfiles are unchanged.

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Run the indicated Buck build command (`buck_hint`) for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this phase), do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If the phase is incomplete, leave `status: in-progress` so the session resumes here next turn.
