---
status: completed
phase: 6
order: 6
plan: plan-autonomous-b-flow-loop.md
phases_overview: plan-autonomous-b-flow-loop-phases.md
difficulty: medium
model_hint: "Capable general model preferred; broad verification and fixture cleanup, with escalation if integration failures reveal architecture gaps."
buck_hint: /b-build
goal: "Complete end-to-end integration coverage and smoke verification for autonomous b-flow phase execution."
files: ["extensions/b-flow/__tests__/integration.test.ts", "extensions/b-flow/__tests__/machine.test.ts", "extensions/b-flow/__tests__/scan-context.test.ts", "extensions/b-flow/__tests__/", ".context/2026-05-18.buck-loop/plan-autonomous-b-flow-loop.md"]
from_plan_steps: [11]
depends_on: [1, 2, 3, 4, 5]
dependency_type: HARD
acceptance_criteria:
  - "[x] Result parser tests cover review pass, review issues with iterate file, review requires replan, and malformed review result blocking."
  - "[x] Scan-context tests cover active iterate detection, completed iterate ignored, and multiple active iterates conflict."
  - "[x] Queue-builder tests prove stale iterate artifacts are not queued independently."
  - "[x] Worker prompt tests prove every mode loads the correct Buck skill/instructions."
  - "[x] Lifecycle tests cover pass path, iterate path, max-iteration block, stagnation block, phase-boundary git safety block, and STOP/orphaned-audit recovery."
  - "[x] `npm test -- extensions/b-flow` passes."
  - "[x] `npm test` passes or any unrelated failures are documented."
  - "[x] Manual smoke verification has been run or blockers are documented."
completed_at: "2026-05-18"
completed_by: pi
---

# Phase 6: Integration Tests and Smoke Verification

## Context

This final phase consolidates coverage across the autonomous lifecycle and performs the smoke verification described in the source plan. It should not introduce major new behavior unless integration failures reveal a small missing piece required for acceptance.

## Implementation Details

1. Review test coverage added in Phases 1–5 and fill gaps from the source plan's minimum coverage list.
2. Ensure result parser coverage includes:
   - review pass;
   - review issues with iterate file;
   - review requires replan;
   - malformed review result blocks.
3. Ensure scan-context coverage includes:
   - active iterate detected;
   - completed iterate ignored;
   - multiple active iterates conflict.
4. Ensure queue-builder coverage proves stale iterate artifacts are not queued as independent chunks.
5. Ensure worker prompt coverage proves each mode loads the correct Buck skill/instructions.
6. Ensure lifecycle coverage includes:
   - build → review pass → save → next phase;
   - build → review issues → iterate → review pass → save;
   - max iterations blocks;
   - stagnation blocks;
   - phase-boundary git safety blocks only at boundaries;
   - STOP with active worker kills or records reconciliation state;
   - orphaned audit without result blocks.
7. Run the planned automated verification and record any unrelated failures.
8. Perform manual smoke verification:
   - Create a tiny phased subject folder with one phase that should pass review.
   - Run `/b-flow start <goal>`.
   - Run `/b-flow run --autonomous`.
   - Confirm projection shows build/review/save and then completion.
   - Repeat with a review-result fixture that creates an active iterate artifact.
   - Confirm iterate → re-review → save happens or blocks with the expected guardrail.

## Risks

- Integration tests may expose architectural gaps in earlier phases. Keep fixes scoped to acceptance criteria and avoid broad refactors.
- Manual smoke verification depends on local b-flow/prompt behavior; document blockers rather than claiming verification if the environment cannot run it.
- Full `npm test` failures may be unrelated; distinguish unrelated failures from autonomous-loop regressions.

## Verification

Run:

```bash
npm test -- extensions/b-flow
npm test
```

Then complete or document the manual smoke verification checklist above.
