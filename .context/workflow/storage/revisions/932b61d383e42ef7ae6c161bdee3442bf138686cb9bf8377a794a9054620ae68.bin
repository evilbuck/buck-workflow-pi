---
status: pending
phase: 3
order: 3
plan: plan-jev-buck-loop-chooser.md
phases_overview: plan-jev-buck-loop-chooser-phases.md
difficulty: hard
model_hint: strongest reasoning model available
buck_hint: /b-build-hard
omp_execution: orchestrate
goal: "Recover malformed model control output through verified fix-or-continue decisions without offering block."
files:
  - extensions/buck-loop/types.ts
  - extensions/buck-loop/machine.ts
  - extensions/buck-loop/loop.ts
  - extensions/buck-loop/run-step.ts
  - extensions/buck-loop/choice.ts
  - extensions/buck-loop/__tests__/choice.test.ts
  - extensions/buck-loop/__tests__/machine.test.ts
  - extensions/buck-loop/__tests__/loop.test.ts
from_plan_steps: [8, 9, 10]
depends_on: [2]
dependency_type: HARD
acceptance_criteria:
  - "[ ] Every recoverable model-choice set is exactly fix or continue."
  - "[ ] Recovery receives the full artifact, schema diagnostics, and TypeSafe discrepancies."
  - "[ ] The recovery choice is TypeSafe-verified before use and durably audited."
  - "[ ] Deterministic safety guards still block without model consultation."
completed_at: null
completed_by: null
---

# Phase 3: Fix-or-Continue Recovery

## Context

Parent goal: Buck Workflow control decisions are complete, repairable, and semantically verified before automation consumes them.

Phase 2 produces typed diagnostics. This phase handles only genuinely incomplete, contradictory, or uncertain model output.

## Deliverables

- Bounded repair session with complete evidence and explicit attempt state.
- Closed-set `fix | continue` output and TypeSafe Choice comparison.
- Conservative policy: disagreement/unavailable verification chooses `fix` while budget remains; schema-valid `continue` after exhaustion is explicitly audited.
- Durable audit records containing diagnostics, verifier results, recovery action, and final route.
- Clean removal of `block` from recoverable choice types and machine choice sets.

## Safety boundary

Keep deterministic blocking for protected branches, corrupt state, exhausted loop/iterate ceilings, and repeated protocol failure that never produces a schema-valid decision. These are not choices exposed to the recovery model.

## Verification

- Tests for fix, continue, agreement, disagreement, provider unavailable, exhausted repair budget, resume, and audit persistence.
- Guard tests proving hard safety blocks remain disjoint and model-free.
- `npm run guardrails:check`.