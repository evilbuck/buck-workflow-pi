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

# SQL memory in Buck-loop — Phase 1 prerequisite hold (assignment 12)

Phase 1 explicitly prohibits implementing the custom-tool admission seam until a disposable database target and deployed-fork restricted-child SELECT are established. This assignment's safe environment check found `SQL_MEMORY_TEST_URL` unset and `SQL_MEMORY_TEST_DISPOSABLE_CONFIRMED` unset; the latest prior checkpoint reported OMP 18.4.2. The configured `SQL_MEMORY_URL` is not evidence that its target is disposable. No database connection/query or restricted child was attempted. No source changes are safe; phase remains in progress and all acceptance criteria remain unchecked. Resume only after an explicitly confirmed disposable test URL is supplied, then prove the live restricted-child SELECT before implementation.
