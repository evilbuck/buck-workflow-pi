---
date: 2026-09-28
domains: [extensions, database, testing]
topics: [sql-memory, buck-loop, restricted-custom-tools, prerequisite]
related: [../2026-09-28.sql-memory-buck-loop/phase-1-tool-contract-child-seam.md, sql-memory-buck-loop-phase-1-blocked-2026-09-28.md]
priority: high
status: active
subject: 2026-09-28.sql-memory-buck-loop
artifacts: [../2026-09-28.sql-memory-buck-loop/phase-1-tool-contract-child-seam.md]
---

# SQL memory in Buck-loop — Phase 1 live prerequisite hold

Rechecked the hard build prerequisite before editing. `omp --version` reports 18.4.2 and `SQL_MEMORY_URL` is set, but neither confirms that its target is disposable. Prior credential-free inspection found host `100.83.73.13` and database `app`; no operator confirmation or separate disposable target is established. No SQL query or restricted child was run, and no source/tests were changed. The phase requires an actual restricted OMP child SQL SELECT before implementing the custom-tool admission seam, and explicitly forbids using an unconfirmed shared database for test data. Phase 1 remains in progress with all acceptance criteria unchecked. Resume only after a disposable target is confirmed and the live restricted-child SELECT is successfully exercised.