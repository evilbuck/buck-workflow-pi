---
date: 2026-09-29
domains: [extensions, database, testing]
topics: [sql-memory, buck-loop, restricted-custom-tools, omp-fork]
related: [../2026-09-28.sql-memory-buck-loop/phase-1-tool-contract-child-seam.md]
priority: high
status: completed
subject: 2026-09-28.sql-memory-buck-loop
artifacts: [phase-1-tool-contract-child-seam.md]
---

# Deployed OMP restricted-child SQL admission proof

The saved /buck-loop run stopped at loopCount 2/12 and state blocked; there was no infinite retry. Phase 1 had not advanced because the child used standalone Pi SDK 0.73.1, not the deployed OMP fork, and never completed the required SELECT. The shared SQL_MEMORY_URL was not disposable and was never queried for this proof.

A throwaway extension loaded explicitly by omp 18.4.3 via -e created a real nested session under the deployed OMP process with customTools: [sqlMemoryTool(pool)], allowRestrictedCustomTools: true, toolNames: ["sql_memory"], restrictToolNames: true, tools: [], disableExtensionDiscovery: true, enableMCP: false, and enableLsp: false. Only a fresh PostgreSQL 18.6 pgvector container bound to 127.0.0.1:32772 was provided as SQL_MEMORY_TEST_URL; SQL_MEMORY_URL was blank for the process. The child reported PROOF_ACTIVE_TOOLS ["sql_memory"], PROOF_TOOL_START sql_memory, and PROOF_TOOL_END false with rows [{"proof":7}], rowCount 1 from SELECT 7 AS proof. The throwaway container was stopped and removed after the result; the source probe was removed after its evidence was recorded.

At the initial fork-admission checkpoint, Phase 1 implementation had not begun. The subsequent build added the stage-scoped adapter and tests; the post-implementation proof below resolved its remaining live-integration gap. The earlier standalone SDK failure was not representative of the deployed OMP loader.

## Verification

- Live OMP child SELECT returned proof = 7, rowCount = 1; only sql_memory was active.
- docker stop succeeded; docker ps -a filter for the throwaway name returned no container.
- At the initial checkpoint no application code was changed; deterministic code guardrails did not apply then.

## Post-implementation proof and outcome

A later actual runStep b-build-hard child was launched by the deployed OMP fork in a throwaway Git workspace with SQL_MEMORY_URL overridden to a second fresh loopback-only PostgreSQL container. The child emitted sql_memory tool start/end (success) and reported SELECT 7 AS proof as one row with proof = 7. A third disposable database exercised the stage-role executor: bound quotes remained data, recall SELECT succeeded, recall UPDATE failed with PostgreSQL read-only-transaction error and left the row unchanged, save-stage memory_ranks INSERT and migrations were denied, and a bound save UPDATE succeeded. Both disposable containers were stopped and removed. No proof used the shared SQL endpoint.

The live test exposed a duplicate onFailure callback for a PostgreSQL error; removing the inner callback kept the stage fail-closed and made the callback fire once. After that change, env -u SQL_MEMORY_URL npm run guardrails:check returned status pass (durable v2, unit and complexity gates pass), and TypeScript LSP diagnostics for index.ts were OK. All six Phase 1 acceptance criteria were checked and the phase status set completed; the workflow review/commit stages remain pending.
