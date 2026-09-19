---
title: "/buck-loop subject picker for missing path"
status: active
priority: medium
created: 2026-09-19
updated: 2026-09-19
completed: null
related:
  - .context/2026-09-19.buck-loop-subject-picker/plan-buck-loop-subject-picker.md
  - extensions/buck-loop/index.ts
  - extensions/buck-loop/scan.ts
---

# `/buck-loop` subject picker for missing path

Bare `/buck-loop` currently prints usage. Pickup: present up to five latest runnable subject folders via `ctx.ui.select`, then pass the chosen folder name as the start path so scan never guesses and the run stays on that subject.

Pickup: `.context/2026-09-19.buck-loop-subject-picker/plan-buck-loop-subject-picker.md`
