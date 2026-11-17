---
status: completed
phase: 2
order: 2
plan: plan-viability-cleanup.md
phases_overview: plan-viability-cleanup-phases.md
difficulty: medium
model_hint: capable general model
buck_hint: /b-build
goal: "Fold duplicate, helper-only, and half-migrated skills (F1–F8) into the canonical sibling that stays."
files:
  - skills/design-brief/
  - plugins/buck-workflow/skills/design-brief/
  - skills/b-design-palette/SKILL.md
  - skills/cross-platform-pi-omp-loading/SKILL.md
  - skills/cross-platform-pi-omp-loading/slash-command-mirror/
  - skills/crawl4ai/
  - plugins/buck-workflow/skills/crawl4ai/
  - skills/b-research/SKILL.md
  - plugins/buck-workflow/skills/b-research/SKILL.md
  - skills/b-save/
  - plugins/buck-workflow/skills/b-save/
  - skills/b-save-improved/
  - skills/deprecated-b-save/
  - prompts/b-save-improved.md
  - prompts/deprecated-b-save.md
  - commands/deprecated-b-save.md
  - extensions/buck-loop/sql-save.ts
  - extensions/buck-loop/__tests__/sql-save-adapters.test.ts
  - skills/b-create-styleguide/SKILL.md
  - skills/b-create-ux-guide/
  - prompts/git-clean-orphans.md
  - skills/git-clean-orphans/
  - skills/git-commit/
  - plugins/buck-workflow/skills/git-commit/
  - skills/git-commit-improved/
  - prompts/b-commit-improved.md
  - extensions/b-commit-improved/index.ts
  - extensions/b-commit-improved/__tests__/wire.test.ts
  - skills/b-memory-import/
  - skills/b-hindsight-import-projects/
  - skills/b-capture/SKILL.md
  - skills/thought-dump-writer/
  - skills/code-review/SKILL.md
  - scripts/codex-plugin.test.ts
  - guardrails.json
  - README.md
  - docs/buck-workflow.md
from_plan_steps: ["F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8"]
depends_on: [1]
dependency_type: HARD
acceptance_criteria:
  - "[x] F1: skills/design-brief/ and plugins/buck-workflow/skills/design-brief/ are gone, and skills/_shared/design-brief.jsonc still exists"
  - "[x] F2: skills/cross-platform-pi-omp-loading/slash-command-mirror/ is gone and the parent SKILL.md still states the prompts/ to commands/ symlink rule"
  - "[x] F3: skills/crawl4ai/ and plugins/buck-workflow/skills/crawl4ai/ are gone, and rg -n 'skills/crawl4ai' skills/b-research/SKILL.md returns no hit"
  - "[x] F4: skills/b-save-improved/, skills/deprecated-b-save/, prompts/deprecated-b-save.md, and commands/deprecated-b-save.md are gone; skills/b-save/scripts/save-preflight.ts and save-apply.ts exist; rg -n 'b-save-improved/scripts' skills/ extensions/ returns no hit"
  - "[x] F5: skills/b-create-ux-guide/ is gone and skills/b-create-styleguide/SKILL.md documents the --inventory-only mode and HTML research guide deliverable"
  - "[x] F6: skills/git-clean-orphans/ is gone and prompts/git-clean-orphans.md references ../skills/git-cleanup/SKILL.md"
  - "[x] F7: skills/git-commit-improved/ is gone, skills/git-commit/scripts/commit-preflight.ts exists, and extensions/b-commit-improved/ + prompts/b-commit-improved.md reference skills/git-commit/"
  - "[x] F8: skills/b-hindsight-import-projects/ and skills/thought-dump-writer/ are gone; skills/b-memory-import/scripts/import-projects.ts exists; skills/b-capture/SKILL.md documents --single-file mode; rg -n 'Drizzle|Supabase' skills/code-review/SKILL.md returns no hit"
  - "[x] npx vitest run scripts/commands-mirror.test.ts scripts/codex-plugin.test.ts skills/_shared/scripts/design-language.test.ts extensions/b-commit-improved/__tests__/wire.test.ts skills/b-save/scripts/save-preflight.test.ts skills/b-save/scripts/save-apply.test.ts passes"
