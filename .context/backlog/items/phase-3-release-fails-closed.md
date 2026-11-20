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

`scripts/publish.ts` aborts on failed `git status --porcelain` and failed `bun pm view` (empty vs failed distinguished). Red/green + mutation check. Easy — `/b-build`.
