---
status: completed
phase: 1
order: 1
plan: plan-omp-eval-loop.md
phases_overview: plan-omp-eval-loop-phases.md
difficulty: medium
model_hint: capable general model preferred
buck_hint: /b-build
goal: "Add before_subagent_spawn hook in interactive-model-switch.ts to route OMP eval subagent models by stage profile without requiring task.perCallModel."
omp_execution: none
files:
  - extensions/interactive-model-switch.ts
  - extensions/index.test.ts
from_plan_steps: [1]
depends_on: []
dependency_type: NONE
acceptance_criteria:
  - "[x] extensions/interactive-model-switch.ts exports stageSkillFromSpawnKey(spawnKey) mapping stage skill prefixes (b-build-hard, b-build, b-review, b-iterate, b-docs, b-howto, b-save, b-commit, b-research, b-explore, b-plan, b-phase, b-brainstorm, b-grill, b-present) to BuckStageKey."
  - "[x] wireInteractiveModelSwitch registers pi.on(\"before_subagent_spawn\", ...) intercepting event.invocationKind === \"eval\" and routing stage models via selectInteractiveModel."
  - "[x] Successful resolution returns { model: picked.id, note: `buckModels:${stage}` }."
  - "[x] Invalid or missing stage profiles return refusal { block: true, reason: refusal(picked.message) }."
  - "[x] Non-eval invocations or unrecognized spawnKeys are passed through without modification."
  - "[x] Unit tests in extensions/index.test.ts verify eval model routing, pass-through, and refusal blocking."
  - "[x] npx vitest run extensions/index.test.ts passes."
completed_at: 2026-11-17
completed_by: Antigravity
---

# Phase 1: Subagent Model Routing for `eval` Spawns

## Context

Parent plan User Goal: Run unattended Buck phase loops in OMP via a hot-reloadable TS/JS `eval` script (`workflowz` + `%load`) using native `agent()`/`judge()`, retiring the 17.7k-line `buck-loop` extension.

This phase implements stage model routing for `eval` `agent()` calls via OMP's `before_subagent_spawn` extension hook in `extensions/interactive-model-switch.ts`. This ensures subagents spawned during `eval` automatically respect `/buck-models` stage profiles without requiring OMP's `task.perCallModel` configuration.

## Implementation Details

1. **`stageSkillFromSpawnKey` helper in `extensions/interactive-model-switch.ts`**:
   - Parse `spawnKey` from `agent(prompt, { agent: "task", label: `${skill}-${phaseSlug}` })` (sanitized into `spawnKey` by OMP's subagent launcher).
   - Match skill prefix against known Buck skills mapped in `INTERACTIVE_STAGE_BY_SKILL`.
   - Return `{ skill, stage }` or `null` if unmapped.

2. **`before_subagent_spawn` event handler**:
   - Register on `pi.on("before_subagent_spawn", async (event, ctx) => ...)` inside `wireInteractiveModelSwitch`.
   - Guard: ignore when `event.invocationKind !== "eval"` or `stageSkillFromSpawnKey(event.spawnKey)` returns `null`.
   - Query `selectInteractiveModel(ctx.cwd, stage)` (or active profile configuration).
   - Return `{ model: picked.id, note: `buckModels:${stage}` }` if a model is resolved.
   - Return `{ block: true, reason: refusal(picked.message) }` if validation fails or the stage profile cannot resolve a valid model.

3. **Unit tests in `extensions/index.test.ts`**:
   - Test `eval` subagent spawn with valid stage profile (e.g. `b-build-phase-1` → resolves build stage model).
   - Test refusal behavior when profile is invalid or stage has no model configured.
   - Test that non-eval invocations (`invocationKind !== "eval"`) and non-Buck spawnKeys pass through cleanly without overrides.

## Risks

- **SpawnKey sanitization divergence**: OMP sanitizes `label` into `spawnKey` (e.g., replaces `/` or special chars with `-`). The prefix matching must be robust to sanitized strings like `b-build-hard-phase-1`.
  - *Mitigation*: Match skill names greedily from longest prefix (`b-build-hard` before `b-build`).

## Verification

- `npx vitest run extensions/index.test.ts`
- `npm run guardrails:check` at coherent checkpoint

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Run the indicated Buck build command (`buck_hint`) for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this phase), do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If the phase is incomplete, leave `status: in-progress` so the session resumes here next turn.
