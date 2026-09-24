---
status: pending
phase: 6
order: 6
plan: plan-buck-loop-model-config.md
phases_overview: plan-buck-loop-model-config-phases.md
difficulty: medium
model_hint: capable general model preferred; integration proof spans all prior runtime and command paths
buck_hint: /b-build
goal: "Make the profile workflow discoverable and prove that no Buck stage silently uses the host model."
files: [docs/buck-workflow.md, docs/howto/configure-buck-model-profiles.md, extensions/omp-models.test.ts, extensions/buck-loop/__tests__/run-step.test.ts, extensions/buck-loop/__tests__/choice.test.ts, extensions/buck-models/index.test.ts]
from_plan_steps: [7, 8]
depends_on: [3, 4, 5]
dependency_type: HARD
acceptance_criteria:
  - "[ ] Living docs describe /buck-models, both config scopes, all twelve group keys, project-stage fallthrough, availability filtering, and stop-not-host-default behavior."
  - "[ ] A user-facing how-to ends with an observable successful profile selection and stage run."
  - "[ ] Integration coverage proves loop work, loop choice, and an interactive command use picked ids and configured/default-off thinking."
  - "[ ] Integration coverage proves missing profile, missing stage, and no available ids stop rather than use the host model."
  - "[ ] Existing mappingFromOmpRoles tests remain green while Buck paths no longer call that mapping."
  - "[ ] The deterministic guardrails contract passes for the complete feature."
completed_at: null
completed_by: null
---

# Phase 6: Documentation and End-to-End Proof

## Context

Parent user goal: an engineer switches a named profile that maps Buck stage groups to model-id sets and thinking levels instead of inheriting one phase-wide role chain.

This join phase starts only after loop runtime, interactive runtime, and `/buck-models` exist. It closes discoverability and cross-path regression gaps; it does not add another model-selection mechanism.

## Implementation Details

1. Replace difficulty-to-role Buck runtime wording in `docs/buck-workflow.md` with the named-profile flow. Keep documentation for unrelated `modelRoles` users intact.
2. Document `/buck-models`, project/global active-name and stage fallthrough, twelve exact keys, thinking defaults, unavailable-id warnings, Jev/random selection, retry ordering, and hard stops.
3. Add/update the canonical `docs/howto/` action for configuring and activating a profile, following repository how-to format and ending in **Eat**.
4. Fill only genuine cross-module behavioral gaps not already defended in Phases 1–5. Do not add source-text or wiring assertions.
5. Run focused suites, a full feature smoke, then the durable guardrails contract.

## Risks

- Do not describe profile selection as a fallback chain; host retry happens inside a selected model call before Buck re-picks.
- Do not imply `difficulty`, `model_hint`, or `buck_hint` chooses a model.
- Avoid duplicating exhaustive unit cases in integration tests.

## Verification

- Focused feature suites for resolver, picker, loop runtime, interactive adapter, and command writer.
- Throwaway end-to-end fake-host smoke: save profile → resolve stage → Jev pick → run selected id/thinking; repeat with missing stage and observe refusal.
- `npm run guardrails:check` must return durable v2 `status: pass` for required gates.
- Docs-only visual review for command names, twelve keys, and stop wording.

## Per-Phase Execution Loop

1. Run `/b-build` for this phase only.
2. Run `/b-review` against this file.
3. Run `/b-iterate` only for in-plan findings, then review again; separate out-of-plan work.
4. Run `/b-docs` and `/b-howto` if review identifies remaining impact.
5. Run `/b-save`, then `/b-commit`; one completed phase equals one commit.
6. If interrupted, leave `status: in-progress` and unchecked criteria.
