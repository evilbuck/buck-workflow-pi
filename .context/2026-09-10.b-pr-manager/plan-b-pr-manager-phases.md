---
status: active
date: 2026-09-10
subject: 2026-09-10.b-pr-manager
topics: [phasing, omp-extension, pull-requests, review-feedback, state-machine, buck-workflow]
source_plan: plan-b-pr-manager.md
phases: 7
format: discrete
---

# Phased Plan: Automated PR Feedback-to-Merge Manager

> Derived from [plan-b-pr-manager.md](plan-b-pr-manager.md)

## Overview

- **Total phases**: 7
- **Rationale**: 10 implementation steps across new extension modules, shared git extraction, GitHub, persistence, model/Buck loop, command UX, tests, and docs — too large and too failure-sensitive for one session. Slices keep the deterministic/LLM ownership boundary intact.
- **Estimated total effort**: 7 sessions (1 per phase)
- **Difficulty mix**: 4 medium, 3 hard

## Phase Summary

| Phase | Status | Difficulty | omp_execution | File |
|-------|--------|------------|---------------|------|
| 1: Freeze contracts and pure machine | completed | medium | none | [phase-1-contracts-pure-machine.md](phase-1-contracts-pure-machine.md) |
| 2: Extract shared PR git primitives | completed | hard | none | [phase-2-shared-pr-git.md](phase-2-shared-pr-git.md) |
| 3: Deterministic GitHub inventory | completed | medium | none | [phase-3-github-inventory.md](phase-3-github-inventory.md) |
| 4: Atomic persistence and resume | completed | medium | none | [phase-4-persistence-resume.md](phase-4-persistence-resume.md) |
| 5: Model actors and Buck fix rounds | in-progress | hard | none | [phase-5-model-actors-buck-loop.md](phase-5-model-actors-buck-loop.md) |
| 6: XState runner and command UX | pending | hard | none | [phase-6-runner-command-ux.md](phase-6-runner-command-ux.md) |
| 7: Safety proof, docs, and smoke | pending | medium | none | [phase-7-proof-docs-smoke.md](phase-7-proof-docs-smoke.md) |

Per-phase `omp_execution` is omitted (`none`). Plan shape (≥4 phases + HARD deps) would recommend `orchestrate` via `/skill:b-loop` on OMP; this phasing step does not stamp it.

## Dependency Matrix

| From → To | Type | Reason |
|-----------|------|--------|
| Phase 1 → Phase 3 | HARD | GitHub adapter implements Phase 1 feedback, snapshot, and mutation types |
| Phase 1 → Phase 4 | HARD | Persistence serializes Phase 1 `RunState` |
| Phase 1 → Phase 5 | HARD | Model/Buck loop returns Phase 1 role and verdict schemas |
| Phase 2 → Phase 6 | HARD | Runner calls shared PR git primitives |
| Phase 3 → Phase 6 | HARD | Runner invokes GitHub inventory and auto-merge helpers |
| Phase 4 → Phase 6 | HARD | Runner checkpoints and resumes through persistence |
| Phase 5 → Phase 6 | HARD | Runner invokes schema-bound roles and Buck rounds |
| Phase 2 → Phase 4 | SOFT | Resume reconcile can fake git snapshots until shared primitives exist |
| Phase 6 → Phase 7 | HARD | Integration, docs, and smoke require the registered command |

## Dependency Diagram

```
Phase 1 ──→ Phase 3 ─┐
    │                │
    ├──→ Phase 4 ────┼──→ Phase 6 ──→ Phase 7
    │                │
    └──→ Phase 5 ────┘
                     │
Phase 2 ─────────────┘
```

**Legend:**
- `──→` = HARD dependency (blocking)
- `- -→` = SOFT dependency (can stub/mock)
- `│` = shared resource/file

**Dependency details:**
- Phase 2 has **NONE** vs Phase 1 — different files; `/b-pr-improved` extraction does not need manager types.
- Phases 3, 4, and 5 HARD-depend on Phase 1 only.
- Phase 4 SOFT-depends on Phase 2 for real git reconcile; tests inject snapshots.
- Phase 6 HARD-depends on Phases 2, 3, 4, and 5 (Phase 1 is transitive).
- Phase 7 HARD-depends on Phase 6.

## Parallel Opportunities

> Phases with NO dependency between them can be executed in parallel by separate agents.

- **Phase 1 ∥ Phase 2**: No shared files. Caveat: do not both edit `extensions/index.ts` (neither should in these phases).
- **Phase 3 ∥ Phase 4 ∥ Phase 5** after Phase 1: adapters and LLM boundary are separate modules. Caveat: all import `types.ts` — treat it as frozen after Phase 1; do not revise the contract without updating dependents.

Phase 6 is the join point. Do not start it until 2–5 are complete.

## Execution Order

1. Complete Phase 1, verify acceptance criteria
2. Update phase file: `status: completed`, check acceptance criteria
3. Update this overview: change status to `completed` in summary table
4. Queue Phase 2 (or run 2 in parallel with 1; then 3∥4∥5), repeat...
5. Join at Phase 6, then Phase 7

Default sequential order if not parallelizing: 1 → 2 → 3 → 4 → 5 → 6 → 7.

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

- [x] Phase 1: Freeze contracts and pure machine — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [x] Phase 2: Extract shared PR git primitives — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [x] Phase 3: Deterministic GitHub inventory — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [x] Phase 4: Atomic persistence and resume — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [ ] Phase 5: Model actors and Buck fix rounds — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [ ] Phase 6: XState runner and command UX — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [ ] Phase 7: Safety proof, docs, and smoke — build → review → iterate if in-plan issues → docs if doc impact → save → commit

## Notes

- Do not revive `extensions/b-flow/`. This is a narrow, user-invoked PR lifecycle machine.
- `/skill:fix-pr` stays the portable/manual fallback; do not fork its verdict taxonomy.
- Runtime state lives under `<git-dir>/b-pr-manager/`, never the PR worktree.
- Model output never controls git, GitHub mutation, timing, persistence, transitions, merge readiness, or success.
- Success is only GitHub `state=MERGED`. Auto-merge accepted / green checks are not completion.
- `--force` without lease must not exist in the implementation.
- README table inserts: re-read the file tail after editing (2026-09-04 truncation incident).
- No live GitHub merge in automated tests.
