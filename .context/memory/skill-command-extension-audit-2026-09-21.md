---
date: 2026-09-21
domains: [audit, skills, extensions, docs]
topics: [cleanup, overlap, deprecation, prompts-commands-mirror, unwired-extensions]
related:
  - 2026-09-21.skill-command-extension-audit/research-skill-command-extension-audit.md
priority: medium
status: completed
subject: 2026-09-21.skill-command-extension-audit
artifacts:
  - research-skill-command-extension-audit.md
  - research/notes-inventory.md
  - research/notes-skills.md
  - research/notes-prompts-commands.md
  - research/notes-extensions.md
  - research/notes-overlap.md
  - research/notes-catalogs.md
---

# Skill / command / extension audit

Five-scout read-only audit of `skills/` (64), `prompts/`=`commands/` (43/43 symlinks), and `extensions/`.

## Outcome

Most overlap is intentional layering. Real cleanup is small.

Safe deletes: unwired `grill-me-dialog.ts`, `tmux-window-status.ts`+test, `extensions/b-grill-auto/`. Keep `buck-mode.test.ts`.

Fixes: thin `prompts/b-save.md`; stop `code-review` writing `/mnt/c/Code/plans/`; document `/code-review` dual identity.

User call: project-specific skills (`node5-code-review`, `rails-app`, `llm-wiki-vault`, `manage-herdr-panes`) and the four-skill grill family.

Do not restore `b-loop` or `b-flow`. Commands mirror is healthy (43/43). Dual `*-improved` pairs stay.

Rejected: scout DELETE of `b-grill` (catalogued); catalogs C9 `b-diagnose` skill-only (false).
