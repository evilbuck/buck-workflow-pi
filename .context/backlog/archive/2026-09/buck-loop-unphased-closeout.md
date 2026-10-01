---
title: Refuse unphased buck-loop done without closeout evidence
status: completed
priority: high
created: 2026-09-30
updated: 2026-09-30
completed: 2026-09-30
related:
  - .context/2026-09-30.buck-loop-unphased-closeout/plan-buck-loop-unphased-closeout.md
  - extensions/buck-loop/machine.ts
  - extensions/buck-loop/persist.ts
  - extensions/buck-loop/loop.ts
  - skills/_shared/scripts/subject-lifecycle.ts
---

# Refuse unphased buck-loop done without closeout evidence

`/buck-loop` no longer treats a confirmed unphased commit as plan completion. Ineligible plans block with the unchecked acceptance lines. Eligible resume writes `status: completed`, runs `close-verified`, and returns `done` without another build.

Shipped in `8e62775`. The in-memory run still false-doned; operator closeout checked the seven criteria and completed the subject in `6829598`.
