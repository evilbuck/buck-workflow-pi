---
status: completed
phase: 1
order: 1
plan: plan-buck-workflow-contract-remediation.md
phases_overview: plan-buck-workflow-contract-remediation-phases.md
difficulty: hard
model_hint: strongest reasoning model available; load-bearing lifecycle transition and durable evidence contract
buck_hint: /b-build-hard
goal: "Keep implementation in-progress until review produces target-specific durable pass evidence."
files:
  - skills/_shared/lifecycle-artifacts.md
  - skills/_shared/subject-resolution.md
  - skills/b-build/SKILL.md
  - skills/b-review/SKILL.md
  - scripts/context-artifact-schemas.mjs
  - scripts/context-artifacts.mjs
  - scripts/context-artifacts.test.mjs
from_plan_steps: [1]
depends_on: []
dependency_type: NONE
acceptance_criteria:
  - "[x] b-build leaves a built discrete phase status: in-progress and does not complete its overview row"
  - "[x] No-argument review prefers the single in-progress phase over later pending phases"
  - "[x] Passing review writes exactly one target-specific review-pass artifact with completion and verification evidence"
  - "[x] In-plan review failure writes iterate evidence and no review-pass artifact"
  - "[x] Review-pass is recognized by context classification and validation"
completed_at: 2026-07-10
completed_by: b-save
memory: [phase-1-review-gated-phase-state-build-2026-07-10.md]
---

# Phase 1: Review-gated Phase State

## Context

**Inherited parent goal**: Buck Workflow users can execute every supported path through review and durable closeout without advancing the wrong phase or losing evidence.

Audit findings 1 and 2 are one state-machine defect: build currently claims completion before the mandatory review gate, and a clean review has no durable representation. This phase establishes the only evidence later closeout logic may trust. The existing `plan-implementation-ledger.md` backlog item is absorbed; do not create a second competing ledger.

## Implementation Details

1. Add one shared lifecycle-artifact contract under `skills/_shared/` and introduce the machine registry substrate needed to classify `review-pass` without attempting the full artifact migration reserved for Phase 9.
2. Define deterministic naming: `review-pass-<target-stem>.md` in the target's subject folder. The target is the reviewed phase, plan, or spec path—not the newest subject.
3. Define frontmatter/body evidence sufficient for save and later review: subject, reviewed target, verdict (`pass` or `pass-with-follow-up`), dates, documentation-impact flag, completion matrix, verification commands/results, out-of-plan follow-ups, and an implementation fingerprint that excludes later `.context/**` durability writes.
4. Change `b-build` phased behavior from `pending → in-progress → completed` to builder-owned `pending → in-progress`. It must not check acceptance boxes as passed or update the overview row to completed.
5. Change shared phase resolution so one `in-progress` phase outranks later `pending` phases. Prompt only when multiple plausible active targets remain.
6. Change `b-review` write boundaries:
   - in-plan defects: write/update `iterate-*.md`, no pass artifact;
   - pass or pass-with-out-of-plan-follow-up: write one review-pass artifact;
   - documentation impact is recorded but remains non-blocking.
7. Keep `b-review` verdict ownership separate from phase-state mutation. Phase 2 makes `b-save` the sole closer.
8. Add fixture-driven validator and lifecycle smokes. Avoid source-string assertions: construct phased subjects and observe selected targets/artifacts.

## Risks

- **Fingerprint churn**: `/b-save` writes context after review. Fingerprint only reviewed implementation paths plus a stable base, not subsequent lifecycle artifacts.
- **Duplicate proof models**: an implementation ledger plus review-pass would diverge. Use only review-pass; update the old backlog item to point here.
- **Legacy single-file phases**: preserve them only if target selection is deterministic. Otherwise fail explicitly and document the migration path.
- **Pass with follow-up**: out-of-plan work must not become an iterate blocker. Record it in the pass artifact and route a new plan.

## Verification

- Fixture with Phase 1 `in-progress` and Phase 2 `pending`: no-argument review resolves Phase 1 and leaves both phase/overview states unchanged before save.
- Clean review fixture: exactly one `review-pass-phase-1-*.md` exists and cites completion-matrix and verification evidence.
- Failing review fixture: `iterate-*.md` exists and no review-pass exists.
- Modify one reviewed implementation file after pass: the fingerprint check rejects the old pass.
- Run focused `scripts/context-artifacts.test.mjs` cases for review-pass classification, required fields, and verdict/status enums.

## Per-Phase Execution Loop

1. Run `/b-build-hard` against this phase file only.
2. Run `/b-review .context/2026-07-10.buck-workflow-implementation-audit/phase-1-review-gated-phase-state.md` explicitly; this avoids the pre-fix wrong-phase resolver during the cutover.
3. If review creates an in-plan iterate artifact, run `/b-iterate`, then re-run the explicit review. Route out-of-plan findings to a separate plan.
4. If review flags documentation impact, run `/b-docs`.
5. Run `/b-save` to make review/iteration evidence and memory durable.
6. Explicitly stage the implementation and durable artifacts.
7. Run `/b-commit` for this phase only.
8. If incomplete, leave `status: in-progress`; resume this exact phase next turn.
