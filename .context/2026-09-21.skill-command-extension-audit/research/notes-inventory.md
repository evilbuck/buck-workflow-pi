# Inventory — 2026-09-21 skill/command/extension audit

Branch: `master` @ `7dc2aaf`. Working tree clean at ingest.

## Counts

- skills/: 64 directories with SKILL.md (includes `_shared`)
- prompts/: 43 markdown files
- commands/: 43 entries, all symlinks to `../prompts/<same-name>.md` (0 regular files)
- prompt vs command name sets: identical
- extensions/: one composed entry `extensions/index.ts`

## Skills (64)

_shared, b-arch-qa, b-auto-fix, b-backlog, b-blueprint, b-brainstorm, b-build, b-capture, b-create-styleguide, b-create-ux-guide, b-diagnose, b-docs, b-eval-upstream-prs, b-explore, b-fix-rebase-conflict, b-grill, b-grill-auto, b-grill-me, b-grill-with-docs, b-guardrails-check, b-handoff, b-hindsight-import-projects, b-howto, b-init-factory, b-init-guardrails, b-init-tracker, b-issue-create, b-iterate, b-memory-import, b-nasa-prd, b-phase, b-plan, b-plan-update, b-pr, b-pr-review-2-issues, b-present, b-recap, b-research, b-review, b-save, b-save-improved, b-triage, b-wizard, code-review, code-review-universal, code-smells, codebase-design, crawl4ai, cross-platform-pi-omp-loading, design-brief, fix-pr, git-clean-orphans, git-commit, git-commit-improved, llm-wiki-vault, manage-herdr-panes, node5-code-review, pi-rpc, product-tour, rails-app, run-in-idle-pane, skill-explainer, thought-dump-writer, writing-for-agents

## Skills without matching prompt (29)

_shared, b-arch-qa, b-auto-fix, b-backlog, b-blueprint, b-create-styleguide, b-create-ux-guide, b-grill, b-grill-auto, b-hindsight-import-projects, b-issue-create, b-memory-import, code-smells, codebase-design, crawl4ai, cross-platform-pi-omp-loading, design-brief, fix-pr, git-commit, git-commit-improved, llm-wiki-vault, manage-herdr-panes, node5-code-review, pi-rpc, rails-app, run-in-idle-pane, skill-explainer, thought-dump-writer, writing-for-agents

Note: `git-commit` is loaded by `/b-commit` prompt. `git-commit-improved` is loaded by `/b-commit-improved`. Skill-only is often intentional.

## Prompts without matching skill dir (8)

b-build-hard (loads b-build), b-commit (loads git-commit), b-commit-improved, b-kamal-release, b-pr-improved, omp-goal, omp-orchestrate, omp-workflow

## Wired extensions (extensions/index.ts)

wireTpsTracker, wireBprImproved, wireBCommitImproved, wireKamalRelease, wirePlanArtifact, wireBSaveImproved, wireCodeReviewIteration, wireBuckLoop, plus inlined model auto-switch.

## Unwired / leftover extension files (to verify)

- `extensions/grill-me-dialog.ts` — not imported
- `extensions/tmux-window-status.ts` (+ test) — not imported
- `extensions/b-grill-auto/` — not imported; backlog still has "Test b-grill-auto extension in live Pi session"
- `extensions/buck-mode.test.ts` — test file, no `buck-mode.ts`
- `extensions/extension-activity.ts` — helper, not a wire()
- `extensions/subprocess.ts` — helper
- `extensions/state-machine.ts` — shared helper
- `extensions/omp-models.ts` — imported as mappingFromOmpRoles

README already says: "Unwired: b-grill-auto extension command, tmux status, session-state injection. Removed: /b-mode, plan-mode write guards, /b-save as extension command, b-flow."

## Known prior cleanups (do not restore)

- `skills/b-loop/` deleted 2026-09-20
- `extensions/b-flow/` + xstate deleted 2026-09-20; tombstone `docs/b-flow.md`
- 2026-09-11 prompts↔commands divergence (8 regular command files) is **fixed**: 43/43 symlinks

## Overlap clusters to investigate

1. Review: code-review, code-review-universal, node5-code-review, code-review-iteration ext, b-review, b-pr-review-2-issues, fix-pr
2. Dual improved: b-save vs b-save-improved; git-commit vs git-commit-improved; b-pr vs b-pr-improved
3. Grill: b-grill, b-grill-me, b-grill-auto, b-grill-with-docs, grill-me-dialog.ts
4. Capture: b-capture vs thought-dump-writer
5. Design/UX: design-brief, b-create-ux-guide, b-create-styleguide, codebase-design
6. Explore/research: b-explore, b-research, b-arch-qa, skill-explainer, crawl4ai
7. Recap/handoff/save
8. Memory: b-memory-import vs b-hindsight-import-projects
9. Docs: b-docs, b-howto, writing-for-agents
10. Diagnose vs code-smells
11. Blueprint vs present
12. Auto-fix vs triage vs issue-create vs backlog
13. Project-specific: rails-app, node5-code-review, llm-wiki-vault, manage-herdr-panes
