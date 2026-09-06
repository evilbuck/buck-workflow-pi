---
name: b-build-hard
description: Implement complex, ambiguous, or higher-risk work with Buck Workflow's stronger build mode. Use when a requested change needs explicit trade-off analysis, incremental delivery, and expanded verification.
---

# B-Build Hard

Follow the sibling `b-build` skill in **hard** mode.

- Think through trade-offs and migration risks before editing.
- Break the work into safe, reviewable steps.
- Preserve existing behavior unless the requested change requires otherwise.
- Run the stronger verification appropriate to the risk.

Use `$b-build` for straightforward implementation work.
