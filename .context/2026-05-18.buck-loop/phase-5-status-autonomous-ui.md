---
status: completed
phase: 5
order: 5
plan: plan-autonomous-b-flow-loop.md
phases_overview: plan-autonomous-b-flow-loop-phases.md
difficulty: medium
model_hint: "Capable general model preferred; this phase wires CLI/UI behavior to existing projection and guardrail state."
buck_hint: /b-build
goal: "Expose autonomous/guided run behavior and lifecycle projection through b-flow commands, status, compaction, and display surfaces."
files: ["extensions/b-flow/index.ts", "extensions/b-flow/ui.ts", "extensions/b-flow/machine.ts", "extensions/b-flow/persistence.ts", "extensions/tmux-window-status.ts", "extensions/tmux-window-status.test.ts"]
from_plan_steps: [9, 10]
depends_on: [3, 4]
dependency_type: HARD
acceptance_criteria:
  - "[x] /b-flow run --autonomous starts the lifecycle actor and skips routine step confirmations while preserving guardrail blocks."
  - "[x] Guided mode confirms build, review, iterate, save, and next-phase transitions."
  - "[x] /b-flow status shows parent state, active phase/chunk, active step, iteration n/5, last result file, and blocked reason."
  - "[x] before_agent_start digest includes active step/iteration and links to phase, iterate, and result files."
  - "[x] session_before_compact summarizes active lifecycle progress."
  - "[x] Optional tmux naming/display polish is implemented only after projection fields exist."
completed_at: "2026-05-18"
completed_by: "b-build"
---

# Phase 5: Autonomous Wiring, Status, and Display

## Context

After lifecycle and safety behavior are in place, b-flow needs to expose the autonomous loop through user-facing commands and durable summaries. This phase should primarily wire existing projection state into CLI/status/UI surfaces.

## Implementation Details

1. In `extensions/b-flow/index.ts` and `extensions/b-flow/ui.ts`, wire `/b-flow run --autonomous` to set autonomous mode and start the lifecycle actor.
2. Autonomous mode should skip routine build/review/iterate/save confirmations, but must still block on guardrails.
3. Guided mode should confirm build, review, iterate, save, and next-phase transitions.
4. Ensure STOP and PAUSE surface the Phase 4 behavior clearly in command output.
5. Update `/b-flow status` to show:
   - current parent state;
   - active phase/chunk;
   - active step;
   - iteration `n/5`;
   - last result file;
   - blocked reason, if any.
6. Update `before_agent_start` digest to include active step/iteration and links to phase, iterate, and result files.
7. Update `session_before_compact` to summarize active lifecycle progress.
8. Treat tmux naming/status polish as optional and only do it after projection fields exist.

## Risks

- UI/status can accidentally become the source of truth. Keep all user-facing views derived from persisted projection/artifacts.
- Guided/autonomous branching can duplicate orchestration logic. Keep mode differences at confirmation boundaries, not lifecycle routing.
- Compaction summaries must be concise but complete enough for cold-start resume.

## Verification

Run b-flow command/UI tests or the closest existing coverage:

```bash
npm test -- extensions/b-flow
npm test -- extensions/tmux-window-status.test.ts
```

Manually verify status/compaction text against representative active, blocked, and completed projections.
