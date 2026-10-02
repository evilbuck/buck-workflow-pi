---
status: completed
date: 2026-10-01
updated: 2026-10-01
subject: 2026-10-01.sql-memory-remember-op
topics: [review, iteration, judgment, sql-memory]
informs: []
addresses: plan-sql-memory-remember-op.md
completed: 2026-10-01
from_review: b-review
---

# Iteration: Jev-classified in-plan gaps

## Source

- Plan: `plan-sql-memory-remember-op.md`.
- Assessment: `research-jev-warning-severity.md` (native `jev-1.13.0`; probabilities and uncertainty recorded).
- This is a new iteration. Do not reopen or overwrite the completed `iterate-sql-memory-remember-op.md`.
- No source changes or live database reproduction were performed during severity classification.

## Critical Issues

### 1. Active-category validation uses a static seed list

- **File:** `extensions/sql-memory/remember.ts:5-15,89-96`; `extensions/sql-memory/columns.ts:70,123-124`.
- **Problem:** Plan step 3 requires rejecting unknown/non-active categories and listing active slugs from `categories` inside the tool. The current static map accepts a seeded slug even if its table status becomes `candidate`, and rejects a new active slug. Matching migration seeds is not dynamic status enforcement.
- **Proposed fix:** Resolve the requested/default category against active database rows before memory insertion. Generate the category-error fix from the actual active slugs, without instructing the model to query them. Add behavioral tests for candidate rejection and a newly active slug accepted; preserve unknown-category rejection and the default project category contract.
- **Jev:** major-in-plan, probability 0.97, confidence 0.96.

### 2. Required idempotency validation is not exercised by repeated calls

- **File:** `extensions/sql-memory/remember.test.ts:169-190,235-285`.
- **Problem:** The existing-id test supplies a pre-existing id and makes one call. It does not establish that two identical calls produce one persisted row and the same id. The two-body test unconditionally reports no source-key match and increments returned ids; it cannot detect identical source keys for different bodies. Correction linkage is exercised once, not retried.
- **Proposed fix:** Use a stateful store fixture that resolves source-key lookups from stored context and active status. Make two identical fresh calls and assert the same id plus one memory insertion; make two distinct-body calls and assert their persisted bodies/source keys remain separate. Retry an identical previousId correction and assert one successor, unchanged predecessor body, and preserved invalidation/linkage. Do not implement the previously disproven bypass allegation: the source-key lookup already precedes the previousId branch.
- **Jev:** major-in-plan verification gap, probability 0.82, confidence 0.77. This finding is not evidence of a runtime retry bug.

## Warnings

### 1. Required missing-identity zero-write assertion is absent

- **File:** `extensions/sql-memory/remember.test.ts:192-204`; `extensions/sql-memory/identity.test.ts:28-40`.
- **Problem:** Plan material-risk validation path 65 requires a throwing git runner and zero inserts. Existing tests assert rejection but not absence of database mutations. Correct source ordering is not the requested executable validation.
- **Suggested approach:** Call the actual remember entry point with missing email, missing origin, and a throwing runner, retaining a database command log; assert rejection and zero inserts. Keep verification behavior-oriented rather than pinning incidental query spelling.
- **Jev:** minor-in-plan verification gap, probability 0.68, confidence 0.58.

## Exclusions

- Concurrent max(seq)+1 allocation stays in its prior explicitly deferred `/b-plan` follow-up. Jev classified it major but out-of-plan.
- Optional explicit retry-collapse wording remains an uncertain minor documentation warning, not the basis of this iteration's blocking disposition.
- No demonstrated new secret leak from raw driver messages; prior baseline already returned raw error.message.
- Repeated advice text is a nonblocking nit. The alleged previousId bypass, unused subject argument, and docs line-11 contradiction are dismissed against current source.

## Recommended Workflow

Run `/b-iterate`, then `/b-review` against `plan-sql-memory-remember-op.md`. Run the project's deterministic check contract after the coherent edit batch, plus the behavioral scenarios above. Do not advance to save/commit readiness on the previous Pass-with-warnings verdict.


## Resolution

All Jev-classified in-plan gaps are fixed and reviewed. Active categories come from current database rows; error fixes list current legal slugs. Stateful repeated fresh/correction tests prove one logical insertion per key, distinct bodies, immutable predecessor linkage, and zero queries/writes on missing or throwing git identity. Tool, docs and canonical/bundled skill explain identical-input collapse.

Verification and completion matrix: [review-jev-fixes.md](review-jev-fixes.md). SQL-memory suite: 114 passed, 1 skipped. Durable guardrails pass; real PostgreSQL connection-local TEMP-table tool smoke passes; independent standards review approves. Draft commit refreshed; no commit made. Formal /b-save then /b-commit checkpoint remains next. Prior completed iteration and subject lifecycle left unchanged.
