---
date: 2026-09-29
domains: [extensions, database, testing]
topics: [sql-memory, buck-loop, restricted-custom-tools, prerequisite]
related: [../2026-09-28.sql-memory-buck-loop/phase-1-tool-contract-child-seam.md]
priority: high
status: active
subject: 2026-09-28.sql-memory-buck-loop
artifacts: [../2026-09-28.sql-memory-buck-loop/phase-1-tool-contract-child-seam.md]
---

# SQL memory in Buck-loop — Phase 1 prerequisite hold (assignment 39)

The assigned phase forbids implementation until an operator establishes a disposable SQL target and a live restricted-child SELECT succeeds. Fresh read-only check found `SQL_MEMORY_TEST_URL` unset and `SQL_MEMORY_TEST_DISPOSABLE` not `yes`; OMP reports 18.4.3. No database operation or restricted child was attempted. Phase remains in progress with acceptance criteria unchecked; no source or phase-state changes were made.

Resume only after provision of a dedicated disposable `SQL_MEMORY_TEST_URL`, explicit `SQL_MEMORY_TEST_DISPOSABLE=yes`, and the required live restricted-child SELECT proof. Never use a shared/production endpoint.

## Verification

- Read-only prerequisite environment check; URL value was not printed.
- `omp --version` reported `omp/18.4.3`.
- No database operation or restricted child was run.
