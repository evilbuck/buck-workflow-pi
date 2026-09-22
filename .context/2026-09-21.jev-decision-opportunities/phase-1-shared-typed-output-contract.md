---
status: completed
phase: 1
order: 1
plan: plan-jev-buck-loop-chooser.md
phases_overview: plan-jev-buck-loop-chooser-phases.md
difficulty: hard
model_hint: strongest reasoning model available
buck_hint: /b-build-hard
omp_execution: orchestrate
goal: "Establish one reusable contract and TypeSafe evaluator for model-authored workflow control outputs."
files:
  - extensions/jev-tool/index.ts
  - extensions/jev-tool/__tests__/jev-tool.test.ts
  - extensions/typed-output/
  - extensions/typed-output/__tests__/
from_plan_steps: [1, 2, 3, 4]
depends_on: []
dependency_type: NONE
acceptance_criteria:
  - "[x] Versioned contracts validate shape, enums, booleans, and cross-field invariants deterministically."
  - "[x] The jev tool and runtime consumers share one injectable TypeSafe evaluator."
  - "[x] Fixtures cover valid, missing, malformed, contradictory, disagreement, low-confidence, and unavailable-provider cases."
  - "[x] Focused tests perform zero live network calls."
completed_at: 2026-09-22
completed_by: b-build
---

# Phase 1: Shared Typed-Output Contract

## Context

Parent goal: Buck Workflow control decisions are complete, repairable, and semantically verified before automation consumes them.

Precondition: complete or reconcile the active `.context/2026-09-21.jev-tool` work and begin from a committed baseline.

## Deliverables

- Versioned TypeScript contracts for `buck.review/v1`, semantic-verification results, validator diagnostics, and `fix | continue`.
- A shared evaluator containing client construction, request validation, injected test seam, SDK call, and normalized failures.
- A thin `jevTool()` adapter preserving the existing public tool input/output contract.
- Fixture corpus and named policy constants. CI uses injected results; live calibration is optional and separate.

## Constraints

- Deterministic code validates structure; TypeSafe evaluates semantic agreement.
- No second SDK wrapper and no `runOmpModelSession` indirection.
- No secret values in diagnostics or fixtures.
- Do not set confidence thresholds by copying the existing phase-difficulty value; calibrate against this corpus.

## Verification

- Focused typed-output and Jev adapter tests.
- Existing Jev tool tests remain behaviorally green.
- `npm run guardrails:check`.