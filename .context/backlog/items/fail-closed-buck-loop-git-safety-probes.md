---
title: Fail closed when buck-loop Git safety probes fail
status: active
priority: high
created: 2026-09-22
updated: 2026-09-22
completed: null
related:
  - .context/2026-09-22.fix-buck-loop-deferred-docs-and-in-cycle-resume/review-zz-buck-loop-2026-09-23T03-13-42-606Z.md
  - extensions/buck-loop/loop.ts
---

# Fail closed when buck-loop Git safety probes fail

`extensions/buck-loop/loop.ts` currently converts failures from Git branch and status commands to an empty string. The resume and start safety gates can therefore interpret an unreadable branch as unprotected and an unreadable status as clean.

Make branch/status probe failures return a structured blocked result before nested work. Preserve the existing protected-branch, dirty-start, and resume ownership rules, and cover command-failure behavior through the exported loop surface.
