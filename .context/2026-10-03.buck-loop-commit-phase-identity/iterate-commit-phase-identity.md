---
status: active
date: 2026-10-03
updated: 2026-10-03
subject: 2026-10-03.buck-loop-commit-phase-identity
topics: [review, iteration, commit-checkpoint]
informs: []
addresses: plan-commit-phase-identity.md
completed: null
from_review: b-review
---

# Iteration: Commit phase identity

## Source

- Reviewed implementation left by `/b-build` against `plan-commit-phase-identity.md`.
- Implementation checkout: `/tmp/buck-loop-commit-phase-identity`, branch `fix/buck-loop-commit-phase-identity`, baseline `b184c34ae00a686ac7410321b226951e24f6c30e`.
- The assignment checkout contains the authoritative plan and unrelated cleanup changes. Neither checkout's pre-existing implementation/index was adopted or modified by this review.
- Report: `review-commit-phase-identity-2026-10-03.md`.
- All findings below are in-plan defects. No production run was resumed.

## Critical Issues

### 1. Marker-backed restart changes phase and corrupts its own projection

- **File**: `extensions/buck-loop/persist.ts:160-175`; `extensions/buck-loop/loop.ts:359-375`.
- **Problem**: Scanning the marker's target still selects the next incomplete phase. The marker branch skips `keepCompletedProjectedPhase` without restoring `checkpoint.targetPath` as the active phase. A completed Phase 1/pending Phase 2 fixture reconciles to Phase 2 while retaining the Phase 1 marker. `confirmBlockedResume` persists that conflicting pair; `asCommitCheckpoint` subsequently rejects it. Public `handleLoop(... resume ...)` returned blocked, launched no worker, and made `readProjection()` return null.
- **Proposed fix**: Validate saved subject/plan/target ownership against disk, retain the exact checkpoint target while pending/blocked, and only publish the next phase with the durable verified-advance transition. Do not serialize an intermediate next-phase/old-marker pair. Add real-Git before/after-commit fresh-process restart regressions (AC-4/AC-5).

### 2. Resume calls USER_CONFIRMED for non-blocked states

- **File**: `extensions/buck-loop/loop.ts:359-375`.
- **Problem**: The original projection/snapshot `blocked` guards were removed. A saved `committing` checkpoint whose phase still matches the scan reaches `userConfirmed(snapshot)` although the machine only accepts that event from `blocked`. Public smoke throws `IllegalTransitionError: illegal transition committing -> committing (not-a-target)`. Other matching non-blocked states are exposed by the same call path.
- **Proposed fix**: Keep confirmation state-specific; explicitly reconcile interrupted committing into the planned recovery edge, or continue only through an appropriate legal transition. Recompute commit facts after that transition. Preserve ordinary non-commit resume behavior and add public recovery regressions (AC-4/AC-5/AC-8).

### 3. Existing commit plus dirt can invoke a second commit child

- **File**: `extensions/buck-loop/loop.ts:803-811,985-1026`.
- **Problem**: `verifiedCommit` collapses unchanged HEAD, advanced-but-dirty HEAD, divergent history, and Git errors into false. `runNestedSkill` treats every false as permission to prepare and rerun commit. Public smoke made a real Phase 1 commit, left `.context/late.md`, and returned child failure. Automatic retry ran another commit child; Git recorded two commits after the same immutable baseline. The supervisor only blocked afterward because HEAD was no longer a direct child.
- **Proposed fix**: Distinguish pending baseline from verified completion and unsafe/unknown outcomes. Authorize a commit effect only with positively observed unchanged baseline (or verified unborn state). Advanced HEAD with dirt, divergence, or failed probes must block without another child. Once intended dirt is resolved, reverify the original baseline idempotently (AC-6).

### 4. Baseline and marker validation do not establish the required evidence

