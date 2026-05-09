---
status: completed
date: 2026-05-08
subject: 2026-05-08.b-orchestration-extension
topics: [phasing, buck-workflow, pi-extension, orchestration, state-machine, b-flow]
source_plan: plan-b-flow-mvp.md
phases: 4
format: discrete
---

# Phased Plan: b-flow MVP

> Derived from [plan-b-flow-mvp.md](plan-b-flow-mvp.md)

## Overview

- **Total phases**: 4
- **Rationale**: 15 implementation steps across 6+ files spanning XState machine definition, persistence, actor logic, worker orchestration, UI, and tests. Too large for one session; high-risk state machine + external worker concerns require incremental verification.
- **Estimated total effort**: 4 sessions
- **Difficulty mix**: 1 easy, 1 medium, 1 hard, 1 medium

## Phase Summary

| Phase | Status | Difficulty | File |
|-------|--------|------------|------|
| 1: Foundation & Types | completed | easy | [phase-1-foundation-types.md](phase-1-foundation-types.md) |
| 2: State Machine Core | completed | medium | [phase-2-state-machine-core.md](phase-2-state-machine-core.md) |
| 3: Worker Loop & Verification | completed | hard | [phase-3-worker-loop.md](phase-3-worker-loop.md) |
| 4: UI, Commands & Tests | completed | medium | [phase-4-ui-commands-tests.md](phase-4-ui-commands-tests.md) |

## Dependency Matrix

| From → To | Type | Reason |
|-----------|------|--------|
| Phase 1 → Phase 2 | HARD | Phase 2 needs types, persistence layer, and module structure from Phase 1 |
| Phase 2 → Phase 3 | HARD | Phase 3 needs the state machine skeleton and scan/guard actors from Phase 2 |
| Phase 3 → Phase 4 | HARD | Phase 4 needs the worker loop and result parsing from Phase 3 |

## Dependency Diagram

```
Phase 1 ──→ Phase 2 ──→ Phase 3 ──→ Phase 4
```

**Legend:**
- `──→` = HARD dependency (blocking)

**Dependency details:**
- Phase 2 HARD-depends on Phase 1: machine context types, persistence module, and `extensions/b-flow/` directory must exist
- Phase 3 HARD-depends on Phase 2: state machine with guards must be running before workers can be invoked
- Phase 4 HARD-depends on Phase 3: command handlers need working machine + worker loop for integration tests

## Parallel Opportunities

No parallel opportunities in MVP — all phases form a linear dependency chain. Future phases (parallel workers, classifier improvements) may introduce parallelism.

## Execution Order

1. Complete Phase 1, verify acceptance criteria
2. Update phase file: `status: completed`, check acceptance criteria
3. Update this overview: change status to `completed` in summary table
4. Queue Phase 2, repeat...

## Notes

- Phase 1 is deliberately small and mechanical — it establishes the skeleton so later phases can be tested incrementally.
- Phase 3 is the highest-risk phase (external worker subprocess management, result parsing, retry logic). If this phase reveals transport issues, it may need its own sub-phasing.
- Tests are split: unit tests for guards/queue logic can start in Phase 2; integration tests for full command → machine → worker flow happen in Phase 4.
- The spec (`spec-b-flow-state-machine.md`) is the authoritative design reference for all phases.
