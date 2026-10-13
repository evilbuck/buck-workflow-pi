---
status: pending
phase: 3
order: 3
plan: plan-fix-pr-native-pr-tool.md
phases_overview: plan-fix-pr-native-pr-tool-phases.md
difficulty: easy
model_hint: smaller/faster general model is fine
buck_hint: /b-build
goal: "Correct stale native-collector language in docs and sync the companion HTML walkthrough to the new three-layer contract."
omp_execution: none
files:
  - docs/buck-workflow.md
  - presentations/2026-09-12.fix-pr-skill-report/index.html
from_plan_steps: [5]
depends_on: [2]
dependency_type: HARD
acceptance_criteria:
  - "[ ] `docs/buck-workflow.md` no longer describes the previous native-collector model (stale text at lines ~1345-1347); it states the three-layer contract: native view / tool-or-script ingest / agent validation."
  - "[ ] Companion walkthrough `presentations/2026-09-12.fix-pr-skill-report/index.html` reflects the changed skill phases/surfaces and error handling."
  - "[ ] No new agent invocation alias added."
completed_at: null
completed_by: null
---

# Phase 3: Docs + Walkthrough Sync

## User Goal
Inherited from plan: public docs and the companion walkthrough agree with the shipped skill/tool contract so future agents and readers see one consistent story.

## Context
`docs/buck-workflow.md:1345-1347` still describes a previous native-collector model. The presentation at `presentations/2026-09-12.fix-pr-skill-report/index.html` should track the changed phases/surfaces.

## Implementation Details
1. Correct the stale collector language in `docs/buck-workflow.md` (also check its `fix-pr` skill table row for consistency).
2. Update the walkthrough's affected surface, phases, and error-handling sections to match the canonical skill.
3. No new invocation alias, no slash wrapper.

## Risks
- Overwriting hand-authored README prose — edits are scoped to the stale fix-pr sections only.

## Verification
Read the changed sections back and confirm they match Phase 2's SKILL.md contract.
