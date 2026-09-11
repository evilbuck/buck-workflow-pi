---
title: "b-save Phase 2: Run model & deterministic snapshot"
status: active
priority: high
created: 2026-09-10
updated: 2026-09-10
completed: null
related:
  - .context/2026-09-10.b-save-state-machine-analysis/phase-2-run-model-and-snapshot.md
  - .context/2026-09-10.b-save-state-machine-analysis/plan-b-save-state-machine-phases.md
  - .context/backlog/items/b-save-state-machine.md
---

# b-save Phase 2: Run model & deterministic snapshot

Versioned run model (`types.ts`), XState v5 topology (`machine.ts`), and authoritative snapshot layer (`snapshot.ts`) migrating proven `save-preflight.ts` logic with hashing and dependency mapping. Foundation for phases 3–6. `/b-build-hard`.
