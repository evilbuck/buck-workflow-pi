---
title: "Named model profiles for Buck workflow stages"
status: active
priority: high
created: 2026-09-23
updated: 2026-09-24
completed: null
related:
  - .context/2026-09-22.buck-loop-model-config/plan-buck-loop-model-config.md
  - .context/2026-09-22.buck-loop-model-config/brainstorm-buck-loop-model-config.md
  - .context/2026-09-22.buck-loop-model-config/plan-buck-loop-model-config-phases.md
  - extensions/buck-loop/run-step.ts
  - extensions/omp-models.ts
---

# Named model profiles for Buck workflow stages

Pickup from [Phase 3: Loop Runtime Cutover](../../2026-09-22.buck-loop-model-config/phase-3-loop-runtime-cutover.md). Phases 1–2 are done.

Engineers switch a named profile. Each stage group maps to model ids plus a thinking level. Runtime asks Jev which available id to run. Missing config stops. `/buck-models` writes project or user-global `.omp` config. Do not fold in the settings-api `modelRoles` parser swap.
