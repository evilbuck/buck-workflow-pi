---
description: Portable release-PR review skill wrapper. Optionally pass a GitHub PR URL, owner/repo#N, or number; with no argument, review the current branch and write CODE-REVIEW.md.
---

# Code Review

$ARGUMENTS

Invoke the portable skill explicitly, with either no argument or a GitHub PR identifier:

- `/skill:code-review` — review the current branch, write `CODE-REVIEW.md` at the repo root
- `/skill:code-review https://github.com/owner/repo/pull/123` — full PR URL
- `/skill:code-review owner/repo#123` — shorthand
- `/skill:code-review 123` — bare number (must be run from the PR's repo)

Load and follow the `code-review` skill:

```
skills/code-review/SKILL.md
```

With the package extension loaded, `/code-review` runs the local Reviewer/Fixer
loop in `extensions/code-review-iteration/`. Invoke the portable release-PR
reviewer as `/skill:code-review` so the two surfaces remain unambiguous.
