---
status: active
date: 2026-09-18
subject: 2026-09-18.buck-loop-extension
topics: [phasing, buck-loop, autonomous-loop, state-machine, omp-sdk, nested-sessions]
source_plan: plan-buck-loop-extension.md
phases: 7
format: discrete
---

# Phased Plan: buck-loop extension

> Derived from [plan-buck-loop-extension.md](plan-buck-loop-extension.md)

## Overview

- **Total phases**: 7
- **Rationale**: The plan spans a load-bearing transition contract, artifact reconciliation, two independent nested-session trust boundaries, an integrating supervisor, command wiring, and living documentation. The core contract must land first; the supervisor is a join point.
- **Estimated total effort**: seven agent sessions. After Phase 1, Phases 2–4 can run in parallel.
- **Difficulty mix**: 5 hard, 2 medium
- **User goal (inherited by all phases)**: An operator can leave a well-scoped Buck plan running unattended through build → review → iterate-if-needed → docs-if-needed → save → commit → next phase, without XState. Every transition is either a deterministic disk/git check or a closed-set LLM choice the machine validates.

## Phase Summary

| Phase | Status | Difficulty | omp_execution | File |
|-------|--------|------------|---------------|------|
| 1: Transition Contract | completed | hard | none | [phase-1-transition-contract.md](phase-1-transition-contract.md) |
| 2: Artifact State | pending | hard | none | [phase-2-artifact-state.md](phase-2-artifact-state.md) |
| 3: Closed-Set Choice | pending | hard | none | [phase-3-closed-set-choice.md](phase-3-closed-set-choice.md) |
| 4: Nested Work Sessions | pending | hard | none | [phase-4-nested-work-sessions.md](phase-4-nested-work-sessions.md) |
| 5: Loop Supervisor | pending | hard | none | [phase-5-loop-supervisor.md](phase-5-loop-supervisor.md) |
| 6: Command Surface | pending | medium | none | [phase-6-command-surface.md](phase-6-command-surface.md) |
| 7: Documentation and Proof | pending | medium | none | [phase-7-documentation-and-proof.md](phase-7-documentation-and-proof.md) |

## Dependency Matrix

| From → To | Type | Reason |
|-----------|------|--------|
| Phase 1 → Phase 2 | HARD | Artifact scans and persisted projections must produce the frozen `Snapshot` and state types. |
| Phase 1 → Phase 3 | HARD | The choice helper accepts only the legal `Choice` set declared by the transition contract. |
| Phase 1 → Phase 4 | HARD | Work effects and result types must match the transition table before sessions are launched. |
| Phase 2 → Phase 5 | HARD | The supervisor needs artifact scans and durable projection reads/writes. |
| Phase 3 → Phase 5 | HARD | Ambiguous edges cannot be handled safely until closed-set choice validation and auditing exist. |
| Phase 4 → Phase 5 | HARD | Build, review, iterate, docs, save, and commit effects require the isolated work-session runner. |
| Phase 5 → Phase 6 | HARD | The command handler must invoke a completed supervisor API rather than invent orchestration logic. |
| Phase 6 → Phase 7 | HARD | Living docs and smoke checks must describe and exercise the actual registered command surface. |

## Dependency Diagram

```text
                       ┌──→ Phase 2: Artifact State ───────┐
Phase 1: Contract ─────┼──→ Phase 3: Closed-Set Choice ───┼──→ Phase 5: Supervisor ──→ Phase 6: Command ──→ Phase 7: Docs + Proof
                       └──→ Phase 4: Work Sessions ────────┘
```

**Legend:**
- `──→` = HARD dependency (blocking)

**Dependency details:**
- Phase 1 is the schema gate. Do not let Phases 2–4 create substitute snapshot, choice, or effect contracts.
- Phases 2, 3, and 4 HARD-depend on Phase 1 but have no dependencies on each other.
- Phase 5 is the integration join and requires Phases 2–4 completed.
- Phases 6 and 7 are sequential because wiring and documentation must follow the final supervisor behavior.

## Parallel Opportunities

