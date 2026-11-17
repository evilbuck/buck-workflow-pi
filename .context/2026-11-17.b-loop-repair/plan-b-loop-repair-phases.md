---
status: active
date: 2026-11-17
subject: 2026-11-17.b-loop-repair
topics: [phasing, b-loop, omp, checkpoints, recovery, workflow_state]
source_plan: plan-b-loop-repair.md
phases: 5
format: discrete
---

# Phased Plan: Repair and simplify `/b-loop`

> Derived from [plan-b-loop-repair.md](plan-b-loop-repair.md)

## Overview

- **Total phases**: 5
- **Rationale**: Separates packaged entry resolution and fail-closed validation (validating `A-4` before stage side effects), private checkpoint/lock/recovery infrastructure, stage boundaries (`build`/`review`/`save`), scoped Git tree-pinning and subject closeout, and real OMP end-to-end tests + docs into independently verifiable slices matching Decision Closure.
- **Estimated total effort**: ~5 sessions
- **Difficulty mix**: 2 medium, 3 hard

## Phase Summary

| Phase | Status | Difficulty | omp_execution | File |
|-------|--------|------------|---------------|------|
| 1: Entry, Invocation Contract & Pre-Flight Validation | completed | medium | none | [phase-1-entry-and-validation.md](phase-1-entry-and-validation.md) |
| 2: Private Checkpoint, Locking, Milestones & Recovery | completed | hard | none | [phase-2-checkpoint-and-recovery.md](phase-2-checkpoint-and-recovery.md) |
| 3: Stage Boundaries (`build`, `review`, `save`) & Acceptance | completed | hard | none | [phase-3-stage-boundaries.md](phase-3-stage-boundaries.md) |
| 4: Scoped Git Staging, Tree-Pinning Commit & Closeout | completed | hard | none | [phase-4-git-commit-and-closeout.md](phase-4-git-commit-and-closeout.md) |
| 5: Real OMP E2E Test Suite & Documentation Sync | pending | medium | none | [phase-5-omp-e2e-and-docs.md](phase-5-omp-e2e-and-docs.md) |

## Dependency Matrix

| From → To | Type | Reason |
|-----------|------|--------|
| Phase 1 → Phase 2 | HARD | Checkpoint persistence relies on validated `(subject, branch, worktree)` identity, strict bridge resolution, and pinned `workflow_state` plan/phase artifacts from Phase 1. Must validate `A-4` before stage effects. |
| Phase 2 → Phase 3 | HARD | Stage execution (`build`, `review`, `save`) records `starting`/`working`/`finished`/`verified` milestones, attempt IDs, blockers, and proof references in the Phase 2 checkpoint seam. |
| Phase 2 → Phase 4 | HARD | Commit recovery and pinned baseline/tree tracking read and update the Phase 2 checkpoint and writer lock. |
| Phase 3 → Phase 4 | HARD | Phase commit staging and `done` derivation depend on verified `build`, `review`, and `save` proof records from Phase 3. |
| Phase 1, 2, 3, 4 → Phase 5 | HARD | Real OMP command-path end-to-end tests and final docs describe and exercise the complete repaired runner across all recovery, Git, and closeout paths. |

## Dependency Diagram

```
Phase 1 ──→ Phase 2 ──→ Phase 3 ──→ Phase 4 ──→ Phase 5
                └───────────────────────▲
```

**Legend:**
- `──→` = HARD dependency (blocking)
- `- -→` = SOFT dependency (can stub/mock)

**Dependency details:**
- Phase 2 HARD-depends on Phase 1: Validated `workflow_state` access, fail-closed bridge checking, and resolved runner path (`A-4`) are prerequisites before persisting checkpoints or starting stage effects.
- Phase 3 HARD-depends on Phase 2: All three stage adapters emit milestone transitions, attempt IDs, and proof references into the Phase 2 checkpoint contract.
- Phase 4 HARD-depends on Phase 2 and Phase 3: Commit staging, tree pinning, and subject `close-verified` execute only after checkpointing and verified save proofs.
- Phase 5 HARD-depends on Phases 1–4: The live OMP end-to-end suite and docs validate and document the final behavior of the entire loop.

## Parallel Opportunities

> Decision Closure intentionally serializes entry validation (`A-4`), checkpoint transitions, stage proofs, Git commit safety, and end-to-end verification in Phases 1–5 because later layers build on shared runner modules and strict safety invariants.

- None safely recommended; execute strictly in order 1 → 2 → 3 → 4 → 5.

## Execution Order

1. Complete Phase 1, verify `A-4` and pre-flight validation gates.
2. Complete Phase 2, verify versioned private checkpoints, serialization, milestones, and recovery.
3. Complete Phase 3, verify `build`, `review`, and `save` boundaries and recovery rules.
4. Complete Phase 4, verify scoped staging, tree-pinned commits, closeout folding, and `done` derivation.
5. Complete Phase 5, verify real OMP command-path end-to-end suite and documentation sync.

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

- [x] Phase 1: Entry, Invocation Contract & Pre-Flight Validation — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [x] Phase 2: Private Checkpoint, Locking, Milestones & Recovery — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [x] Phase 3: Stage Boundaries (`build`, `review`, `save`) & Acceptance — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [x] Phase 4: Scoped Git Staging, Tree-Pinning Commit & Closeout — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [ ] Phase 5: Real OMP E2E Test Suite & Documentation Sync — build → review → iterate if in-plan issues → docs if doc impact → save → commit
