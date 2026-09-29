---
date: 2026-09-29
domains: [extensions, database, testing]
topics: [sql-memory, buck-loop, restricted-custom-tools, stage-policy]
related: [../2026-09-28.sql-memory-buck-loop/phase-1-tool-contract-child-seam.md, sql-memory-buck-loop-deployed-child-proof-2026-09-29.md]
priority: high
status: completed
subject: 2026-09-28.sql-memory-buck-loop
artifacts: [../extensions/sql-memory/index.ts, ../extensions/sql-memory/index.test.ts, ../extensions/sql-memory/sql-gate.test.ts, ../extensions/buck-loop/run-step.ts, ../extensions/buck-loop/__tests__/run-step.test.ts]
---

# SQL memory Buck-loop Phase 1 implementation

Implemented optional bound SQL `values`, stage-aware tool policy, and restricted tool injection for configured Buck-loop child sessions. Recall roles run transactions read-only; save roles allow only `INSERT`/`UPDATE` on users/projects/memories; child migrations are denied. `b-commit` receives no SQL tool. Each child session owns a bounded lazy PostgreSQL pool (max 2 connections) and ends it on session teardown. Tool-policy or DB errors are recorded and make the nested stage fail, preventing a configured loop from treating a failed SQL operation as successful.

The deployed OMP restricted-child SELECT proof preceded implementation. Subsequently, an actual `runStep` child invoked the stage-scoped `sql_memory` tool against a second disposable PostgreSQL instance, returning proof=7; a third disposable instance verified role-policy and read-only-transaction behavior. No shared SQL endpoint was queried. The phase criteria and status are complete; workflow review/commit remain pending.

## Verification

- `env -u SQL_MEMORY_URL npx vitest run extensions/sql-memory/index.test.ts extensions/sql-memory/sql-gate.test.ts extensions/buck-loop/__tests__/run-step.test.ts` — 63 passed.
- `env -u SQL_MEMORY_URL npm run guardrails:check` — pass, durable v2; coverage 88.2% vs baseline 84%; complexity pass.
- Running guardrails with ambient `SQL_MEMORY_URL` set initially failed because pre-existing runner tests assumed no configured SQL tool; rerun with the variable unset passed. The configured value was never printed or queried.
