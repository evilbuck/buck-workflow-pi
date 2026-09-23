---
status: pending
phase: 2
order: 2
plan: plan-jev-buck-loop-chooser.md
phases_overview: plan-jev-buck-loop-chooser-phases.md
difficulty: hard
model_hint: strongest reasoning model available
buck_hint: /b-build-hard
omp_execution: orchestrate
goal: "Make b-review emit a complete typed contract and make buck-loop route from validated facts."
files:
  - skills/b-review/SKILL.md
  - skills/_shared/typed-output-verification.md
  - extensions/buck-loop/types.ts
  - extensions/buck-loop/scan.ts
  - extensions/buck-loop/machine.ts
  - extensions/buck-loop/__tests__/scan.test.ts
  - extensions/buck-loop/__tests__/machine.test.ts
  - extensions/buck-loop/__tests__/loop.test.ts
from_plan_steps: [5, 6, 7]
depends_on: [1]
dependency_type: HARD
acceptance_criteria:
  - "[ ] b-review requires all human routing sections and a schema-valid buck.review/v1 block."
  - "[ ] A Jev-capable review verifies every declared enum/boolean before returning."
  - "[ ] Buck-loop derives review routes from typed facts rather than prose headings."
  - "[ ] Both recorded block-warning incidents pass as public handleLoop regressions."
completed_at: null
completed_by: null
---

# Phase 2: Review Contract and Typed Routing

## Context

Parent goal: Buck Workflow control decisions are complete, repairable, and semantically verified before automation consumes them.

Phase 1 supplies the validator and shared TypeSafe evaluator.

## Deliverables

- Portable b-review output protocol with mandatory Documentation Impact, How-to Impact, Issue Classification, Verdict, Recommended Next Step, and final `buck.review/v1` JSON.
- End-of-step Jev verification instructions for verdict and four binary facts.
- Typed `ReviewFacts` carrying schema diagnostics and semantic-verification status.
- Deterministic route derivation for iterate, docs/how-to, out-of-plan follow-up, and save.
- Incident fixtures for omitted How-to Impact and `None. Stale ...`.

## Constraints

- Human sections remain readable but are not the automation source of truth.
- `route` is code-derived, never a model-authored duplicate field.
- Invalid review output takes a deterministic repair path; it is not interpreted as a clean review.
- Out-of-plan findings and documentation/how-to impact remain non-blocking for correctness.

## Verification

- Focused scanner, machine, and public `handleLoop` tests.
- The two diagnosis reproductions turn green.
- `npm run guardrails:check`.