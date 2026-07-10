---
status: active
date: 2026-07-10
subject: 2026-07-10.buck-workflow-implementation-audit
topics: [phasing, buck-workflow, lifecycle, omp, portability, artifact-contracts, packaging, documentation]
source_plan: plan-buck-workflow-contract-remediation.md
research: [research-workflow-implementation-audit.md]
memory: [buck-workflow-contract-remediation-phasing-2026-07-10.md, phase-1-review-gated-phase-state-build-2026-07-10.md]
phases: 14
format: discrete
---

# Phased Plan: Buck Workflow Contract Remediation

> Derived from [plan-buck-workflow-contract-remediation.md](plan-buck-workflow-contract-remediation.md)

## Overview

- **Total phases**: 14
- **Rationale**: The audit contains 25 findings across lifecycle state, current OMP execution, runtime ownership, portable build policy, artifact validation, wrapper architecture, package surfaces, and documentation. The lifecycle and runtime contracts have hard ordering constraints; independent wrapper and runtime work can still proceed in parallel.
- **Execution size**: 14 session-bounded phases; no time estimate.
- **Difficulty mix**: 9 hard, 5 medium.
- **Conservative surface decision**: retire incomplete `b-auto-fix` and `b-grill-auto` from active discovery rather than expand unsafe executors inside this remediation. Recommissioning requires a separate runner contract.

## Phase Summary

| Phase | Status | Difficulty | omp_execution | File |
|-------|--------|------------|---------------|------|
| 1: Review-gated phase state | completed | hard | none | [phase-1-review-gated-phase-state.md](phase-1-review-gated-phase-state.md) |
| 2: Save-owned closeout transaction | pending | hard | none | [phase-2-save-owned-closeout.md](phase-2-save-owned-closeout.md) |
| 3: Stage and commit safety | pending | hard | none | [phase-3-stage-commit-safety.md](phase-3-stage-commit-safety.md) |
| 4: OMP eval-kernel compatibility | pending | hard | none | [phase-4-omp-eval-compatibility.md](phase-4-omp-eval-compatibility.md) |
| 5: Shared OMP execution contract | pending | hard | none | [phase-5-shared-omp-execution-contract.md](phase-5-shared-omp-execution-contract.md) |
| 6: Subject-aware runtime state | pending | hard | none | [phase-6-subject-aware-runtime-state.md](phase-6-subject-aware-runtime-state.md) |
| 7: Project-adaptive build discovery | pending | hard | none | [phase-7-project-adaptive-build.md](phase-7-project-adaptive-build.md) |
| 8: Conditional approval and session cleanup | pending | medium | none | [phase-8-conditional-approval-session-cleanup.md](phase-8-conditional-approval-session-cleanup.md) |
| 9: Artifact registry and integrity | pending | hard | none | [phase-9-artifact-registry-integrity.md](phase-9-artifact-registry-integrity.md) |
| 10: Canonical PR wrappers | pending | medium | none | [phase-10-canonical-pr-wrappers.md](phase-10-canonical-pr-wrappers.md) |
| 11: Entry-point and legacy cleanup | pending | hard | none | [phase-11-entrypoint-legacy-cleanup.md](phase-11-entrypoint-legacy-cleanup.md) |
| 12: Installer and surface inventory | pending | medium | none | [phase-12-installer-surface-inventory.md](phase-12-installer-surface-inventory.md) |
| 13: Reference contract regeneration | pending | medium | none | [phase-13-reference-contract-regeneration.md](phase-13-reference-contract-regeneration.md) |
| 14: Workflow narrative reality pass | pending | medium | none | [phase-14-workflow-narrative-reality-pass.md](phase-14-workflow-narrative-reality-pass.md) |

## Dependency Matrix

