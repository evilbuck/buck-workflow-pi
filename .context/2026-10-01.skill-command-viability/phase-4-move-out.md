---
status: pending
phase: 4
order: 4
plan: plan-viability-cleanup.md
phases_overview: plan-viability-cleanup-phases.md
difficulty: medium
model_hint: capable general model
buck_hint: /b-build
goal: "Move rails-app, llm-wiki-vault, and the cross-platform skill out of the portable package once destinations are written."
files:
  - skills/rails-app/
  - skills/llm-wiki-vault/
  - skills/cross-platform-pi-omp-loading/
  - docs/cross-platform-pi-omp-loading.md
  - README.md
  - docs/buck-workflow.md
  - AGENTS.md
from_plan_steps: ["M1", "M2", "M3"]
depends_on: [3]
dependency_type: HARD
acceptance_criteria:
  - "[ ] A-3: each of M1, M2, and M3 either has Destination filled and the skill is absent from skills/, or Status is keep or skip and the skill is untouched"
  - "[ ] If M3 is done, docs/cross-platform-pi-omp-loading.md exists and skills/cross-platform-pi-omp-loading/ does not"
  - "[ ] If M2 is done, AGENTS.md no longer advertises llm-wiki-vault"
  - "[ ] README.md and docs/buck-workflow.md do not name a skill this phase moved"
completed_at: null
completed_by: null
---

# Phase 4: Move out of the package

## Context

Parent user goal: the maintainer can walk one checklist, change any recommendation, and apply or skip each item without losing the decision. This phase is parent todos M1, M2, and M3.

HARD-depends on Phase 3 so catalog edits land on the post-grill tree. M3 also needs Phase 2's F2 fold. That is already satisfied if Phase 2 completed, because Phase 3 cannot start until Phase 2 is done.

**A-3 owner.** A-3 is deferred and non-blocking for earlier phases. This phase is the only validation owner. Before any move, the parent plan must have `Destination:` filled on that todo. If a destination is empty, do not delete or move that skill. Leave its Status at `recommended` and stop that item. Do not invent a destination.

Default M3 destination, already written on the plan: `docs/cross-platform-pi-omp-loading.md`. That counts as filled.

## Implementation Details

1. Read M1, M2, and M3 Status and Destination on `plan-viability-cleanup.md`.
2. **M1** `rails-app`: move `skills/rails-app/` to Destination. Drop the README row. Fit 0.33, 0 mentions.
3. **M2** `llm-wiki-vault`: move `skills/llm-wiki-vault/` to Destination. Drop the README row and the `AGENTS.md` vault-wiki paragraph. Distinct 3.72, fit 0.21.
4. **M3** after F2: move the remaining parent skill body to `docs/cross-platform-pi-omp-loading.md` unless Destination was changed. Delete `skills/cross-platform-pi-omp-loading/`. Update docs that link the skill path. Fit 1.00, confidence 1.00.
5. Skip any todo set to `keep` or `skip`.

Do not touch `extensions/b-kamal-release/`, `manage-herdr-panes`, or `product-tour`. Those are X1–X3 and stay on the parent checklist.

## Risks

Moving a skill to a guessed path loses it. Empty Destination means stop, not guess. Rollback of a completed move is `git revert` of this phase commit plus restoring the destination copy if it lives outside this repo.

## Verification

For each todo marked done, the skill directory is gone from `skills/` and the destination has the content. For each todo left `keep` or `skip`, the skill directory is unchanged.

```bash
rg -n "skills/rails-app/|skills/llm-wiki-vault/|skills/cross-platform-pi-omp-loading/" README.md docs/buck-workflow.md
```

Hits are allowed only for todos that were not moved.

## Per-Phase Execution Loop

1. Run `/b-build` for this phase only. Escalate to `/b-build-hard` only if a destination is ambiguous. Do not guess one.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact, run `/b-iterate`, then re-run `/b-review`. Out-of-plan findings go to a new `/b-plan`. If review flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save`.
5. Run `/b-commit`. One phase, one commit.
6. If incomplete, leave `status: in-progress`.
