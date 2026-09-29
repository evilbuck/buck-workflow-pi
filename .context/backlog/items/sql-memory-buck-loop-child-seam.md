---
title: Enable restricted SQL memory in Buck-loop children
status: active
priority: medium
created: 2026-09-28
updated: 2026-09-28
completed: null
related: [.context/2026-09-28.sql-memory-buck-loop/plan-sql-memory-buck-loop.md, extensions/sql-memory/index.ts, extensions/buck-loop/run-step.ts]
---

# Enable restricted SQL memory in Buck-loop children

First pickup-able implementation unit (slice A) of the [SQL memory Buck-loop plan](../../2026-09-28.sql-memory-buck-loop/plan-sql-memory-buck-loop.md). Add bound values to the existing SQL operation; expose the existing gated tool as an explicit, stage-scoped custom tool to isolated OMP child sessions. Recall stages run read-only transactions; save gains only required writes; commit receives no SQL tool and no child may migrate. Do not relax restricted tool discovery. Prove the installed OMP SDK option in a real child before relying on the integration. Preserve user changes already in the checkout.

Exit evidence: bound quote-containing query; denied write/migrate outside save; live child SELECT through `sql_memory`; b-commit tool absence; focused contract tests and durable guardrails. The later recall, save, and policy slices remain in the linked plan, not separate backlog items yet.
