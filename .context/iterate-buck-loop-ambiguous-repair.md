---
status: completed
date: 2026-09-29
updated: 2026-09-29
subject: 2026-09-29.buck-loop-ambiguous-repair
topics: [review, iteration, buck-loop]
informs: []
addresses: plan-buck-loop-ambiguous-repair.md
completed: 2026-09-29
from_review: b-review
---

# Iteration: keep restart stop across commands

## Source

- Reviewed after: `/b-build`
- Plan: `plan-buck-loop-ambiguous-repair.md`
- Review: `review-ambiguous-repair-2026-09-29.md`

## Critical issues

### Same-process command re-entry bypasses restart

- **File:** `extensions/buck-loop/loop.ts`
- **Problem:** After a retry edits `extensions/buck-loop/`, a second `start` or `resume` can run in the same OMP process under the old loaded module, despite the restart instruction.
- **Fix:** Keep a process-local restart gate keyed by repo; refuse subsequent work commands with the original reason. Do not persist that gate beyond a process restart. Keep `status` and `stop` available.
- **Check:** Temp-repo `handleLoop` test invokes `resume` and `start` after the restart stop; no nested work runs. A fresh process has no in-memory gate.

## Resolution

`handleLoop` now gates same-process `start` and `resume` after a repair edits the loop extension, while `status` and `stop` remain available. The temp-repo integration test and standalone smoke confirmed no additional nested work after the restart warning; the final review passed.

## Recommended workflow

Run `/b-iterate`, then `/b-review` against the same plan. Keep the SQL-memory hold notes outside the repair commit.
