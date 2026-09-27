---
title: "Jev-ranked /buck-loop subject picker for missing path"
status: active
priority: medium
created: 2026-09-19
updated: 2026-09-27
completed: null
related:
  - .context/2026-09-19.buck-loop-subject-picker/plan-buck-loop-subject-picker.md
  - extensions/buck-loop/index.ts
  - extensions/buck-loop/scan.ts
---

# Jev-ranked `/buck-loop` subject picker for missing path

Bare `/buck-loop` currently prints usage. Pickup: use TypeSafe Jev to rank runnable active subjects from bounded conversation and subject metadata, present up to ten probability-ordered rows via `ctx.ui.select`, then pass the operator's chosen folder as the start path. The loop never auto-starts a guess; `scan()` remains explicit-path only.

Pickup: `.context/2026-09-19.buck-loop-subject-picker/plan-buck-loop-subject-picker.md`
