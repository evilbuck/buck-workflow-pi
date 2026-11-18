---
date: 2026-11-17
domains: [b-loop, omp, e2e, docs, recovery]
topics: [b-loop, omp-eval, e2e-testing, stale-review-guard, docs-sync]
related: [.context/2026-11-17.b-loop-repair/phase-5-omp-e2e-and-docs.md, .context/2026-11-17.b-loop-repair/review-phase-5-omp-e2e-and-docs.md, .context/2026-11-17.b-loop-repair/iterate-phase-5-omp-e2e-and-docs.md]
priority: high
status: completed
subject: 2026-11-17.b-loop-repair
artifacts:
  - phase-5-omp-e2e-and-docs.md
  - review-phase-5-omp-e2e-and-docs.md
  - iterate-phase-5-omp-e2e-and-docs.md
  - plan-b-loop-repair-phases.md
---

# `/b-loop` Repair Phase 5: Real OMP E2E Suite & Documentation Sync

## Summary
- Added `skills/b-loop/scripts/eval-buck-loop.e2e.test.ts` (4 comprehensive suites) executing the packaged `prompts/b-loop.md` `import()` path inside live `omp __omp_worker_js_eval_process` workers on external linked worktrees (no `skills/` directory) with real `workflow_state`, `checkpoint-cli.ts`, `subject-lifecycle.ts`, and real Git:
  - Covered all 9 pre-flight rejections (including genuine `origin` + `projects.<name>.integration_ref` rejection), 2-phase milestone sequences (`starting`/`working`/`finished`/`verified`), folded `close-verified`, idempotent zero-commit re-run, and live-writer `"yielded"`.
  - Covered genuine crash recovery before `build · starting` dispatch, resumed `starting -> working` with partial `src/first.ts` edits preserved, between `finished` and `verified`, after durable `save` apply without duplicate memory writes, and after final `close-verified` + `git commit` with single-commit adoption.
  - Covered blockers on failed `judge()`, actionable `b-review`, stale worktree drift before `b-save` (blocking at `b-save starting · blocked` then rewinding cleanly on re-run), ambiguous save journals, dirty/staged index refusal, failed `close-verified`, reverted `index.md`, and `git reset --soft` unreachable commits.
- Fixed a real runtime bug discovered during E2E testing: `StageAdapter.prepareStarting` now supports `{ blocked }` (`types.ts`, `recovery.ts`), and `stages.ts` runs `checkReviewWorktreeFresh(ctx)` during `b-save` `prepareStarting` so stale worktree drift halts `b-save` at `starting · blocked`.
- Synchronized `skills/b-loop/SKILL.md`, `README.md`, `docs/buck-workflow.md`, `docs/buck-loop.md`, `docs/extension-loading.md`, `docs/oh-my-pi.md`, `docs/b-flow.md`, and `docs/howto/*` with repaired `/b-loop <subject>` behavior and historical unwired status of `extensions/buck-loop/`.

## Verification
- `lizard -C 10 -w skills/b-loop/scripts/*.ts`: 0 warnings; `tsc --noEmit --noUnusedLocals --noUnusedParameters`: 0 errors/unused in non-test `skills/b-loop/scripts/*.ts` & `eval-buck-loop.e2e.test.ts`.
- `npx vitest run skills/b-loop/scripts/ scripts/commands-mirror.test.ts scripts/skill-frontmatter.test.ts`: 7/7 files, 57/57 tests passed (`eval-buck-loop.e2e.test.ts` 4/4).
- `npm run guardrails:check`: `status: "pass"`, `unit_test_gate: "pass"`, `coverage.current: 88.4` (baseline `84`), `complexity_gate: "pass"` (`new_violations: []`, `hard_ceiling_violations: []`).
