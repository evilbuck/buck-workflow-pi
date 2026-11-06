---
status: completed
date: 2026-10-12
updated: 2026-10-12
subject: 2026-10-10.durable-storage-adapters
topics: [review, iteration, storage, receipts, concurrency]
informs: []
addresses: phase-3-domain-semantics.md
completed: 2026-10-12
from_review: b-review
---

# Iteration: Phase 3 receipt initialization race

## Source
- Reviewed after: `/b-iterate`.
- Phase: `phase-3-domain-semantics.md`.
- Parent plan: `plan-durable-storage-adapters.md`, step 3, material risk 5.
- Baseline: HEAD `849ef5a63791a4ca3e2a131067481b862f16c179`; combined staged/unstaged current source and additive migration.
- Report: `review-phase-3-current-state-2026-10-12.md`.

## Critical Issues

### 1. PostgreSQL concurrent first writers can replace attempt-bound metadata requirements
- **File**: `skills/_shared/storage/postgres-store.ts` (lines 117–135), and bundled copy.
- **Problem**: `#lockedAttempt()` uses `SELECT ... FOR UPDATE OF r`. An absent `(project_id, run_id)` has no row to lock. Two real transactions can both observe null and pass `assertReceiptIdentity`. The later `ON CONFLICT` updates overwrite `artifact_run_duties.metadata_duties` without revalidating the committed predecessor. Concurrent calls with identical run/attempt/branch/worktree identity but duties `[probe, backlog]` and `[probe]` both fulfill, leaving only `[probe]`. A subsequent complete receipt succeeds without the initially declared backlog requirement. This defeats criterion 3 and the required-duty immutability guard under concurrency.
- **Current evidence**: direct Bun API smoke on disposable `pgvector/pgvector:pg18`. A barrier after each real absent-row SELECT ensured both transactions selected before insertion; no query results were mocked. Output: `outcomes:[fulfilled,fulfilled]`; persisted attempted duties `[probe]`; subsequent readback `status:complete`, duties `[probe]`. Sequential missing-duty refusal remains correct on all four adapters.
- **Proposed fix**: Serialize receipt initialization and updates on a stable project/run transaction lock before reading the attempt, including the absent-row case. Reuse the existing sorted advisory-lock pattern, with a distinct receipt namespace. Alternatively use insert-if-absent followed by locked reload and the same domain validation; never overwrite requirements based on a stale null result. Preserve exact scope/revision/readback checks and synchronize the bundle.
- **Regression verification**: Real PostgreSQL concurrent first writers for the same project/run must not both accept conflicting duty declarations; the winning requirement set must remain unchanged. Include a completion contender and verify a loser cannot downgrade a complete receipt or its obligations. Keep ordinary sequential row/no-fact completion and stale/mismatched identity cases green.
- **Classification**: In-plan implementation defect, phase acceptance criterion 3 and parent material risk 5. Not a new feature or Phase 4/5 caller-cutover requirement.


- **Jev failure**: Jev failed: missing, unreadable, or oversized file skills/_shared/storage/postgres-store.ts` (lines 117–135), and bundled copy.. Re-review this finding with Jev.

## Warnings
The previous re-review's malformed-subject discovery finding remains unchanged at `domain.ts:151–161`: discovery retains effective state but discards malformed provenance. The supervisor's existing ranking placed that finding below waterline. This artifact does not re-rank or re-add that previously filtered issue to the required iteration scope; it makes no claim that it was fixed.

## Recommended Workflow
Start with `/b-iterate` for the receipt race, then re-run `/b-review` against `phase-3-domain-semantics.md`. Complete this artifact after verified implementation before returning. The supervisor alone owns phase/loop state, ranking, save, and commit. No source, phase status, or pre-existing artifact was changed by this review.

## Resolution and verification

- `postgres-store.ts` and its bundled copy now acquire a transaction advisory lock in the distinct `receipt` namespace, keyed by project/run, before selecting the attempt. The lock covers absent-row initialization, validation, writes, readback, and commit.
- Canonical and bundled PostgreSQL tests add real-query scheduling fixtures for conflicting first declarations and an attempted contender against completion; no database rows are mocked.
- Targeted PostgreSQL suite: 24 passed. Final targeted concurrency run: 2 passed, 22 skipped.
- Mutation check: removing the receipt advisory lock makes the first-writer regression fail because the conflicting contender fulfills; restored implementation passes.
- Direct Bun API smoke: 20 real PostgreSQL races each admitted exactly one conflicting first writer, retained its duties, and rejected both late attempted writers after completion. Throwaway smoke removed.
- Final isolated `npm run guardrails:check` on disposable PostgreSQL: durable v2 pass; unit, ratchet, patch, and complexity pass; coverage 90.1%; lint and functional gates skipped by contract.
- An intermediate guardrails/targeted-suite overlap failed because both suites delete the same `fixture-project` rows. Final verification used a separate database and passed without changing tests or gates.
- Updated `docs/context-artifacts.md` and the existing draft commit. No phase, lifecycle, loop, backlog, or unrelated workflow state changed; the below-waterline discovery warning remains unchanged.
- Supervisor: re-run `/b-review` against `phase-3-domain-semantics.md`; supervisor owns save and commit.
