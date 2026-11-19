---
date: 2026-11-18
domains: [tooling, skills]
topics: [b-refactor, accidental-complexity, skill-registration]
related: []
priority: medium
status: completed
subject: 2026-11-18.b-refactor-skill
artifacts: [plan-b-refactor-skill.md, skills/b-refactor/SKILL.md]
---

# b-refactor skill

`/b-refactor` removes one accidental-complexity force per invocation, targeted or found. Behavior is pinned first. The night loop is the caller (1–4 runs), not the skill. It does not commit, push, or open a PR; closeout hands to `/b-review`, `/b-save`, `/b-commit`, `/b-pr`.

Find mode is two looks, then stop. A prior Leave is not a candidate unless named. Not bundled in the Codex plugin. Does not consult `buckModels`.

Command mirror test: `scripts/commands-mirror.test.ts` 4 passed. Docs-only session; guardrails gate skipped.
