---
title: buck-loop extension — scrap XState, happy-path nested-session runner
status: active
priority: high
created: 2026-09-18
updated: 2026-09-18
completed: null
related:
  - .context/2026-09-18.buck-loop-extension/plan-buck-loop-extension.md
  - .context/2026-09-18.buck-loop-extension/plan-buck-loop-extension-phases.md
  - .context/2026-09-18.buck-loop-extension/phase-1-transition-contract.md
  - extensions/b-flow/
  - extensions/omp-models.ts
  - skills/b-loop/SKILL.md
  - .context/2026-06-01.deprecate-b-flow/
---

# buck-loop extension

Pickup: `.context/2026-09-18.buck-loop-extension/plan-buck-loop-extension.md`.

New `extensions/buck-loop/` command `/buck-loop` drives the Buck happy path (build → review → iterate-if-needed → docs-if-needed → save → commit → next phase) with a hand-rolled transition table and nested OMP sessions. XState is not used. `extensions/b-flow/` stays unwired. `/skill:b-loop` stays advisory.

Implementation of all 7 phases is on disk (161 focused tests, guardrails pass). Next: `/b-commit`. Leave this item open until that commit lands.
