---
date: 2026-09-28
domains: [extensions, database, testing]
topics: [sql-memory, buck-loop, restricted-custom-tools, prerequisite]
related: [../2026-09-28.sql-memory-buck-loop/phase-1-tool-contract-child-seam.md, sql-memory-buck-loop-phase-1-hold-2026-09-28-child-check.md]
priority: high
status: active
subject: 2026-09-28.sql-memory-buck-loop
artifacts: [../2026-09-28.sql-memory-buck-loop/phase-1-tool-contract-child-seam.md]
---

# SQL memory in Buck-loop — Phase 1 prerequisite hold (current assignment)

Rechecked the assignment prerequisite. `SQL_MEMORY_URL` is set, but `SQL_MEMORY_TEST_URL`, `SQL_MEMORY_TEST_DISPOSABLE_CONFIRMED`, and `SQL_MEMORY_TEST_DISPOSABLE` are unset. A set configured endpoint does not prove the database disposable. Phase 1 prohibits implementing restricted-tool admission before the disposable target and live restricted-child SELECT are established. No DB query/connection or child session attempted; no source changes made. Phase remains in progress and acceptance criteria stay unchecked. Resume only after the operator supplies a confirmed disposable test target and the deployed-fork restricted-child SELECT can be exercised.
