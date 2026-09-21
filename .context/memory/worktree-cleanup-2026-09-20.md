---
date: 2026-09-20
domains: [git, housekeeping]
topics: [worktree, cleanup, merged-branches]
related: [fix-pr-32-2026-09-20.md]
priority: low
status: completed
---

# Merged worktree cleanup

Removed two merged worktrees after copying untracked PR #32 notes into the main repo:

- `better-fix-pr` (`feat/better-fix-pr` @ 663530f)
- `fix-pr-32.wt` (`feat/good-ideas` @ 5ce9ed2)

Deleted 15 merged local branch refs (all ancestors of `master`). Left unmerged worktrees `autonomous-loop.wt`, `b-commit-err.wt`, `buck-workflow-pi-pr20`, and detached `/tmp/buck-workflow-pi-pr-{17,19}`.