completed_at: 2026-11-16
completed_by: b-build
---

# Phase 2: Fold duplicates (F1–F8)

## Context

Parent user goal: the maintainer can walk one checklist, change any recommendation, and apply or skip each item without losing the decision. This phase executes parent todos F1 through F8.

HARD-depends on Phase 1 because both edit `docs/buck-workflow.md` and `README.md`.

A-1 is already validated: `skills/design-brief/` is not `skills/_shared/design-brief.jsonc`. Do not delete the JSONC or `skills/_shared/themes/**/design-brief.jsonc`. A-2 is validated: any prompt delete removes both `prompts/<name>.md` and `commands/<name>.md` together.

Skip any of F1–F8 whose parent-plan Status is `keep` or `skip`. Apply all items marked `do`.

## Implementation Details

1. **F1 (`design-brief` → `b-create-styleguide`).** Delete `skills/design-brief/` and `plugins/buck-workflow/skills/design-brief/`. Remove `design-brief` from `scripts/codex-plugin.test.ts` `canonicalCopies`. Point "make a UI brief" references (e.g. in `skills/b-design-palette/SKILL.md`, `README.md`, `docs/buck-workflow.md`) at `b-create-styleguide`.
2. **F2 (`slash-command-mirror` → `cross-platform-pi-omp-loading`).** Move the unique symlink setup, drift mitigation (`scripts/commands-mirror.test.ts`), and verification steps from `skills/cross-platform-pi-omp-loading/slash-command-mirror/SKILL.md` into `skills/cross-platform-pi-omp-loading/SKILL.md`. Delete `skills/cross-platform-pi-omp-loading/slash-command-mirror/`. Update the parent link and `docs/buck-workflow.md` line that cites the child path.
3. **F3 (`crawl4ai` → `b-research`).** Fold the install/bootstrap and optional usage paragraph from `skills/crawl4ai/SKILL.md` into `skills/b-research/SKILL.md` (and sync `plugins/buck-workflow/skills/b-research/SKILL.md`). Delete `skills/crawl4ai/` and `plugins/buck-workflow/skills/crawl4ai/`. Remove `crawl4ai` from `scripts/codex-plugin.test.ts`.
4. **F4 (`b-save-improved` + `deprecated-b-save` → `b-save`).** Move `skills/b-save-improved/scripts/save-preflight.ts`, `save-apply.ts`, `save-preflight.test.ts`, and `save-apply.test.ts` into `skills/b-save/scripts/` (and sync `plugins/buck-workflow/skills/b-save/`). Update `skills/b-save/SKILL.md` to document both the `extensions/b-save/index.ts` deterministic path and the cross-platform script/prompt fallback (`--dry-run`, `--archive-inferred`, `--subject`, `--no-retain`, `--model`). Update script path references in `extensions/buck-loop/sql-save.ts` and `extensions/buck-loop/__tests__/sql-save-adapters.test.ts`. Repoint `prompts/b-save-improved.md` to `../skills/b-save/SKILL.md`. Delete `skills/b-save-improved/`, `skills/deprecated-b-save/`, `prompts/deprecated-b-save.md`, and `commands/deprecated-b-save.md`.
5. **F5 (`b-create-ux-guide` → `b-create-styleguide`).** Fold `b-create-ux-guide`'s non-interactive / section-scoped component inventory mode (`--inventory-only` or when the user asks for an analytical UX inventory without `AGENTS.md` wiring) and its HTML research guide deliverable (`docs/ux-research.html`) plus 12-category component taxonomy into `skills/b-create-styleguide/SKILL.md`. Delete `skills/b-create-ux-guide/` (and any Codex copy if present). Keep `b-design-palette` separate.
6. **F6 (`git-clean-orphans` redirect skill removal).** Confirm `prompts/git-clean-orphans.md` points directly to `../skills/git-cleanup/SKILL.md`. Delete `skills/git-clean-orphans/` (and any Codex copy if present). Update `AGENTS.md`, `README.md`, and `docs/buck-workflow.md`.
7. **F7 (`git-commit-improved` → `git-commit`).** Move `skills/git-commit-improved/scripts/commit-preflight.ts` into `skills/git-commit/scripts/` (and sync `plugins/buck-workflow/skills/git-commit/`). Update `skills/git-commit/SKILL.md` to document the deterministic `scripts/commit-preflight.ts` and `extensions/b-commit-improved/` path alongside the portable procedure. Update `extensions/b-commit-improved/index.ts`, `extensions/b-commit-improved/__tests__/wire.test.ts`, and `prompts/b-commit-improved.md` to reference `skills/git-commit/`. Delete `skills/git-commit-improved/`.
8. **F8 (`b-hindsight-import-projects` → `b-memory-import`, `thought-dump-writer` → `b-capture`, `code-review` cleanup).**
   - Move `skills/b-hindsight-import-projects/scripts/import-projects.ts` and `import-projects.test.ts` into `skills/b-memory-import/scripts/`, update `INNER` path resolution in `import-projects.ts` (now same `scripts/` directory), update `guardrails.json` complexity baseline path if needed, document multi-project `--root` / `import-projects.ts` mode in `skills/b-memory-import/SKILL.md`, and delete `skills/b-hindsight-import-projects/`.
   - Fold `skills/thought-dump-writer/SKILL.md` into `skills/b-capture/SKILL.md` as its single-file + per-turn git-checkpoint mode (`--single-file <path>`) and delete `skills/thought-dump-writer/`.
   - Strip the leftover project-specific `## Notes on this project` section (mentioning `wiki/`, Drizzle, and Supabase) from `skills/code-review/SKILL.md`.
