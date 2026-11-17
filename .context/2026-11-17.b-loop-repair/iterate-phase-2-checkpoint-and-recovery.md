---
status: completed
date: 2026-11-17
updated: 2026-11-17
subject: 2026-11-17.b-loop-repair
topics: [review, iteration, checkpoints, recovery, b-loop]
informs: []
addresses: phase-2-checkpoint-and-recovery.md
completed: 2026-11-17
from_review: b-review
---

# Iteration: Phase 2 Checkpoint, Locking, Milestones & Recovery (`2026-11-17.b-loop-repair`)

## Source
- Reviewed after: `/b-build-hard` on `phase-2-checkpoint-and-recovery.md`
- Phase: `phase-2-checkpoint-and-recovery.md`

## Critical Issues

1. **Partial readback verification (`checkpoint.ts`)**: Verify cryptographic SHA-256 digest and full deep equality across every `LoopCheckpoint` field before accepting readback.
2. **Missing plan/phase drift checks & weak `completedPhaseCommits` cross-validation (`checkpoint.ts`, `recovery.ts`)**: Validate full checkpoint schema/enums, verify `planRevision`/`planSha256`/`phaseOrder` against `pinnedPlan`, require 40/64-char commit hashes, and cross-check `completedPhaseCommits` against `phases[name]` stage proofs (`build`, `review`, `save`, `commit.commitId`).
3. **Writer lock TOCTOU stale-reclaim race & concurrent unlock `ENOENT` (`checkpoint.ts`)**: Serialize stale-lock reclamation under a `.reclaim.lock` verifying `ownerId` still matches before unlinking, treat `ENOENT` on lock read as transient unlock race and retry acquisition, and always perform one final `tryAtomicLinkLock` attempt after reclaiming a dead lock.
4. **Recovery state-machine bugs (`recovery.ts`, `types.ts`)**: Fail closed when `commit` verifies without `commitId` and only record `completedPhaseCommits` for `commit`; bind recovery milestone strictly when `(phase, stage)` matches `(currentPhaseLogicalName, currentStage)`; persist `attemptId` across `resumeStarting` -> `finished` and `recordBlocker`; avoid mutating `session.checkpoint` prior to CAS persistence.

## Warnings & Nits

5. **Unconditional preflight checkpoint read (`eval-buck-loop.ts`)**: Always read existing checkpoint, call `assertCheckpointBinding`, and run `detectPlanCompletionGap` when running in preflight mode.
6. **PID reuse, symlink checks, & cleanup error safety (`checkpoint.ts`)**: Record Linux `/proc/<pid>/stat` start ticks in `WriterLockOwner`, reject symlinks with `lstatSync`, create temp files with `{ flag: "wx", mode: 0o600 }`, preserve primary errors on `release`, and surface non-`ENOENT` unlink failures safely.
7. **`checkpoint-cli.ts` branch-drift, `configPath`, symlinked `cwd`, pre-write validation & stdin payload**: Forward canonical `cwd`, `--branch-ref`, and optional `--config-path` to `checkpoint-cli.ts`; assert branch HEAD matches `--branch-ref`; validate JSON before `store.writeBatch`; read payload via nonce-delimited stdin (`--payload-stdin`) instead of CLI argv (`ARG_MAX`); verify full `readback.key` + `readback.sha256`.
8. **Missing test coverage & minor cleanups (`checkpoint.test.ts`, shared `shellQuote`, `dirname`, dead branches)**.

## Recommended Workflow

Fix all Critical, Warning, and Nit items cleanly via `/b-iterate`, verify tests + complexity + `tsc` + isolated Standards re-review + `npm run guardrails:check`, then save and commit Phase 2.
