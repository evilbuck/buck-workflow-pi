---
title: "Review severity ranking — Phase 1: Types, Scan, and the Pure Waterline"
status: completed
priority: high
created: 2026-10-03
updated: 2026-10-04
completed: 2026-10-04
related:
  - .context/2026-10-03.review-severity-ranking/phase-1-types-scan-pure-waterline.md
  - .context/2026-10-03.review-severity-ranking/plan-review-severity-ranking-phases.md
---

# Phase 1: Types, Scan, and the Pure Waterline

Establish the ranking state contract in `extensions/buck-loop/`: `ranking` in `LoopState` (out of `WorkState`, in `FROZEN_PHASE`), `{ kind: "rank" }` effect, persistence compatibility, `hasIterate()` ignoring `status: below-waterline`, the iterate-artifact parser (`critical:<n>` / `warning:<n>`), and the pure `aboveWaterline()` waterline. Validates A-1, A-9, A-10.

Scope and acceptance criteria: [phase-1-types-scan-pure-waterline.md](../../2026-10-03.review-severity-ranking/phase-1-types-scan-pure-waterline.md)

Archived 2026-10-04: the phase file is `status: completed` with every acceptance criterion checked, the phases overview lists Phase 1 as completed, and the work is committed in `8f8c511` (`feat(buck-loop): establish review ranking types and waterline`). SQL receipt `01a104c8-5bcf-73e3-b861-f77e6257f093` records the closeout fact. Phase 2 is committed-pending behind the same branch; Phases 3-4 remain open.

Execution: `orchestrate` keyword on first turn, then `/b-build-hard` against the phase file.
