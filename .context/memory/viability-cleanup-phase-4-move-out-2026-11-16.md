---
date: 2026-11-16
domains: [skills, refactor, docs, testing]
topics: [viability-cleanup, cross-platform-pi-omp-loading, node5-code-review, catalog-cleanup]
subject: 2026-10-01.skill-command-viability
artifacts:
  - plan-viability-cleanup.md
  - plan-viability-cleanup-phases.md
  - phase-4-move-out.md
  - draft-commit.md
related:
  - .context/memory/viability-cleanup-phase-2-fold-duplicates-2026-11-16.md
  - .context/memory/viability-cleanup-phase-3-unify-b-grill-2026-11-16.md
priority: high
status: completed
---

# Viability Cleanup Phase 4: Move Cross-Platform Loading Doc and Remove node5-code-review (M1–M5)

## User Goal

Complete Phase 4 (M1–M5) of the viability cleanup plan: execute in-repo move/delete items M3 and M4, apply A-3 destination rules to external move-out items M1, M2, and M5, and close out all phases of `2026-10-01.skill-command-viability`.

## What shipped

- **M3 (`cross-platform-pi-omp-loading` → `docs/cross-platform-pi-omp-loading.md`)**: Moved the consolidated package-loading and `prompts/` ↔ `commands/` symlink guide to `docs/cross-platform-pi-omp-loading.md`, deleted `skills/cross-platform-pi-omp-loading/`, and updated references in `README.md`, `docs/buck-workflow.md`, and `docs/extension-loading.md`.
- **M4 (`node5-code-review` → delete)**: Deleted project-specific `skills/node5-code-review/` (superseded by `b-review` and `code-review-universal`) and removed its row from `README.md`.
- **M1, M2, M5 (A-3 external move-outs)**: Since `Destination:` is unset on `plan-viability-cleanup.md` for `rails-app`, `llm-wiki-vault`, and `manage-herdr-panes`, left those three skills in place and recorded their status as `skip` per A-3 so every todo on `plan-viability-cleanup.md` is `keep`, `skip`, or `done`.

## Verification

- `test ! -d skills/cross-platform-pi-omp-loading && test -f docs/cross-platform-pi-omp-loading.md && test ! -d skills/node5-code-review` passed.
- `! rg -n "skills/design-brief/|skills/b-grill-me/|skills/b-grill-with-docs/|skills/crawl4ai|skills/b-save-improved/|skills/deprecated-b-save/|skills/b-create-ux-guide/|skills/git-clean-orphans/|skills/git-commit-improved/|skills/b-hindsight-import-projects/|skills/thought-dump-writer/|skills/node5-code-review/|prompts/omp-goal|prompts/omp-orchestrate|prompts/omp-workflow" README.md docs/buck-workflow.md` passed.
- `npx vitest run scripts/commands-mirror.test.ts scripts/codex-plugin.test.ts scripts/skill-frontmatter.test.ts` passed (3 files, 16 tests).

- `.context/2026-10-01.skill-command-viability/phase-4-move-out.md` — docs/cross-platform-pi-omp-loading.md:1-162, README.md:315-340, docs/buck-workflow.md:127-268, and npx vitest run scripts/commands-mirror.test.ts scripts/codex-plugin.test.ts scripts/skill-frontmatter.test.ts
