---
title: Fix buck-loop deferred-docs routing and in-cycle resume
status: completed
priority: high
created: 2026-09-22
updated: 2026-09-22
completed: 2026-09-22
related:
  - .context/2026-09-22.fix-buck-loop-deferred-docs-and-in-cycle-resume/plan-fix-buck-loop-deferred-docs-and-in-cycle-resume.md
  - .context/2026-09-19.buck-loop-stall-diagnosis/research-buck-loop-stall.md
  - .context/backlog/items/buck-loop-contextless-choice-stall.md
  - .context/backlog/items/jev-buck-loop-chooser.md
  - extensions/buck-loop/scan.ts
  - extensions/buck-loop/loop.ts
  - extensions/buck-loop/machine.ts
---

# Fix buck-loop deferred-docs routing and in-cycle resume

## Problem

Teleport subject `2026-09-22.host-site-resource-sync` stopped in Phase 2 after its review accurately deferred living docs and how-to coverage to Phase 5. `parseReviewImpact` / `isFlagged` did not recognize the review's first-line wording—"No Phase 2 living-document impact..."—or its deferred how-to statement, so it set `docsImpact=true` and `howtoImpact=true` and routed `reviewing → documenting`. Documenting correctly found no changed `CONTEXT.md`, `AGENTS.md`, `CLAUDE.md`, or `docs/` path and returned `ambiguous`; the chooser then accepted legal `block` despite `advance` being the correct outcome.

The resulting in-cycle block could not be resumed: `refuseUnsafeWorkspace` rejects every non-`.context` dirty path before `USER_CONFIRMED`, including the active phase's own uncommitted source work. Its existing building-state test labels the refusal "unrelated," but the gate cannot distinguish phase work from unrelated dirt. The operator committed out of band and advanced the projection; parser and resume gate remain unchanged here. This is not the 2026-09-22 jev-tool stall, where a missing How-to section made the review unparseable.

## Acceptance criteria

- [x] A review whose first line states no living-document or documentation impact does not set `docsImpact`.
- [x] A review that defers how-to coverage to a later phase does not set `howtoImpact`.
- [x] Documenting advances rather than blocks when the review's own impact flags are false and no living-document path was expected to change.
- [x] An in-cycle blocked run can resume when its only dirty non-`.context` paths are the active phase's own uncommitted work.
- [x] Starting with unrelated dirty files, and resuming a building run with unrelated dirty files, continue to fail closed.
- [x] Focused scan and loop tests cover the Teleport review wording and the in-cycle resume case.
