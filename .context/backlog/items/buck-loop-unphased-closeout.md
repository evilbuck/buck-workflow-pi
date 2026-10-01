---
title: Refuse unphased buck-loop done without closeout evidence
status: active
priority: high
created: 2026-09-30
updated: 2026-09-30
completed: null
related:
  - .context/2026-09-30.buck-loop-unphased-closeout/plan-buck-loop-unphased-closeout.md
  - extensions/buck-loop/machine.ts
  - extensions/buck-loop/persist.ts
  - extensions/buck-loop/loop.ts
  - skills/_shared/scripts/subject-lifecycle.ts
---

# Refuse unphased buck-loop done without closeout evidence

`/buck-loop` marks an unphased plan `done` after a confirmed commit even when acceptance boxes are open and `close-verified` would refuse. Resume then exits immediately.

Pickup: [plan-buck-loop-unphased-closeout.md](../../2026-09-30.buck-loop-unphased-closeout/plan-buck-loop-unphased-closeout.md) — unphased, `/b-phase` then `/b-build-hard`.
