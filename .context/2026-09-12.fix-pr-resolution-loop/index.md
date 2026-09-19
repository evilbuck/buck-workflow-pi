---
status: completed
date: 2026-09-12
subject: 2026-09-12.fix-pr-resolution-loop
topics: [fix-pr, worktrees, review-loop, orchestrate, subagents]
---

# fix-pr resolution loop

Update `fix-pr` so it fixes review findings on the PR head branch, orchestrates read-only exploration, and repeats independent review until settled or bounded by `--max-loop`.

## Artifacts

- [`plan-fix-pr-resolution-loop.md`](plan-fix-pr-resolution-loop.md) — implementation contract and verification
