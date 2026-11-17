---
title: "Phase 1: Subagent Model Routing for eval Spawns"
status: completed
priority: medium
created: 2026-11-17
updated: 2026-11-17
completed: 2026-11-17
related: [.context/2026-11-16.omp-eval-loop-research/phase-1-subagent-model-routing.md, .context/2026-11-16.omp-eval-loop-research/plan-omp-eval-loop-phases.md]
---

# Phase 1: Subagent Model Routing for `eval` Spawns

Add `before_subagent_spawn` hook in `interactive-model-switch.ts` to route OMP `eval` subagent models by stage profile without requiring `task.perCallModel`.

Details and acceptance criteria: [phase-1-subagent-model-routing.md](../../.context/2026-11-16.omp-eval-loop-research/phase-1-subagent-model-routing.md). Difficulty: medium, `/b-build`.
