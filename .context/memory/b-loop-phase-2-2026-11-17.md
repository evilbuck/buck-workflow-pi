---
date: 2026-11-17
domains: [b-loop, checkpoints, recovery, locking, storage]
topics: [b-loop, private-checkpoint, cas-readback, writer-lock, milestones, recovery]
related: [.context/2026-11-17.b-loop-repair/phase-2-checkpoint-and-recovery.md, .context/2026-11-17.b-loop-repair/plan-b-loop-repair.md]
priority: high
status: completed
subject: 2026-11-17.b-loop-repair
artifacts:
  - phase-2-checkpoint-and-recovery.md
  - review-phase-2-checkpoint-and-recovery.md
  - iterate-phase-2-checkpoint-and-recovery.md
---

# Memory: Phase 2 — `/b-loop` Private Checkpoint, Writer Lock, Milestones & Recovery

## Summary

Completed Phase 2 of `.context/2026-11-17.b-loop-repair/plan-b-loop-repair.md`, implementing versioned per-`(subject, branch, worktree)` private checkpoints backed by `RepoFilesStorageStore` (`FileStorageStore`), serialized writer locking, shared four-stage/phase milestones with blockers, and proof-driven recovery.

## Key Decisions & Implementation

- **`skills/b-loop/scripts/checkpoint-cli.ts`**: Reuses `resolveTrustedContext` + `withBoundStore` + `consumers.ts` run-private scope (`kind: "checkpoint"` with `worktreeId` + `runId` so `FileStorageStore` stores privately under `manifestRoot/private/`, never touching `.context/`). Canonicalizes `cwd`, asserts live `git symbolic-ref --quiet HEAD === branchRef`, reads payload via stdin (`--payload-stdin json`, avoiding `ARG_MAX`) and validates JSON before `store.writeBatch`, enforces `--expected-revision` CAS, and verifies `readback.key` + `sha256` before returning.
- **`skills/b-loop/scripts/checkpoint.ts`**:
  - `persistCheckpointWithReadback`: enforces CAS and full SHA-256 (`checkpointDigest`) + canonical deep-equality readback before downstream side effects.
  - `assertCheckpointBinding`: verifies schema enums (`LoopStage`, `Milestone`), bound `(subjectId, branchRef, worktreeRoot)`, and pinned `planLogicalName`/`planRevision`/`planSha256`/`phaseOrder`.
  - `acquireWriterLock`: atomic `linkSync` over `O_EXCL` temp file, Linux `/proc/<pid>/stat` start-tick checks to catch recycled PIDs, `lstatSync` symlink rejection, `.reclaim` serialized stale cleanup verifying `ownerId`, and transient `ENOENT` retry handling so live concurrent writers yield safely.
  - `derivePhaseMilestone`, `formatStageProgress`, `emitLoopProgress`: emits `Phase N · <starting|working|finished|verified>` and `Phase N · b-<stage> <milestone> [· blocked]`.
- **`skills/b-loop/scripts/recovery.ts` & `eval-buck-loop.ts`**:
  - Unconditional preflight checkpoint read (`assertCheckpointBinding` + `detectPlanCompletionGap`), failing closed on completion-checkbox / commit-proof gaps or unreachable/40-char-invalid commits.
  - Drives `starting` -> `working` -> `finished` -> `verified` transitions with CAS persistence at every transition, handling `starting`/`working`/`finished`/`verified` recovery and requiring `commitId` on `commit` verification.

## Verification

- `npx vitest run skills/b-loop/scripts/` (`checkpoint.test.ts` + `eval-buck-loop.test.ts`): 21/21 passed (including symlink `cwd`, branch-drift, digest/proof tampering, PID-reuse/symlink locks, all milestone recovery branches, multi-phase recovery, and `A-4` real `omp` eval worker).
- `lizard -C 10 -w skills/b-loop/scripts/*.ts`: 0 complexity warnings.
- `npx tsc --noEmit`: 0 errors in `skills/b-loop/`.
- Isolated Standards Re-Reviewer (`804504d8`): 0 Critical, 0 Warning (2 non-blocking nits noted).
- `npm run guardrails:check`: `status: "pass"`, `coverage: 88.3%` (`baseline: 84`), `hotspots_remaining: 27`, 0 new violations.
- `npm run subject-lifecycle:check`: `{"ok":true,"violations":[]}`.
