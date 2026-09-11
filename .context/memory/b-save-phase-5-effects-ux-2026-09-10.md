---
date: 2026-09-10
domains: [workflow, extensions]
topics: [b-save, effects, command-ux, hindsight, phase-5]
related:
  - extensions/b-save/effects.ts
  - extensions/b-save/index.ts
priority: high
status: completed
subject: 2026-09-10.b-save-state-machine-analysis
artifacts:
  - extensions/b-save/effects.ts
  - extensions/b-save/index.ts
---

# Phase 5: effects and command UX

Hindsight native-memory effect is `unsupported` on OMP 18.1.17. Local/Mnemopi use `ctx.memory.status()/save()` with stored-count validation and one retry. Command adapter parses frozen flags, persists run manifests, and prints headless recovery. Engine is not registered in `extensions/index.ts` yet.
