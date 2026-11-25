---
title: Reject stale subject lifecycle closure proof
status: active
priority: medium
created: 2026-11-25
updated: 2026-11-25
completed: null
related:
  - skills/_shared/scripts/subject-lifecycle.ts
  - .context/2026-11-23.full-orchestration-review/verify-fixture-exercise.md
---

# Reject stale subject lifecycle closure proof

The orchestration T2 fixture got `verifiedClosed: true` with an incomplete phase blocker. The lifecycle inspector currently derives the boolean from a completed index while deriving blockers separately from current plan evidence. The close transition also short-circuits on completed status. Investigate callers that trust the boolean alone and make closeout proof agree with current blockers, covering both legacy and canonical indexes. Preserve inspection of historical recorded state.

Review: https://github.com/evilbuck/buck-workflow-pi/pull/76#pullrequestreview-6061908296
