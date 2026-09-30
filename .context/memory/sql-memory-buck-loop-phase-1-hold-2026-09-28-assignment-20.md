---
date: 2026-09-28
domains: [extensions, database, testing]
topics: [sql-memory, buck-loop, restricted-custom-tools, prerequisite]
related: [../2026-09-28.sql-memory-buck-loop/phase-1-tool-contract-child-seam.md]
priority: high
status: active
subject: 2026-09-28.sql-memory-buck-loop
artifacts: [../2026-09-28.sql-memory-buck-loop/phase-1-tool-contract-child-seam.md]
---

# SQL memory in Buck-loop — Phase 1 prerequisite hold (assignment 20)

Rechecked on 2026-09-28: deployed `omp --version` reports 18.4.2; `SQL_MEMORY_URL` is set, but `SQL_MEMORY_TEST_URL` is unset and `SQL_MEMORY_TEST_DISPOSABLE` is unset. The configured endpoint is not evidence of a disposable target. No database connection/query and no restricted OMP child was attempted. Phase 1 explicitly requires operator-established disposable-target confirmation and a successful live restricted-child SELECT before implementing the SDK admission seam.

No implementation or phase acceptance/status changes were made. Next prerequisite: provide a dedicated disposable `SQL_MEMORY_TEST_URL` and explicitly set `SQL_MEMORY_TEST_DISPOSABLE=yes`; then perform the live restricted-child SELECT proof before changing the seam.

## Files modified

- `.context/memory/sql-memory-buck-loop-phase-1-hold-2026-09-28-assignment-20.md`
- `.context/memory/index.md`
