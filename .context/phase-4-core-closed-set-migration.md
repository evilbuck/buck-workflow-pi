---
status: pending
phase: 4
order: 4
plan: plan-jev-buck-loop-chooser.md
phases_overview: plan-jev-buck-loop-chooser-phases.md
difficulty: hard
model_hint: strongest reasoning model available
buck_hint: /b-build-hard
omp_execution: orchestrate
goal: "Apply the proven typed-output protocol to every core model-authored closed-set routing decision or recommendation."
files:
  - skills/b-phase/SKILL.md
  - skills/b-plan/SKILL.md
  - skills/b-grill/SKILL.md
  - skills/b-grill-auto/SKILL.md
  - skills/b-grill-me/SKILL.md
  - skills/b-grill-with-docs/SKILL.md
  - skills/b-triage/SKILL.md
  - skills/_shared/typed-output-verification.md
from_plan_steps: [11]
depends_on: [3]
dependency_type: HARD
acceptance_criteria:
  - "[ ] A durable inventory identifies every core model-authored binary/enum routing decision or recommendation and its consumer."
  - "[ ] Each in-scope output has deterministic validation and end-of-step TypeSafe verification."
  - "[ ] Code-authored booleans/enums are explicitly excluded and do not call TypeSafe."
  - "[ ] No migrated skill invents a harness-specific API requirement for non-OMP agents."
completed_at: null
completed_by: null
---

# Phase 4: Core Closed-Set Migration

## Context

Parent goal: Buck Workflow control decisions are complete, repairable, and semantically verified before automation consumes them.

Reuse the Phase 1 protocol and Phase 3 recovery semantics; do not create skill-specific variants.

## Deliverables

- Inventory table: producer, field, allowed values, consumer, deterministic validator, TypeSafe question, unavailable-provider behavior.
- Migration of model-authored values that route work or present closed-set recommendations, including b-phase difficulty, the b-plan `omp_execution` recommendation, Light Grill run/skip, b-grill boundary assessment, and b-triage category/state where confirmed by the inventory.
- Portable skill wording: call `jev` when available; emit explicit unavailable-verification metadata when the host lacks it.

## Constraints

- Do not call TypeSafe for code-derived lifecycle state, counters, dependency arrays, guardrail verdicts, or other deterministic facts.
- Do not broaden into free-form editorial verification. Preserve b-plan user confirmation and b-triage maintainer confirmation; TypeSafe verifies the recommendation but never authorizes the action.
- If an identified consumer is outside the core pipeline, create a linked follow-up instead of silently expanding this phase.

## Verification

- Inventory completeness check against skill consumers.
- Focused tests or throwaway proof for each runtime-consumed migrated field.
- `npm run guardrails:check` when code is touched; docs-only gate otherwise.