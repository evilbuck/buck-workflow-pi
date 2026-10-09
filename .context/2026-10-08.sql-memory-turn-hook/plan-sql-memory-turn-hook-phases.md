---
status: active
date: 2026-10-08
subject: 2026-10-08.sql-memory-turn-hook
topics: [phasing, omp-hooks, sql-memory, turn-capture]
source_plan: plan-sql-memory-turn-hook.md
phases: 4
format: discrete
---

# Phased Plan: SQL memory turn hook

> Derived from [plan-sql-memory-turn-hook.md](plan-sql-memory-turn-hook.md)

## Overview

- **Total phases**: 4
- **Rationale**: Isolate the persisted-window selection and secret handling, capture/write trust boundary, OMP adapter and package registration, then documentation and end-to-end verification.
- **Difficulty mix**: 2 hard, 1 medium, 1 easy.

## Phase Summary

| Phase | Status | Difficulty | omp_execution | File |
|-------|--------|------------|---------------|------|
| 1: Enablement and Window | completed | medium | none | [phase-1-enable-window.md](phase-1-enable-window.md) |
| 2: Capture and Durable Write | completed | hard | none | [phase-2-capture-write.md](phase-2-capture-write.md) |
| 3: OMP Hook and Package Surface | pending | hard | none | [phase-3-hook-package.md](phase-3-hook-package.md) |
| 4: Documentation and Live Proof | pending | easy | none | [phase-4-docs-proof.md](phase-4-docs-proof.md) |

## Dependency Matrix

| From → To | Type | Reason |
|-----------|------|--------|
| Phase 1 → Phase 2 | HARD | Capture depends on the stable enablement and replay-safe selected-window contract. |
| Phase 2 → Phase 3 | HARD | The adapter must call the verified capture/write boundary. |
| Phase 3 → Phase 4 | HARD | Docs and package smoke must reflect the shipped hook behavior. |

## Dependency Diagram

```text
Phase 1 ──→ Phase 2 ──→ Phase 3 ──→ Phase 4
```

## Dependency details

- Phase 2 HARD-depends on Phase 1 because capture consumes its selected window and enablement contract.
- Phase 3 HARD-depends on Phase 2 because the event adapter must delegate to tested capture logic.
- Phase 4 HARD-depends on Phase 3 because package-discovery and operator documentation require the shipped surface.

## Execution Workflow

Read the first non-completed phase, implement only that phase, run its verification, then `/b-review` → `/b-save` → `/b-commit` before advancing. Keep acceptance criteria unchecked until evidence has been reviewed.

## Execution Checklist

- [ ] Phase 1: Enablement and Window — build → review → save → commit
- [ ] Phase 2: Capture and Durable Write — build → review → save → commit
- [ ] Phase 3: OMP Hook and Package Surface — build → review → save → commit
- [ ] Phase 4: Documentation and Live Proof — build → review → save → commit
