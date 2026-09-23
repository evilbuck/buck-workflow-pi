---
title: Phase 1 — Dead unwired extensions
status: completed
priority: medium
created: 2026-09-21
updated: 2026-09-21
completed: 2026-09-21
related:
  - .context/2026-09-21.skill-command-extension-audit/phase-1-dead-unwired-extensions.md
  - .context/2026-09-21.skill-command-extension-audit/plan-skill-surface-cleanup-phases.md
  - .context/2026-09-21.skill-command-extension-audit/plan-skill-surface-cleanup.md
  - extensions/grill-me-dialog.ts
  - extensions/tmux-window-status.ts
  - extensions/b-grill-auto/
  - guardrails.json
---

# Phase 1 — Dead unwired extensions

Delete `grill-me-dialog.ts`, `tmux-window-status.ts` + test, and `extensions/b-grill-auto/`. Rewrite grill Document Mode off `grill-me_dialog`. Shrink complexity inventory by those three rows. Drop live-doc unwired tree entries. Archive `test-b-grill-auto-extension`. Recopy Codex `b-grill` / `b-grill-me` / `b-grill-with-docs`. Keep `buck-mode.test.ts`.

Pickup: `.context/2026-09-21.skill-command-extension-audit/phase-1-dead-unwired-extensions.md`. Difficulty **medium**; `/b-build`.

Completed 2026-09-21. Focused extension-registry and Codex bundle tests passed; durable guardrails passed at 84.5% coverage with 30/30 complexity hotspots.
