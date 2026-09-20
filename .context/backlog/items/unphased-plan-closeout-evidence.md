---
title: Define verified closeout evidence for unphased plans
status: active
priority: medium
created: 2026-09-19
updated: 2026-09-19
completed: null
related:
  - .context/2026-09-19.subject-work-state/plan-subject-work-state.md
  - skills/_shared/scripts/subject-lifecycle.ts
---

# Define verified closeout evidence for unphased plans

`close-verified` intentionally treats every unphased plan as open. The completed deterministic subject work-state plan is itself unphased, so `/b-save` correctly preserved its saved artifacts but refused lifecycle closeout with `plan-subject-work-state.md: unphased plan remains open`.

Define deterministic completion evidence for unphased plans without trusting a caller-supplied boolean or weakening phased-plan verification.
