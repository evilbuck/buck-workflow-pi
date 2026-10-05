---
title: "Review severity ranking — Phase 1: Types, Scan, and the Pure Waterline"
status: active
priority: high
created: 2026-10-03
updated: 2026-10-03
completed: null
related:
  - .context/2026-10-03.review-severity-ranking/phase-1-types-scan-pure-waterline.md
  - .context/2026-10-03.review-severity-ranking/plan-review-severity-ranking-phases.md
---

# Phase 1: Types, Scan, and the Pure Waterline

Establish the ranking state contract in `extensions/buck-loop/`: `ranking` in `LoopState` (out of `WorkState`, in `FROZEN_PHASE`), `{ kind: "rank" }` effect, persistence compatibility, `hasIterate()` ignoring `status: below-waterline`, the iterate-artifact parser (`critical:<n>` / `warning:<n>`), and the pure `aboveWaterline()` waterline. Validates A-1, A-9, A-10.

Scope and acceptance criteria: [phase-1-types-scan-pure-waterline.md](../../2026-10-03.review-severity-ranking/phase-1-types-scan-pure-waterline.md)

Execution: `orchestrate` keyword on first turn, then `/b-build-hard` against the phase file.
