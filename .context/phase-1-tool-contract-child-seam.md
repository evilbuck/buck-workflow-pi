---
status: completed
phase: 1
order: 1
plan: plan-sql-memory-buck-loop.md
phases_overview: plan-sql-memory-buck-loop-phases.md
difficulty: hard
model_hint: strongest reasoning model available (SDK seam, live OMP proof prerequisite)
buck_hint: /b-build-hard
goal: "Admit a scoped sql_memory tool into isolated buck-loop children via restricted SDK customTools, with stage policy on the shared gate/executor and bounded pool lifetime."
omp_execution: none
files:
  - extensions/sql-memory/index.ts
  - extensions/sql-memory/sql-gate.ts
  - extensions/sql-memory/db.ts
  - extensions/buck-loop/run-step.ts
  - extensions/buck-loop/types.ts
from_plan_steps: [1]
depends_on: []
dependency_type: NONE
acceptance_criteria:
  - "[x] Optional bound `values` on SQL ops; quotes in inputs/body remain data (contract tests)"
  - "[x] SQL-gate denial matrix passes: blocked writes/migrations denied in recall (read-only transaction) stages; save-stage allowlist enforced"
  - "[x] Restricted customTools injection in run-step.ts with allowRestrictedCustomTools:true + toolNames + restrictToolNames:true proven against the deployed OMP fork (live child SELECT works)"
  - "[x] Bounded pool with explicit lifetime handling; no ambient extension discovery or MCP"
  - "[x] b-commit child sees no sql_memory tool"
  - "[x] Configured OMP loop blocks on tool/DB failure; no silent file fallback"
completed_at: 2026-09-29
completed_by: operator-verified
---

# Phase 1: Tool contract and child seam

## Context

Parent User Goal: engineers share one remote PostgreSQL memory store across all projects — any OMP agent can store/recall project- and branch-scoped memories, replacing `.context/memory/` for new memories in `/buck-loop`. This phase builds the admission seam everything else depends on: getting the existing `sqlMemoryTool` into isolated loop children safely.

The OMP SDK (`can1357/oh-my-pi@33f887a`) admits restricted `customTools` only with `allowRestrictedCustomTools:true` and a matching `toolNames` entry; ambient extension discovery cannot safely grant `sql_memory` to children. Source ledger: `research/sources-omp-child-tools.md`. **Prove this on the deployed OMP fork before building on the seam.**

## Execution checkpoint

`SQL_MEMORY_URL` remains a shared, unverified target and MUST NOT receive test data. On 2026-09-29, a throwaway extension loaded by the deployed `omp` 18.4.3 process created a restricted child with `customTools: [sqlMemoryTool(pool)]`, `allowRestrictedCustomTools: true`, `toolNames: ["sql_memory"]`, `restrictToolNames: true`, and ambient discovery/MCP/LSP disabled. The child reported `PROOF_ACTIVE_TOOLS ["sql_memory"]`, called `sql_memory` once with `SELECT 7 AS proof`, and returned `{"rows":[{"proof":7}],"rowCount":1}` from a fresh loopback-only `pgvector/pgvector:pg18` PostgreSQL container. After implementation, an actual `runStep` `b-build-hard` child in a throwaway workspace under the deployed OMP RPC host invoked the scoped `sql_memory` adapter and returned `[{ proof: 7 }]` from a second disposable loopback PostgreSQL container. A third disposable database confirmed bound-value SELECT/UPDATE, recall transaction write rejection and rollback, save allowlist, and migration denial. All three containers were stopped and removed; proof processes overrode the shared SQL URL with the disposable URL. Focused tests (63 passed) and `env -u SQL_MEMORY_URL npm run guardrails:check` passed after the final SQL failure-callback repair. Phase 1 acceptance criteria are checked; the next loop stage is review, not another build. Do not repeat the standalone Pi SDK probe or use the shared endpoint for testing.

## Implementation Details

- Add optional bound `values` to the SQL op shape; all dynamic input becomes bind parameters.
- Extend the existing SQL gate/executor with stage role policy: build/review/iterate/docs/howto recall in DB read-only transactions; save stage may INSERT/UPDATE only memory/user/project rows (never `migrate`, never skill-weight mutation). `b-commit` gets no SQL.
- In `run-step.ts`, inject a scoped adapter of `sqlMemoryTool` as SDK `customTools` with `allowRestrictedCustomTools:true`, the tool name in `toolNames`, `restrictToolNames:true`. No ambient discovery, no MCP.
- Reuse a bounded connection pool with explicit lifetime handling across the child session.
- A configured OMP loop blocks on tool/DB failure — no file fallback.

## Risks

- **SDK version mismatch**: repo typechecks against `@mariozechner/pi-coding-agent`; deployed OMP admission differs. Live proof is a hard prerequisite; do NOT relax `restrictToolNames` or enable ambient discovery to work around a mismatch.
- Gate/executor changes must not break existing direct `xd://sql_memory` usage.

## Verification

- Contract tests: bound values, denial matrix incl. read-only transaction protection, stage allowlists, restricted admission.
- Live throwaway proof: an actual restricted OMP child executes a real `sql_memory` SELECT while `b-commit` sees no tool.
- `npm run guardrails:check` after the slice; LSP diagnostics on changed files.


[You have received this identical output 3 times. Re-reading '.context/2026-09-28.sql-memory-buck-loop/phase-1-tool-contract-child-seam.md:raw' will not change it — use a narrower selector (path:A-B), or proceed with the edit.]