9. Update `README.md` and `docs/buck-workflow.md` rows for all F1–F8 changes.

## Risks

- Deleting `skills/_shared/design-brief.jsonc` breaks blueprint and present HTML. Guard with `test -f skills/_shared/design-brief.jsonc`.
- Missing a caller when moving `save-preflight.ts`, `save-apply.ts`, `commit-preflight.ts`, or `import-projects.ts` breaks tests or runtime commands. Grep across `skills/`, `extensions/`, `prompts/`, and `guardrails.json`.
- Rollback is `git revert` of this phase commit.

## Verification

```bash
test ! -d skills/design-brief && test ! -d plugins/buck-workflow/skills/design-brief && test -f skills/_shared/design-brief.jsonc
test ! -d skills/cross-platform-pi-omp-loading/slash-command-mirror
test ! -d skills/crawl4ai && test ! -d plugins/buck-workflow/skills/crawl4ai
! rg -n "skills/crawl4ai" skills/b-research/SKILL.md
test ! -d skills/b-save-improved && test ! -d skills/deprecated-b-save && test ! -e prompts/deprecated-b-save.md && test ! -L commands/deprecated-b-save.md && test -f skills/b-save/scripts/save-preflight.ts && test -f skills/b-save/scripts/save-apply.ts
! rg -n "b-save-improved/scripts" skills/ extensions/
test ! -d skills/b-create-ux-guide && rg -n -- "--inventory-only" skills/b-create-styleguide/SKILL.md
test ! -d skills/git-clean-orphans && rg -n "skills/git-cleanup/SKILL.md" prompts/git-clean-orphans.md
test ! -d skills/git-commit-improved && test -f skills/git-commit/scripts/commit-preflight.ts
test ! -d skills/b-hindsight-import-projects && test ! -d skills/thought-dump-writer && test -f skills/b-memory-import/scripts/import-projects.ts
! rg -n "Drizzle|Supabase" skills/code-review/SKILL.md
npx vitest run scripts/commands-mirror.test.ts scripts/codex-plugin.test.ts skills/_shared/scripts/design-language.test.ts extensions/b-commit-improved/__tests__/wire.test.ts skills/b-save/scripts/save-preflight.test.ts skills/b-save/scripts/save-apply.test.ts
bun test skills/b-memory-import/scripts/import-projects.test.ts
```

## Per-Phase Execution Loop

1. Run `/b-build` for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact, run `/b-iterate`, then re-run `/b-review`. Out-of-plan findings go to a new `/b-plan`. If review flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save`.
5. Run `/b-commit`. One phase, one commit.
6. If incomplete, leave `status: in-progress`.
