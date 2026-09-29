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

# SQL memory in Buck-loop — Phase 1 prerequisite hold (assignment 35)

The assigned phase explicitly prohibits implementation until an operator-established disposable SQL target exists and a live restricted-child SELECT succeeds. Fresh inspection found `SQL_MEMORY_TEST_URL` unset and `SQL_MEMORY_TEST_DISPOSABLE` not `yes`; OMP reports 18.4.2. No database connection/query or restricted child was attempted. No source or phase-state change was made; Phase 1 remains in progress with acceptance criteria unchecked.

Prerequisite to resume: supply a dedicated disposable `SQL_MEMORY_TEST_URL`, set `SQL_MEMORY_TEST_DISPOSABLE=yes`, then establish the live restricted-child SELECT proof. Never use a shared/production endpoint.

## Verification

- Read the assigned phase and linked plan; confirmed live disposable-target and restricted-child proof are hard prerequisites.
- Checked the two disposable-target environment indicators without printing URL values; neither satisfies the requirement.
- `omp --version` reported `omp/18.4.2`.
- No database operation or restricted child was run.
