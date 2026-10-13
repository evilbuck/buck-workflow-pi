---
status: active
date: 2026-06-07
subject: 2026-06-06.omp-integration-buck-workflow
topics: [phasing, cross-harness, compat, eval-kernel, b-phase, b-plan, omp-execution-recommendation, omp-autonomous-loops, b-grill]
source_plan: plan-cross-harness-kernel.md
phases: 4
format: discrete
---

# Phased Plan: Cross-harness compat + Phased Kernel

> Derived from [plan-cross-harness-kernel.md](plan-cross-harness-kernel.md)

## Overview

- **Total phases**: 4
- **Rationale**: Plan is large (4 substantive phases, 15+ files, two distinct concerns: cross-harness safety on the existing OMP surfaces, plus a new kernel workstream that needs a contract doc, real example cells, and `b-grill*` integration). Hard dependency between every phase. Each phase fits in one session.
- **Estimated total effort**: ~4.5–5 hours
- **Difficulty mix**: 1 easy (Phase 1), 2 medium (Phases 2, 3), 1 hard (Phase 4)

## Phase Summary

| Phase | Status | Difficulty | omp_execution | File |
|-------|--------|------------|---------------|------|
| 1: Cross-harness compat | completed (2026-06-07) | easy | none | [phase-1-cross-harness-compat.md](phase-1-cross-harness-compat.md) |
| 2: Kernel contract doc | completed (2026-06-07) | medium | none | [phase-2-kernel-contract-doc.md](phase-2-kernel-contract-doc.md) |
| 3: Real kernel usage examples | completed (2026-06-07) | medium | none | [phase-3-eval-kernel-examples.md](phase-3-eval-kernel-examples.md) |
| 4: b-grill* integration with the cell | completed (2026-06-07) | hard | none | [phase-4-b-grill-integration.md](phase-4-b-grill-integration.md) |

**`omp_execution` note.** The plan-level OMP Execution Recommendation says
"4+ phases with hard deps → `orchestrate`." Each phase file's
`omp_execution` is independently `none` because `b-phase`'s recommendation
rule is **plan-level**, not phase-level. The orchestrator contract
(parallel `task` subagents, no-yield between phases, verify-after-every-phase)
is set on the first turn of the *plan* — once the user types the
`orchestrate` keyword, omp injects the contract for the full run. Individual
phases do not need to re-declare it.

If a phase ever needs a different opt-in (e.g., Phase 3 wants a `workflow`
cell to validate the examples), the phase's own frontmatter can override.
For the default execution, leave each phase at `omp_execution: none` and
let the plan-level `orchestrate` carry.

## Dependency Matrix

| From → To | Type | Reason |
|-----------|------|--------|
| Phase 1 → Phase 2 | HARD | The contract doc references the runtime probe from Phase 1. |
| Phase 2 → Phase 3 | HARD | The example cells reference helper signatures documented in Phase 2. |
| Phase 3 → Phase 4 | HARD | The `decision_domains → PHASES` mapping is defined in Phase 2's doc; the cell shape is exercised in Phase 3. |

## Dependency Diagram

```
Phase 1 ──→ Phase 2 ──→ Phase 3 ──→ Phase 4
 (compat)   (contract)  (examples)  (b-grill*)
```

**Legend:**
- `──→` = HARD dependency (blocking)
- `│` = shared resource/file
- All four phases are sequential. No phase can be parallelized.

## Dependency details:

- Phase 2 HARD-depends on Phase 1: `docs/eval-kernel.md` "Cross-platform"
  section must point at the runtime probe from Phase 1 (the `try / except
  ImportError` block in `b-plan`'s eval cell template) and at the
  header-guard in the three `omp-*.md` slash-command stubs.
- Phase 3 HARD-depends on Phase 2: the two example cells import helpers
  whose signatures must be stable in the contract doc before the cells
  can be written against them. The schema shape (`additionalProperties: false`)
  is also first documented in Phase 2.
- Phase 4 HARD-depends on Phases 2 and 3: the `decision_domains → PHASES`
  mapping is defined in Phase 2's doc; the cell shape and the per-phase
  `agent()` call pattern is exercised in Phase 3. Without both, the
  mapping cannot be specified safely.

## Parallel Opportunities

> Phases with NO dependency between them can be executed in parallel by separate agents.

- **None.** Every phase hard-depends on the previous. The plan is intentionally
  sequential — the work builds on prior deliverables at each step.

## Execution Order

1. Complete Phase 1, verify acceptance criteria
2. Update phase file: `status: completed`, check acceptance criteria
3. Update this overview: change status to `completed` in summary table
4. Queue Phase 2, repeat...
5. Continue through Phase 4

## OMP Execution Recommendation (this plan's own meta-check)

Applying the rules from `skills/b-plan/SKILL.md` "OMP Execution Recommendation":

- Plan is phased? Yes (4 phases).
- ≥ 4 phases? Yes.
- ≥ 1 HARD dependency between phases? Yes (each phase hard-depends on the previous).
- → First rule matches → **recommend `orchestrate`** (when the active harness is OMP).

On non-OMP harnesses, Phase 1's top-row guard returns `none` and the
Ralph cycle runs without an opt-in keyword.

## Ralph Workflow Instructions

This is a phased Ralph-ready plan. Treat each phase as one unit:

1. Read the first non-completed phase from the Phase Summary table.
2. Read that discrete phase file and execute only its scope using the listed `buck_hint`.
3. If the phase's `omp_execution` is `orchestrate | workflow | goal`, drop the matching keyword (or run `/goal set`) on the first turn before the build command — see the phase file's "Ralph Mini-Cycle Instructions" for the precondition. *(For this plan, plan-level `orchestrate` is set on the first turn of the plan; per-phase `omp_execution` is `none` by default.)*
4. Run `/b-review` against the phase file after implementation.
5. If review creates an `iterate-*.md` artifact, run `/b-iterate`, then re-run `/b-review`.
6. Run `/b-save` to consolidate memory, draft commits, and phase state.
7. Run `/git-commit` to checkpoint durable state before `ralph_done`.

For a non-phased plan, use the same mini-cycle with the whole plan as a
single unit: `/b-build` → `/b-review` → `/b-iterate` if needed → `/b-save`
→ `/git-commit` → `ralph_done`.

## Ralph Execution Checklist

- [ ] Phase 1: Cross-harness compat — build → review → iterate if needed → save → commit
- [ ] Phase 2: Kernel contract doc — build → review → iterate if needed → save → commit
- [ ] Phase 3: Real kernel usage examples — build → review → iterate if needed → save → commit
- [ ] Phase 4: b-grill* integration with the cell — build → review → iterate if needed → save → commit

## Notes

- The active subject folder is `.context/2026-06-06.omp-integration-buck-workflow/`.
  All phase files live alongside the source plan in this folder.
- This plan was authored with the goal of "compat fixes + kernel phasing" baked in.
  Phase 1 is the foundation; Phases 2–4 turn the eval-kernel work into a
  proper workstream instead of a one-shot starter template.
- The `b-flow` deprecation (2026-06-01) is the lesson for *all* four phases:
  prompt-level / skill-level changes only, no new Pi extension, no new state
  machine. Phase 4's `b-grill*` integration is a new skill **section**, not a
  new skill.
- The OpenCode `command/` vs `commands/` asymmetry is pre-existing and out
  of scope for this plan.
