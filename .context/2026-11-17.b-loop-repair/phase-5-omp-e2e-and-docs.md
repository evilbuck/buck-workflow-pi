---
status: completed
phase: 5
order: 5
plan: plan-b-loop-repair.md
phases_overview: plan-b-loop-repair-phases.md
difficulty: medium
model_hint: capable general model
buck_hint: /b-build
goal: "Replace the import-only smoke test with a real OMP command-path end-to-end verification suite across two phases, crash/recovery matrix, and update user-facing docs."
omp_execution: none
files:
  - skills/b-loop/scripts/eval-buck-loop.e2e.test.ts
  - skills/b-loop/scripts/eval-buck-loop.test.ts
  - skills/b-loop/SKILL.md
  - prompts/b-loop.md
  - README.md
  - docs/buck-workflow.md
  - docs/buck-loop.md
  - docs/howto/recover-buck-loop.md
from_plan_steps: [5]
depends_on: [1, 2, 3, 4]
dependency_type: HARD
acceptance_criteria:
  - "[x] Packaged `/b-loop <subject>` executes end-to-end in installed OMP from a separate checkout/worktree without Buck source files on a two-phase `repo-files` fixture using local fixture agents and real Git."
  - "[x] Automated E2E / integration tests assert milestone order (`starting`, `working`, `finished`, `verified`) for every stage & phase, blocker preservation, crash recovery (before dispatch, after dispatch, between `finished` & `verified`, after save apply before checkpoint writeback, after commit before checkpoint writeback), mutated input/ref/tree blocking, concurrent live-writer yield, rejected flags/wrong-subject/unphased/non-`repo-files`/dirty-staged rejections, and idempotent zero-commit re-run after closeout."
  - "[x] Updated docs (`README.md`, `docs/buck-workflow.md`, `docs/buck-loop.md`, `docs/howto/recover-buck-loop.md`, `skills/b-loop/SKILL.md`, and checked `docs/howto/resume-buck-loop-after-repair.md`/`docs/eval-kernel.md` if referencing old flags) accurately describe `/b-loop <subject>`, four shared milestones, blockers, and checkpoint recovery without documenting removed `--status`/`--resume`/`--stop` flags."
  - "[x] `npx vitest run scripts/commands-mirror.test.ts`, focused runner/E2E tests, `npm run subject-lifecycle:check`, and `npm run guardrails:check` all pass."
completed_at: 2026-11-17
completed_by: claude-opus-4-6
---

# Phase 5: Real OMP E2E Test Suite & Documentation Sync

## Context

Parent plan User Goal: When a phase fails or gets interrupted, Buck operators and their agents can see what finished and continue by running the same `/b-loop <subject>` command.

Phases 1–4 implemented packaged import resolution (`A-4`), private `(subject, branch, worktree)` checkpoints, stage boundaries, and safe Git tree-pinned commits/closeout. This final phase replaces the prior import-only smoke test with a comprehensive real OMP command-path test suite against disposable feature worktrees + `repo-files` + real Git, and synchronizes all user-facing docs and how-tos with the repaired `/b-loop <subject>` behavior.

## Implementation Details

1. **Real OMP Command-Path Test Harness (`eval-buck-loop.e2e.test.ts` / `eval-buck-loop.test.ts`)**:
   - Create isolated temporary Git repositories with a named feature branch and separate worktree containing a two-phase discrete fixture subject and `repo-files` storage config (using an isolated `XDG_CONFIG_HOME` / `BUCK_WORKFLOW_CONFIG` and repo without Buck source files).
   - Wire real OMP 18.22.0 execution path (`prompts/b-loop.md` → installed runner import → real OMP `eval` host / local fixture agents + real Git) and verify:
     - Happy path two-phase execution in order, exposing `starting`, `working`, `finished`, `verified` milestones for every stage and phase.
     - Interruptions / simulated crashes at:
       - before dispatch (`starting`)
       - after dispatch (`working`)
       - between `finished` and `verified`
       - right after durable `save` apply before checkpoint writeback (verifying no duplicate save)
       - right after `git commit` before checkpoint writeback (verifying single commit adopted cleanly)
       - interruption after final `close-verified` before final commit completes
     - Failure / block boundaries:
       - failed build acceptance / native judgment
       - actionable review findings blocking save & preserving `b-review finished · blocked`
       - stale review after worktree mutation blocking save
       - ambiguous save outcome blocking retry
       - failed Git probes / unexpected index / changed branch or tree blocking commit adoption
       - failed `close-verified` blocking final commit
     - Concurrent live-writer test in same `(subject, branch, worktree)` confirming second invocation yields cleanly.
     - Pre-flight rejection tests: wrong/missing subject, removed flags (`--status`/`--resume`/`--stop`), unrelated dirty/staged files, unphased plan, non-`repo-files` adapter / `integration_ref`, detached HEAD.
     - Final commit verification (contains closeout update) and re-running finished `/b-loop <subject>` produces `done` with zero new commits.
2. **Documentation & How-To Sync**:
   - Update `README.md`, `docs/buck-workflow.md`, `docs/buck-loop.md`, `docs/howto/recover-buck-loop.md`, and `skills/b-loop/SKILL.md` (plus check `docs/howto/resume-buck-loop-after-repair.md` / `docs/eval-kernel.md` for stale flag or `%load` references) so documentation accurately covers:
     - `/b-loop <subject>` single-command invocation (`repo-files`, named Git branch, discrete phased plan)
     - Removal of `--status`, `--resume`, `--stop`, profile flags, auto-subject discovery, review ranking, and auto-iterate loops
     - The four shared stage/phase milestones (`starting`, `working`, `finished`, `verified`), progress labels, blockers, and recovery by re-running `/b-loop <subject>`
     - Built-in closeout folding and verified `done` semantics

## Risks

- **OMP test flakiness / timeouts / environment leakage**: Real OMP subprocess tests could mutate user `~/.config/buck-workflow` or leak temp repos.
  - *Mitigation*: Always isolate `HOME` / `XDG_CONFIG_HOME` / `BUCK_WORKFLOW_CONFIG` per temp fixture, avoid relying on remote network calls via local fixture agent/judge shims or deterministic OMP eval harness where appropriate while proving the genuine installed `omp` command path, and always clean temp dirs in `finally`.

## Verification

- Execute full `eval-buck-loop.test.ts` + `eval-buck-loop.e2e.test.ts` (including live `omp` execution in a separate temp worktree).
- Verify all acceptance criteria checkboxes across `plan-b-loop-repair.md`.
- Run `npx vitest run scripts/commands-mirror.test.ts`, `npm run subject-lifecycle:check`, and `npm run guardrails:check`.

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Run `/b-build` for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this phase), do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` (and `/b-howto` if how-tos changed) before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state (followed by subject closeout in final closeout or folded per plan).
6. If the phase is incomplete, leave `status: in-progress` so the session resumes here next turn.
