---
status: active
date: 2026-09-16
updated: 2026-09-29
subject: 2026-09-16.decision-closure
topics: [phasing, buck-loop, decision-closure, assumptions, risk, rollback, workflow]
source_plan: plan-decision-closure-protocol.md
source_plans: [../2026-09-19.chooser-block-determinism/plan-chooser-block-determinism.md]
phases: 6
format: discrete
---

# Phased Plan: Reliable Buck-loop Decisions and Decision Closure

## User Goal

First verify and close the recorded Buck-loop chooser/review stall. Then make material decisions, assumptions and rollback posture visible before autonomous execution, without slowing routine work.

## Overview

One coordinated sequence owns both source plans. The [combined parent plan](plan-decision-closure-protocol.md) preserves the original closure contract; the [chooser source plan](../2026-09-19.chooser-block-determinism/plan-chooser-block-determinism.md) preserves incident requirements. All six phases belong to the combined parent in this folder; do not execute the chooser source as a second queue.

Bugs first is an explicit user priority gate. Current source already contains tolerant parsing, context/audit plumbing and native Jev judgment. Phase 1 verifies all original bug criteria and repairs only proven remaining gaps; no completion is inferred from stale status fields or code inspection. Protocol and feature work starts only after bug closeout.

## Phase Summary

| Phase | Status | Difficulty | omp_execution | File |
|---|---|---|---|---|
| 1: Chooser Stall Verification and Repair | completed | hard | none | [phase-1-chooser-stall.md](phase-1-chooser-stall.md) |
| 2: Shared Protocol | pending | hard | none | [phase-2-shared-protocol.md](phase-2-shared-protocol.md) |
| 3: Grill Variants | pending | not-hard | none | [phase-3-grill-variants.md](phase-3-grill-variants.md) |
| 4: Plan and Phase | pending | not-hard | none | [phase-4-plan-and-phase.md](phase-4-plan-and-phase.md) |
| 5: Build and Review | pending | not-hard | none | [phase-5-build-and-review.md](phase-5-build-and-review.md) |
| 6: Narrative and Proof | pending | not-hard | none | [phase-6-narrative-and-proof.md](phase-6-narrative-and-proof.md) |

## Dependency Matrix

| From → To | Type | Reason |
|---|---|---|
| 1 → 2 | HARD, priority policy | User requested bugs first: verify and checkpoint the incident contract before adding closure features. No claim of technical coupling. |
| 2 → 3 | HARD, technical | Grill closeouts instantiate the shared protocol vocabulary. |
| 2 → 4 | HARD, technical | Plan/phase ledgers need the shared IDs, statuses and validation rules. |
| 2 → 5 | HARD, technical | Build/review consume the shared minimal-change and closure-ready rules. |
| 4 → 5 | SOFT | Ledgers are instantiated in Phase 4; Phase 5 can author against Phase 2's frozen shape. |
| 3, 4, 5 → 6 | HARD, integration | Narrative, bundle parity and six behavior scenarios require all skill consumers. |

## Dependency Diagram

```text
1 (bug proof/repair) → 2 (shared protocol) → 3 (grills) ──────┐
                                         → 4 (plan/phase) ─┼→ 6 (docs/proof)
                                         → 5 (build/review)┘
4 - - → 5 is SOFT; all solid arrows are HARD.
```

## Parallel Opportunities

Phases 3–5 have disjoint canonical and bundled skill directories and may be authored in parallel only after Phases 1–2 close. Phase 5 must use the frozen protocol if Phase 4 is not yet available; integration proof waits until both exist. Serialize shared docs/backlog updates. Never parallelize closure feature work ahead of the bug-first gate.

## Acceptance Coverage

| Source contract | Owning phase |
|---|---|
| Chooser: equivalent heading-level facts, context on both paths and audited retries, public-loop save routing, original incident/fixture scan, unchanged legal-set and block safety | 1 |
| Closure: material triggers, low-risk skip, stable IDs/status/blocking/validation, risk/rollback fields, confirmed reframing, pressure calibration, minimal-change order | 2 |
| Closure: all four portable grill variants, consistent shared closeout, preserved Light Grill and existing metadata | 3 |
| Closure: conditional plan records, missing-upstream synthesis, earliest-capable assumption assignment and hard gates | 4 |
| Closure: hard-mode minimal-change and settled-decision rules; review defect/warning/new-scope distinctions and rollback evidence | 5 |
| Closure: two methodology principles, six behavior scenarios, originality and forbidden-term constraints, bundle parity and packaging proof | 6, with per-phase checks in 2–5 |

All original outcomes remain required. The closure-only prohibition on runtime changes does not prohibit the explicitly added incident-scoped Phase 1 repair. The separate typed-review/fix-or-continue roadmap is not silently merged or narrowed.

## Execution Order

1. Start Phase 1. Verify before editing: shipped fixes are reused, not recreated.
2. Review, resolve in-plan defects, save evidence and commit its verified checkpoint.
3. Start Phase 2 only after Phase 1 closes.
4. After Phase 2 closes, run 3–5 in order or use the documented parallel opportunity.
5. Start Phase 6 only after every consumer phase closes.

## Execution Workflow

For each phase: listed `buck_hint` → `/b-review` → `/b-iterate` only for in-plan defects → living docs/how-to updates when flagged → `/b-save` → `/b-commit`. New out-of-plan scope gets a separate plan. One completed phase gets one verified checkpoint; no batch completion inferred from a later phase.

Keep interrupted phases resumable; only check acceptance and mark `completed` with fresh exercised evidence. Update the summary table after phase closeout. Subject lifecycle fields are owned by `skills/_shared/scripts/subject-lifecycle.ts`; use its protocol rather than editing index status directly. No orchestration mode is enabled by this rephasing.

## Execution Checklist

- [ ] Phase 1: Chooser stall proof/remaining repairs → review → save → commit
- [ ] Phase 2: Shared protocol → review → save → commit
- [ ] Phase 3: Grill variants → review → save → commit
- [ ] Phase 4: Plan and phase → review → save → commit
- [ ] Phase 5: Build and review → review → save → commit
- [ ] Phase 6: Narrative and proof → review → save → commit

## Revision Record

2026-09-29: user requested rephasing the decision-closure and chooser-block-determinism plans together, bugs first. Inserted bug verification/remaining-gap repair as Phase 1; retained all closure scope in renumbered Phases 2–6. Both original plan filenames remain stable. Phase difficulty uses the current `hard | not-hard` contract. No implementation acceptance criterion was marked complete by rephasing.
