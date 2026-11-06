---
status: active
date: 2026-09-27
subject: 2026-09-19.buck-loop-subject-picker
topics: [phasing, buck-loop, subject-ranking, jev, tui, command-surface]
source_plan: plan-buck-loop-subject-picker.md
phases: 3
format: discrete
---

# Phased Plan: Jev-ranked `/buck-loop` subject picker

> Derived from [plan-buck-loop-subject-picker.md](plan-buck-loop-subject-picker.md)

## Overview

- **Total phases**: 3
- **Rationale**: The plan changes the command boundary, introduces a new Jev ranking module, adds two test surfaces, and updates user-facing docs — too much for one session with reliable verification.
- **Estimated total effort**: ~2 hard sessions + 1 easy session
- **Difficulty mix**: 2 hard, 1 easy

## Phase Summary

| Phase | Status | Difficulty | omp_execution | File |
|-------|--------|------------|---------------|------|
| 1: Subject-Choice Module | pending | hard | none | [phase-1-subject-choice.md](phase-1-subject-choice.md) |
| 2: Command Boundary and Kickoff | pending | hard | none | [phase-2-command-kickoff.md](phase-2-command-kickoff.md) |
| 3: Documentation | pending | easy | none | [phase-3-docs.md](phase-3-docs.md) |

## Dependency Matrix

| From → To | Type | Reason |
|-----------|------|--------|
| Phase 1 → Phase 2 | HARD | Phase 2's handler consumes `subject-choice.ts` exports; it cannot compile or be tested without the Phase 1 module. |
| Phase 2 → Phase 3 | SOFT | Docs describe shipped behavior; nothing blocks writing them except accuracy against the real UI. |

## Dependency Diagram

```
Phase 1 ──→ Phase 2 - -→ Phase 3
```

**Legend:**
- `──→` = HARD dependency (blocking)
- `- -→` = SOFT dependency (can stub/mock)

**Dependency details:**
- Phase 2 HARD-depends on Phase 1: the wire layer imports candidate discovery, Jev ranking, and validation from `extensions/buck-loop/subject-choice.ts`.
- Phase 3 SOFT-depends on Phase 2: documentation references exact activity strings (`Choosing a subject`, `Starting <subject>`) and shipped behavior.

## Execution Workflow

Use this overview as the durable navigation map for an OMP execution session. For each phase:
1. Read the first non-completed phase from the Phase Summary table.
2. Read that discrete phase file and execute only its scope using the listed `buck_hint`.
3. Run `/b-review` against the phase file after implementation.
4. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this phase), do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
5. Run `/b-save` so memory, draft commits, phase state, and review/iteration artifacts are durable.
6. Run `/b-commit` to checkpoint durable state.
7. If interrupted mid-cycle, leave the phase file `status: in-progress`; the session resumes from that phase and any active `iterate-*.md` artifact.

## Execution Checklist

- [ ] Phase 1: Subject-Choice Module — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [ ] Phase 2: Command Boundary and Kickoff — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [ ] Phase 3: Documentation — build → review → iterate if in-plan issues → docs if doc impact → save → commit

## Parallel Opportunities

None — all phases are sequentially dependent (1 → 2 → 3).

## Notes

- Hard fail-closed invariant across all phases: Jev failure, missing credentials, malformed probabilities, missing TUI, timeout, or cancel stops the invocation with no run artifacts and no chat/heuristic fallback.
- Never create the start log before operator selection (would record an empty path).
- `scan.ts`, `loop.ts`, `machine.ts`, `persist.ts`, and `choice.ts` require no behavior changes in any phase.
