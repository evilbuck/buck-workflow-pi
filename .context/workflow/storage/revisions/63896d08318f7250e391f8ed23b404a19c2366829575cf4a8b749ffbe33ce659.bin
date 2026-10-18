---
status: completed
date: 2026-09-29
updated: 2026-09-29
subject: 2026-09-28.sql-memory-buck-loop
topics: [review, iteration, sql-memory, buck-loop]
informs: []
addresses: phase-1-tool-contract-child-seam.md
completed: 2026-09-29
from_review: b-review
---

# Iteration: Phase 1 SQL tool contract and child seam

## Source
- Reviewed after: `/b-build-hard`
- Phase: `phase-1-tool-contract-child-seam.md`
- Plan: `plan-sql-memory-buck-loop.md`

## Critical Issues

### 1. Save child can modify user skill weights
- **File**: `extensions/sql-memory/sql-gate.ts:38-55`
- **Problem**: The save role checks only the target table, so `UPDATE users SET skill_weight = 100 WHERE email = $1` is accepted. The phase explicitly forbids skill-weight mutation in loop children; `users.skill_weight` is a real mutable column in `migrations/001_initial_schema.sql:14-17`. A direct `bun` gate probe returned `{allowed:true}`.
- **Proposed fix**: Reject writes to `users.skill_weight` in the save policy, including qualified assignments; test both rejected weight mutation and allowed user identity insert/update through the tool executor. Keep the unrestricted direct `sql_memory` contract unchanged.

### 2. SQL pool cleanup can bypass child disposal and result contract
- **File**: `extensions/buck-loop/run-step.ts:472-486`
- **Problem**: `await pool.end()` runs in `finally` before `session.dispose()`. If pool shutdown rejects, `runOneSession` rejects before disposing the child and before returning `{retain,result}`; this violates explicit pool/session lifetime handling and can escape the supervisor's ordinary stage-failure result path.
- **Proposed fix**: Dispose the child and close the pool in independently guarded cleanup so either failure still attempts both cleanups; preserve the primary stage failure and return a failed stage result on shutdown failure. Add a deterministic fake-pool teardown-failure case to the child-session tests.

## Warnings

### 1. Qualified save targets are refused despite the general gate allowing them
- **File**: `extensions/sql-memory/sql-gate.ts:50-53`
- **Problem**: `INSERT INTO public.memories (...) VALUES (...)` passes `checkSqlStatement` but fails the save-stage target check because it compares the first relation token (`public`) to the table allowlist. This is an interoperability limitation for the same permitted public table.
- **Suggested approach**: Reuse the existing relation parser to resolve the public-qualified target, and test both qualified allowed tables and non-public denial.

## Recommended Workflow

Start with `/b-iterate` on this phase, then re-run `/b-review` against the same phase. The active `/buck-loop` child must stage only its own files; other staged work predates this review.

## Resolution

- Save-role writes to `users.skill_weight` (including quoted and qualified assignments and explicit inserts) are denied before connecting. Identity writes and `public`-qualified allowlisted targets remain permitted.
- Nested session disposal and SQL pool shutdown both run even if either fails. Shutdown failure returns a failed stage; an existing stage failure remains primary.
- Focused SQL/child tests: 73 passed. Durable guardrails: required unit, coverage ratchet, and complexity gates passed (88.3% coverage at the coherent check before the quoted-identifier regression was added). Re-run review against this phase before save/commit.
