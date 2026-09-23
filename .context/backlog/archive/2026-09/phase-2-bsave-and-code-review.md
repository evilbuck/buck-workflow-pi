---
title: Phase 2 — b-save thin-wrap and code-review paths
status: completed
priority: medium
created: 2026-09-21
updated: 2026-09-21
completed: 2026-09-21
related:
  - .context/2026-09-21.skill-command-extension-audit/phase-2-bsave-and-code-review.md
  - .context/2026-09-21.skill-command-extension-audit/plan-skill-surface-cleanup-phases.md
  - .context/2026-09-21.skill-command-extension-audit/plan-skill-surface-cleanup.md
  - skills/b-save/SKILL.md
  - prompts/b-save.md
  - skills/code-review/SKILL.md
  - prompts/code-review.md
---

# Phase 2 — b-save thin-wrap and code-review paths

Absorb prompt-only b-save detail into `skills/b-save/SKILL.md`, then thin `prompts/b-save.md` to a ~13-line loader. Recopy Codex `b-save`. Replace `/mnt/c/Code/plans/` in `code-review` with `.context/` subject-folder paths. Document `/code-review` dual identity in the prompt. Do not rename the extension command.

Pickup: `.context/2026-09-21.skill-command-extension-audit/phase-2-bsave-and-code-review.md`. Difficulty **medium**; `/b-build`.

Completed 2026-09-21. Independent review passed all acceptance criteria with no findings; focused command-mirror and Codex tests passed 11/11; durable guardrails passed at 84.5% coverage with 30/30 complexity hotspots.
