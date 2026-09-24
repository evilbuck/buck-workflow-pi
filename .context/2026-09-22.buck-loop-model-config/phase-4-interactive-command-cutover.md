---
status: pending
phase: 4
order: 4
plan: plan-buck-loop-model-config.md
phases_overview: plan-buck-loop-model-config-phases.md
difficulty: hard
model_hint: strongest reasoning model available; parent-session mutation and restoration must be race-safe
buck_hint: /b-build-hard
goal: "Apply the same named stage profile to interactive Buck commands, then restore the parent session exactly."
files: [extensions/index.ts, extensions/index.test.ts]
from_plan_steps: [5]
depends_on: [2]
dependency_type: HARD
acceptance_criteria:
  - "[ ] The interactive stage table covers every pinned Buck skill mapping except loop-only choice; unlisted skills do not consult buckModels."
  - "[ ] Before the command turn, resolver and picker receive command text, resolved subject artifacts, and only the bounded user/assistant conversation tail."
  - "[ ] Missing profile/stage/candidates refuses before the skill runs and names the stage; no host-default model is used."
  - "[ ] The selected parent model and thinking level are applied for the command turn and both prior values are restored on agent_end."
  - "[ ] Refusal, throw, and user override paths cannot leave stale switch state or restore over an explicit user model change."
completed_at: null
completed_by: null
---

# Phase 4: Interactive Command Cutover

## Context

Parent user goal: an engineer switches a named profile that maps Buck stage groups to model-id sets and thinking levels instead of inheriting one phase-wide role chain.

This phase adapts the shared Phase 1–2 policy to parent-session Buck slash commands. It does not alter `/buck-loop`, which Phase 3 owns.

## Implementation Details

1. Replace `MODEL_SWITCH_COMMANDS` with an explicit skill-to-stage map for brainstorm/plan, phase, build/build-hard, review, iterate, save, commit, docs/howto, research/explore, grill variants, and present.
2. Capture the actual command text on input. Resolve subject artifacts using existing project conventions and build a conversation tail from only the last eight user/assistant messages, capped at 12,000 characters by trimming oldest content first.
3. Resolve and pick before the agent starts. Refuse the turn with an actionable error when profile selection stops.
4. Apply both model and thinking level using host APIs available in the extension context. Snapshot both previous values first.
5. Restore on `agent_end`, including cleanup after refusal and thrown operations. Preserve the existing explicit-user-override guard.
6. Add host-adapter tests for stage mapping, context bounds, refusal, switching, restoration, and override races.

## Risks

- Current state tracks only a model; restoration must include thinking without corrupting user changes.
- System/tool messages must never enter picker state.
- The input and `before_agent_start` events are asynchronous; stale pending command state must be cleared on all exits.

## Verification

- Focused Vitest for the extension adapter tests.
- TUI/host smoke with a throwaway fake ExtensionAPI: invoke one mapped command and one unmapped command, observe one switch/restore pair only.
- Run the deterministic guardrails contract before completion.

## Per-Phase Execution Loop

1. Run `/b-build-hard` for this phase only.
2. Run `/b-review` against this file.
3. Run `/b-iterate` only for in-plan findings, then review again; separate out-of-plan work.
4. Run `/b-docs` if review flags documentation impact.
5. Run `/b-save`, then `/b-commit`; one completed phase equals one commit.
6. If interrupted, leave `status: in-progress` and unchecked criteria.