> Phases with NO dependency between them can be executed in parallel by separate agents.

- **Phase 2 ∥ Phase 3 ∥ Phase 4** after Phase 1.
  - *Rationale*: they own disjoint files: artifact state, model choice, and long work sessions.
  - *Caveat*: all three consume Phase 1 contracts. If a contract defect appears, fix and review Phase 1 first; do not fork local types.
- **Not parallelizable**: Phase 1 (schema gate), Phase 5 (join), Phase 6 (wiring), Phase 7 (final proof).

## Execution Order

1. Complete Phase 1 and freeze the transition contract.
2. Complete Phases 2, 3, and 4 in any order or in parallel; run the full per-phase mini-cycle and commit each separately.
3. Start Phase 5 only after Phases 2–4 are completed.
4. Complete Phase 6, then Phase 7.
5. Update each phase file and this overview as phases complete.

`omp_execution` is omitted (`none`). `/skill:b-loop` may later stamp `orchestrate` if the operator wants a no-yield run; this phasing does not enable an OMP loop.

## Execution Workflow

Use this overview as the durable navigation map for an OMP execution session. For each phase:
1. Read the first non-completed phase from the Phase Summary table whose dependencies are complete.
2. Read that discrete phase file and execute only its scope using the listed `buck_hint`.
3. If the phase's `omp_execution` is `orchestrate | workflow`, drop the matching keyword on the first turn before the build command. If it is `goal`, run `/goal set "<plan User Goal>" --budget <omp_goal_budget>` first instead. Either way, see the phase file's "Per-Phase Execution Loop" for the precondition.
4. Run `/b-review` against the phase file after implementation.
5. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues**, route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
6. Run `/b-save` so memory, draft commits, phase state, and review/iteration artifacts are durable.
7. Run `/b-commit` to checkpoint durable state.
8. If interrupted mid-cycle, leave the phase file `status: in-progress`; resume from that phase and any active `iterate-*.md` artifact.

**Commit invariant**: one phase completion equals one commit. Do not batch multiple completed phases into one commit.

## Execution Checklist

- [ ] Phase 1: Transition Contract — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [ ] Phase 2: Artifact State — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [ ] Phase 3: Closed-Set Choice — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [ ] Phase 4: Nested Work Sessions — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [ ] Phase 5: Loop Supervisor — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [ ] Phase 6: Command Surface — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [ ] Phase 7: Documentation and Proof — build → review → iterate if in-plan issues → docs if doc impact → save → commit

## Notes

- Build `extensions/buck-loop/` from scratch. Do not import or edit `extensions/b-flow/**`; it stays unwired.
- No XState or replacement FSM dependency. Use a pure transition table and a hand-rolled supervisor loop.
- Existing Buck plan/phase artifacts and git state are authoritative. `.context/workflow/buck-loop.json` is a projection, not the source of truth.
- The model may choose only from a machine-declared legal enum. Invalid, empty, or unparsable output never advances the loop.
- The command handles existing plans only. Auto-planning, auto-phasing, parallel phases, chunk queues, main-session injection, and automatic OMP loop activation remain out of scope.
- `/buck-loop` is the runner. `/skill:b-loop` remains the advisory execution-mode stamper.

## Risks Carried from Parent Plan

| Risk | Mitigation | Owning phase |
|---|---|---|
| Transition drift or unsafe default advance | Pure exhaustive table, closed effects, and red-first fixture tests | 1 |
| Projection overwrites artifact truth | Rescan on resume; explicit unsafe-disagreement block cases | 2 |
| Model invents a transition | Prompt only legal values; parse, validate, retry once, audit, then block | 3 |
| Nested worker recurses or overreaches | Disable extension discovery and assign least-privilege tools per skill | 4 |
| Supervisor trusts worker prose | Rescan postconditions after every effect; worker text is diagnostic only | 5 |
| New command accidentally revives b-flow behavior | Explicit `/buck-loop` registration and tests that `b-flow` remains unwired | 6 |
| Architecture reversal is undocumented | ADR 0002 and living-doc distinction between runner and stamper | 7 |
