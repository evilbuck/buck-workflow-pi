---
status: completed
date: 2026-09-12
subject: 2026-09-12.fix-pr-resolution-loop
topics: [fix-pr, worktrees, review-loop]
---

# fix-pr resolution loop

Update `fix-pr` so the default path fixes review findings on the pull request's real head branch in a git worktree, then waits for subsequent review and repeats until settled or bounded by `--max-loop`.

## Artifacts

- [`plan-fix-pr-resolution-loop.md`](plan-fix-pr-resolution-loop.md) — implementation contract and verification
