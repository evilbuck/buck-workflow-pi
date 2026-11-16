---
status: active
date: 2026-10-01
updated: 2026-11-16
subject: 2026-10-01.skill-command-viability
topics: [phasing, skills, commands, viability, cleanup, consolidation]
source_plan: plan-viability-cleanup.md
phases: 4
format: discrete
---

# Phased Plan: Viability cleanup

> Derived from [plan-viability-cleanup.md](plan-viability-cleanup.md)

## Overview

- **Total phases**: 4
- **Rationale**: D1, F1–F8, G1, and M1–M5 share `README.md`, `docs/buck-workflow.md`, and `scripts/codex-plugin.test.ts`, so phasing keeps each commit a coherent, revertible slice.
- **Estimated total effort**: four sessions, one commit each
- **Difficulty mix**: 4 medium
- **Not phased**: X2, X3 stay on the parent checklist (`keep`)

## Phase Summary

| Phase | Status | Difficulty | omp_execution | File |
|---|---|---|---|---|
| 1: OMP stubs to docs | completed | medium | none | [phase-1-omp-stubs.md](phase-1-omp-stubs.md) |
| 2: Fold duplicates (F1–F8) | completed | medium | none | [phase-2-fold-duplicates.md](phase-2-fold-duplicates.md) |
| 3: Unify grill family (G1) | pending | medium | none | [phase-3-grill-shell.md](phase-3-grill-shell.md) |
| 4: Move or remove misfits (M1–M5) | pending | medium | none | [phase-4-move-out.md](phase-4-move-out.md) |

## Dependency Matrix

| From → To | Type | Reason |
|---|---|---|
| Phase 1 → Phase 2 | HARD | Both edit `docs/buck-workflow.md` and `README.md` |
| Phase 2 → Phase 3 | HARD | Both edit those catalog files and `scripts/codex-plugin.test.ts` |
| Phase 3 → Phase 4 | HARD | Phase 4 catalog edits must follow the grill unification; M3 also needs F2, which Phase 2 completes |

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

- A-1 (`design-brief` skill vs `_shared/design-brief.jsonc`) and A-2 (`prompts/` ↔ `commands/` symlink mirror) are validated and enforced in Phase 2.
- A-5 (`ADR-FORMAT.md` and `CONTEXT-FORMAT.md` relocation into `skills/b-grill/`) is validated and enforced in Phase 3.
- A-3 (external move destinations unset on `M1`, `M2`, `M5`) is owned by Phase 4. It stays deferred and non-blocking for Phases 1–3. Phase 4 executes M3 and M4 (whose destinations are in-repo) and leaves any unset external move in place as `skip` rather than guessing a destination.
- A-4 is X2 (`keep`) and is outside these phases.

## Execution Order

1. Complete Phase 1, verify acceptance criteria, set the phase file `status: completed` (done 2026-10-03).
2. Execute Phase 2 (F1–F8), verify acceptance criteria, review, save, commit.
3. Execute Phase 3 (G1), verify acceptance criteria, review, save, commit.
4. Execute Phase 4 (M1–M5), verify acceptance criteria, review, save, commit.

## Execution Workflow

Use this overview as the durable navigation map. For each phase:

1. Read the first non-completed phase from the Phase Summary table.
2. Read that discrete phase file and execute only its scope using `/b-build`.
3. Run `/b-review` against the phase file.
4. If review creates an `iterate-*.md` artifact, run `/b-iterate`, then re-run `/b-review`. Out-of-plan findings go to a separate `/b-plan`. If review flags documentation impact, run `/b-docs` before `/b-save`.
5. Run `/b-save`.
6. Run `/b-commit` before the next phase.
7. If interrupted, leave the phase file `status: in-progress`.

`omp_execution` is none.

## Execution Checklist

- [x] Phase 1: OMP stubs to docs — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [x] Phase 2: Fold duplicates (F1–F8) — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [ ] Phase 3: Unify grill family (G1) — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [ ] Phase 4: Move or remove misfits (M1–M5) — build → review → iterate if in-plan issues → docs if doc impact → save → commit

## Notes

- Do not phase X2–X3 (`keep`).
- Phase 3 consolidates `b-grill`, `b-grill-me`, and `b-grill-with-docs` into `skills/b-grill/` with domain docs enabled by default and `--no-docs` to opt out.
- Phase 4 does not guess destinations for M1, M2, or M5.
