---
description: Evaluate upstream PRs locally — triage, validate, and produce a merge-order plan
---

# B-Eval-Upstream-PRs

$ARGUMENTS

You may optionally provide an upstream repo (default: the fork's parent), an output path, and the validation posture. Examples:

- `/b-eval-upstream-prs` (defaults to current fork's `upstream` remote)
- `/b-eval-upstream-prs FelixKratz/JankyBorders`
- `/b-eval-upstream-prs --output .context/2026-09-06.upstream-prs/plan-upstream-prs.md`

Local-only by default — no remote comments, no upstream pushes. After evaluation, hand off to `b-build` / `b-iterate` to actually adopt a PR, or `b-pr` to push the bundled result.

Load and follow the `b-eval-upstream-prs` skill:

```
skills/b-eval-upstream-prs/SKILL.md
```
