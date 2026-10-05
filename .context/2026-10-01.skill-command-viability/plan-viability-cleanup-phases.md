---
status: active
date: 2026-10-01
subject: 2026-10-01.skill-command-viability
topics: [phasing, skills, commands, viability, cleanup]
source_plan: plan-viability-cleanup.md
phases: 4
format: discrete
---

# Phased Plan: Viability cleanup

> Derived from [plan-viability-cleanup.md](plan-viability-cleanup.md)

## Overview

- **Total phases**: 4
- **Rationale**: D1, F1–F3, G1, and M1–M3 share `README.md` and `docs/buck-workflow.md`, so one session cannot apply them without a messy half-updated catalog.
- **Estimated total effort**: four sessions, one commit each
- **Difficulty mix**: 4 medium
- **Not phased**: X1, X2, X3 stay on the parent checklist (`keep`)

## Phase Summary

| Phase | Status | Difficulty | omp_execution | File |
|---|---|---|---|---|
| 1: OMP stubs to docs | completed | medium | none | [phase-1-omp-stubs.md](phase-1-omp-stubs.md) |
| 2: Fold duplicates | pending | medium | none | [phase-2-fold-duplicates.md](phase-2-fold-duplicates.md) |
| 3: Delete the grill shell | pending | medium | none | [phase-3-grill-shell.md](phase-3-grill-shell.md) |
| 4: Move out of the package | pending | medium | none | [phase-4-move-out.md](phase-4-move-out.md) |

## Dependency Matrix

| From → To | Type | Reason |
|---|---|---|
| Phase 1 → Phase 2 | HARD | Both edit `docs/buck-workflow.md` and `README.md` |
| Phase 2 → Phase 3 | HARD | Both edit those catalog files and `scripts/codex-plugin.test.ts` |
| Phase 3 → Phase 4 | HARD | Phase 4 catalog edits must follow the grill-shell deletion; M3 also needs F2, which Phase 2 already completed |

## Dependency Diagram

```
Phase 1 ──→ Phase 2 ──→ Phase 3 ──→ Phase 4
```

**Legend:** `──→` = HARD.

**Dependency details:**

- Phase 2 HARD-depends on Phase 1: shared catalog files.
- Phase 3 HARD-depends on Phase 2: shared catalog files and the Codex allowlist.
- Phase 4 HARD-depends on Phase 3: shared catalog files. M3's need for F2 is covered because Phase 2 must finish before Phase 3.

## Parallel Opportunities

None. Every phase edits `README.md` and `docs/buck-workflow.md`.

## Assumption assignment

A-3 (move destinations unset) is owned only by Phase 4. It stays deferred and non-blocking for Phases 1–3. Phase 4 must not invent a destination. A-1 and A-2 are already validated. A-4 is X2 and is outside these phases.

## Execution Order

1. Complete Phase 1, verify acceptance criteria, set the phase file `status: completed`.
2. Update this table.
3. Queue Phase 2, then 3, then 4.

## Execution Workflow

Use this overview as the durable navigation map. For each phase:

1. Read the first non-completed phase from the Phase Summary table.
2. Read that discrete phase file and execute only its scope using `/b-build`.
3. Run `/b-review` against the phase file.
4. If review creates an `iterate-*.md` artifact, run `/b-iterate`, then re-run `/b-review`. Out-of-plan findings go to a separate `/b-plan`. If review flags documentation impact, run `/b-docs` before `/b-save`.
5. Run `/b-save`.
6. Run `/b-commit` before the next phase.
7. If interrupted, leave the phase file `status: in-progress`.

`omp_execution` is none. The parent plan is an operator walk-through, not an orchestrated sweep.

## Execution Checklist

- [x] Phase 1: OMP stubs to docs — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [ ] Phase 2: Fold duplicates — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [ ] Phase 3: Delete the grill shell — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [ ] Phase 4: Move out of the package — build → review → iterate if in-plan issues → docs if doc impact → save → commit

## Notes

- Do not phase X1–X3.
- Phase 3 stops without deleting if the two `grill.py` files differ.
- Phase 4 does not guess destinations for M1 or M2.
