---
status: completed
phase: 1
order: 1
plan: plan-viability-cleanup.md
phases_overview: plan-viability-cleanup-phases.md
difficulty: medium
model_hint: capable general model
buck_hint: /b-build
goal: "Turn the three omp slash stubs into documentation without losing the goal-mode protocol."
files:
  - prompts/omp-goal.md
  - prompts/omp-orchestrate.md
  - prompts/omp-workflow.md
  - commands/omp-goal.md
  - commands/omp-orchestrate.md
  - commands/omp-workflow.md
  - docs/buck-workflow.md
  - README.md
from_plan_steps: ["D1"]
depends_on: []
dependency_type: NONE
acceptance_criteria:
  - "[x] prompts/omp-goal.md, prompts/omp-orchestrate.md, and prompts/omp-workflow.md are gone, and the matching commands/ symlinks are gone"
  - "[x] rg -n '6-step completion-audit' docs/buck-workflow.md hits prose in that file, not only a link to prompts/omp-goal.md"
  - "[x] npx vitest run scripts/commands-mirror.test.ts passes"
completed_at: 2026-10-03
completed_by: b-build
---

# Phase 1: OMP stubs to docs

## Context

Parent user goal: the maintainer can walk one checklist, change any recommendation, and apply or skip each item without losing the decision. This phase is parent todo D1 only.

The three commands both claim to enter a mode and say they are no-ops. Jev writing scores: orchestrate 0.06 (conf 0.95), workflow 0.10 (conf 0.92), goal 0.57. `docs/buck-workflow.md` currently points the 6-step completion-audit at `prompts/omp-goal.md`. Copy that protocol into the doc before deleting the prompt.

## Implementation Details

1. Read `prompts/omp-goal.md`, `prompts/omp-orchestrate.md`, and `prompts/omp-workflow.md`.
2. Copy the goal-mode 6-step completion-audit and the harness no-op notes into `docs/buck-workflow.md` at the existing OMP autonomous-loops section. Replace links that would dangle.
3. Update the README slash-command rows for these three names so they no longer point at deleted prompts.
4. Delete the three prompt files and the three `commands/` symlinks in the same change. Do not leave one side.
5. Do not delete `extensions/` code. These stubs have no extension.

If the operator set D1 to `keep` or `skip` in the parent plan, stop and mark this phase skipped in the overview. Do not delete.

## Risks

Deleting the prompt before the protocol is in the doc drops the only write-up `b-review` cites. The acceptance grep is the check. Rollback is `git revert` of this phase's commit.

## Verification

```bash
test ! -e prompts/omp-goal.md && test ! -e prompts/omp-orchestrate.md && test ! -e prompts/omp-workflow.md
test ! -e commands/omp-goal.md && test ! -e commands/omp-orchestrate.md && test ! -e commands/omp-workflow.md
rg -n "6-step completion-audit" docs/buck-workflow.md
npx vitest run scripts/commands-mirror.test.ts
```

## Per-Phase Execution Loop

1. Run `/b-build` for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact, run `/b-iterate`, then re-run `/b-review`. Out-of-plan findings go to a new `/b-plan`, not this phase. If review flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save`.
5. Run `/b-commit`. One phase, one commit.
6. If incomplete, leave `status: in-progress`.
