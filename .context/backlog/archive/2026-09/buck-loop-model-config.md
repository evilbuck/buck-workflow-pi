---
title: "Named model profiles for Buck workflow stages"
status: completed
priority: high
created: 2026-09-23
updated: 2026-09-24
completed: 2026-09-24
related:
  - .context/2026-09-22.buck-loop-model-config/plan-buck-loop-model-config.md
  - .context/2026-09-22.buck-loop-model-config/brainstorm-buck-loop-model-config.md
  - .context/2026-09-22.buck-loop-model-config/plan-buck-loop-model-config-phases.md
  - extensions/buck-loop/run-step.ts
  - extensions/omp-models.ts
---

# Named model profiles for Buck workflow stages

All six phases completed. Engineers switch a named profile whose stage groups map to model ids and thinking levels. Runtime asks Jev which available id to run, falls back to uniform random only when Jev cannot answer, and stops on missing configuration instead of using the host model. `/buck-models` writes project or user-global `.omp` config without folding in the separate `modelRoles` parser migration.
