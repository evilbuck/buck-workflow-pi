---
status: completed
date: 2026-09-19
subject: 2026-09-19.reusable-state-machine
topics: [phasing, state-machine, extensions, buck-loop, architecture, refactor]
source_plan: plan-reusable-state-machine.md
phases: 3
format: discrete
memory:
  - reusable-state-machine-phase-3-build-2026-09-20.md
---

# Phased Plan: Reusable Pure State-Machine Evaluator

> Derived from [plan-reusable-state-machine.md](plan-reusable-state-machine.md)

## Overview

- **Total phases**: 3
- **Rationale**: The plan crosses a new generic core, a load-bearing Buck migration, and repository-wide documentation/proof across more than five files; separating the contracts makes each risk boundary independently reviewable.
- **Estimated total effort**: three phase-scoped build/review cycles
- **Difficulty mix**: 2 medium, 1 hard
- **User goal (inherited by all phases)**: Extension authors can define and test deterministic, fail-closed state machines without rebuilding dispatch and closed-choice validation, while `/buck-loop` keeps its current behavior.

## Phase Summary

| Phase | Status | Difficulty | omp_execution | File |
|-------|--------|------------|---------------|------|
| 1: Generic Evaluator Contract | completed | medium | none | [phase-1-generic-evaluator-contract.md](phase-1-generic-evaluator-contract.md) |
| 2: Buck Machine Migration | completed | hard | none | [phase-2-buck-machine-migration.md](phase-2-buck-machine-migration.md) |
| 3: Architecture Documentation and Proof | completed | medium | none | [phase-3-architecture-documentation-and-proof.md](phase-3-architecture-documentation-and-proof.md) |

## Dependency Matrix

| From → To | Type | Reason |
|-----------|------|--------|
| Phase 1 → Phase 2 | HARD | The Buck definition and caller migration compile against the generic evaluator contract established in Phase 1. |
| Phase 2 → Phase 3 | HARD | Documentation and end-to-end proof must describe and exercise the final migrated Buck seam, not a proposed interface. |

## Dependency Diagram

```text
Phase 1 ──→ Phase 2 ──→ Phase 3
 generic       Buck       docs +
 core          adapter    full proof
```

**Legend:**
- `──→` = HARD dependency (blocking)
- `- -→` = SOFT dependency (can stub/mock)
- `│` = shared resource/file

**Dependency details:**
- Phase 2 HARD-depends on Phase 1: the adapter must consume the real `advance` / `choose` / `send` API and typed failures; duplicating or stubbing that contract would create a second convention.
- Phase 3 HARD-depends on Phase 2: the ADR wording, legacy-callsite proof, full Buck suite, and non-Buck import smoke all depend on the completed cutover.

## Parallel Opportunities

> Phases with NO dependency between them can be executed in parallel by separate agents.

None. This is a strict HARD chain. Drafting docs before the Buck migration would risk documenting an interface that changes during cutover, and the final verification cannot run before all callers migrate.

## Execution Order

1. Complete Phase 1 and verify the generic evaluator contract.
2. Update the Phase 1 file and this summary to `completed`; run `/b-save` → `/b-commit`.
3. Complete Phase 2 against the committed Phase 1 API; verify all Buck behavior before removing the legacy table.
4. Update the Phase 2 file and this summary to `completed`; run `/b-save` → `/b-commit`.
5. Complete Phase 3 documentation and end-to-end proof; then close the parent plan through the normal save/commit cycle.

`omp_execution` is omitted (`none`) for every phase. Work the phases sequentially; `/skill:b-loop` may stamp a different mode later if the user explicitly opts into one.

## Execution Workflow

Use this overview as the durable navigation map for an OMP execution session. For each phase:
1. Read the first non-completed phase from the Phase Summary table.
2. Read that discrete phase file and execute only its scope using the listed `buck_hint`.
3. If the phase's `omp_execution` is `orchestrate | workflow`, drop the matching keyword on the first turn before the build command. If it is `goal`, run `/goal set "<plan User Goal>" --budget <omp_goal_budget>` first instead. Either way, see the phase file's "Per-Phase Execution Loop" for the precondition.
4. Run `/b-review` against the phase file after implementation.
5. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this phase), do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
6. Run `/b-save` so memory, draft commits, phase state, and review/iteration artifacts are durable.
7. Run `/b-commit` to checkpoint durable state.
8. If interrupted mid-cycle, leave the phase file `status: in-progress`; the session resumes from that phase and any active `iterate-*.md` artifact.

**Commit invariant**: one phase completion equals one commit. Do not batch multiple completed phases into a single commit; run `/b-save` → `/b-commit` after each phase, before queueing the next.

## Execution Checklist

- [x] Phase 1: Generic Evaluator Contract — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [x] Phase 2: Buck Machine Migration — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [x] Phase 3: Architecture Documentation and Proof — build → review → save completed; commit next

## Notes

- Start implementation from current HEAD and preserve commit `478dc6b` plus any later compatible chooser/loop changes. Never reconstruct the source from this plan.
- The context-free chooser-stall work is separate scope. Preserve compatible edits in `scan.ts`, `choice.ts`, `loop.ts`, and tests; do not fix that issue inside this plan.
- The reusable seam ends at pure decision evaluation. Persistence, retries, scanning, model calls, clocks, nested sessions, and effect execution stay Buck-specific.
- `extensions/b-flow/**` remains untouched and unwired. No new runtime dependency is allowed.
- No grill-session artifact exists for this subject; phase boundaries come from the parent plan's explicit core / migration / proof split and the HARD compile-time dependencies.

## Risks Carried from Parent Plan

| Risk | Mitigation | Owning phase |
|---|---|---|
| Framework creep | Keep the core synchronous, flat, and limited to definition plus `advance`, `choose`, and `send`. | 1 |
| Priority regression | Evaluate all automatic rules and encode Buck priority with mutually exclusive guards. | 1, 2 |
| Operational drift | Keep the supervisor as the sole effect interpreter and verify durable blocking and useful reasons behaviorally. | 2, 3 |
| False reuse | Prove domain independence with a non-Buck fixture and smoke; do not migrate an unrelated production extension. | 1, 3 |
| Moving baseline | Re-read current source and LSP references immediately before migration. | 2 |
