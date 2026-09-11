---
date: 2026-09-10
domains: [workflow, extensions]
topics: [b-save, roles, omp-models, isolation, phase-3]
related:
  - extensions/b-save/roles.ts
  - extensions/omp-model-session.ts
  - extensions/omp-models.ts
priority: high
status: completed
subject: 2026-09-10.b-save-state-machine-analysis
artifacts:
  - extensions/b-save/roles.ts
  - extensions/omp-model-session.ts
---

# Phase 3: bounded semantic roles

Scribe, evidence-auditor, and goal-classifier run through `runOmpModelSession` with empty tools/ambient lists, caller-owned system prompts, and one retry of the original evidence prompt. Schema violations and double failure return `failed_model`. No Hindsight delivery role (Phase 1 `unsupported`). `b-save-improved` still imports `runOmpModelSession` from `omp-models.ts`.
