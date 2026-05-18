---
date: 2026-05-18
domains: [implementation, orchestration, testing]
topics: [b-flow, autonomous, guardrails, stagnation, cancellation, recovery, xstate]
subject: 2026-05-18.buck-loop
artifacts: [phase-4-guardrails-recovery.md, plan-autonomous-b-flow-loop-phases.md, draft-commit.md]
related: [buck-loop-phase-3-lifecycle-2026-05-18.md, b-flow-unit-tests-2026-05-09.md, b-flow-mvp-2026-05-09.md]
priority: high
status: completed
---

# Session: 2026-05-18 - Buck loop phase 4 guardrails recovery

## Context
- Executed Phase 4 from `.context/2026-05-18.buck-loop/plan-autonomous-b-flow-loop-phases.md` via `/b-build`.
- Built on the explicit per-phase lifecycle actor from Phase 3.
- Goal: add conservative blocking guardrails for autonomous execution safety.

## Decisions Made
1. **Guard helpers are pure functions** — stagnation, fingerprint counting, no-source-change detection, and block reason counting are all pure functions in guards.ts for testability.
2. **Stagnation guard fires before reviewNeedsIterate** — in processingReviewResult, the stagnation check runs after reviewBlocked but before reviewNeedsIterate, so a stagnating issue fingerprint or max-iteration breach blocks before entering another iterate cycle.
3. **Issues without iterate file are blocking, not requires-replan** — ambiguous review results (issues found but no iterate_file) now block with a parseError explaining the missing field, rather than auto-routing to requires-replan.
4. **Worker PID persisted on spawn** — onSpawn callback updates the projection's active.workerPid for STOP cancellation tracking.
5. **PAUSE blocks during active worker** — the /b-flow pause command checks for an active workerPid and warns the user instead of transitioning to paused state.
6. **STOP attempts SIGTERM on worker PID** — killWorkerPid sends SIGTERM; if it fails, the reconciliation state is preserved in the projection for manual recovery.
7. **Block reason history on queue items** — every blocked/failed transition appends the reason to the queue item's blockReasonHistory, enabling the repeated-reason guard (3+ same reason blocks).
8. **Phase boundary safety uses git status + result changed_files** — before starting a new phase, checks for unattributed source changes by comparing git status against the previous completed phase's result changed_files.
9. **Iterate artifact non-advancement check** — after iterate completes, if the active iterate artifact's status is still "active", the machine blocks.

## Implementation Notes
### Changed Files
- `extensions/b-flow/guards.ts` — added sourceChangedFiles, countConsecutiveIssueFingerprints, countConsecutiveNoSourceChangeIterations, countConsecutiveBlockReasons.
- `extensions/b-flow/chunk-queue-machine.ts` — integrated guard checks into processingReviewResult (stagnation), processingIterateResult (non-advancement), all blocked transitions (block reason history), checkingPhaseBoundarySafety (git safety, iterate conflict), and worker PID tracking via onSpawn.
- `extensions/b-flow/verify-result.ts` — added changedFiles, iterateArtifact, iterateStatus to VerificationResult; added parseError to ReviewResult for ambiguous/incomplete review results; issues without iterate file now blocking instead of requires-replan.
- `extensions/b-flow/worker.ts` — added onSpawn callback, killWorkerPid export.
- `extensions/b-flow/scan-context.ts` — exported readGitContext, IterateScanResult, scanActiveIteratesForSubject.
- `extensions/b-flow/types.ts` — added parseError to ReviewResult, changedFiles to IterationRecord, blockReasonHistory to ChunkQueueItem.
- `extensions/b-flow/persistence.ts` — normalizes iterations and blockReasonHistory arrays on load.
- `extensions/b-flow/index.ts` — STOP kills worker PID; PAUSE blocks during active worker.
- `extensions/b-flow/__tests__/machine.test.ts` — added guardrail tests: max iterations, fingerprint stagnation, repeated block reasons.
- `extensions/b-flow/__tests__/guards.test.ts` — converted from node:test to vitest; added tests for new guard helpers.
- `extensions/b-flow/__tests__/phase1-contracts.test.ts` — updated "issues without iterate file" test expectation to blocking.
- `extensions/b-flow/__tests__/wire.test.ts` — fixed pre-existing TS implicit any error.

### Abandoned Approaches
- **Issues without iterate file → requires-replan** — changed to blocking because the distinction between "true requires-replan" and "parser couldn't find iterate_file" was ambiguous; blocking is safer and more conservative.

## Verification
- `npx vitest run extensions/b-flow --exclude='**/integration.test.ts'` — 104 tests pass.
- `npx tsc --noEmit` — no TypeScript errors in b-flow files.
- Guardrail tests verify: max iterations blocking, fingerprint stagnation blocking, repeated block reason blocking.

## Remaining Risks
- Git safety attribution is approximate — it compares git status porcelain output against result changed_files, which may not handle renames or staging area nuances.
- Process killing uses SIGTERM without a follow-up SIGKILL — orphaned workers may persist.
- The integration test file uses node:test which can't resolve .js ESM imports — pre-existing issue.

## Next Step
- Execute **Phase 5: Autonomous Wiring, Status, and Display** via `/b-build`.
