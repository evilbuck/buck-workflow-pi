---
status: pending
phase: 3
order: 3
plan: plan-review-severity-ranking.md
phases_overview: plan-review-severity-ranking-phases.md
difficulty: hard
model_hint: strongest reasoning model available
buck_hint: /b-build-hard
goal: "Wire the ranking state into the machine and loop: the new reviewing exit, all ranking exits, and the in-process rank effect handler."
omp_execution: orchestrate
files:
  - extensions/buck-loop/machine.ts
  - extensions/buck-loop/loop.ts
  - extensions/buck-loop/__tests__/machine.test.ts
  - extensions/buck-loop/__tests__/loop.test.ts
from_plan_steps: [4, 5, 6]
depends_on: [1, 2]
dependency_type: HARD
acceptance_criteria:
  - "[ ] A review with an unfinished iterate artifact transitions to `ranking` with effect `rank`, and never straight to `iterating`; no iterate artifact keeps today's docs, save, and unparseable-choice edges (A-2 unchanged)."
  - "[ ] From `ranking`: above-waterline issue + iterate budget remaining → `iterating`, and the iterate artifact contains only above-waterline ids; above-waterline + no budget → the existing limit block."
  - "[ ] No issue above the waterline and a parseable report → `documenting` when docs or howto impact is flagged, otherwise `saving`, including at the iterate ceiling; `hasIterate()` is false because the file is `below-waterline` (A-6)."
  - "[ ] None above and a garbled report → Jev evaluates docs impact and how-to impact; either yes → `documenting`, both no → `saving`; a second failure of that evaluation opens the existing choice — no iterate, no save (A-11)."
  - "[ ] `runEffect` handles `kind: \"rank\"` in-process: no nested session, no `choose()`, no profile chat model, no `iterateCyclesOnPhase` or `loopCount` increment for the rank call (A-4)."
  - "[ ] An unfinished iterate artifact that parses to zero issues blocks with a scan-defect reason; two unfinished iterate files block (A-10 at the machine edge)."
  - "[ ] Rollback check on record: a machine test names the old edge and asserts reverting it restores `iterate artifact present → iterating` (R-1 recovery check)."
completed_at: null
completed_by: null
---

# Phase 3: Machine Edges and the Rank Effect Handler

## Context

Parent user goal: the operator running autonomous `/buck-loop` stops paying time and tokens for review findings that do not matter — after review, each in-plan issue is severity-ranked and only an issue above the waterline starts `b-iterate`.

Phases 1–2 built the vocabulary and the engine. This phase makes the behavior live: the reviewing exit changes shape, `ranking` becomes reachable, and the machine (not Jev) picks `iterating`, `documenting`, `saving`, `blocked`, or the existing choice. This is the phase where autonomous-loop behavior actually changes.

Deferred assumption owned here: **A-11** (a docs/how-to evaluation that fails twice opens the existing choice; it does not iterate, save, or assume an update is needed). The operator can reject this default before this phase starts. R-1 and R-2 rollback paths are exercised here.

## Implementation Details

From plan steps 4, 5, and 6:

1. `machine.ts` reviewing exit: session ok + unfinished iterate artifact + ranking still pending → `ranking` with effect `rank`. Do not go straight to `iterating`. No iterate artifact → today's docs/save/unparseable edges untouched (A-2).
2. `machine.ts` ranking exits (after a completed rank):
   - Any above-waterline + iterate budget left → `iterating`.
   - Any above-waterline + no budget → existing limit block.
   - None above + parseable docs/howto flag → `documenting`; none above + parseable report with neither flag → `saving` (including at the iterate ceiling).
   - None above + garbled report → Jev for docs impact and how-to impact; either yes → `documenting`; both no → `saving`; second failure → the existing choice. Never offer iterate from `ranking` when nothing cleared the waterline.
   - Zero parsed issues from an accepted artifact → blocked (scan-defect reason). Two unfinished files → blocked.
3. `loop.ts` `runEffect`: handle `kind: "rank"` in-process using Phase 2's `rankIssues()`. No nested skill session, no `choose()`, no profile chat model. Retry is another `runJev`. Do not increment `iterateCyclesOnPhase` or `loopCount`.
4. Keep the R-1 rollback reachable: the pre-change assertion (`iterate artifact present → iterating`) is preserved as a named, reverted-edge test.

## Risks

- R-1: double Jev failure iterates an unscored finding — accepted operator rule; compensations: retry, note, audit file, and the rollback edge test.
- R-2: parser drops everything → blocked, not silent save; machine test proves it.
- This phase changes live autonomous behavior mid-project; the machine test suite must stay green end-to-end before commit.

## Verification

- `machine.test.ts`: every acceptance criterion above as a transition test; unparseable review with no iterate artifact still opens the existing choice.
- `loop.test.ts`: effect `rank` calls the injected ask function and does not spawn a skill session; counters unchanged.
- Focused vitest as the inner loop; `npm run guardrails:check` at closeout.

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Type the `orchestrate` keyword anywhere in the first turn, then run `/b-build-hard` for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` (in-plan issues), run `/b-iterate`, then re-run `/b-review`. Out-of-plan findings route to a separate `/b-plan` → `/b-build` follow-up. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If the phase is incomplete, leave `status: in-progress` so the session resumes here next turn.
