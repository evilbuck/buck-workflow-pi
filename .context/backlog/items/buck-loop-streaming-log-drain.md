---
title: "Add a tail-able /buck-loop streaming log drain"
status: active
priority: medium
created: 2026-09-24
updated: 2026-09-24
completed: null
related:
  - .context/2026-09-24.buck-loop-streaming-log-drain/plan-buck-loop-streaming-log-drain.md
  - extensions/buck-loop/index.ts
  - extensions/buck-loop/run-step.ts
  - extensions/extension-activity.ts
---

# Add a tail-able `/buck-loop` streaming log drain

Implement the bounded plan at [plan-buck-loop-streaming-log-drain.md](../../2026-09-24.buck-loop-streaming-log-drain/plan-buck-loop-streaming-log-drain.md). Write normalized progress/activity/terminal records to `.context/workflow/buck-loop.log.jsonl` so an operator can use `tail -F` while the loop is still running. Start truncates, resume appends, status/stop do not touch the file, and logging failures never change workflow state.
