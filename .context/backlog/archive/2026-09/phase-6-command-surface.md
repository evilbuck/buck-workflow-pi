---
title: Phase 6 — buck-loop command surface
status: completed
priority: medium
created: 2026-09-18
updated: 2026-09-18
completed: 2026-09-18
related:
  - .context/2026-09-18.buck-loop-extension/phase-6-command-surface.md
  - .context/2026-09-18.buck-loop-extension/plan-buck-loop-extension-phases.md
  - extensions/buck-loop/index.ts
  - extensions/index.ts
---

# Phase 6 — buck-loop command surface

Register `/buck-loop` with explicit start-path, resume, status, and stop modes. Keep parsing thin, status read-only, b-flow unwired, and orchestration inside the supervisor.

Shipped 2026-09-18: `wireBuckLoop(pi)` in `extensions/index.ts`. `extensions/b-flow/` remains unwired. Pickup was `.context/2026-09-18.buck-loop-extension/phase-6-command-surface.md`.
