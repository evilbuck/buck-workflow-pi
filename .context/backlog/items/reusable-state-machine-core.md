---
title: Extract reusable pure state-machine evaluator
status: active
priority: medium
created: 2026-09-19
updated: 2026-09-19
completed: null
related:
  - .context/2026-09-19.reusable-state-machine/plan-reusable-state-machine.md
  - extensions/buck-loop/table.ts
  - extensions/buck-loop/types.ts
  - extensions/buck-loop/loop.ts
---

# Extract reusable pure state-machine evaluator

Create a domain-neutral, synchronous evaluator for flat automatic, closed-choice, and external-event transitions. Move Buck policy into a Buck-specific definition while keeping scanning, persistence, model calls, and effect execution in the supervisor.

## Acceptance

- Generic evaluator has no Buck, Node, OMP SDK, XState, I/O, clock, or async runtime dependency.
- Buck behavior remains unchanged and all legacy table callers migrate cleanly.
- Legal choices are derived and revalidated from one declaration.
- A non-Buck fixture proves the interface is domain-independent.
- ADR 0002 and extension docs describe the evaluator/adapter seam.

Pickup: `.context/2026-09-19.reusable-state-machine/plan-reusable-state-machine.md`.
