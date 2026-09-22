---
status: active
plan: plan-jev-buck-loop-chooser.md
subject: 2026-09-21.jev-decision-opportunities
updated: 2026-09-22
omp_execution: orchestrate
phases: 5
---

# Phases: Typed workflow outputs and fix-or-continue recovery

## User Goal

Operators can trust Buck Workflow automation to produce complete control decisions, repair malformed agent output without dead-ending, and continue safely when repair is unnecessary.

## Why phased

The plan changes a shared TypeSafe adapter, a portable skill contract, buck-loop scanning and state-machine behavior, several model-authored control outputs, and live workflow documentation. Five independently reviewed phases keep the routing cutover and recovery semantics verifiable.

## External precondition

Complete or reconcile `.context/2026-09-21.jev-tool` before Phase 1. Its active Phase 2 work overlaps the Jev adapter and buck-loop tests. Start from a committed baseline; do not overwrite that working tree.

## Dependency graph

- Phase 1 → Phase 2: **HARD** — review verification and runtime routing need the shared evaluator and versioned contract.
- Phase 2 → Phase 3: **HARD** — recovery consumes the typed review diagnostics established in Phase 2.
- Phase 3 → Phase 4: **HARD** — other skills reuse the proven `fix | continue` and semantic-verification protocol.
- Phase 4 → Phase 5: **HARD** — documentation and live proof must describe the final migrated surface.

## Phase sequence

1. [Phase 1: Shared Typed-Output Contract](phase-1-shared-typed-output-contract.md) — hard — shared evaluator, schemas, fixtures, calibration policy.
2. [Phase 2: Review Contract and Typed Routing](phase-2-review-contract-and-routing.md) — hard — mandatory `buck.review/v1`, deterministic scanner, incident regressions.
3. [Phase 3: Fix-or-Continue Recovery](phase-3-fix-or-continue-recovery.md) — hard — evidence-rich recovery, verified choice, no recoverable `block` option.
4. [Phase 4: Core Closed-Set Migration](phase-4-core-closed-set-migration.md) — hard — inventory and migrate model-authored core workflow enums/booleans.
5. [Phase 5: Documentation and Live Proof](phase-5-documentation-and-live-proof.md) — medium — living docs, optional ADR, real `/buck-loop` smoke, final guardrails.

## Execution

Type `orchestrate` in the first turn for each phase. Run `/b-build-hard` for Phases 1–4 and `/b-build` for Phase 5; every phase still completes review, iteration if needed, save, and commit before the next phase.