- **File**: `extensions/buck-loop/loop.ts:985-1003`; `extensions/buck-loop/persist.ts:308-332`.
- **Problem**: `checkpointHead` turns any failed HEAD query into `baseHead: null` if a subsequent status command succeeds; that is not a positive unborn-HEAD check. Marker validation compares target only with saved phase/plan strings, not canonical subject/plan ownership or existing target membership; it accepts arbitrary hash lengths from 40 through 64. These are source-level violations of Step 2's fail-closed proof contract, independent of the broader Git-safety backlog.
- **Proposed fix**: Positively establish unborn HEAD versus probe failure, validate full commit object evidence, and validate canonical repository-relative checkpoint ownership against the saved subject and plan. Reject missing/lost/conflicting targets without selecting another phase. Preserve the marker on proof failure; do not reconstruct it (AC-6).

### 5. Missing-marker interrupted commits retain phase-completion shortcuts

- **File**: `extensions/buck-loop/persist.ts:167,202-217`; `extensions/buck-loop/loop.ts:359-363,400-409`.
- **Problem**: With no marker, `keepCompletedProjectedPhase` still synthesizes `sessionOutcome: ok / postcondition: confirmed` from phase completion even for interrupted committing. The resume hold only recognizes a final history entry whose `from` is committing, not a projection currently in committing with `saving -> committing` history. An interrupted markerless commit therefore has no explicit manual-recovery hold; the new marker-creation path can also create identity for an already-interrupted committing state. The literal blocked/Phase-2 fixture does hold, but that does not cover all required missing-marker shapes.
- **Proposed fix**: Make missing-marker interrupted commit reconciliation explicitly blocked with manual guidance, remove commit confirmation from the completed-phase shortcut, and create a marker only on a legitimate first commit entry before effects. Cover legacy committing, blocked-from-committing, malformed marker, and literal Phase-2 drift (AC-6/AC-7).

### 6. Runtime status still prescribes the old recovery contract

- **File**: `extensions/buck-loop/loop.ts:204-234`; `docs/howto/recover-buck-loop.md`.
- **Problem**: `recoveryFor` is unchanged. It does not identify the retained marker/baseline or distinguish verified/pending/legacy cases. The exercised legacy Phase-2 drift status explicitly recommended manually committing and then starting the saved Phase 2 path. Marker-backed failures get the same fresh-start advice rather than the planned explicit same-checkpoint resume. The edited how-to describes distinctions the command does not report.
- **Proposed fix**: Derive truthful status/recovery guidance from validated checkpoint identity and deterministic Git facts. Identify target and whether an existing commit is verified; offer explicit resume only for recoverable marker-backed cases and manual recovery for legacy/inconsistent ones. Keep docs aligned with exercised behavior (Step 5/AC-7/AC-10).

### 7. Required behavioral verification matrix is absent

- **File**: `extensions/buck-loop/__tests__/loop.test.ts`; `extensions/buck-loop/__tests__/persist.test.ts`; plan Steps 1, 5, 6.
- **Problem**: The implementation diff has no public supervisor regression additions; persistence tests add only null defaults. No test in the four planned suites exercises non-null `commitCheckpoint` or `baseHead`. The required refusal identity, crash-window, dirty/divergent history, SQL receipt-bound identity, and downgrade/manual-fallback rehearsals have no implementation evidence. `SQL_MEMORY_TEST_URL` is not configured; three existing SQL supervisor tests were skipped. A configured general SQL URL is not authorization to use its store as a disposable test database.
- **Proposed fix**: Implement the plan's real-Git public regression matrix and fresh-process before/after-commit smoke, plus pending-checkpoint rollback rehearsal. Use the existing disposable SQL test setup with `SQL_MEMORY_TEST_URL`; do not claim SQL identity/receipt coverage from skipped tests. Keep A-4 deferred with its validation path until exercised (AC-1 through AC-10).

### 8. Required deterministic gates fail

