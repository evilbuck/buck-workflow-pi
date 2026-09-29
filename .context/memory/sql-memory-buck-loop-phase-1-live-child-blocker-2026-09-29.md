---
date: 2026-09-29
domains: [extensions, database, testing]
topics: [sql-memory, buck-loop, restricted-custom-tools, sdk-fork]
related: [../2026-09-28.sql-memory-buck-loop/phase-1-tool-contract-child-seam.md]
priority: high
status: superseded
subject: 2026-09-28.sql-memory-buck-loop
artifacts: []
---

# SQL-memory Phase 1 — deployed child proof remains blocked

The assigned phase checkpoint requires a successful restricted-child `sql_memory` SELECT against a disposable database before implementation. Provisioned a fresh `pgvector/pgvector:pg18` PostgreSQL 18.6 container on a loopback-only random port; used it only as the disposable target and stopped it afterward. The configured shared `SQL_MEMORY_URL` was not used.

Attempted a child through the repository's installed `@mariozechner/pi-coding-agent` SDK 0.73.1 with `allowRestrictedCustomTools: true`, `toolNames: ["sql_memory"]`, and `restrictToolNames: true`, using an OMP-provided Anthropic OAuth token without printing it. The model reported no `sql_memory` tool; no database SELECT ran. This is evidence that the installed Pi SDK does not establish the deployed OMP-fork contract; it is not an OMP-fork admission test and does not satisfy the phase prerequisite. No source code or phase acceptance criteria were changed.

Stopped at the explicit pre-implementation checkpoint. This hold was resolved later the same day by the deployed-fork proof recorded in sql-memory-buck-loop-deployed-child-proof-2026-09-29.md. The standalone Pi failure remains historical evidence, not a current implementation blocker.

## Verification

- `omp --version`: 18.4.3; OMP OAuth-backed Anthropic account available.
- Disposable container: PostgreSQL 18.6, started and stopped; test process did not query it.
- SDK child prompt: reported no callable tools; restricted custom-tool SELECT proof failed.
- `SQL_MEMORY_URL` was not used. `SQL_MEMORY_TEST_URL` remained unset.
- No code checks run; no code changed.
