---
title: "z.ai discount banner OMP extension"
status: active
priority: medium
created: 2026-09-09
updated: 2026-09-10
completed: null
related:
  - .context/2026-09-09.zai-discount-banner/plan-zai-discount-banner.md
  - .context/2026-09-09.zai-discount-banner/research-zai-discount-banner.md
  - extensions/zai-discount-banner.ts
  - extensions/zai-discount-banner.test.ts
  - .context/2026-09-09.zai-discount-banner/iterate-zai-discount-banner.md
---

# z.ai discount banner OMP extension

Implement `.context/2026-09-09.zai-discount-banner/plan-zai-discount-banner.md`: an
above-editor banner (`ctx.ui.setWidget`) while a GLM-5.3-Flash campaign occurrence
(start dates 2026-09-03 → 2026-09-20, daily 23:00–09:00 the following day SGT)
is active and exact `glm-5.3-flash` is returned by authenticated availability for
provider `zai` or `zai-coding-plan`. No off-peak UI, no toasts (user decisions, 2026-09-09).

Time-boxed: the last campaign occurrence starts 2026-09-20 and ends at 09:00 SGT
the following day; the banner self-expires from the occurrence-start date table. A
future off-peak footer chip (`ctx.ui.setStatus`) can reuse the tested `isOffPeak` seam.

## Progress

- 2026-09-10: Completed the five-item review iteration and saved an active checkpoint. A second `/b-review` and resolution or explicit override of the repository-wide complexity failure remain before completion.
