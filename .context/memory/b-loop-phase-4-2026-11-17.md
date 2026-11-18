---
date: 2026-11-17
domains: [b-loop, git, lifecycle, recovery, workflow]
topics: [b-loop, git-commit, tree-pinning, close-verified, crash-recovery, validation]
related: [.context/2026-11-17.b-loop-repair/phase-4-git-commit-and-closeout.md, .context/2026-11-17.b-loop-repair/review-phase-4-git-commit-and-closeout.md, .context/2026-11-17.b-loop-repair/iterate-phase-4-git-commit-and-closeout.md]
priority: high
status: completed
subject: 2026-11-17.b-loop-repair
artifacts:
  - phase-4-git-commit-and-closeout.md
  - review-phase-4-git-commit-and-closeout.md
  - iterate-phase-4-git-commit-and-closeout.md
  - plan-b-loop-repair-phases.md
---

# `/b-loop` Repair Phase 4: Scoped Git Staging, Tree-Pinning Commit & Closeout

## Summary
- Implemented `skills/b-loop/scripts/git-commit.ts` (`createCommitStageAdapter` and `verifySubjectCloseoutWithLifecycle`) and wired it into `skills/b-loop/scripts/eval-buck-loop.ts`.
- Enforced fail-closed Git hygiene: refuses pre-existing staged index changes (including `.context/workflow/`) and unrelated dirty/untracked files outside `.context/<subject>/`, `.context/memory/`, `.context/backlog/`, and declared `phase.files` (exact paths and normalized directory prefixes), stages explicitly in 40-path chunks while excluding `.context/workflow/`, and updates `phase-*.md` / `plan-*-phases.md` atomically via `workflow_state` CAS before disk sync.
- Pinned `(baselineHead, expectedPhaseSha256, expectedOverviewSha256)` via `StageContext.pinStageProof` prior to mutations and `(baselineHead, expectedTree)` via `runStageStarting` prior to `commit` dispatch, folded `subject-lifecycle.ts close-verified` (with read-only `inspect --json` preflight) into the final commit tree, verified `parentCount === 1 && parent === baselineHead && HEAD^{tree} === expectedTree`, adopted crashed commits cleanly, and gated `done` strictly via `verifyDoneInvariants`.
- Hardened `runSh` / `shellQuote` and consolidated shared Git/JSON/env helpers in `skills/b-loop/scripts/validation.ts`.

## Verification
- `lizard -C 10 -w skills/b-loop/scripts/*.ts`: 0 warnings across all 13 files; `tsc --noEmit` in `skills/b-loop/`: 0 errors.
- `npx vitest run skills/b-loop/scripts/ scripts/commands-mirror.test.ts`: 5/5 files, 47/47 tests passed (`git-commit.test.ts` 10/10, `eval-buck-loop.test.ts` 13/13 including real `omp __omp_worker_js_eval_process` 2-phase completion).
- `npm run guardrails:check`: `status: "pass"`, `unit_test_gate: "pass"`, `coverage.current: 88.3` (baseline `84`), `complexity_gate: "pass"` (`new_violations: []`, `hard_ceiling_violations: []`).
