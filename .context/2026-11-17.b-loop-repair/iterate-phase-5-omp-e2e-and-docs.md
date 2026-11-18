---
date: 2026-11-17
phase: phase-5-omp-e2e-and-docs
status: completed
---

# Iterate: Phase 5 Real OMP E2E Test Suite & Documentation Sync

Addressed all findings across Phase 5 implementation, review `7b834b3e`, and re-review `19fc88de`:

1. **Stale-review save start blocker (`types.ts`, `recovery.ts`, `stages.ts`)**:
   - Extended `StageAdapter.prepareStarting` to return `{ blocked?: { reason, nextSafeAction } }` handled by `runStageStarting` and `dispatchAndVerifyStage`, preventing `save` dispatch and preserving `b-save starting · blocked` when worktree or phase content drifts after a clean review.
   - Removed unused `SaveStageProof` import and factored `checkReviewWorktreeFresh(ctx)` so `prepareStarting` preserves upstream throw priority without calling `assertUpstreamReviewClean` twice.
2. **Real OMP E2E test rigor (`skills/b-loop/scripts/eval-buck-loop.e2e.test.ts`)**:
   - Replaced invalid top-level `integration_ref` fixture with a real `git remote add origin` + `projects.e2e` config (`origins` + `integration_ref: refs/heads/main`) asserting `/Configured integration_ref \(refs\/heads\/main\) is outside/i` and `agentLabels: []` on all 9 pre-flight rejections.
   - Replaced the synthetic `currentMilestone: "working"` rewrite and dead `dispatchWorking` branch in Test 2 with genuine end-to-end crashes at `build · starting` -> resumed `starting` -> `working` (writing partial edit to `src/first.ts` before crashing in `awaitFinished`) -> resumed `working` preserving `src/first.ts` (`sawPartialOnResume: true`).
   - Removed unused imports (`LoopCheckpoint`, duplicate `../cfg.yaml` files) and kept all functions `<= 10` cyclomatic complexity.
3. **Cross-repo documentation consistency**:
   - Eliminated conflicting `/buck-loop` active-wiring wording across `docs/buck-workflow.md`, `docs/extension-loading.md`, `docs/oh-my-pi.md`, `docs/b-flow.md`, `docs/howto/configure-buck-model-profiles.md`, `docs/howto/watch-buck-loop-activity.md`, `docs/howto/change-buck-loop-density.md`, `docs/howto/recover-buck-loop.md`, `docs/howto/resume-buck-loop-after-repair.md`, `docs/howto/README.md`, `README.md`, `docs/buck-loop.md`, and `skills/b-loop/SKILL.md`.
