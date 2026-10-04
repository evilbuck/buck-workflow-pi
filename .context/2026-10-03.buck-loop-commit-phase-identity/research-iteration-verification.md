---
status: active
date: 2026-10-03
subject: 2026-10-03.buck-loop-commit-phase-identity
domains: [runtime, testing, docs]
topics: [commit-checkpoint, restart-recovery, sql-receipts, guardrails]
related: [plan-commit-phase-identity.md, iterate-commit-phase-identity.md]
informs: [plan-commit-phase-identity.md]
---

# Commit-identity iteration evidence

## Disposition

Runtime fixes and focused verification are implemented in `/tmp/buck-loop-commit-phase-identity` on `fix/buck-loop-commit-phase-identity`. Closeout remains blocked by two untouched SQL test failures. The iteration stays active; no commit, save receipt, production resume, or next supervisor state was selected.

## Files amended in the repair worktree

- `extensions/buck-loop/loop.ts`: legal blocked recovery, checkpoint preparation at normal/choice commit entry, pending/verified/unsafe Git proof, target release only at durable confirmed advance, evidence-specific status, original history on stop, separated checkpoint responsibilities.
- `extensions/buck-loop/persist.ts`: authoritative retained target, canonical disk ownership, full object-id validation, interrupted missing-marker manual hold, no phase-completion shortcut for interrupted committing, split reconciliation responsibilities.
- `extensions/buck-loop/__tests__/loop.test.ts`: real-Git public regression matrix and public dependency typing.
- `extensions/buck-loop/__tests__/persist.test.ts`: restore required fixture loopCount.
- `extensions/buck-loop/__tests__/wire-status.integration.test.ts`: remove obsolete command-wording/history-length assertions, retain behavioral status and stop checks.
- `docs/buck-workflow.md`, `docs/howto/recover-buck-loop.md`, `docs/howto/resume-buck-loop-after-repair.md`, `docs/CHANGELOG.md`: evidence-specific recovery and no-second-commit contract.

Existing staged `types.ts`, `machine.ts`, `scan.ts`, and machine/scan test edits were inherited from the prior implementation; this iteration did not modify or restage them. The incident checkout's unrelated index/source/workflow state was preserved. Plan scope adds the exact status integration test rather than a broad directory prefix.

## Exercised evidence

- Focused Vitest: loop/persist/scan/machine/wire-status integration — **380 passed, zero skipped**. SQL_MEMORY_TEST_URL pointed only to a disposable Docker PostgreSQL 18 + pgvector database initialized with `migrations/001_initial_schema.sql`. No shared database was used. The container was removed afterward.
- Regression cases: initial out-of-scope refusal and index preservation; failed/no-commit children; successful two-phase ordering and exactly two real commits; before/after-commit recovery; advanced HEAD plus dirt/divergence; post-commit child failure without second child; malformed/conflicting/lost target; unknown base and broken HEAD; literal legacy Phase-2 drift; manual checkpoint resolution; stopped pending-marker resolution before replacing the run; valid/stale receipt binding; pending/verified/unsafe status evidence.
- Fresh-process Bun smoke: real handleLoop, scanner, persistence, machine, and Git; only the external worker boundary was controlled. A first process refused unrelated dirt without a worker or phase drift; unrelated fixture content was preserved separately; the next process committed Phase 1 before Phase 2 build. A separate after-commit/before-projection window advanced without a commit child. Both produced exactly one commit since their immutable baseline. Disposable repositories and scripts were removed.
- TypeScript compiler API against project configuration: **0 diagnostics in assigned source/test files**, **151 project-wide diagnostics**. No blanket project-wide typecheck success is claimed.
- `npm test` final Vitest leg: **1495 passed / 2 failed**, **86 passing files / 2 failing files**. Because the command uses `&&`, Bun did not run through npm test. Standalone `npm run test:bun`: **70 passed / 0 failed**.
- Authoritative guardrails: required complexity passes with **no new violations and no hard-ceiling violations**. Required unit/global-ratchet fail; coverage command exits 1, so coverage is **unknown**, not a measured regression. Lint and functional gates are disabled/skipped; patch is advisory. No contract thresholds, baselines, ignores, or enforcement states were changed.
- Actual OMP UI was not exercised. Fresh Bun processes exercise the public supervisor seam; a fresh OMP process is still required before loading these imported extension changes in production.

## Remaining external gate blockers

1. `extensions/buck-loop/__tests__/sql-save.test.ts:91`: expects `subject:` in `saveDirective`; the repair base's unchanged `sql-save.ts` omits it. The supplied plan explicitly excludes SQL save directive/protocol changes and this checkout must not absorb the incident checkout's separate SQL-save repair.
2. `extensions/sql-memory/index.test.ts:267`: correction reuse returns `{ id, notice }`; the untouched test expects exactly `{ id }`. This unrelated SQL-memory surface is outside the declared repair scope.

No unrelated test was deleted or repinned to turn the gate green. The supervisor must resolve these independently or supply explicit authority for the affected work/required-gate override. Re-review against this same plan remains required; b-save/b-commit are not authorized by this iteration result.

## Abandoned approaches

- Boolean-only commit verification: unsafe advanced/dirt outcomes must not authorize another child. Replaced with a bounded pending/verified/unsafe proof.
- Scanner-selected next phase during checkpoint ownership: creates conflicting serialized identity. Retain the checkpoint target until the verified advance is persisted.
- Calling USER_CONFIRMED on a saved committing state: violates the compiled machine edge. Reconcile the interrupted checkpoint into blocked recovery first.
- Plain PostgreSQL 17 test image: lacks vector and uuidv7 support required by the canonical migration. Used disposable PostgreSQL 18 + pgvector instead; no production schema was changed.
