---
title: Skill/command/extension surface cleanup
status: active
priority: medium
created: 2026-09-21
updated: 2026-09-21
completed: null
related:
  - .context/2026-09-21.skill-command-extension-audit/plan-skill-surface-cleanup.md
  - .context/2026-09-21.skill-command-extension-audit/plan-skill-surface-cleanup-phases.md
  - .context/2026-09-21.skill-command-extension-audit/phase-1-dead-unwired-extensions.md
  - .context/2026-09-21.skill-command-extension-audit/phase-2-bsave-and-code-review.md
  - .context/2026-09-21.skill-command-extension-audit/research-skill-command-extension-audit.md
  - extensions/grill-me-dialog.ts
  - extensions/tmux-window-status.ts
  - extensions/b-grill-auto/
  - prompts/b-save.md
  - skills/code-review/SKILL.md
---

# Skill/command/extension surface cleanup

From the 2026-09-21 audit. Do not restore `skills/b-loop/` or `extensions/b-flow/`.

## Slice 1 — dead unwired extensions

Delete:

- `extensions/grill-me-dialog.ts`
- `extensions/tmux-window-status.ts` + `extensions/tmux-window-status.test.ts`
- `extensions/b-grill-auto/` (keep `skills/b-grill-auto/`)

Close backlog item `test-b-grill-auto-extension.md` (extension is not wired).

Keep `extensions/buck-mode.test.ts` (slimdown regression + model auto-switch).

## Slice 2 — broken / drifted

- Thin `prompts/b-save.md` to load `skills/b-save/SKILL.md`
- Stop `skills/code-review/SKILL.md` writing to `/mnt/c/Code/plans/`
- Document `/code-review` dual (prompt vs extension) in `prompts/code-review.md`

## Slice 3 — user call (not auto-delete)

Project-specific skills in the portable package: `node5-code-review`, `rails-app`, `llm-wiki-vault`, `manage-herdr-panes`.

Grill family: four skills stay until a canonical entry is chosen.

## Catalog

README Prompt Templates table is missing `/product-tour` and `/git-clean-orphans` (and a few aliases/stubs). Do this after slices 1–2.
