---
title: Live TUI progress for deterministic slash commands
status: active
priority: high
created: 2026-08-20
updated: 2026-08-20
completed: null
related:
  - .context/2026-08-20.deterministic-extension-progress/plan-deterministic-extension-progress.md
  - extensions/b-pr-improved/index.ts
  - extensions/b-commit-improved/index.ts
  - extensions/b-kamal-release/index.ts
---

# Live TUI progress for deterministic slash commands

`/b-pr-improved` (and siblings) look frozen until they finish: `execFileSync`
blocks the event loop, and the first `notify` happens after preflight.

Pickup: `.context/2026-08-20.deterministic-extension-progress/plan-deterministic-extension-progress.md`

One unit: shared progress helper + async `execFile` for small children +
spawn with last-N failure tail for `kamal deploy` (no full log buffer).
