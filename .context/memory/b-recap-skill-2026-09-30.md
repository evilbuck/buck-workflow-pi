---
date: 2026-09-30
domains: [tooling]
topics: [b-recap-skill, session-recap, workflow-skills]
subject: 2026-09-04.b-recap
artifacts:
  - skills/b-recap/SKILL.md
  - prompts/b-recap.md
  - commands/b-recap.md
  - README.md
  - docs/buck-workflow.md
related: []
priority: medium
status: completed
---

Shipped the `b-recap` read-only session-recap skill plus `/b-recap` slash command via PR #14 (merge 6257962, feature commit e78fa2e, review-fix commit 6d4fe05). The skill enforces a fixed scan-friendly Markdown shape with a hard 500-word ceiling, ranks direct user messages over compaction summaries and Buck artifacts, and explicitly excludes the recap invocation from the latest-request field. The README tail truncation surfaced by `b-review` (critical) plus the SKILL.md grouping rule and the `docs/buck-workflow.md` section-placement warning (warnings) were all resolved in 6d4fe05 before merge; the iterate artifact is therefore closed. No permanent tests were added — behavioral proof is a live `/b-recap` invocation as documented in the plan's Verification section.