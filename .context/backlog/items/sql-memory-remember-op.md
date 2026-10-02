---
title: Stop model-written SQL memory saves
status: active
priority: medium
created: 2026-10-01
updated: 2026-10-01
completed: null
related:
  - .context/2026-10-01.sql-memory-remember-op/plan-sql-memory-remember-op.md
  - extensions/sql-memory/index.ts
  - skills/b-save/SKILL.md
  - docs/sql-memory.md
---

# Stop model-written SQL memory saves

A direct `/b-save` probed `users.id`, `information_schema`, and a uuid-to-text cast. The skill already named the columns. The tool document did not, and gate denials collapsed to `operation not allowed` in the notice.

Pickup: [plan-sql-memory-remember-op.md](../../2026-10-01.sql-memory-remember-op/plan-sql-memory-remember-op.md) — unphased, `/b-build-hard`.
