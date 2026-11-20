---
title: Close remaining code-level .context bypasses (b-commit fallbackDraft, loop iterate-open-acceptance)
status: active
priority: medium
created: 2026-11-18
updated: 2026-11-18
completed: null
related:
  - extensions/b-commit-improved/index.ts
  - extensions/buck-loop/loop.ts
  - .context/2026-11-18.workflow-state-routing-audit/plan-workflow-state-routing.md
---

# Remaining code-level .context bypasses (post Phase A)

Two code sites still write durable `.context` state with no store involvement, found
by the 2026-11-18 routing audit. Both are small fixes using the established
retain-first pattern (`scheduleConfiguredRetain` + `flushConfiguredRetains`, as
`extensions/buck-loop/activity-log.ts:176-183` does).

1. **`extensions/b-commit-improved/index.ts:88-100,116-145`** — `fallbackDraft`
   writes `.context/draft-commit.md` (or a subject-folder draft) directly with
   `writeFileSync`. Fix: retain-first; the file becomes the user-facing export.
   Mirrored as an instruction in `skills/b-build/SKILL.md:366` and
   `skills/b-iterate/SKILL.md:64` — update both when the code lands.

2. **`extensions/buck-loop/loop.ts:1477-1491`** —
   `.context/<subject>/iterate-open-acceptance.md` is written with no retain — the
   only buck-loop site without a store write. Fix: add the same
   `scheduleConfiguredRetain` the site's neighbors already use.

Note: `/b-loop` is documented repo-files-only (`skills/b-loop/SKILL.md:25`), which
softens (2) but does not excuse it once loops run against adapter projects.

## Effort

Easy — `/b-build`. Both sites follow an in-repo pattern; tests mirror
`extensions/buck-loop/__tests__/sql-save-adapters.test.ts` fixtures.
