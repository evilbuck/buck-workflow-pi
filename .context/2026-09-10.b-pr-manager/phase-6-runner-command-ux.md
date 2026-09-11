---
status: pending
phase: 6
order: 6
plan: plan-b-pr-manager.md
phases_overview: plan-b-pr-manager-phases.md
difficulty: hard
model_hint: strongest available model; wires every actor, cancellation, merge-method safety, and command registration
buck_hint: /b-build-hard
goal: "Register /b-pr-manager, run the XState machine with real invoked actors, and expose resume, base, merge-method, progress, and cancellation UX."
files:
  - extensions/b-pr-manager/index.ts
  - extensions/b-pr-manager/git.ts
  - extensions/index.ts
  - extensions/b-pr-manager/__tests__/wire.test.ts
from_plan_steps: [7]
depends_on: [2, 3, 4, 5]
dependency_type: HARD
acceptance_criteria:
  - "[ ] `/b-pr-manager` is registered and disposed on session shutdown"
  - "[ ] CLI matches the plan contract; flags > saved run > git-local config > defaults"
  - "[ ] Fresh start with a dirty worktree blocks before checkout; resume allows only manager-owned dirty paths"
  - "[ ] Missing/stale `.git/b-pr-base` prompts before any mutation; `--base` is accepted only when it equals the PR base"
  - "[ ] Merge method resolution: explicit flag, saved run, existing auto-merge request, sole enabled method, otherwise one upfront selection — never a silent history-rewriting choice when several methods exist"
  - "[ ] Conflict actor loop is bounded to 20 steps; markers scanned, paths staged, `git rebase --continue` is deterministic"
  - "[ ] Polling: immediate observation plus seven delayed waits; abort-aware sleep; progress resets index; limit → `exhausted`"
  - "[ ] Ctrl+C / `ctx.signal` persist `paused`, cancel sleeps and nested sessions, preserve rebase/edits, print exact resume command"
  - "[ ] Auto-merge is requested only after the deterministic merge gate; completion is claimed only on GitHub `state=MERGED`"
  - "[ ] Wire tests cover command parse, registration, and actor disposal without a real PR"
completed_at: null
completed_by: null
---

# Phase 6: XState runner and command UX

## Context

Parent user goal: a developer can run one OMP command on an open pull request and have valid review feedback fixed, verified, rebased, pushed, and merged without babysitting.

This phase is the `[D]` controller that invokes Phases 2–5. It must not let model output select shell commands, timeouts, or success.

## Implementation Details

1. Add `extensions/b-pr-manager/git.ts`: manager-specific worktree ownership, expected/owned dirty paths, checkout via `gh pr checkout`, identity checks, and reconcile around `extensions/pr-git.ts`. Never auto-abort/reset.
2. Implement `index.ts`:
   - Parse `/b-pr-manager [<number-or-url>]` plus flags from the plan.
   - `--resume` loads + reconciles before any mutation.
   - No PR arg: current-branch open PR; 0 or N matches → deterministic block with rerun command.
   - Ask for base (OMP UI) when cache missing/mismatched; PR `baseRefName` first.
   - Resolve merge method per plan policy; persist the choice on the run.
   - Start the XState actor with invoked services: github, git, persistence, model/buck-loop, abortable timer.
   - Render progress via existing `CommandProgress`.
   - After every successful transition and before sleep/mutation: atomic checkpoint.
   - Merge gate implementation is deterministic and matches the nine conditions in the plan. A state change between read and mutation invalidates the gate.
   - `enabling_auto_merge` calls Phase 3's mutation helper; never `--admin`.
   - Success path records URL, merge commit OID, method, timestamp, then releases the lock.
3. Register in `extensions/index.ts`. Dispose active actors on session shutdown.
4. Committing uses extracted deterministic commit plumbing (b-commit-improved / shared helpers). Model may draft Conventional Commit text; deterministic code validates sentinels and stages only manager-owned paths.
5. Push: ordinary vs `--force-with-lease` from Phase 2 primitives; read remote OID after; lease failure blocks.
6. Wire tests: registration, flag parse, dirty-start block, resume command string, disposal on cancel, merge-method prompt when multiple methods enabled, no `--force` argv.

End-to-end fake-`gh` primary paths can start here if cheap; remaining convergence cases belong to Phase 7.

## Risks

- Silent squash/rebase choice when the repo allows several methods. Always prompt or use an explicit saved choice.
- Claiming success on auto-merge accepted / green checks. Only `state=MERGED`.
- Cancellation that aborts the rebase. Persist and leave git state.

## Verification

- `vitest` `extensions/b-pr-manager/__tests__/wire.test.ts`.
- Command appears in the extension registry; `/b-pr-improved` still registers unchanged.
- Dispose path cancels in-flight timer and model session in the test double.

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Run `/b-build-hard` for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. Out-of-plan issues go to a separate `/b-plan` → `/b-build`; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If incomplete, leave `status: in-progress`.

`omp_execution` is omitted (`none`). No first-turn keyword or `/goal set`.
