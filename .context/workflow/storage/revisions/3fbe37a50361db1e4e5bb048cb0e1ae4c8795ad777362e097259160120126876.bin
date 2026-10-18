---
status: completed
subject: b-pr-review-2-issues-context-skip
date: 2026-06-17
---

# b-pr-review-2-issues context skip

## Goal
Update the `b-pr-review-2-issues` skill so PR review comments on `.context/**` are skipped by default, except when they report leaked credentials or other secrets.

## Outcome
- `skills/b-pr-review-2-issues/SKILL.md` now defines `.context/**` comments as `context_skip` by default.
- Secret-leak comments on `.context/**` stay in scope as `actionable`.
- The plan summary, scope, out-of-scope section, and behavior rules now report `context-skipped` comments explicitly.
- `prompts/b-pr-review-2-issues.md` matches the new classification rule so the thin wrapper does not drift from the canonical skill.

## Artifacts
- `skills/b-pr-review-2-issues/SKILL.md`
- `prompts/b-pr-review-2-issues.md`
- `.context/memory/b-pr-review-2-issues-context-skip-2026-06-17.md`
