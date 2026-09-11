---
status: active
date: 2026-09-10
subject: 2026-09-10.b-save-state-machine-analysis
topics: [phasing, b-save, state-machine, deterministic-checkpoint, command-migration]
source_plan: plan-b-save-state-machine.md
phases: 6
format: discrete
---

# Phased Plan: b-save State Machine

> Derived from [plan-b-save-state-machine.md](plan-b-save-state-machine.md)

## Overview

- **Total phases**: 6
- **Rationale**: 11 implementation steps across ~20 files in six domains (SDK proof, engine core, model roles, journaled apply, effects/UX, command cutover + docs) with a critical command-name cutover — far past the one-session threshold; the plan itself requires phasing.
- **Estimated total effort**: 6 full build sessions (one per phase), each ending in its own review → save → commit cycle.
- **Difficulty mix**: 4 hard, 2 medium

## Phase Summary

| Phase | Status | Difficulty | omp_execution | File |
|-------|--------|------------|---------------|------|
| 1: Boundaries & Contract Freeze | completed | hard | goal | [phase-1-boundaries-and-contract.md](phase-1-boundaries-and-contract.md) |
| 2: Run Model & Deterministic Snapshot | completed | hard | none | [phase-2-run-model-and-snapshot.md](phase-2-run-model-and-snapshot.md) |
| 3: Bounded Semantic Roles | completed | medium | none | [phase-3-bounded-semantic-roles.md](phase-3-bounded-semantic-roles.md) |
| 4: Deterministic Evaluation & Journaled Apply | pending | hard | none | [phase-4-evaluation-and-apply.md](phase-4-evaluation-and-apply.md) |
| 5: External Effects & Command UX | pending | medium | none | [phase-5-effects-and-command-ux.md](phase-5-effects-and-command-ux.md) |
| 6: Parity, Atomic Cutover & Documentation | pending | hard | none | [phase-6-parity-cutover-docs.md](phase-6-parity-cutover-docs.md) |

## Dependency Matrix

| From → To | Type | Reason |
|-----------|------|--------|
| Phase 1 → Phase 2 | HARD | Run model and machine encode the frozen flags/resume selector; snapshot enforces the contract's paths and policy |
| Phase 1 → Phase 5 | HARD | Effects adapter choice (guarded Hindsight vs `unsupported`) is locked by the Step 1 SDK proof |
| Phase 2 → Phase 3 | HARD | Roles consume typed evidence records/proposals and dependency hashes from the snapshot layer |
| Phase 2 → Phase 4 | HARD | Evaluation consumes snapshot evidence and persisted run state |
| Phase 3 → Phase 4 | HARD | Deterministic-first routing raises `NeedsJudgmentError` into the bounded roles |
| Phase 4 → Phase 5 | HARD | Effects run only after durable apply success; UX reports apply/effect outcomes |
| Phase 5 → Phase 6 | HARD | Parity exercises the full engine including UX and effects before cutover |

## Dependency Diagram

```
Phase 1 ──→ Phase 2 ──→ Phase 3 ──→ Phase 4 ──→ Phase 5 ──→ Phase 6
    │                                                 ↑
    └──────────────── (Hindsight proof outcome) ───────┘
```

**Legend:**
- `──→` = HARD dependency (blocking)
- `│`/`└──→` = long-range HARD dependency (proof outcome feeds Phase 5's adapter)

**Dependency details:**
- Phase 2 HARD-depends on Phase 1: types/machine encode the frozen command contract.
- Phase 5 HARD-depends on Phase 1: the Hindsight effect is guarded-adapter-or-`unsupported`, decided by the SDK proof, never re-litigated.
- Phases 2–6 form a strict build-order chain (contracts → roles → evaluation/apply → effects/UX → cutover).

## Parallel Opportunities

None between phases — the chain is HARD end-to-end (shared contracts and build order at every hop). Within Phase 1, the SDK experiment (step 1) and the contract freeze (step 2) are independent workstreams an executing agent may interleave.

## OMP Execution Recommendation

`goal` mode, stamped on Phase 1 only (`omp_goal_budget: 80000` = 16k × 4 hard phases + 8k × 2 medium phases, rounded per the plan rule of thumb). Rationale: the strictly sequential chain gives `orchestrate`/`workflow` parallelism nothing to fan out; goal mode persists the plan objective across all six build sessions and enforces the 6-step completion audit before `goal({op:'complete')` — which aligns with Phase 6's parity checklist. Alternative: leave goal off and run each phase as a standard manual mini-cycle; the phase files are self-contained either way.

Caveat: Phase 6 includes live clean-session verification (interrupt/resume, command discovery) that may need the user's hands even under an active goal — the goal must not be completed until the parity checklist and guardrails pass.

## Execution Order

1. Complete Phase 1, verify acceptance criteria
2. Update phase file: `status: completed`, check acceptance criteria
3. Update this overview: change status to `completed` in summary table
4. Queue Phase 2, repeat...

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

- [x] Phase 1: Boundaries & Contract Freeze — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [x] Phase 2: Run Model & Deterministic Snapshot — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [x] Phase 3: Bounded Semantic Roles — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [ ] Phase 4: Deterministic Evaluation & Journaled Apply — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [ ] Phase 5: External Effects & Command UX — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [ ] Phase 6: Parity, Atomic Cutover & Documentation — build → review → iterate if in-plan issues → docs if doc impact → save → commit

## Notes

- Plan frontmatter and subject `index.md` were already `status: active` when phasing ran — no status flip needed (skill step 5c).
- Phase 1's SDK experiment must use disposable backends; it never touches the real Hindsight store.
- `extensions/index.ts` registration of the engine is deliberately deferred to Phase 6 so the current `/b-save` prompt and `/b-save-improved` keep working until parity.
- The `research-b-save-state-machine.md` responsibility matrix is the authoritative boundary table for Phase 4's evaluation rules.
