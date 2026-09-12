---
date: 2026-09-12
domains: [workflow, agent-instructions, github]
topics: [fix-pr, git-worktree, review-loop, max-loop, polling, orchestrate, subagents]
related:
  - ../2026-09-12.fix-pr-resolution-loop/plan-fix-pr-resolution-loop.md
  - ../../skills/fix-pr/SKILL.md
  - ../../docs/buck-workflow.md
  - ../../prompts/omp-orchestrate.md
priority: high
status: completed
subject: 2026-09-12.fix-pr-resolution-loop
artifacts: [index.md, plan-fix-pr-resolution-loop.md]
---

# fix-pr head-branch worktrees and bounded review loops

## Outcome

Updated `fix-pr` so its default path fixes every valid review finding in a worktree on the pull request's exact head branch, orchestrates read-only feedback and validation exploration, verifies and pushes the changes, then polls for independent re-review and repeats when new valid findings arrive.

- Reuse an existing worktree for `headRefName`; otherwise create one and verify both the branch and immutable head OID before mutation.
- Push explicitly to the PR head repository and `HEAD:<headRefName>` rather than assuming `origin`.
- Keep `--issues-only` and `--dry-run` as explicit alternatives; remove the redundant `--fix-only` mode and the size-based issue handoff.
- Poll after each push at 2, 2, 2, 2, 2, 5, 5, and 10 minutes, for 30 minutes total.
- Default to 10 fix/review loops; `--max-loop=<n>` accepts a positive integer override.
- Distinguish `settled`, `review_pending`, and `max_loops_reached`; settlement still requires an independent post-push review explicitly confirming resolution.
- On OMP, orchestrate two parallel feedback collectors and then validation tasks per independent file/root-cause group; keep raw payloads in child context and compact normalized evidence in mainline.

## Validated gotcha

The report's warning was correct in substance but wrong about the observed result. Current `gh pr diff` accepts only one positional argument: `gh pr diff <N> -- <path>` exits with `accepts at most 1 arg(s)` rather than returning an empty diff. Single-file validation now uses local `git diff ... -- <path>` in the worktree or the GitHub contents API.

`gh pr checkout --worktree` defaults to the PR head branch name, but an existing OMP checkout demonstrated that other checkout tooling can create a `pr-<N>` local branch tracking the real head branch. The skill therefore verifies the exact local branch instead of trusting the checkout helper.

## Documentation and verification

Updated `docs/buck-workflow.md` with the head-branch worktree, default-fix disposition, polling schedule, loop cap, terminal statuses, and exploratory orchestration. Reconciled `prompts/omp-orchestrate.md` so subagents may perform bounded read-only exploration or claim validation while the orchestrator retains final verification. README and the hand-authored project AGENTS summary remain unchanged because their high-level description is still accurate.

Verification:

- Static skill/document contract check: pass (472 skill lines, 24 balanced fences).
- Poll schedule check: pass (`[2,2,2,2,2,5,5,10]`, 30 minutes).
- Scenario smoke check: pass for the two-collector batch, compact normalized outputs, multi-group validation fan-out, single-group agent reuse, stale-OID rejection, read-only child boundaries, mainline final verification, and unchanged settlement requirements.
- `git diff --check`: pass.
- Context artifact validation: the new subject and memory are clean; the repo-wide command remains red on the pre-existing `.context/memory/mattpocock-adoption-2026-09-10.md` status value `in-progress`.
- No backlog item added: no deferred work remains in scope.
