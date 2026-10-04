---
status: active
date: 2026-10-03
subject: 2026-10-03.review-severity-ranking
topics: [phasing, buck-loop, jev, review, severity, ranking]
source_plan: plan-review-severity-ranking.md
phases: 4
format: discrete
---

# Phased Plan: review severity ranking

> Derived from [plan-review-severity-ranking.md](plan-review-severity-ranking.md)

## Overview

- **Total phases**: 4
- **Rationale**: the plan crosses four layers (state contract, Jev ranking core, machine/loop routing, docs) with a new effect kind; one session would be the wrong envelope.
- **Estimated total effort**: ~45k goal tokens (8k + 16k + 16k + 4k)
- **Difficulty mix**: 2 hard, 1 medium, 1 easy

## Phase Summary

| Phase | Status | Difficulty | omp_execution | File |
|-------|--------|------------|---------------|------|
| 1: Types, Scan, and the Pure Waterline | completed | medium | orchestrate | [phase-1-types-scan-pure-waterline.md](phase-1-types-scan-pure-waterline.md) |
| 2: Jev Ranking Core and Audit Trail | pending | hard | orchestrate | [phase-2-jev-ranking-core.md](phase-2-jev-ranking-core.md) |
| 3: Machine Edges and the Rank Effect Handler | pending | hard | orchestrate | [phase-3-machine-loop-routing.md](phase-3-machine-loop-routing.md) |
| 4: State Diagram and Doc Sentence | pending | easy | orchestrate | [phase-4-docs.md](phase-4-docs.md) |

## Dependency Matrix

| From → To | Type | Reason |
|-----------|------|--------|
| Phase 1 → Phase 2 | HARD | `rankIssues()` builds on the parser and `aboveWaterline()`; no independent compile without the types/contract. |
| Phase 1 → Phase 3 | HARD | The machine edge references the `ranking` state, `rank` effect, and `hasIterate()` below-waterline rule from Phase 1. |
| Phase 2 → Phase 3 | HARD | `runEffect`'s `rank` handler calls `rankIssues()`; routing depends on its results. |
| Phase 3 → Phase 4 | HARD | The docs describe the edges as landed in `machine.ts`, not as planned. |

## Dependency Diagram

```
Phase 1 ──→ Phase 2 ──→ Phase 3 ──→ Phase 4
   └──────────────────────┘
```

**Legend:**
- `──→` = HARD dependency (blocking)
- `│` = shared resource/file

**Dependency details:**
- Phase 2 HARD-depends on Phase 1: the engine consumes the Phase 1 parser and waterline function.
- Phase 3 HARD-depends on Phases 1 and 2: state vocabulary plus the ranking engine.
- Phase 4 HARD-depends on Phase 3: prose must match implemented edges.

## Parallel Opportunities

- None. The chain is fully sequential; Phase 3 is the only integration point and Phase 4 describes its result.

## Execution Order

1. Complete Phase 1, verify acceptance criteria
2. Update phase file: `status: completed`, check acceptance criteria
3. Update this overview: change status to `completed` in summary table
4. Queue Phase 2, repeat...

## Execution Workflow

Use this overview as the durable navigation map for an OMP execution session. For each phase:
1. Read the first non-completed phase from the Phase Summary table.
2. Read that discrete phase file and execute only its scope using the listed `buck_hint`.
3. The `omp_execution` is `orchestrate`: type the `orchestrate` keyword anywhere in the first turn of the phase; omp injects the orchestrator contract (parallel `task` subagents, no-yield between phases, verify-after-every-phase).
4. Run `/b-review` against the phase file after implementation.
5. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this phase), do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
6. Run `/b-save` so memory, draft commits, phase state, and review/iteration artifacts are durable.
7. Run `/b-commit` to checkpoint durable state.
8. If interrupted mid-cycle, leave the phase file `status: in-progress`; the session resumes from that phase and any active `iterate-*.md` artifact.

**Commit invariant**: one phase completion equals one commit. Do not batch multiple completed phases into a single commit; run `/b-save` → `/b-commit` after each phase, before queueing the next.

## Deferred Assumption Ownership

| Assumption | Owning phase | Validation |
|---|---|---|
| A-1 (iterate-artifact shape) | Phase 1 | Fixture parse unit test |
| A-8 (one Jev call per issue) | Phase 2 | Injected-ask unit tests |
| A-9 (`hasIterate()` ignores below-waterline) | Phase 1 | Scan unit test before the machine edge |
| A-10 (two unfinished files block) | Phase 1 (parse), Phase 3 (machine edge) | Ranking + machine tests |
| A-11 (double docs-eval failure opens choice) | Phase 3 | Machine test; operator may reject the default before Phase 3 starts |

## Execution Checklist

- [ ] Phase 1: Types, Scan, and the Pure Waterline — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [ ] Phase 2: Jev Ranking Core and Audit Trail — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [ ] Phase 3: Machine Edges and the Rank Effect Handler — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [ ] Phase 4: State Diagram and Doc Sentence — build → review → iterate if in-plan issues → docs if doc impact → save → commit
