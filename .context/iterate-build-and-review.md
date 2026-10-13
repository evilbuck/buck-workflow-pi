---
status: completed
date: 2026-09-29
updated: 2026-09-29
subject: 2026-09-16.decision-closure
topics: [review, iteration]
informs: []
addresses: phase-5-build-and-review.md
completed: 2026-09-29
from_review: b-review
---

# Iteration: Build and Review Decision Closure

## Source
- Reviewed after: `/b-build`
- Plan: `plan-decision-closure-protocol.md`
- Phase: `phase-5-build-and-review.md`

## Critical Issues

### 1. Settled decisions are guarded only at escalation points
- **File**: `skills/b-build/SKILL.md:58-66` and `plugins/buck-workflow/skills/b-build/SKILL.md`
- **Problem**: The settled-decision and reframing rules are inside the condition for introducing a dependency, abstraction, or broad refactor. A hard-mode implementation can change a settled approach without any of those three triggers, so the phase's separate decision-preservation criterion is not enforced. For example, switching an already-approved storage behavior by a small local edit would skip this condition.
- **Proposed fix**: Keep the minimal-change sequence gated on those three triggers, but apply the settled-decision and current-contradictory-evidence/reframing rules to all hard-mode implementation choices. Do not add per-edit approvals or ceremony to standard work. Synchronize the bundle.

### 2. Phase-scoped reviews may skip assumption and rollback checks
- **File**: `skills/b-review/SKILL.md:99-121` and `plugins/buck-workflow/skills/b-review/SKILL.md`
- **Problem**: The new completion-matrix checks apply only "For plans that contain" a closure ledger or material-risk entries. A reviewer invoked with a `phase-*.md` acceptance contract, as this workflow requires, may read only that phase and never apply the checks to its assumption IDs, inherited parent ledger, or declared rollback/fallback. The phase's blocking assumption could therefore pass without resolution evidence.
- **Proposed fix**: Apply the matrix additions to plan and phase reviews. For a phase, inspect its own validation criteria and the relevant parent-plan ledger/material-risk entries for that phase; do not require other phases to finish. Mark an unresolved in-plan blocker or unsupported recovery claim as a defect, a non-blocking deferred assumption as a warning, and new scope as out-of-plan. Synchronize the bundle.

## Warnings

- Originality against the cited donor discussion could not be directly checked because that external discussion path is absent here; the changed language does not visibly copy the shared Buck protocol schema.

## Resolution and verification

- Hard mode now preserves settled decisions for all implementation choices; only the minimal-change sequence is gated on dependencies, abstractions, and broad refactors. Current contradictory evidence and reframing route are explicit.
- Phase reviews now consult their acceptance criteria and the relevant parent-plan ledger and recovery claims, without requiring other phases to finish.
- Canonical and bundled `b-build`/`b-review` directories match (`diff -rq`); focused Codex packaging tests pass (7/7); forbidden-term scan returns no matches. All changed paths are Markdown, so the code guardrails gate does not apply.
- Re-run `/b-review` against `phase-5-build-and-review.md` before `/b-save`.

## Recommended Workflow

Fixes implemented and locally verified. Re-run `/b-review` against `phase-5-build-and-review.md`; if it passes, run `/b-save` and `/b-commit`.
