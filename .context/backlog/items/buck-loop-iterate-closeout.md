---
title: Stop false heavy lifts when an iterate file stays active
status: active
priority: high
created: 2026-10-03
updated: 2026-10-03
completed: null
related:
  - .context/2026-10-03.buck-loop-iterate-closeout/plan-iterate-closeout.md
  - extensions/buck-loop/ambiguity.ts
  - extensions/buck-loop/loop.ts
  - skills/b-iterate/SKILL.md
---

# Stop false heavy lifts when an iterate file stays active

An ok iterating session that leaves exactly one `iterate-*.md` active is a supervisor close, not a Jev heavy lift. The diagnosis must name that file and must not report a completed phase as `not completed`.

Pickup: [plan-iterate-closeout.md](../../2026-10-03.buck-loop-iterate-closeout/plan-iterate-closeout.md) — unphased, `/b-build-hard`, clean branch.
