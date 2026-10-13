---
status: pending
phase: 5
order: 5
plan: plan-jev-buck-loop-chooser.md
phases_overview: plan-jev-buck-loop-chooser-phases.md
difficulty: medium
model_hint: capable general model preferred
buck_hint: /b-build
omp_execution: orchestrate
goal: "Document the final control-output contract and prove it through the real Buck workflow."
files:
  - docs/buck-workflow.md
  - docs/extension-loading.md
  - docs/adr/
  - AGENTS.md
  - extensions/buck-loop/__tests__/loop.test.ts
from_plan_steps: [12]
depends_on: [4]
dependency_type: HARD
acceptance_criteria:
  - "[ ] Living docs describe typed review output, semantic verification, recovery, and the remaining hard-stop boundary."
  - "[ ] A disposable real /buck-loop run repairs a deliberately malformed review and completes the correct route."
  - "[ ] Durable audits prove which values were declared, verified, repaired, and consumed."
  - "[ ] Final focused tests and guardrails pass from a clean committed baseline."
completed_at: null
completed_by: null
---

# Phase 5: Documentation and Live Proof

## Context

Parent goal: Buck Workflow control decisions are complete, repairable, and semantically verified before automation consumes them.

This phase documents the completed implementation; it does not pre-commit an ADR. Run b-review first and write an ADR only if the shared evaluator/recovery boundary is judged surprising and hard to reverse.

## Deliverables

- Living workflow and extension documentation.
- Managed conventions update only if b-docs identifies a durable project convention.
- Actual `/buck-loop` smoke on a disposable non-protected branch with a deliberately malformed review output.
- Audit inspection proving schema validation, TypeSafe comparison, recovery action, and final route.

## Verification

- Fresh smoke evidence from the real command surface.
- Focused regression suite.
- `npm run guardrails:check`.
- `/b-review` verdict with Documentation Impact and How-to Impact sections plus the typed control block.