- **File**: `extensions/buck-loop/__tests__/persist.test.ts:34-48`; `extensions/buck-loop/loop.ts`; `extensions/buck-loop/persist.ts`.
- **Problem**: The persistence fixture lost required `loopCount: 3`, causing 12 focused-suite failures (340 passed / 3 skipped). The authoritative guardrails runner reports required unit/global-ratchet/complexity failures; coverage measurement failed, so coverage is unknown, not a measured regression. New complexity violations: `reconcile` 11, `normalizeProjection` 11, `asCommitCheckpoint` 11, `drive` 17, `runNestedSkill` 12, `rescan` 12. `drive` also breaches the hard ceiling of 15. `npm test` produced persistence failures and a SQL-save failure before timing out after 300 seconds; its Bun leg was not observed.
- **Proposed fix**: Restore the valid persistence fixture, address in-scope runtime defects, and refactor the actual checkpoint responsibilities to satisfy existing complexity limits. Do not soften the contract or remove behavior tests. Establish a stable complete-suite result, classify the untouched SQL-save failure separately, and rerun focused suites, npm test, and required guardrails after the coherent fix (AC-10).

## Warnings

- No independent OMP UI interaction was exercised; verification used the public `handleLoop` command seam with real scanner, persistence, machine, and temporary Git repositories. No native-model verdict was invented.

## Recommended Workflow

Run `/b-iterate` against this artifact, then re-run `/b-review` against `plan-commit-phase-identity.md`. The iteration is not done until its defects are addressed, review passes, and `/b-save` records durable state. Preserve the incident checkout's unrelated index/worktree and the original blocked production run. This review does not select a supervisor state.

## Iteration evidence — 2026-10-03

Implementation amendments are in `/tmp/buck-loop-commit-phase-identity`, not the incident checkout. Source records and this artifact remain in the assignment checkout. No production projection, receipt, cleanup phase, or unrelated changes were altered.

- Retained checkpoint ownership now wins restart scanning; interrupted committing reconciles through blocked recovery before USER_CONFIRMED. Intermediate next-phase/old-marker projections are no longer published.
- Git proof distinguishes pending baseline, verified direct-child completion, and unsafe/unknown history. Only pending permits a commit child; advanced-but-dirty, divergent, failed probes, and invalid baseline objects cannot repeat a commit.
- Marker parsing accepts only full 40/64-character object IDs and the saved active target. Disk reconciliation validates canonical subject/plan ownership and existing, non-symlinked paths. Missing-marker interrupted commits retain manual recovery rather than phase-completion proof.
- The first commit transition and choice-driven commit entry prepare the marker before effects; verified advancement releases it durably. Status reports target, baseline, and pending/verified/unsafe evidence. Stop preserves original projection history.
- Added public real-Git regressions covering refusal/index isolation, bounded failure/no-commit outcomes, two-phase success, both crash windows, dirty/divergent history, invalid/lost markers, failed Git evidence, legacy Phase-2 drift, manual fallback, stopped pending-checkpoint recovery, and valid/stale SQL receipt binding.
- Restored persistence fixture `loopCount: 3`. Checkpoint responsibilities were separated without weakening the complexity contract. Test fixture dependency types now use the public LoopDeps contract.
- Removed obsolete status-test wording/history-length assertions; preserved behavioral stop/status coverage. Added that exact test file to plan scope.
- Recovery docs and changelog match exercised status and no-second-commit behavior.

Verification: five focused suites **380 passed, zero skipped** with disposable SQL configured; fresh-process real-supervisor/real-Git smoke passed guard refusal plus before/after-commit restart (one commit after the baseline in each case). Assigned-file TypeScript probe reports **0 diagnostics**; project-wide diagnostics remain 151. Standalone Bun leg: **70 passed**.

**Still blocking:** `npm test` finishes its Vitest leg with **1495 passed / 2 failed** in untouched SQL surfaces: `sql-save.test.ts:91` expects the subject omitted by `saveDirective`, and `extensions/sql-memory/index.test.ts:267` rejects the existing `notice` field on correction reuse. Required guardrails unit/global-ratchet gates fail; coverage is unmeasured because its command fails. Complexity passes with no new or hard-ceiling violations. Lint/functional are disabled; patch is advisory. The plan expressly excludes SQL save directive changes, and no unrelated tests or source were weakened.

Iteration remains **active**: no completion claim, independent re-review, save receipt, commit, or supervisor-state selection. Full evidence and the exact external gate blockers are in `research-iteration-verification.md`.
