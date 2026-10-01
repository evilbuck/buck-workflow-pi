---
title: Show a one-line TUI notice when sql_memory is used
status: active
priority: medium
created: 2026-09-30
updated: 2026-09-30
completed: null
related:
  - .context/2026-09-30.sql-memory-tui-notice/plan-sql-memory-tui-notice.md
  - extensions/sql-memory/index.ts
  - extensions/omp-models.ts
  - extensions/buck-loop/run-step.ts
---

# Show a one-line TUI notice when sql_memory is used

Operators currently see either a JSON dump or a bare `✓ sql_memory` when the tool runs. The notice should be one line with a short synopsis, in the same compact style as a Jev decision line, and must not print SQL or connection strings.

Pickup: [plan-sql-memory-tui-notice.md](../../2026-09-30.sql-memory-tui-notice/plan-sql-memory-tui-notice.md) — unphased, single-session, `/b-build`.
