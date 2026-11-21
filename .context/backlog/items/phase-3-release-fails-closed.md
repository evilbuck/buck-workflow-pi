---
title: "Phase 3: release script fails closed"
status: active
priority: medium
created: 2026-11-20
updated: 2026-11-20
completed: null
related:
  - .context/2026-11-20.bun-typescript-migration/phase-3-release-fails-closed.md
  - .context/2026-11-20.bun-typescript-migration/plan-migration-followups-phases.md
---

`scripts/publish.ts` aborts on failed `git status --porcelain` and on a registry, transport, or authentication failure from `bun pm view`. A not-yet-published version is benign even when that lookup exits nonzero. Red/green + mutation check. Easy — `/b-build`.
