---
status: active
date: 2026-05-18
subject: 2026-05-18.buck-loop
topics: [phasing, buck-loop, b-flow, autonomous, xstate, orchestration]
source_plan: plan-autonomous-b-flow-loop.md
phases: 6
format: discrete
---

# Phased Plan: Autonomous b-flow Inner Loop

> Derived from [plan-autonomous-b-flow-loop.md](plan-autonomous-b-flow-loop.md)

## Overview

- **Total phases**: 6
- **Rationale**: The source plan touches 10+ implementation files, changes the orchestration state machine, alters worker/result contracts, and requires substantial recovery and integration testing.
- **Estimated total effort**: 6 focused implementation sessions.
- **Difficulty mix**: 4 medium, 2 hard.
- **Backlog update**: skipped because `.context/backlog/` and legacy `.context/backlog.md` are not present.
- **Grill metadata**: no `grill-session-*.md` files were present in this subject folder.

## Phase Summary

| Phase | Status | Difficulty | File |
|-------|--------|------------|------|
| 1: Contracts, Parsers, and Scanners | completed | medium | [phase-1-contracts-parsers-scanners.md](phase-1-contracts-parsers-scanners.md) |
| 2: Worker Modes and Prompt Contracts | completed | medium | [phase-2-worker-modes.md](phase-2-worker-modes.md) |
| 3: Lifecycle Actor and Runtime Projection | completed | hard | [phase-3-lifecycle-projection.md](phase-3-lifecycle-projection.md) |
| 4: Guardrails, Recovery, and Cancellation | completed | hard | [phase-4-guardrails-recovery.md](phase-4-guardrails-recovery.md) |
| 5: Autonomous Wiring, Status, and Display | pending | medium | [phase-5-status-autonomous-ui.md](phase-5-status-autonomous-ui.md) |
| 6: Integration Tests and Smoke Verification | pending | medium | [phase-6-integration-smoke.md](phase-6-integration-smoke.md) |

## Dependency Matrix

| From → To | Type | Reason |
|-----------|------|--------|
| Phase 1 → Phase 2 | HARD | Worker mode prompts/audits should use the shared `WorkerMode`, review result, active iterate, and queue contracts from Phase 1. |
| Phase 1 → Phase 3 | HARD | The lifecycle actor depends on typed result parsing, active iterate scan metadata, and stale iterate queue filtering. |
| Phase 2 → Phase 3 | HARD | Lifecycle states spawn build/review/iterate/save workers and need the mode-specific worker/audit contract. |
| Phase 3 → Phase 4 | HARD | Guardrails, recovery, STOP, and PAUSE need explicit lifecycle states and persisted active projection to block or reconcile correctly. |
| Phase 3 → Phase 5 | HARD | Status, compaction, and display must derive from persisted active lifecycle projection rather than inventing their own state. |
| Phase 4 → Phase 5 | HARD | Autonomous/guided UI must preserve blocking guardrails and surface STOP/PAUSE behavior correctly. |
| Phase 1 → Phase 6 | HARD | Final integration tests assert parser, scanner, queue-builder, and result contracts. |
| Phase 2 → Phase 6 | HARD | Final integration tests assert worker mode prompts and audit contracts. |
| Phase 3 → Phase 6 | HARD | Final integration tests assert lifecycle happy paths and projection. |
| Phase 4 → Phase 6 | HARD | Final integration tests assert blocking guardrails, recovery, and cancellation. |
| Phase 5 → Phase 6 | HARD | Smoke verification exercises the user-facing autonomous command/status path. |

## Dependency Diagram

```text
Phase 1 ──→ Phase 2 ──→ Phase 3 ──→ Phase 4 ──→ Phase 5 ──→ Phase 6
   │                         │          │                         ▲
   └─────────────────────────┴──────────┴─────────────────────────┘
```

**Legend:**
- `──→` = HARD dependency (blocking)
- `- -→` = SOFT dependency (can stub/mock)
- `│` = additional direct dependency into final verification

**Dependency details:**
- Phase 2 HARD-depends on Phase 1 because worker modes should use the newly introduced shared types and result/iterate contracts.
- Phase 3 HARD-depends on Phases 1–2 because lifecycle routing consumes parsed review results, active iterate metadata, and mode-specific workers.
- Phase 4 HARD-depends on Phase 3 because guardrails must observe explicit lifecycle states and persisted active projection.
- Phase 5 HARD-depends on Phases 3–4 because UI/status must display lifecycle state and preserve guardrail blocking semantics.
- Phase 6 HARD-depends on all previous phases because it consolidates end-to-end integration and smoke verification.

## Parallel Opportunities

> Phases with NO dependency between them can be executed in parallel by separate agents.

No full phase is dependency-free after Phase 1. The safest execution path is sequential.

Possible limited parallel work:

- **Phase 4 helper design ∥ Phase 5 status text drafting**: An agent could sketch pure guard helper tests while another drafts status/compaction output expectations.
  - *Rationale*: Guard helper names and status labels can be discussed before implementation is complete.
  - *Caveat*: Do not merge Phase 5 wiring before Phase 4 guardrail behavior and Phase 3 projection fields are stable.

## Execution Order

1. Complete Phase 1 and verify acceptance criteria.
2. Update `phase-1-contracts-parsers-scanners.md`: set `status: completed`, check acceptance criteria, and fill `completed_at` / `completed_by`.
3. Update this overview: change Phase 1 status to `completed` in the summary table.
4. Queue Phase 2 and repeat through Phase 6.
5. After Phase 6, run the planned full verification and manual smoke test, or document blockers clearly.

## Notes

- Phase 3 and Phase 4 are the highest-risk phases and should use `/b-build-hard`.
- Keep all runtime truth artifact-driven: phase file frontmatter, worker result files, audit files, and `orchestration.json` projection.
- When uncertain during recovery or safety attribution, block with an actionable reason rather than guessing success.
- Future sessions can resume cold by reading this overview, finding the first non-completed phase, then reading that phase file.
