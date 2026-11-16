---
date: 2026-11-16
domains: [skills, refactor, docs, testing]
topics: [viability-cleanup, skill-consolidation, b-save, git-commit, b-create-styleguide, b-memory-import, b-capture]
subject: 2026-10-01.skill-command-viability
artifacts:
  - plan-viability-cleanup.md
  - plan-viability-cleanup-phases.md
  - phase-2-fold-duplicates.md
  - draft-commit.md
related: []
priority: high
status: completed
---

# Viability Cleanup Phase 2: Fold Duplicate Skills (F1–F8)

## User Goal

Walk the viability cleanup checklist and execute Phase 2 (F1–F8), folding duplicate, redirect-only, and mode-variant skills into their canonical siblings while keeping every test and guardrail gate green.

## What shipped

- **F1 (`design-brief` → `b-create-styleguide`)**: Deleted `skills/design-brief/` and `plugins/buck-workflow/skills/design-brief/`, preserved `skills/_shared/design-brief.jsonc`, updated `skills/b-design-palette/SKILL.md`, and removed `design-brief` from `scripts/codex-plugin.test.ts`.
- **F2 (`slash-command-mirror` → `cross-platform-pi-omp-loading`)**: Folded the `commands/<name>.md -> ../prompts/<name>.md` symlink procedure and `scripts/commands-mirror.test.ts` guard into `skills/cross-platform-pi-omp-loading/SKILL.md` and deleted `skills/cross-platform-pi-omp-loading/slash-command-mirror/`.
- **F3 (`crawl4ai` → `b-research`)**: Folded optional Crawl4AI bootstrap/usage into `skills/b-research/SKILL.md` (and synced `plugins/buck-workflow/skills/b-research/SKILL.md`), deleted `skills/crawl4ai/` and its Codex copy, and updated `scripts/codex-plugin.test.ts`.
- **F4 (`b-save-improved` + `deprecated-b-save` → `b-save`)**: Consolidated all three save skills into `skills/b-save/` (and synced `plugins/buck-workflow/skills/b-save/`), relocated `save-preflight.ts` and `save-apply.ts` (plus tests) to `skills/b-save/scripts/`, updated `extensions/buck-loop/sql-save.ts` and `prompts/b-save-improved.md`, and deleted `skills/b-save-improved/`, `skills/deprecated-b-save/`, `prompts/deprecated-b-save.md`, and `commands/deprecated-b-save.md`.
- **F5 (`b-create-ux-guide` → `b-create-styleguide`)**: Added `--inventory-only` analytical component inventory mode, `docs/ux-research.html` deliverable, and 12-category component taxonomy to `skills/b-create-styleguide/SKILL.md`, and deleted `skills/b-create-ux-guide/`.
- **F6 (`git-clean-orphans` redirect removal)**: Kept `prompts/git-clean-orphans.md` pointing directly to `../skills/git-cleanup/SKILL.md` and deleted `skills/git-clean-orphans/`.
- **F7 (`git-commit-improved` → `git-commit`)**: Moved `commit-preflight.ts` into `skills/git-commit/scripts/` (and synced Codex copy), updated `skills/git-commit/SKILL.md`, `extensions/b-commit-improved/index.ts`, `extensions/b-commit-improved/__tests__/wire.test.ts`, and `prompts/b-commit-improved.md`, and deleted `skills/git-commit-improved/`.
- **F8 (`b-hindsight-import-projects` → `b-memory-import`, `thought-dump-writer` → `b-capture`, `code-review` cleanup)**: Moved `import-projects.ts` and `import-projects.test.ts` into `skills/b-memory-import/scripts/` (updating `guardrails.json` and `vite.config.ts`), folded `--single-file <path>` mode into `skills/b-capture/SKILL.md`, stripped project-specific Drizzle/Supabase notes from `skills/code-review/SKILL.md`, and deleted `skills/b-hindsight-import-projects/` and `skills/thought-dump-writer/`.

## Verification

- `npm run guardrails:check` passed (`status: pass`, coverage 88.3% vs 84% baseline, complexity 27 hotspots vs 30 baseline, 0 new violations).
- `npx vitest run scripts/commands-mirror.test.ts scripts/codex-plugin.test.ts skills/_shared/scripts/design-language.test.ts extensions/b-commit-improved/__tests__/wire.test.ts skills/b-save/scripts/save-preflight.test.ts skills/b-save/scripts/save-apply.test.ts extensions/buck-loop/__tests__/sql-save-adapters.test.ts` passed (7 files, 137 tests).
- `bun test skills/b-memory-import/scripts/import-projects.test.ts` passed (15/15 tests).

- `.context/2026-10-01.skill-command-viability/phase-2-fold-duplicates.md` — skills/b-save/scripts/save-preflight.ts:1-20, skills/git-commit/scripts/commit-preflight.ts:1-20, skills/b-memory-import/scripts/import-projects.ts:1-35, and npm run guardrails:check (status: pass)
