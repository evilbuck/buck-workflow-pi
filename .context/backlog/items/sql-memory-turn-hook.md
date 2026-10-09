---
title: Opt-out SQL memory turn hook
status: active
priority: medium
created: 2026-10-08
updated: 2026-10-08
completed: null
related:
  - .context/2026-10-08.sql-memory-turn-hook/plan-sql-memory-turn-hook.md
  - extensions/sql-memory/remember.ts
  - docs/sql-memory.md
---

# Opt-out SQL memory turn hook

Every three completed OMP user prompts, store at most one durable fact through `rememberSqlMemory` when `SQL_MEMORY_URL` is set. Opt out with `BUCK_TURN_MEMORY=0` or `buckTurnMemory.enabled: false`.

Pickup: [plan-sql-memory-turn-hook.md](../../2026-10-08.sql-memory-turn-hook/plan-sql-memory-turn-hook.md). Phase before build.
