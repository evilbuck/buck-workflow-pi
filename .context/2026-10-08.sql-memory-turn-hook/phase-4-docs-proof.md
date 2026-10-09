---
status: pending
phase: 4
order: 4
plan: plan-sql-memory-turn-hook.md
phases_overview: plan-sql-memory-turn-hook-phases.md
difficulty: easy
model_hint: General model; documentation update and bounded integration proof.
buck_hint: /b-build
omp_execution: none
goal: Document the opt-out writer and prove shipped behavior matches operator guidance.
from_plan_steps: [6, 7]
depends_on: [3]
dependency_type: HARD
acceptance_criteria:
  - "[ ] Docs distinguish the opt-out hook from ordinary ungated remember and /b-save."
  - "[ ] How-to covers status, env/settings opt-out, re-enable, and Eat observes zero writes across three prompts while opted out."
  - "[ ] Guardrails pass; live SQL write proof is reported only if SQL_MEMORY_URL is available."
completed_at: null
completed_by: null
---

# Phase 4: Documentation and Live Proof

## Context

The person running OMP gets durable session facts saved to SQL memory without a manual `/b-save`; capture is on when SQL is configured, with an opt-out. This final phase aligns operator guidance with the shipped hook.

## Implementation Details

Update the SQL memory and extension-loading references, add the opt-out how-to and index link, then run the documented deterministic checks. A live write scenario is conditional on an available SQL_MEMORY_URL; a missing URL is not a successful live proof.

## Risks

Stale Q4 wording could imply all SQL writes are gated or that no automatic writer exists. Keep the policy boundary explicit.

## Verification

Run the docs checks and `/b-guardrails-check`. If SQL_MEMORY_URL is set, exercise three prompts, a fourth prompt, and a separate opted-out session; otherwise explicitly report the live check skipped.
