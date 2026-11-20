---
title: "Phase 1: token-attribution message_end timeout"
status: active
priority: high
created: 2026-11-20
updated: 2026-11-20
completed: null
related:
  - .context/2026-11-20.bun-typescript-migration/phase-1-token-attribution-timeout.md
  - .context/2026-11-20.bun-typescript-migration/plan-migration-followups-phases.md
---

Remove awaited persistence from the `message_end` handler: early-return unchanged-record writes, batch per-file artifact-scan commits, decouple handler from persistence queue. Red/green wire + ingest tests, mutation checks, live OMP restart proof. Hard — `/b-build-hard`.
