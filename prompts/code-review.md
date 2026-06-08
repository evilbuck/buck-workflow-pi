---
description: Brutally honest critique of code changes. Optionally pass a GitHub PR (URL, owner/repo#N, or number) to create a worktree and post inline comments. With no argument, reviews the current branch and writes CODE-REVIEW.md at the repo root.
---

# Code Review

$ARGUMENTS

Pass either nothing, or a GitHub PR identifier as the argument:

- `/code-review` — review the current branch, write `CODE-REVIEW.md` at the repo root
- `/code-review https://github.com/owner/repo/pull/123` — full PR URL
- `/code-review owner/repo#123` — shorthand
- `/code-review 123` — bare number (must be run from the PR's repo)

Load and follow the `code-review` skill:

```
skills/code-review/SKILL.md
```
