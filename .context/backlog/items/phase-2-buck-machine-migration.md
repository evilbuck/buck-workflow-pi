---
title: Phase 2 — Buck machine migration
status: active
priority: high
created: 2026-09-19
updated: 2026-09-19
completed: null
related:
  - .context/2026-09-19.reusable-state-machine/phase-2-buck-machine-migration.md
  - .context/2026-09-19.reusable-state-machine/plan-reusable-state-machine-phases.md
  - .context/2026-09-19.reusable-state-machine/plan-reusable-state-machine.md
  - extensions/buck-loop/machine.ts
  - extensions/buck-loop/loop.ts
---

# Phase 2 — Buck machine migration

Express Buck transition policy over the generic evaluator, migrate all runtime and test callers, preserve supervisor behavior, and remove the legacy table cleanly.

Pickup after Phase 1: `.context/2026-09-19.reusable-state-machine/phase-2-buck-machine-migration.md`. Difficulty **hard**; `/b-build-hard`.
