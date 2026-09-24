---
status: completed
phase: 5
order: 5
plan: plan-buck-loop-model-config.md
phases_overview: plan-buck-loop-model-config-phases.md
difficulty: medium
model_hint: capable general model preferred; bounded command UI over the Phase 1 config API
buck_hint: /b-build
goal: "Let engineers create, edit, and activate portable model profiles without hand-editing YAML."
files: [extensions/buck-models/index.ts, extensions/buck-models/index.test.ts, extensions/index.ts]
from_plan_steps: [6]
depends_on: [1]
dependency_type: HARD
acceptance_criteria:
  - "[x] /buck-models lets the engineer choose project or user-global scope, create/name a profile, and switch the active name without rewriting lists."
  - "[x] All twelve stage groups can edit model ids, optional notes, and optional thinking levels."
  - "[x] Every stage shows project ownership or user-global fallthrough."
  - "[x] Unavailable ids produce a warning but do not prevent save."
  - "[x] Saving either scope round-trips the edited profile and preserves unrelated YAML keys."
  - "[x] The command is registered from extensions/index.ts with a discoverable description."
completed_at: 2026-09-24
completed_by: b-build
---

# Phase 5: `/buck-models` Command

## Context

Parent user goal: an engineer switches a named profile that maps Buck stage groups to model-id sets and thinking levels instead of inheriting one phase-wide role chain.

Phase 1 owns parsing, resolution, availability, and lossless writes. This phase is the required setup surface; hand-edited YAML remains supported but is not the primary workflow.

## Implementation Details

1. Add `wireBuckModels(pi)` under `extensions/buck-models/` and register it beside `wireBuckLoop`.
2. Use host dialogs to choose write scope, create/name or select a profile, set active, and edit each exact stage group.
3. Edit candidate rows as id plus optional note and stage thinking as `off|minimal|low|medium|high|xhigh` or omitted.
4. Display whether the effective stage is project-owned or global fallthrough.
5. Compare ids with the current model registry and show non-blocking unavailable warnings before save.
6. Save through Phase 1's full-document writer only. Cancellation performs no writes.
7. Test command interactions with fake UI and filesystem seams, including create/select/edit, cancellation, warning, and unrelated-key preservation.

## Risks

- A long twelve-stage dialog can become fragile; reuse one boring editor flow rather than twelve implementations.
- Create-and-name and selecting active are distinct mutations; cancellation must not partially persist either.
- Do not reject portable ids merely because the current machine lacks them.

## Verification

- Focused Vitest: `npx vitest run extensions/buck-models/index.test.ts --reporter=verbose`.
- Launch the actual command surface where available and complete a project-scope profile edit; otherwise use a fake-host smoke and explicitly record the lack of visual TUI verification.
- Reread both target files after smoke to prove unrelated keys remain.
- Run the deterministic guardrails contract before completion.

## Per-Phase Execution Loop

1. Run `/b-build` for this phase only.
2. Run `/b-review` against this file.
3. Run `/b-iterate` only for in-plan findings, then review again; separate out-of-plan work.
4. Run `/b-docs` if review flags documentation or how-to impact.
5. Run `/b-save`, then `/b-commit`; one completed phase equals one commit.
6. If interrupted, leave `status: in-progress` and unchecked criteria.
