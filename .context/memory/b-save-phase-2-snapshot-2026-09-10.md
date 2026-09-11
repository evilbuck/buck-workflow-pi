---
date: 2026-09-10
domains: [workflow, architecture, extensions]
topics: [b-save, xstate, snapshot, run-manifest, phase-2]
related:
  - extensions/b-save/types.ts
  - extensions/b-save/machine.ts
  - extensions/b-save/snapshot.ts
  - .context/2026-09-10.b-save-state-machine-analysis/phase-2-run-model-and-snapshot.md
priority: high
status: completed
subject: 2026-09-10.b-save-state-machine-analysis
artifacts:
  - extensions/b-save/types.ts
  - extensions/b-save/machine.ts
  - extensions/b-save/snapshot.ts
---

# Phase 2: run model and snapshot

Shipped versioned run manifests (`schema_version: 1`, unknown versions rejected), XState v5 topology with one model retry then `failed_model`, and a snapshot layer ported from save-preflight invariants: subject precedence, containment, advisory session evidence, provenance-only loose moves, redaction, input hashes, proposal dependency map.

Verification: `npx vitest run extensions/b-save` 46 passed; lizard CCN <= 10 on types/machine/snapshot. Engine still unregistered.
