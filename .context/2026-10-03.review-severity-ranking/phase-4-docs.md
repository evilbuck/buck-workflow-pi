---
status: completed
phase: 4
order: 4
plan: plan-review-severity-ranking.md
phases_overview: plan-review-severity-ranking-phases.md
difficulty: easy
model_hint: smaller/faster general model is fine
buck_hint: /b-build
goal: "Document the new ranking state in the state diagram and, if present, the buck-loop review-exit sentence."
omp_execution: orchestrate
files:
  - docs/state-machine-diagram.html
  - docs/buck-loop.md
from_plan_steps: [7]
depends_on: [3]
dependency_type: HARD
acceptance_criteria:
  - "[x] `docs/state-machine-diagram.html` reviewing description reflects the new exit: unfinished iterate artifact goes to `ranking` (rank effect), not directly to `iterating`."
  - "[x] `docs/buck-loop.md` review-exit sentence updated if and only if that sentence exists; no other prose churn."
  - "[x] No site HTML copy of the state diagram was added (out of scope)."
completed_at: 2026-10-05
completed_by: manual-recovery
---

# Phase 4: State Diagram and Doc Sentence

## Context

Parent user goal: the operator running autonomous `/buck-loop` stops paying time and tokens for review findings that do not matter — after review, each in-plan issue is severity-ranked and only an issue above the waterline starts `b-iterate`.

Phase 3 made the routing live; this phase makes the documented picture match it. Purely descriptive work — no behavior.

## Implementation Details

From plan step 7:

1. Update the reviewing description in `docs/state-machine-diagram.html` to show `reviewing → ranking` (with the `rank` effect) when an unfinished iterate artifact exists, and `ranking`'s exits.
2. In `docs/buck-loop.md`, update the review-exit sentence only if it exists.
3. Do not copy the state diagram into `site/`; do not touch `skills/b-review/SKILL.md` or `choice-ranking.ts`.

## Risks

- Minimal; only doc drift if Phase 3's final edges differ from this description — read `machine.ts` as landed, not the plan, when writing prose.

## Verification

- Read the rendered text of both files; confirm the described transitions match `machine.ts` as implemented.

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Type the `orchestrate` keyword anywhere in the first turn, then run `/b-build` for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` (in-plan issues), run `/b-iterate`, then re-run `/b-review`. Out-of-plan findings route to a separate `/b-plan` → `/b-build` follow-up. If `/b-review` flags further documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If the phase is incomplete, leave `status: in-progress` so the session resumes here next turn.
