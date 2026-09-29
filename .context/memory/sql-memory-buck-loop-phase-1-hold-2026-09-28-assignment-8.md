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

# SQL memory in Buck-loop — Phase 1 prerequisite hold (assignment 8)

The assigned Phase 1 explicitly forbids implementing the custom-tool admission seam until a disposable database target is established and a deployed-fork restricted-child SELECT is safely exercised. A fresh credential-free environment check found `SQL_MEMORY_URL` set, `SQL_MEMORY_TEST_URL` unset, and `SQL_MEMORY_TEST_DISPOSABLE_CONFIRMED` not equal to `1`. The configured endpoint is not thereby proven disposable. No database connection/query or restricted OMP child was attempted. Phase remains `in-progress`; acceptance criteria remain unchecked. No source changes are safe in this assignment.