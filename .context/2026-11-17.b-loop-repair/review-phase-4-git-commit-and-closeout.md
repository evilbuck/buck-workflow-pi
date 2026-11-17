---
date: 2026-11-17
phase: phase-4-git-commit-and-closeout
status: completed
verdict: pass
---

# Two-Axis Review: Phase 4 Scoped Git Staging, Tree-Pinning Commit & Closeout

## Verdict: PASS (0 Critical, 0 Warning)

- **Standards Axis**:
  - Initial review (`4b1eca22`): **Fail** (2 Critical, 4 Warning, 5 Nit) — caught `normalizeDeclaredPath` double-slash bug on directory prefixes (`src/`), non-atomic phase/overview mutation before `CommitStageProof` + pre-write disk mutation + solo `plan-*-phases.md` drift, staged `.context/workflow/` bypass, non-string `runSh` failing open on missing exit codes, `validation.ts` `shellQuote` quote-parse hazard + `git-commit.test.ts` complexity > 10, fenced ```` ```json ```` commit titles, and helper duplication / test gaps.
  - Re-review (`2882e29a` after `iterate-phase-4-git-commit-and-closeout.md`): **Pass** (0 Critical, 0 Warning, 2 minor Nits) — both remaining Nits were subsequently addressed (latest-phase `expectedOverviewSha256` rollback guard in `checkpoint.ts` and `./src/`, `win\`, `src2/` test assertions in `git-commit.test.ts`).
- **Spec Axis** (against `phase-4-git-commit-and-closeout.md` & `plan-b-loop-repair.md`): **Pass** — all 7 Phase 4 acceptance criteria verified.
- **Deterministic Checks (post-final-edit `task-1237`)**:
  - `lizard -C 10 -w skills/b-loop/scripts/*.ts`: **0 warnings** across all 13 source & test files (`validation.ts` and `git-commit.ts` parsed end-to-end).
  - `tsc --noEmit`: **0 errors** in `skills/b-loop/`.
  - `npx vitest run skills/b-loop/scripts/ scripts/commands-mirror.test.ts`: **5/5 files, 47/47 tests passed** (including `git-commit.test.ts` 10/10 and `eval-buck-loop.test.ts` 13/13 with live `omp __omp_worker_js_eval_process` 2-phase full completion).
  - `npm run guardrails:check`: **`status: "pass"`**, `unit_test_gate: "pass"`, `coverage.current: 88.3` (baseline `84`), `complexity_gate: "pass"` (`new_violations: []`, `hard_ceiling_violations: []`).

## Spec Acceptance Checklist
- [x] `runSh` / `exitCodeOf` in `skills/b-loop/scripts/validation.ts` fails closed on `ShellError`, non-zero exit codes, negative numeric strings, missing/undefined/null exit codes, `{ ok: false }`, `{ isError: true }`, and `{ cancelled: true }`.
- [x] `prepareFreshCommitTree` / `validatePreExistingStagedIndex` / `assertAllowedDirtyEntries` in `skills/b-loop/scripts/git-commit.ts` refuse pre-existing staged index paths (including `.context/workflow/`) and unrelated dirty/untracked files outside `.context/<subject>/`, `.context/memory/`, `.context/backlog/`, and declared `phase.files` (exact paths and directory prefixes).
- [x] Scoped chunked staging (`git add -A --`) excludes `.context/workflow/`, persists `(baselineHead, expectedPhaseSha256, expectedOverviewSha256)` via `pinStageProof` before `workflow_state` mutation and `(baselineHead, expectedTree)` via `runStageStarting` prior to `commit` dispatch, and refreshes `StageContext` before `dispatchWorking`.
- [x] On the final phase (after verifying earlier phase commits are ancestors of `baselineHead`), commit prep runs read-only `subject-lifecycle.ts inspect --json` preflight before mutations, updates `phase-*.md` / `plan-*-phases.md`, executes `subject-lifecycle.ts close-verified` (resolved via `import.meta.url`), and folds resulting index changes into `expectedTree`.
- [x] Post-commit `verifyCommitResult` confirms `parentCount === 1 && parent === baselineHead` and `HEAD^{tree} === expectedTree`, plus canonical `subject-lifecycle.ts inspect` on the final phase, persisting `commitId` matching `verdict.commitId`.
- [x] Commit crash recovery handles mid-prep crashes via pre-pinned `expectedPhaseSha256` / `expectedOverviewSha256`, resumes staged `HEAD === baselineHead` when `write-tree === expectedTree`, adopts single-parent landed commits matching `(baselineHead, expectedTree)` without duplicating commits, blocks on mismatched `HEAD`/index/tree/closeout, and makes zero new commits on idempotent re-runs.
- [x] `verifyDoneInvariants` in `skills/b-loop/scripts/recovery.ts` derives `done` strictly from reachable verified commits across all phases, `detectPlanCompletionGap`, and canonical closeout (`canonical && state === "completed" && effectiveState === "completed" && verifiedClosed && blockers.length === 0`).
