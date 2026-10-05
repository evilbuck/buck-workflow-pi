---
status: pending
phase: 2
order: 2
plan: plan-viability-cleanup.md
phases_overview: plan-viability-cleanup-phases.md
difficulty: medium
model_hint: capable general model
buck_hint: /b-build
goal: "Fold design-brief, slash-command-mirror, and crawl4ai into the sibling that already owns the job."
files:
  - skills/design-brief/
  - plugins/buck-workflow/skills/design-brief/
  - skills/cross-platform-pi-omp-loading/SKILL.md
  - skills/cross-platform-pi-omp-loading/slash-command-mirror/
  - skills/crawl4ai/
  - plugins/buck-workflow/skills/crawl4ai/
  - skills/b-research/SKILL.md
  - scripts/codex-plugin.test.ts
  - README.md
  - docs/buck-workflow.md
from_plan_steps: ["F1", "F2", "F3"]
depends_on: [1]
dependency_type: HARD
acceptance_criteria:
  - "[ ] skills/design-brief/ and plugins/buck-workflow/skills/design-brief/ are gone"
  - "[ ] skills/_shared/design-brief.jsonc still exists"
  - "[ ] skills/cross-platform-pi-omp-loading/slash-command-mirror/ is gone and the parent SKILL.md still states the prompts/ to commands/ symlink rule"
  - "[ ] skills/crawl4ai/ and plugins/buck-workflow/skills/crawl4ai/ are gone"
  - "[ ] rg -n 'skills/crawl4ai' skills/b-research/SKILL.md returns no hit"
  - "[ ] npx vitest run scripts/codex-plugin.test.ts skills/_shared/scripts/design-language.test.ts passes"
completed_at: null
completed_by: null
---

# Phase 2: Fold duplicates

## Context

Parent user goal: the maintainer can walk one checklist, change any recommendation, and apply or skip each item without losing the decision. This phase is parent todos F1, F2, and F3.

HARD-depends on Phase 1 because both edit `docs/buck-workflow.md` and `README.md`. Start from Phase 1's tree so the omp-stub deletion is not reverted.

A-1 is already validated: `skills/design-brief/` is not `skills/_shared/design-brief.jsonc`. Do not assign a new validation. Do not delete the JSONC or `skills/_shared/themes/**/design-brief.jsonc`.

Skip any of F1–F3 whose parent-plan Status is `keep` or `skip`. Apply only `recommended` or `do`.

## Implementation Details

1. **F1.** Delete `skills/design-brief/` and the Codex copy `plugins/buck-workflow/skills/design-brief/`. Remove `design-brief` from `scripts/codex-plugin.test.ts` `canonicalCopies`. Point "make a UI brief" catalog rows at `b-create-ux-guide`.
2. **F2.** Move any unique symlink steps from `skills/cross-platform-pi-omp-loading/slash-command-mirror/SKILL.md` into the parent `SKILL.md`. Delete the child directory. Update the parent link and the `docs/buck-workflow.md` citation of the child path. This skill is not in the Codex allowlist.
3. **F3.** Fold the install/bootstrap section of `skills/crawl4ai/SKILL.md` into `skills/b-research/SKILL.md` as a short optional paragraph. Delete `skills/crawl4ai/` and `plugins/buck-workflow/skills/crawl4ai/`. Remove `crawl4ai` from the Codex allowlist. Update `skills/b-research/SKILL.md` before the delete so it no longer says `skills/crawl4ai/SKILL.md`.

One commit for the whole phase after all three applied todos pass. Do not batch this with Phase 1 or Phase 3.

## Risks

Deleting the JSONC breaks blueprint and present HTML. The file-exists check is the guard. Rollback is `git revert` of this phase commit.

## Verification

```bash
test ! -d skills/design-brief && test -f skills/_shared/design-brief.jsonc
test ! -d skills/cross-platform-pi-omp-loading/slash-command-mirror
test ! -d skills/crawl4ai
rg -n "skills/crawl4ai" skills/b-research/SKILL.md
npx vitest run scripts/codex-plugin.test.ts skills/_shared/scripts/design-language.test.ts
```

`rg` must exit non-zero (no hits).

## Per-Phase Execution Loop

1. Run `/b-build` for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact, run `/b-iterate`, then re-run `/b-review`. Out-of-plan findings go to a new `/b-plan`. If review flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save`.
5. Run `/b-commit`. One phase, one commit.
6. If incomplete, leave `status: in-progress`.