| From → To | Type | Reason |
|-----------|------|--------|
| Phase 1 → Phase 2 | HARD | Save may close work only after review-pass evidence and `in-progress` phase semantics exist. |
| Phase 2 → Phase 3 | HARD | Commit validation must bind to the finalized post-save artifact set. |
| Phase 3 → Phase 4 | HARD | Both modify `b-plan`; the staging sweep lands before the eval migration to preserve phase order and avoid parallel edits. |
| Phase 4 → Phase 5 | HARD | Shared OMP/review wording must consume current eval semantics and finalized closeout/staging instructions. |
| Phase 5 → Phase 6 | SOFT | Runtime subject resolution can stand alone, but must use the shared execution/session terminology. |
| Phase 1 → Phase 6 | HARD | `in-progress` phase precedence is part of actual-subject selection. |
| Phase 3 → Phase 7 | HARD | Both alter generated build closeout instructions; commit/staging semantics land first. |
| Phases 5 + 6 + 7 → Phase 8 | HARD | Approval/session cleanup consumes settled OMP, runtime-owner, and project-discovery contracts. |
| Phases 1 + 2 + 3 → Phase 9 | HARD | The registry must encode final review-pass, phase, memory, and draft contracts once. |
| Phase 6 → Phase 11 | HARD | Legacy b-flow/session cleanup must preserve the final subject-resolution contract. |
| Phases 2 + 3 + 10 + 11 → Phase 12 | HARD | Inventory is generated only after final save/commit wrapper and active-surface shapes exist. |
| Phases 5 + 6 + 8 + 9 + 12 → Phase 13 | HARD | Reference docs consume final runtime, status, and package registries. |
| Phases 7 + 13 → Phase 14 | HARD | Narrative docs are rewritten after executable and generated reference truth is stable. |

## Dependency Diagram

```text
Phase 1 ──→ Phase 2 ──→ Phase 3 ──→ Phase 4 ──→ Phase 5 ──→ Phase 6
                                │                         │          ├──→ Phase 8
                                ├──→ Phase 7              │          └──→ Phase 11 ──→ Phase 12
                                └──→ Phase 9              │                              ↑
Phase 10 ───────────────────────────────────────────────────────────────────────────────┘
Phases 5 + 6 + 8 + 9 + 12 ──→ Phase 13
Phases 7 + 13 ──→ Phase 14
```

**Legend:**
- `──→` = HARD dependency (blocking)
- Phase 5 → Phase 6 is SOFT in semantics, but Phase 6 still follows Phase 5 to avoid a second terminology pass.
- Shared-file ordering is treated as a dependency even when business logic is independent.

## Dependency details

- **Lifecycle/runtime chain (1 → 2 → 3 → 4 → 5)**: verdict/evidence precedes state closure and staging; the shared `b-plan` staging sweep precedes eval migration; centralized OMP policy consumes both.
- **Shared-file ordering**: Phase 4 follows Phase 3 for `b-plan` even though eval compatibility is otherwise independent.
- **Runtime/build convergence (5, 6, 7 → 8)**: removing approval and session assumptions is safe only after actual project verification and runtime ownership are known.
- **Registry (9)**: review-pass and draft contracts would churn if registered before lifecycle phases settle.
- **Inventory (12)**: surface counts and exceptions are generated only after wrappers and retirements are final.
- **Documentation (13 → 14)**: generated reference truth comes before explanatory prose and diagrams.

## Parallel Opportunities

> Use separate agents/worktrees only when they can preserve the one-phase/one-commit invariant and do not edit shared files.

- **Phase 1 ∥ Phase 10**: lifecycle evidence and PR-wrapper canonicalization have no file or build-order dependency.
- **Phase 4 ∥ Phase 7 ∥ Phase 9** after Phase 3: eval compatibility, build discovery, and artifact validator work are separate subsystems.
- **Phase 5 may continue alongside Phases 7 and 9** after Phase 4 completes.
- **Phase 8 ∥ Phase 11** after Phases 6 and 7: skill-side session cleanup and inactive-surface retirement can proceed separately if Phase 11 stays out of `skills/b-build/SKILL.md`.
- **No parallelization for Phases 12–14**: inventory and both documentation passes consume prior outputs in order.

## OMP Execution Recommendation

When the active harness is OMP and the user intends to execute the entire plan, use **`orchestrate`**: 14 phases, multiple hard dependencies, and several safe parallel waves fit the orchestrator contract. Type the `orchestrate` keyword anywhere in the first turn of the plan. Individual phase frontmatter intentionally omits `omp_execution`, so the overview table records literal `none` for each phase.

