---
status: pending
phase: 2
order: 2
plan: plan-buck-loop-model-config.md
phases_overview: plan-buck-loop-model-config-phases.md
difficulty: hard
model_hint: strongest reasoning model available; this is the Jev/random trust boundary used by every runtime path
buck_hint: /b-build-hard
goal: "Choose one available configured model from stage context, with deterministic failure handling and no host-model fallback."
files: [extensions/buck-models/picker.ts, extensions/buck-models/picker.test.ts, extensions/typed-output/evaluator.ts]
from_plan_steps: [3]
depends_on: [1]
dependency_type: HARD
acceptance_criteria:
  - "[ ] The picker sends a TypeSafe Choice request containing stage, candidate ids/notes, skill, and supplied execution context."
  - "[ ] A valid Jev answer selects that exact id even when confidence is low."
  - "[ ] Jev unavailable, error, or no answer uses an injected uniform-random source over all remaining candidates."
  - "[ ] Re-picking after failure excludes the failed id; exhausting candidates returns the named-stage stop instead of the host model."
  - "[ ] The selected result carries the resolved stage thinking level, defaulting to off."
completed_at: null
completed_by: null
---

# Phase 2: TypeSafe Model Picker

## Context

Parent user goal: an engineer switches a named profile that maps Buck stage groups to model-id sets and thinking levels instead of inheriting one phase-wide role chain.

Phase 1 supplies resolved, availability-filtered candidates. This phase owns selection policy only; runtime adapters remain unchanged until later phases.

## Implementation Details

1. Add a parent-extension picker under `extensions/buck-models/` with injected evaluator and random source seams.
2. Build the TypeSafe Choice request through `createTypeSafeEvaluator`. Criteria are candidate ids with optional notes; state names the stage, skill, and caller-provided loop or interactive context.
3. Decode only ids in the remaining candidate set. Confidence is diagnostic, never a threshold.
4. On unavailable/error/no-answer, choose `Math.floor(random() * candidates.length)` with bounds validation suitable for injected tests. Never select the first id as a special fallback.
5. Expose failed-id exclusion/re-pick without mutating the original resolution. Return a stop when no candidate remains.
6. Test observable picks, not SDK wiring: exact Jev choice, low-confidence acceptance, deterministic injected random positions, and failed-id exclusion.

## Risks

- A permissive answer decoder could run an unconfigured model. Membership-check every answer.
- Random fallback must be injectable or tests become flaky.
- This code runs in the parent; nested sessions have extension discovery disabled and cannot own the Jev call.

## Verification

- Focused Vitest: `npx vitest run extensions/buck-models/picker.test.ts --reporter=verbose`.
- Throwaway smoke with a fake evaluator: observe Jev-selected, random-selected, and exhausted outcomes.
- Run the deterministic guardrails contract before completion.

## Per-Phase Execution Loop

1. Run `/b-build-hard` for this phase only.
2. Run `/b-review` against this file.
3. Run `/b-iterate` only for in-plan findings, then review again; separate out-of-plan work.
4. Run `/b-docs` only if review identifies living-documentation impact.
5. Run `/b-save`, then `/b-commit`; one completed phase equals one commit.
6. If interrupted, leave `status: in-progress` and unchecked criteria.
