---
date: 2026-09-12
subject: 2026-09-12.fix-pr-resolution-loop
status: completed
domains: [workflow, agent-instructions]
topics: [fix-pr, git-worktree, github-review, polling]
related: ["skills/fix-pr/SKILL.md", "presentations/2026-09-12.fix-pr-skill-report/index.html"]
research: []
memory: [../memory/fix-pr-resolution-loop-2026-09-12.md]
priority: high
---

# Plan: make `fix-pr` resolve review feedback iteratively

## Goal

Make the default `fix-pr` run finish every valid review finding on the pull request's real head branch, request no unnecessary product decision, and wait for independent post-push review before declaring settlement.

## Changes

1. Resolve PR head metadata before checkout and run mutations in a dedicated or existing worktree whose local branch is exactly `headRefName`.
2. Reuse an existing worktree when that branch is already checked out; Git permits one worktree per branch. Push explicitly to the PR head repository and `headRefName`.
3. Replace the size-based default issue handoff with fix-now behavior. Keep `--issues-only` and `--dry-run` as explicit overrides; remove redundant `--fix-only`.
4. After each push, poll for new reviews at 2, 2, 2, 2, 2, 5, 5, and 10 minute intervals. Revalidate new feedback and repeat when valid findings remain.
5. Default to at most 10 fix/review loops; accept a positive integer through `--max-loop=<n>`. Never claim settlement when the review window expires or the loop cap is reached with unresolved status.
6. Correct the report's path-filtered `gh pr diff` gotcha: current `gh` does not support the pathspec form and exits with an argument error. Use local `git diff ... -- <path>` in the worktree or the contents API for head contents.

## Verification

- Check frontmatter and instruction structure.
- Search for stale size-gate, `--fix-only`, `origin HEAD`, `pr-<N>` branch, and path-filtered `gh pr diff` guidance.
- Confirm the polling intervals total 30 minutes and the success/blocking states are explicit.
