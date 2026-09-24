---
status: pending
phase: 3
order: 3
plan: plan-buck-loop-model-config.md
phases_overview: plan-buck-loop-model-config-phases.md
difficulty: hard
model_hint: strongest reasoning model available; nested retry ordering and supervisor blocking are high-blast-radius
buck_hint: /b-build-hard
goal: "Run Buck loop work and closed-set decisions on the configured stage model and thinking level."
files: [extensions/buck-loop/run-step.ts, extensions/buck-loop/choice.ts, extensions/buck-loop/loop.ts, extensions/buck-loop/__tests__/run-step.test.ts, extensions/buck-loop/__tests__/choice.test.ts, extensions/buck-loop/__tests__/loop.test.ts]
from_plan_steps: [4]
depends_on: [2]
dependency_type: HARD
acceptance_criteria:
  - "[ ] Every nested Buck skill resolves its stage and runs the picker-selected modelPattern with that stage's thinking level."
  - "[ ] Closed-set workflow choice uses the choice stage profile and no longer resolves the smol role or host model."
  - "[ ] Missing profile/stage/candidates blocks the loop and names the stage."
  - "[ ] A failed nested session is re-picked only after the host session call returns failed, and the failed id is absent from the next candidate set."
  - "[ ] A host-recovered result is retained without re-picking; candidate exhaustion blocks."
  - "[ ] difficulty hard still selects the b-build-hard prompt variant but never selects a model."
completed_at: null
completed_by: null
---

# Phase 3: Loop Runtime Cutover

## Context

Parent user goal: an engineer switches a named profile that maps Buck stage groups to model-id sets and thinking levels instead of inheriting one phase-wide role chain.

Phases 1–2 define resolution and selection. This phase removes role-based model selection from `/buck-loop` work sessions and its closed-set choice path.

## Implementation Details

1. Map `NestedSkill` values to the pinned stage keys; keep `difficultyOf` only for choosing `b-build-hard` versus `b-build`.
2. Before creating each nested session, resolve candidates, build context from the exact plan/phase path and body plus difficulty when present, and pick a model.
3. Pass the picked id as `modelPattern` and the resolved thinking level to `createAgentSession`; never omit the model on a configured Buck stage.
4. Treat the completed `session.prompt()` outcome as the boundary after host retry/fallback. On failed/aborted/empty/throw outcomes, exclude that selected id and repeat while candidates remain. Do not react to `auto_retry_end` and do not re-pick after a recovered text result.
5. Resolve the `choice` stage before the existing legal-continuation Jev flow. The configured selected model handles the tool-less fallback call with configured thinking; remove `resolveOmpRole(..., "smol")`.
6. Propagate profile stop messages through existing loop block/failure records.
7. Update the run-step, choice, and loop behavioral tests through injected seams.

## Risks

- Do not create a second retry loop around a successful host fallback.
- Empty assistant text is a failed nested result even if the host did not classify it as retryable.
- Transition choice and model choice are separate Choice questions; keep their outputs and audits distinct.
- Preserve child tool allowlists and extension-discovery restrictions.

## Verification

- RED/GREEN focused runs for `run-step.test.ts`, `choice.test.ts`, and `loop.test.ts`.
- Throwaway loop smoke with fake resolver/evaluator/session: first id fails, second succeeds; observe two ids in order and one successful result.
- Assert source behavior through public calls: no host-default success path and hard difficulty changes only the prompt skill.
- Run the deterministic guardrails contract before completion.

## Per-Phase Execution Loop

1. Run `/b-build-hard` for this phase only.
2. Run `/b-review` against this file.
3. Run `/b-iterate` only for in-plan findings, then review again; separate out-of-plan work.
4. Run `/b-docs` if review flags documentation impact.
5. Run `/b-save`, then `/b-commit`; one completed phase equals one commit.
6. If interrupted, leave `status: in-progress` and unchecked criteria.
