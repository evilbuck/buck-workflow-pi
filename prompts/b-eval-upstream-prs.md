---
description: Evaluate upstream PRs locally — triage, validate, and produce a merge-order plan
---

# B-Eval-Upstream-PRs

$ARGUMENTS

You may optionally provide an upstream repo (default: the fork's parent) and an output path. Examples:

- `/b-eval-upstream-prs` (defaults to the current fork's parent repository)
- `/b-eval-upstream-prs FelixKratz/JankyBorders`
- `/b-eval-upstream-prs --output .context/2026-09-06.upstream-prs/plan-upstream-prs.md`

Local-only — no remote comments, no upstream pushes. After evaluation, hand off to `b-build` / `b-iterate` to actually adopt a PR, or `b-pr` to push the bundled result.

Load and follow the `b-eval-upstream-prs` skill:

```
skills/b-eval-upstream-prs/SKILL.md
```
