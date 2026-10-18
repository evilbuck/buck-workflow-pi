---
status: completed
date: 2026-10-04
subject: 2026-10-03.buck-loop-commit-phase-identity
topics: [review, commit-checkpoint, restart-recovery]
addresses: plan-commit-phase-identity.md
review_verdict: needs-work
implementation_checkout: /tmp/buck-loop-commit-phase-identity
iteration: iterate-commit-phase-identity.md
---

# Plan Path Review: Preserve Buck-loop commit phase identity

## Verdict

**Needs work.** A stopped retained checkpoint is not a safe continuation. Stopping directly from `committing` tells the operator to start that phase path; doing so drops the marker and selects Phase 2 while Phase 1 is still uncommitted. Required guardrails also fail on this base. No supervisor state was selected.

## Plan Source

- File: `.context/2026-10-03.buck-loop-commit-phase-identity/plan-commit-phase-identity.md`
- Goal: keep the unfinished commit target and Git baseline authoritative until a real verified commit, then advance exactly once.
- User goal: retry or restart a failed phase commit without starting the next phase, duplicating a commit, or including unrelated work.
- Baseline: repair worktree `fix/buck-loop-commit-phase-identity` at `b184c34`, staged cutover only. Assignment checkout `chore/cleanup-skills` at `cca1691` has no implementation diff.
- Research followed: `research-commit-phase-identity.md`. No spec. No phases. Decision-closure protocol applied.

## Evidence Sources

- Repair checkout: 14 staged files, 558 insertions / 116 deletions, no unstaged implementation diff. Reviewed staged source, not the assignment branch.
- Changed files match the plan list plus `extensions/buck-loop/__tests__/wire-status.integration.test.ts`, which the plan said to declare before checkpoint and was not added to `files:`.
- Prior iteration claims were re-checked against current source and fresh runs. They are not treated as proof.
- No `sql_memory` call. Supplied recall was reference only.

## Completion Matrix

| Plan deliverable | Status | Evidence / missing piece |
|---|---|---|
| User goal / goal | partial | Refusal, retry, blocked resume, and crash-window tests retain Phase 1. Stop-from-committing status starts a new run, clears the marker, and lands on Phase 2. |
| Scope / affected files | partial | Runtime and docs stay inside the repair. `wire-status.integration.test.ts` changed and is not in `files:`. |
| Step 1: public failure regressions | complete | `loop.test.ts` commit-checkpoint describe: refusal, failed/lying child, index isolation. Focused suite 375 passed. |
| Step 2: persist checkpoint before effects | complete | `prepareCommitTransition` writes the marker before `prepareCommitCheckpoint`. Full 40/64 object ids. Probe failure is not an unborn baseline. |
| Step 3: pin until confirmed proof | complete | `retainedPhase` plus pending/verified/unsafe proof. Dirty or divergent advanced HEAD does not launch another child. Clean direct-child advances once. |
| Step 4: explicit recovery transitions | complete | Blocked marker resume uses `USER_CONFIRMED` to committing. Legacy missing-marker stays blocked. Ambiguous commit cannot advance by choice. |
| Step 5: operator contracts | missing | Blocked and live committing status name the checkpoint. Aborted status does not give a legal continuation. See iteration issue 1. |
| Step 6: coherent checks | missing | Required unit and global-ratchet gates fail. Coverage was not measured. |
| AC-1 | complete | Refusal test retains Phase 1, baseline, and unrelated bytes/index. No Phase 2 worker. |
| AC-2 | complete | Failure and no-commit children stay on the same target/baseline and do not advance. |
| AC-3 | complete | Two-phase start produces two commits and `done` with a null checkpoint. Phase 2 build sees one commit since baseline. |
| AC-4 | complete | Fresh `handleLoop` resume of committing and blocked fixtures runs Phase 1 `b-commit` before any Phase 2 work. |
| AC-5 | complete | Crash-completed clean checkpoint resumes to Phase 2 with no commit child and an unchanged commit count. |
| AC-6 | complete | Dirty, diverged, lost, malformed, unknown-base, broken HEAD, and conflicting target hold without a worker. Clearing only the late file then verifies without a second commit. |
| AC-7 | complete | Literal Phase 2 drift without a marker stays blocked, launches no worker, and the manual-commit-then-start sequence is the only continuation the test permits. |
| AC-8 | partial | Machine tests deny model advance of ambiguous commits. Ordinary non-commit choice remains. Stop/resume of an aborted checkpoint does not preserve the recovery contract. |
| AC-9 | complete | File-mode matrix passed. Disposable PostgreSQL 18 + pgvector, migration 001, loopback only: valid and stale marker-backed receipt cases passed. No shared database. Unphased closeout tests remain in the focused suite and passed under the broader filter. |
| AC-10 | missing | Focused suites passed. Required guardrails failed. Recovery docs still tell a stopped operator to start the shown path. No production projection, receipt, or cleanup-phase status was mutated. |
| Blocking assumptions | complete | A-1, A-2, A-3 remain validated. A-4 validated by the disposable receipt run above. None are blocking. |
| Material fallback: stop, manual commit, start next | missing | The safe manual sequence exists in a test, but status after stop-from-committing recommends the unsafe start before that commit. |
| Material rollback with a pending marker | missing | Same stop guidance. Following it replaces the projection before the operator resolves the checkpoint. |

## Review Axes

### Spec / acceptance-contract axis

