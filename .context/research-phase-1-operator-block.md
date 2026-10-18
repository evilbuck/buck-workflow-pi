---
status: completed
date: 2026-09-29
subject: 2026-09-28.sql-memory-buck-loop
topics: [sql-memory, buck-loop, prerequisite, diagnosis]
informs: [phase-1-tool-contract-child-seam.md]
---

# Phase 1 operator block diagnosis

The blocked `/buck-loop` run was an unmet *plan prerequisite*, not evidence that SQL injection or the OMP SDK failed. At the time of the run, the phase's Execution checkpoint said not to implement until an operator established a disposable target and a live restricted-child SELECT succeeded. The child assignment wrote a prerequisite-hold note rather than source; all six acceptance boxes stayed unchecked. `.context/workflow/buck-loop.json` records one build, an ambiguous postcondition, then a mandatory operator stop. `extensions/buck-loop/ambiguity.ts` asks Jev whether a further skill run or status change can fix the postcondition, explicitly saying no when a disposable database or operator input is required. Its 0.8 yes threshold rejects the recorded 0.4 verdict.

The configured `SQL_MEMORY_URL` points at an unproven shared target; it cannot be assumed disposable. In the current shell `SQL_MEMORY_TEST_URL` and both disposable-confirmation indicators are unset. These indicators occur in hold notes, not in `extensions/`, `skills/`, or `docs/`; they are an operational convention, not an application-level gate.

The operator prerequisite is unnecessarily absolute on this host. A read-only Docker check found the daemon reachable and `pgvector/pgvector:pg18` cached. A newly created, loopback-bound disposable container started PostgreSQL 18.6 and reported the `vector` extension available. A follow-up `docker ps` found it still running despite the intended shell EXIT cleanup; an explicit `docker stop` removed it. No shared DB was queried, no migration was run, and no restricted OMP child was attempted. This proves a disposable local target can be self-provisioned without credentials from the operator; it does **not** prove the customTools admission seam.

The phase checkpoint now permits self-provisioning a fresh disposable local target before the live child proof while retaining the no-shared-DB and proof-before-implementation requirements.

## Unblock path

1. Start a fresh disposable `pgvector/pgvector:pg18` container on a loopback-only dynamic port. Keep it alive through live proof, then remove it; do not repoint the shared endpoint or use its data.
2. Give only the throwaway test process that container's connection URL (and set the disposable confirmation convention). Prove a restricted child against the deployed OMP fork using explicit `customTools`, `allowRestrictedCustomTools:true`, `toolNames`, and `restrictToolNames:true`; require a real `sql_memory` SELECT. A SELECT from the host alone does not satisfy the criterion.
3. Implement the Phase 1 contract and verify all six criteria. Do not mark the phase complete or resume the loop merely because the container started. If local Docker cannot be used in the eventual execution environment, request a dedicated disposable test URL and explicit confirmation; a configured shared URL is insufficient.

A separate control-plane improvement would tell the supervisor that safe local provisioning is available instead of making Jev infer capabilities from an unchecked phase. This is not the SQL seam itself.
