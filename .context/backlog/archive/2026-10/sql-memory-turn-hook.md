---
title: Opt-out SQL memory turn hook
status: completed
priority: medium
created: 2026-10-08
updated: 2026-10-08
completed: 2026-10-08
related:
  - .context/2026-10-08.sql-memory-turn-hook/plan-sql-memory-turn-hook.md
  - extensions/sql-memory/remember.ts
  - docs/sql-memory.md
---

# Opt-out SQL memory turn hook

Shipped on `feat/sql-memory-hook`. `hooks/post/turn-memory.ts` is listed once by OMP. Opt out with `BUCK_TURN_MEMORY=0` or `buckTurnMemory.enabled: false`.
