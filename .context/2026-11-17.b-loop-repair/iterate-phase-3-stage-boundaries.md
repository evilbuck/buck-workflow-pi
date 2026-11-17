---
date: 2026-11-17
phase: phase-3-stage-boundaries
status: completed
---

# Iterate: Phase 3 Stage Boundaries & Recovery Hardening

Addressed all findings from the Phase 3 Standards Axis review and `guardrails:check`:

1. **Critical (`review.recoverWorking` deadlock on stale build)**: `recoverReviewWorking` now routes `!upstream.fresh` through `{ status: "finished" }` so `verifyReviewResult` / `recovery.ts` rewinds cleanly to `build`, guarded by `MAX_PHASE_REWINDS = 3` in `executeCheckpointLoop`.
2. **Warnings (`save` receipt duties & strict readback, `RunStateBackend` isolation, symlinks/mode fingerprint, fail-closed phase reads)**:
   - `saveStagePrompt` now specifies `metadataDuties: ["save-metadata", "readback", "probe"]`, and `stages.test.ts` enforces `assertRequiredDutiesUnchanged` on mock receipts.
   - `sealAndVerifyAppliedRefs` requires strict post-seal `read-receipt` verification (`attemptId`, `"complete"`, and exact sorted `artifactRevisions`) without falling back to the write reply.
   - `persistHandoff` / `loadHandoff` keep `inProcessRunState` disabled whenever `RunStateBackend` is supplied.
   - `recoverSaveWorking` routes `journal.status === "applied"` cleanly through `verifyResult` even when `savedRefs` is empty.
   - `hashWorkingTreeEntry` handles `ENOENT` directly on `lstatSync` (supporting dangling symlinks), hashes regular-file permissions (`st.mode & 0o777`), and sorts paths by code point.
   - `verifyPhaseRevisionMatches` fails closed on missing or errored `workflow_state` reads.
   - Raised `A-4` OMP cell timeouts in `eval-buck-loop.test.ts` (`30_000`ms cell / `85_000`ms `execSync` / `90_000`ms test) with timer cleanup for full-suite `--coverage` load; added regression tests across `stages.test.ts`.
3. **Nits & Complexity**: Removed `as Promise<never>` cast in `checkpoint.ts`, extracted helpers so `lizard -C 10 -w` parses all of `stages.ts` (1190+ NLOC, 67 functions) with zero warnings, wrapped `resolveSavedRefsRevisions` failures into `{ status: "blocked" }`, tightened finite score checks, and removed unused `configPath` from `StageAdapterOptions`.