Do **not** use `workflow` for the initial run: Phase 4 repairs the stale eval-cell contract. Do **not** rely on goal-mode completion auditing before Phase 5 centralizes that contract. A user may re-run `/skill:b-loop` after those phases if they want to stamp a different mode onto the remaining phase files.

## Execution Order

1. Complete Phase 1, review it explicitly, save, stage, and commit.
2. Complete each next phase only after its listed dependencies are committed.
3. After implementation, run `/b-review` against the exact phase file.
4. If review creates an `iterate-*.md` artifact for in-plan issues, run `/b-iterate`, then re-run `/b-review`.
5. Route out-of-plan findings to a separate `/b-plan` → `/b-build` cycle; they do not block an accepted phase.
6. If review flags documentation impact, run `/b-docs` before `/b-save`.
7. Run `/b-save`, explicitly stage the implementation plus durable artifacts, then run `/b-commit`.
8. Leave an interrupted phase `in-progress`; resume from that phase and any active iterate artifact.

**Commit invariant**: one completed phase equals one commit. Never batch completed phases into one commit.

## Execution Workflow

Use this overview as the durable navigation map for an OMP execution session. For each phase:
1. Read the first non-completed phase whose dependencies are completed.
2. Read that discrete phase file and execute only its scope using the listed `buck_hint`.
3. If executing the whole plan under OMP, type the plan-level `orchestrate` keyword on the first turn; per-phase modes remain `none` unless later stamped by `/skill:b-loop`.
4. Run `/b-review` against the exact phase file after implementation.
5. If review creates an `iterate-*.md` artifact, run `/b-iterate`, then re-run `/b-review`. Route out-of-plan issues to a separate plan. Run `/b-docs` if documentation impact is flagged.
6. Run `/b-save` so memory, review/iteration artifacts, phase state, and the draft commit are durable.
7. Explicitly stage the implementation and durable artifacts.
8. Run `/b-commit` to checkpoint the phase.
9. If interrupted mid-cycle, leave the phase `in-progress` and resume it next turn.

## Execution Checklist

- [x] Phase 1: Review-gated phase state — build → review → docs → save → stage → commit
- [ ] Phase 2: Save-owned closeout transaction — build → review → iterate if needed → docs if needed → save → stage → commit
- [ ] Phase 3: Stage and commit safety — build → review → iterate if needed → docs if needed → save → stage → commit
- [ ] Phase 4: OMP eval-kernel compatibility — build → review → iterate if needed → docs if needed → save → stage → commit
- [ ] Phase 5: Shared OMP execution contract — build → review → iterate if needed → docs if needed → save → stage → commit
- [ ] Phase 6: Subject-aware runtime state — build → review → iterate if needed → docs if needed → save → stage → commit
- [ ] Phase 7: Project-adaptive build discovery — build → review → iterate if needed → docs if needed → save → stage → commit
- [ ] Phase 8: Conditional approval and session cleanup — build → review → iterate if needed → docs if needed → save → stage → commit
- [ ] Phase 9: Artifact registry and integrity — build → review → iterate if needed → docs if needed → save → stage → commit
- [ ] Phase 10: Canonical PR wrappers — build → review → iterate if needed → docs if needed → save → stage → commit
- [ ] Phase 11: Entry-point and legacy cleanup — build → review → iterate if needed → docs if needed → save → stage → commit
- [ ] Phase 12: Installer and surface inventory — build → review → iterate if needed → docs if needed → save → stage → commit
- [ ] Phase 13: Reference contract regeneration — build → review → iterate if needed → docs if needed → save → stage → commit
- [ ] Phase 14: Workflow narrative reality pass — build → review → iterate if needed → docs if needed → save → stage → commit

## Notes

- The supplied artifact was research, not a formal implementation plan. `plan-buck-workflow-contract-remediation.md` was created first so every phase has a valid parent and coverage map.
- Phase 1 supersedes the separate implementation-ledger concept with one review-pass artifact; do not create both.
- Phase 11's retirement choice is conservative and explicit. Git history preserves removed code; future runnable automation needs its own researched runner contract.
- Historical OMP eval cells remain historical. Phase 4 moves maintained examples into a normal canonical examples directory and updates runtime-facing references.
- The b-loop slash mirror remains a distinct intentional deferral.
