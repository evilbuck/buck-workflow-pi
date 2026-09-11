---
date: 2026-09-10
domains: [workflow, extensions]
topics: [b-save, evaluate, apply, journal, phase-4]
related:
  - extensions/b-save/evaluate.ts
  - extensions/b-save/apply.ts
priority: high
status: completed
subject: 2026-09-10.b-save-state-machine-analysis
artifacts:
  - extensions/b-save/evaluate.ts
  - extensions/b-save/apply.ts
---

# Phase 4: evaluation and journaled apply

Twelve rules close or raise `NeedsJudgmentError` / `UserGateError`. Hard failures (`ContainmentError`, `SchemaError`, `StaleInputError`) never reach a model. Apply journals before-images, writes atomically, and recovers via resume or rollback. Native memory stays `unsupported`; reindex stays `skipped`.
