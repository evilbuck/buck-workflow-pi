---
description: Universal language-agnostic code review with severity-tagged feedback, language-specific reference guides (React/Vue/Angular/Rust/TS/Python/Go/etc.), cross-cutting patterns (security, performance, architecture, N+1, async), a PR-diff triage script, and GitHub PR review posting with inline comments. Writes a durable review report to .context/. Use when reviewing pull requests, posting inline PR comments, doing security/architecture audits, mentoring reviewers, or establishing review standards.
---

# Code Review (Universal)

$ARGUMENTS

You may optionally provide a target as an argument — a path, file glob, PR reference, or freeform description:

- `/code-review-universal` — review the current diff / pending changes
- `/code-review-universal path/to/diff.patch` — review a specific diff
- `/code-review-universal src/auth/` — review changes in a directory
- `/code-review-universal https://github.com/owner/repo/pull/123` — review a GitHub PR, post inline comments
- `/code-review-universal owner/repo#123` — same, shorthand
- `/code-review-universal #123` — review a PR in the current repo

Load and follow the `code-review-universal` skill:

```
skills/code-review-universal/SKILL.md
```
