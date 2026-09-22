---
title: Phase 2 — Binary phase-difficulty cutover
status: active
priority: high
created: 2026-09-21
updated: 2026-09-21
completed: null
related:
  - .context/2026-09-21.jev-tool/phase-2-binary-difficulty-cutover.md
  - .context/2026-09-21.jev-tool/plan-jev-tool-phases.md
  - .context/2026-09-21.jev-tool/plan-jev-tool.md
  - extensions/omp-models.ts
  - extensions/index.ts
  - extensions/buck-loop/loop.ts
---

# Phase 2 — Binary phase-difficulty cutover

Introduce a separate `PhaseDifficulty` domain (`hard | not-hard`), cut root auto-switch and buck-loop consumers over to it, map legacy `easy | medium` to `not-hard`, and preserve three-tier code-review Hardness.

Pickup: `.context/2026-09-21.jev-tool/phase-2-binary-difficulty-cutover.md`. Difficulty **hard**; `/b-build-hard`. HARD-depends on Phase 1 because both phases modify `extensions/index.ts`.
