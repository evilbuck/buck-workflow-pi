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

# SQL memory in Buck-loop — Phase 1 prerequisite hold (assignment 34)

The assigned phase explicitly requires an operator-established disposable SQL target and successful live restricted-child SELECT before implementation. Fresh environment inspection found `SQL_MEMORY_TEST_URL` unset and `SQL_MEMORY_TEST_DISPOSABLE` not set to `yes`. OMP reports 18.4.2; that does not prove the restricted `customTools` contract. No database connection/query or restricted child was attempted, and no implementation or phase-state change was made. Phase 1 remains in progress with unchecked acceptance criteria.

Next prerequisite: provide a dedicated disposable `SQL_MEMORY_TEST_URL`, explicitly set `SQL_MEMORY_TEST_DISPOSABLE=yes`, and run/observe the live restricted-child SELECT proof. The configured shared SQL endpoint is not a substitute.

## Verification

- Read the assigned phase and prior prerequisite checkpoint.
- Inspected disposable-target environment indicators and `omp --version`; the target URL and explicit disposable confirmation are absent; OMP reports 18.4.2.
- No database operation or restricted child was run.