Worst finding: **stopped committing status recommends a fresh start that drops the retained checkpoint and selects Phase 2** (`loop.ts` `stoppedStatus` / `recoveryFor`; observed in a fresh Bun process on branch `loop-work`).

Additional in-plan finding: required guardrails fail on an unchanged SQL-save assertion. Do not repair that assertion inside this commit.

Prior iteration defects (projection drift, illegal `USER_CONFIRMED` on committing, second commit child, weak baseline parsing, phase-completion shortcut, blocked-status wording, missing public matrix, complexity ceiling) are closed in the current staged source. Do not reopen them.

### Standards axis — sequential fallback

No task/sub-agent tool was available. After the acceptance pass, a separate standards pass used `code-review-universal/reference/typescript.md`, `code-quality-universal.md`, `code-review-best-practices.md`, and the diff-scoped smells Long Method, Temporary Field, and Duplicate Code.

Worst finding: **none**. Complexity gate passed with no new violations and no hard-ceiling violations. `commitCheckpoint` is required durable state, not a temporary field. `commitProof`'s catch-to-`unsafe` is the plan's fail-closed contract, not a swallowed success. `loop.ts` remains a pre-existing large file; this cutover extracted checkpoint responsibilities rather than growing `drive`.

Cross-axis ranking: **none**.

## Exercised Verification

1. Focused Vitest without SQL: 5 files, **375 passed / 5 skipped**. The skips are the `SQL_MEMORY_TEST_URL` cases.
2. Disposable `pgvector/pgvector:pg18` on loopback, migration `001_initial_schema.sql`, container removed afterward. `binds marker-backed recovery to a valid SQL receipt` and `... stale SQL receipt` **passed**. No credential printed. No shared database used.
3. `npm run guardrails:check` in the repair worktree: durable v2, **fail**. Unit exit 1. Coverage command exit 1, so coverage is unknown. Complexity pass.
4. Fresh Bun process, non-protected `loop-work` branch, real `handleLoop` / Git / persistence:
   - Stop from `committing`: reason was `Run stopped. To continue, run /buck-loop .context/2026-09-18.demo/phase-1-p1.md.` Marker still present.
   - Following that start: result blocked on a failed build retry; projection `phasePath` became Phase 2; `commitCheckpoint` became null. Phase 1 had not been committed.
   - Stop from blocked-with-marker: status names the checkpoint and says `Run /buck-loop --resume`. Resume returns `aborted` and repeats that advice. Marker remains, but the recommended command does not continue the checkpoint.
5. `sql-save.ts` and `sql-save.test.ts` have an empty diff against the repair base. The failing assertion is pre-existing there.

## Guardrails Verdict

- Contract: **durable**, version **2**, runner **1.0.0**.
- Status: **fail**. Code-bearing review, not docs-only.
- `unit_test_gate=fail` (required), `functional_test_gate=skipped` (disabled), `lint_gate=skipped` (disabled), `patch_gate=advisory`, `global_ratchet=fail` (required), `complexity_gate=pass` (required).
- Diagnostic: `coverage command failed (exit 1)`. Current and patch coverage null. Baseline remains 84. This is missing measurement, not a quantified coverage regression.
- Unit tail: `extensions/buck-loop/__tests__/sql-save.test.ts:91` expected `subject:` in `saveDirective`. 1 failed, 1488 passed, 8 skipped. `npm test` and the Bun leg were not run after this failure; the unit gate already failed.

## Verification Status / User Goal Analysis

- Goal achieved: **partial**.
- Met: marker-backed retry, blocked resume, crash windows, unsafe Git holds, legacy drift hold, SQL receipt binding, one commit per successful phase.
- Missing: truthful aborted-checkpoint continuation; required gates on this base.
- User goal verdict: **partially met**.
- Scope adhered, with the undeclared status-test edit noted above. No unrelated implementation was adopted.

## Documentation Impact

- How-to step 3 still says to start the path shown after every stop. That matches the unsafe runtime advice and contradicts the retained-checkpoint contract.
- Non-blocking as a docs-only signal, but the wording is part of in-plan issue 1 and must change with the runtime fix. Run `/b-docs` only after that fix if a convention remains unrecorded.

## How-to Impact

- No new procedure. The existing recovery how-to is the right file and currently gives the wrong stopped-checkpoint action. Correct it inside the iteration, not as a separate `/b-howto`.

## Issue Classification

- In-plan: stopped-checkpoint guidance drops or stalls identity; required gates fail on this base. Recorded in `iterate-commit-phase-identity.md`.
- Out-of-plan: `saveDirective` omitting `subject:` is unchanged SQL-save behavior. Do not edit it in this repair. The assignment checkout at `cca1691` already includes `subject:` in the directive; use that as base evidence, not as permission to cherry-pick the SQL change into this commit.

## Completion Audit

1. Objective: retain unfinished target/baseline, prove one real commit, recover idempotently, and give truthful guidance.
2. Evidence: acceptance rows cite tests or the fresh Bun stop/start observation.
3. Current staged source was read. Authoritative guardrails were run and failed.
4. Public `handleLoop` seam and real Git were exercised. OMP UI was not.
5. The stop/start result is observed, not inferred. Prior iteration notes were not used as proof.
6. Review is not truncated. Needs work is the implementation result, not an incomplete review.

## Recommended Next Step

Repair only the two in-plan defects in `/tmp/buck-loop-commit-phase-identity`, then re-review this same plan. Do not resume the original blocked cleanup run and do not select a supervisor state from this review.
