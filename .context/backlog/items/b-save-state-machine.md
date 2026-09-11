---
title: Build deterministic b-save state machine
status: active
priority: high
created: 2026-09-10
updated: 2026-09-10
completed: null
related:
  - .context/2026-09-10.b-save-state-machine-analysis/plan-b-save-state-machine.md
  - .context/2026-09-10.b-save-state-machine-analysis/plan-b-save-state-machine-phases.md
  - .context/2026-09-10.b-save-state-machine-analysis/research-b-save-state-machine.md
  - .context/discussions/b-save-state-machine.md
  - extensions/b-save-improved/index.ts
  - skills/b-save/SKILL.md
---

# Build deterministic b-save state machine

Implement the accepted OMP-first state-machine plan. The new engine becomes `/b-save`; the current prompt-driven workflow moves to `/deprecated-b-save`; `/b-save-improved` is removed only after parity.


Phased 2026-09-10 into six sequential phases — see the [phases overview](../../2026-09-10.b-save-state-machine-analysis/plan-b-save-state-machine-phases.md). This item tracks overall delivery through the Phase 6 cutover and closes when `/b-save` + `/deprecated-b-save` are the two live commands.

The first implementation gate is proving whether OMP's shipped public SDK can enforce a trusted pre-execution Hindsight retain capability. If it cannot, Hindsight delivery must fail closed as unsupported without weakening the durable `.context` checkpoint.
