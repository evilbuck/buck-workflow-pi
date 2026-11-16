---
status: pending
phase: 4
order: 4
plan: plan-viability-cleanup.md
phases_overview: plan-viability-cleanup-phases.md
difficulty: medium
model_hint: capable general model
buck_hint: /b-build
goal: "Execute in-repo move/delete items M3 and M4, and handle M1, M2, and M5 per A-3 destination rules."
files:
  - skills/cross-platform-pi-omp-loading/
  - docs/cross-platform-pi-omp-loading.md
  - docs/extension-loading.md
  - skills/node5-code-review/
  - skills/rails-app/
  - skills/llm-wiki-vault/
  - skills/manage-herdr-panes/
  - README.md
  - docs/buck-workflow.md
  - AGENTS.md
from_plan_steps: ["M1", "M2", "M3", "M4", "M5"]
depends_on: [3]
dependency_type: HARD
acceptance_criteria:
  - "[ ] M3: docs/cross-platform-pi-omp-loading.md exists and skills/cross-platform-pi-omp-loading/ does not"
  - "[ ] M4: skills/node5-code-review/ does not exist and rg -n 'node5-code-review' README.md docs/buck-workflow.md returns no hit"
  - "[ ] A-3: each of M1, M2, and M5 either has Destination filled and the skill is moved to Destination and absent from skills/, or Destination is empty and the skill is left in place with Status updated to skip (so no todo remains at recommended or do)"
  - "[ ] README.md and docs/buck-workflow.md do not name a skill this phase deleted or moved"
  - "[ ] npx vitest run scripts/commands-mirror.test.ts scripts/codex-plugin.test.ts scripts/skill-frontmatter.test.ts passes"
completed_at: null
completed_by: null
---

# Phase 4: Move or remove project/environment-specific skills (M1–M5)

## Context

Parent user goal: the maintainer can walk one checklist, change any recommendation, and apply or skip each item without losing the decision. This phase executes parent todos M1–M5.

HARD-depends on Phase 3 so catalog edits land on the post-grill tree. M3 also depends on Phase 2's F2 fold.

**A-3 owner.** A-3 is deferred and non-blocking for earlier phases. This phase is the validation owner. M3 (`docs/cross-platform-pi-omp-loading.md`) and M4 (`delete`) have in-repo destinations and are ready now. For external move-out todos (`M1`, `M2`, `M5`), check whether `Destination:` is filled on `plan-viability-cleanup.md`:
- If `Destination:` is filled, move the skill to that path and update catalog references.
- If `Destination:` is empty, do **not** invent a destination or delete the skill; set its Status to `skip` (Not this pass — pending external `Destination:`) on `plan-viability-cleanup.md` so the parent plan's acceptance criterion ("Every todo is `keep`, `skip`, or `done`. None left at `recommended` or `do`") is cleanly satisfied without data loss.

## Implementation Details

1. **M3 (`cross-platform-pi-omp-loading` → `docs/cross-platform-pi-omp-loading.md`).** Move the consolidated body of `skills/cross-platform-pi-omp-loading/SKILL.md` (with frontmatter stripped or adapted to a doc header) to `docs/cross-platform-pi-omp-loading.md`. Delete `skills/cross-platform-pi-omp-loading/`. Update references in `README.md`, `docs/buck-workflow.md`, and `docs/extension-loading.md`.
2. **M4 (`node5-code-review` → delete).** Delete `skills/node5-code-review/` and remove its catalog row from `README.md` (and `docs/buck-workflow.md` if present).
3. **M1 (`rails-app`), M2 (`llm-wiki-vault`), M5 (`manage-herdr-panes`).** Read `Destination:` on `plan-viability-cleanup.md`. If filled, move the skill directory to `Destination:` and remove its catalog row (and `AGENTS.md` paragraph for M2). If empty, leave the skill directory untouched and mark the todo `Status: skip` (with a note that `Destination:` was unset) in `plan-viability-cleanup.md`.
4. Do not touch `extensions/b-kamal-release/` (X2 `keep`) or `skills/product-tour/` (X3 `keep`).

## Risks

Moving a skill to a guessed path loses it. Empty Destination means leave in place and mark `skip`, never guess. Rollback of a completed move/delete is `git revert` of this phase commit.

## Verification

```bash
test ! -d skills/cross-platform-pi-omp-loading && test -f docs/cross-platform-pi-omp-loading.md
test ! -d skills/node5-code-review
! rg -n "skills/cross-platform-pi-omp-loading|node5-code-review" README.md docs/buck-workflow.md
npx vitest run scripts/commands-mirror.test.ts scripts/codex-plugin.test.ts scripts/skill-frontmatter.test.ts
```

## Per-Phase Execution Loop

1. Run `/b-build` for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact, run `/b-iterate`, then re-run `/b-review`. Out-of-plan findings go to a new `/b-plan`. If review flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save`.
5. Run `/b-commit`. One phase, one commit.
6. If incomplete, leave `status: in-progress`.
