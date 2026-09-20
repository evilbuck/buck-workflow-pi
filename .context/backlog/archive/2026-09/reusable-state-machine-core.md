---
title: Extract reusable pure state-machine evaluator
status: completed
priority: medium
created: 2026-09-19
updated: 2026-09-20
completed: 2026-09-20
related:
  - .context/2026-09-19.reusable-state-machine/plan-reusable-state-machine.md
  - .context/2026-09-19.reusable-state-machine/plan-reusable-state-machine-phases.md
  - .context/2026-09-19.reusable-state-machine/phase-1-generic-evaluator-contract.md
  - .context/2026-09-19.reusable-state-machine/phase-2-buck-machine-migration.md
  - .context/2026-09-19.reusable-state-machine/phase-3-architecture-documentation-and-proof.md
  - extensions/state-machine.ts
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

## Phases

1. Generic evaluator contract — medium, `/b-build`
2. Buck machine migration — hard, `/b-build-hard`
3. Architecture documentation and proof — medium, `/b-build`

Done 2026-09-20: generic evaluator extracted, Buck migrated without behavior drift, legacy table removed, architecture documented, independent smoke passed, and durable guardrails remained green.

