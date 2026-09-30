---
date: 2026-09-28
domains: [extensions, database, testing]
topics: [sql-memory, buck-loop, restricted-custom-tools, prerequisite]
subject: 2026-09-28.sql-memory-buck-loop
artifacts: [../2026-09-28.sql-memory-buck-loop/phase-1-tool-contract-child-seam.md]
related: [sql-memory-buck-loop-plan-2026-09-28.md]
priority: high
status: active
---

# SQL memory in Buck-loop — Phase 1 prerequisite check

Phase 1 remains in progress without source changes. Confirmed `omp --version` reports 18.4.2; `SQL_MEMORY_URL` is unset, and the project resolves `@mariozechner/pi-coding-agent@0.73.1`. The local CLI does not itself exercise the SDK admission path, and the project's imported Pi SDK is not proof of deployed OMP fork behavior. No live restricted child call or PostgreSQL-backed SELECT was observed, so admission remains unproven and acceptance criteria remain unchecked. Updated phase checkpoint with these findings. To resume, make a disposable SQL store available and run an actual restricted child through the deployed OMP fork; implement only after its SELECT succeeds.
