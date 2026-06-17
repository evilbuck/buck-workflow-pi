---
date: 2026-06-17
domains: [skill, docs, buck-workflow]
topics: [b-pr-review-2-issues, pr-review, context-skip, secrets]
related: [".context/2026-06-17.b-pr-review-2-issues-context-skip/index.md", "skills/b-pr-review-2-issues/SKILL.md", "prompts/b-pr-review-2-issues.md"]
priority: medium
status: completed
subject: 2026-06-17.b-pr-review-2-issues-context-skip
artifacts: ["index.md"]
---

# b-pr-review-2-issues context skip

Updated the `b-pr-review-2-issues` skill to treat review comments on `.context/**` as session-context noise by default.

## What changed
- Added an explicit `.context/**` path check before classification in `skills/b-pr-review-2-issues/SKILL.md`.
- Introduced `context_skip` as a documented classification for non-secret comments on `.context/**`.
- Kept a narrow exception: comments reporting leaked credentials, tokens, keys, or other secrets in `.context/**` remain `actionable`.
- Updated the generated plan/report summary and scope language to include `context-skipped` counts.
- Updated `prompts/b-pr-review-2-issues.md` so the wrapper's checklist matches the skill.

## Verification
- Re-read `skills/b-pr-review-2-issues/SKILL.md` after edit; the ingestion, classification, scope, report, and behavior sections all include the `.context/**` rule.
- Re-read `prompts/b-pr-review-2-issues.md`; the wrapper now mirrors the same skip/exception behavior.

## Notes
The fetch step itself is unchanged: `gh pr view <number> --comments --json comments` still retrieves all PR comments. The `.context/**` exclusion happens in the skill's classification pass, which is the correct layer because GitHub does not know this repository-specific review policy.
