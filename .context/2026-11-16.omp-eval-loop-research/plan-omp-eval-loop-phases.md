---
status: active
date: 2026-11-17
subject: 2026-11-16.omp-eval-loop-research
topics: [phasing, omp, eval, workflowz, buck-loop, typescript, buck-models, before-subagent-spawn]
source_plan: plan-omp-eval-loop.md
phases: 4
format: discrete
---

# Phased Plan: Replace `/buck-loop` Extension with OMP TypeScript `eval` Runner (`workflowz`)

> Derived from [plan-omp-eval-loop.md](plan-omp-eval-loop.md)

## Overview

- **Total phases**: 4
- **Rationale**: Isolates hook-level model routing, script runner implementation/testing, prompt/command wrappers and unwiring cutover, and documentation updates into independently verifiable slices.
- **Estimated total effort**: ~4 sessions
- **Difficulty mix**: 2 easy, 1 medium, 1 hard

## Phase Summary

| Phase | Status | Difficulty | omp_execution | File |
|-------|--------|------------|---------------|------|
| 1: Subagent Model Routing for `eval` Spawns | completed | medium | none | [phase-1-subagent-model-routing.md](phase-1-subagent-model-routing.md) |
| 2: TypeScript `eval` Buck Loop Runner & Bridge Tests | completed | hard | none | [phase-2-eval-loop-runner.md](phase-2-eval-loop-runner.md) |
| 3: Command & Prompt Entrypoints and Extension Cutover | pending | easy | none | [phase-3-command-prompt-cutover.md](phase-3-command-prompt-cutover.md) |
| 4: Documentation & Workflow Skill Updates for OMP 18.x | pending | easy | none | [phase-4-docs-and-skill-updates.md](phase-4-docs-and-skill-updates.md) |

## Dependency Matrix

| From → To | Type | Reason |
|-----------|------|--------|
| Phase 1 → Phase 2 | SOFT | Subagent routing sets up `before_subagent_spawn` for `eval`, but Phase 2 runner can be developed and unit-tested with mock eval bridges independently. |
| Phase 2 → Phase 3 | HARD | `/b-loop` prompt and command wrappers execute `%load skills/b-loop/scripts/eval-buck-loop.ts`, and unwiring `wireBuckLoop` requires the tested replacement runner. |
| Phase 3 → Phase 4 | SOFT | Documentation updates in Phase 4 describe the completed `/b-loop` prompt and unwired extension state. |

## Dependency Diagram

```
Phase 1 - - - - - - - - - - - - - - - - - -┐
                                           ▼
Phase 2 ──(HARD)──→ Phase 3 - - (SOFT) - -→ Phase 4
```

**Legend:**
- `──→` = HARD dependency (blocking)
- `- -→` = SOFT dependency (can stub/mock)

**Dependency details:**
- Phase 2 SOFT-depends on Phase 1: `eval-buck-loop.ts` formats subagent labels matching Phase 1's hook regex/prefix patterns; tests can mock `agent` bridges.
- Phase 3 HARD-depends on Phase 2: `%load` targets `skills/b-loop/scripts/eval-buck-loop.ts` which must be complete and tested before cutover.
- Phase 4 SOFT-depends on Phase 3: Documentation and skills describe the shipping `/b-loop` command and unwired extension.

## Parallel Opportunities

> Phases with NO or SOFT dependencies can begin preparation in parallel.

- **Phase 1 ∥ Phase 2**: Phase 1 modifies `extensions/interactive-model-switch.ts` while Phase 2 creates `skills/b-loop/scripts/eval-buck-loop.ts` in isolation without touching extension code. They share no source files.

## Execution Order

1. Complete Phase 1: Add and verify `before_subagent_spawn` in `extensions/interactive-model-switch.ts`.
2. Complete Phase 2: Implement and test `skills/b-loop/scripts/eval-buck-loop.ts` and validate deferred assumption `A-3`.
3. Complete Phase 3: Add `prompts/b-loop.md`, `commands/b-loop.md`, `skills/b-loop/SKILL.md`, and unwire `wireBuckLoop(pi)`.
4. Complete Phase 4: Synchronize docs and skills (`docs/eval-kernel.md`, `docs/buck-workflow.md`, `skills/b-plan/SKILL.md`, `skills/b-phase/SKILL.md`).

## Execution Workflow

Use this overview as the durable navigation map for an OMP execution session. For each phase:
1. Read the first non-completed phase from the Phase Summary table.
2. Read that discrete phase file and execute only its scope using the listed `buck_hint`.
3. If the phase's `omp_execution` is `orchestrate | workflow`, drop the matching keyword on the first turn before the build command. If it is `goal`, run `/goal set "<plan User Goal>" --budget <omp_goal_budget>` first instead. Either way, see the phase file's "Per-Phase Execution Loop" for the precondition.
4. Run `/b-review` against the phase file after implementation.
5. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this phase), do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
6. Run `/b-save` so memory, draft commits, phase state, and review/iteration artifacts are durable.
7. Run `/b-commit` to checkpoint durable state before moving to the next phase.
8. If interrupted mid-cycle, leave the phase file `status: in-progress`; the session resumes from that phase and any active `iterate-*.md` artifact.

**Commit invariant**: one phase completion equals one commit. Do not batch multiple completed phases into a single commit; run `/b-save` → `/b-commit` after each phase, before queueing the next.

## Execution Checklist

- [x] Phase 1: Subagent Model Routing for `eval` Spawns — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [x] Phase 2: TypeScript `eval` Buck Loop Runner & Bridge Tests — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [ ] Phase 3: Command & Prompt Entrypoints and Extension Cutover — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [ ] Phase 4: Documentation & Workflow Skill Updates for OMP 18.x — build → review → iterate if in-plan issues → docs if doc impact → save → commit
