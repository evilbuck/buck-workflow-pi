---
title: Unified live activity for extensions
status: active
priority: high
created: 2026-08-20
updated: 2026-09-11
completed: null
related:
  - .context/2026-09-11.extension-activity-progress/plan-extension-activity-progress.md
  - .context/2026-09-11.extension-activity-progress/plan-extension-activity-progress-phases.md
  - extensions/command-progress.ts
  - extensions/omp-models.ts
  - extensions/b-pr-improved/index.ts
  - extensions/b-commit-improved/index.ts
  - extensions/b-save-improved/index.ts
  - extensions/b-kamal-release/index.ts
---

# Unified live activity for extensions

Originally scoped as "Live TUI progress for deterministic slash commands" on 2026-08-20 to stop `/b-pr-improved` (and siblings) looking frozen while `execFileSync` blocked the event loop. Retargeted on 2026-09-11 to the broader plan at `.context/2026-09-11.extension-activity-progress/`.

Pickup: `.context/2026-09-11.extension-activity-progress/plan-extension-activity-progress.md` (use `.context/2026-09-11.extension-activity-progress/plan-extension-activity-progress-phases.md` as the execution map).

What now lives in this item: animated footer spinner + bounded live activity window for every currently shipped long-running extension command (`b-pr-improved`, `b-commit-improved`, `b-save-improved`, `b-kamal-release`), with subprocess capture split out, normalized model events flowing through `runOmpModelSession()`, and `extensions/command-progress.ts` removed after clean cutover.
