---
date: 2026-11-17
phase: phase-4-git-commit-and-closeout
status: completed
---

# Iterate: Phase 4 Scoped Git Staging, Tree-Pinning Commit & Closeout

Addressed all Critical, Warning, and Nit findings from the Phase 4 review (`4b1eca22`), re-review (`2882e29a`), and `guardrails:check`:

1. **Critical (`C1` — trailing-slash directory prefixes)**: Updated `normalizeDeclaredPath` and `matchesDeclaredFile` in `skills/b-loop/scripts/git-commit.ts` to record `isDirPrefix` before stripping trailing slashes via `posix.normalize(...).replace(/\/+$/, "")`, handling `src/`, `./src/`, and `win\` cleanly without `//` mismatches while rejecting outside prefixes (`src2/`).
2. **Critical (`C2` — pre-mutation pinning, CAS write order, solo overview drift)**:
   - Added `preflightSubjectCloseout` (`subject-lifecycle.ts inspect --json`) before any `workflow_state` or file mutation on the final phase.
   - Added `StageContext.pinStageProof` (`recovery.ts` `persistCheckpointPatch`) and `CommitStageProof.expectedPhaseSha256` / `expectedOverviewSha256` so deterministic pre-commit SHAs pin to the private checkpoint prior to mutating `phase-*.md`, `plan-*-phases.md`, or `index.md`.
   - Ordered `commitArtifactUpdate` to succeed `workflow_state({ operation: "write", expectedRevision })` before calling `syncArtifactDiskIfNeeded`, eliminating `#storeDirectEdit` poisoning on CAS failures.
   - Updated `commitAuthorizedPhaseUpdate`, `commitAuthorizedPlanUpdate` (tracking the latest landed/in-flight `expectedOverviewSha256`), and `isInFlightCommitCompletion` to accept authorized mid-prep and solo `plan-*-phases.md` updates while rejecting unauthorized drift and cross-phase rollbacks.
3. **Warnings (`W1`–`W4`) & Nits (`N1`–`N5`)**:
   - Refused pre-existing staged `.context/workflow/` entries in `validatePreExistingStagedIndex` while keeping dirty scratch files excluded from staging.
   - Hardened `runSh` / `exitCodeOf` / `textFromError` / `extractObjectShOutput` in `skills/b-loop/scripts/validation.ts` to fail closed on missing/undefined/null exit codes, negative numeric strings, `{ cancelled: true }`, and plain-object errors.
   - Removed the `shellQuote` regex-quote parse hazard in `validation.ts`, consolidated shared Git/JSON/env helpers in `validation.ts`, and refactored helper functions across `validation.ts`, `recovery.ts`, `git-commit.ts`, and `git-commit.test.ts` so `lizard -C 10 -w` reports zero warnings across all files.
   - Used `extractJsonObject` in `formatCommitMessageText` so fenced ```` ```json ```` `b-commit` drafts parse cleanly, checked `parsed.blockers` in `verifySubjectCloseoutWithLifecycle`, checked `completedPhaseSha256` in `isInFlightCommitCompletion`, and expanded `git-commit.test.ts` to 10 passing tests.
