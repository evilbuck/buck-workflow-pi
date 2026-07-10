---
title: "Phase 7: Project-adaptive build discovery"
status: active
priority: high
created: 2026-07-10
updated: 2026-07-10
completed: null
related:
  - .context/2026-07-10.buck-workflow-implementation-audit/phase-7-project-adaptive-build.md
  - .context/backlog/items/reconcile-buck-workflow-contracts.md
---

# Phase 7: Project-adaptive build discovery

## Outcome

The portable build skill discovers each repository's real test, UI, browser, and server surfaces before prescribing verification.

## Start condition

Phase 3 completed and committed.

## Acceptance

- No absent framework/tool is prescribed.
- Non-UI JS/TS does not force Playwright/server work.
- Current repo and representative non-UI/UI fixtures select correct concrete checks.

Full contract: [phase-7-project-adaptive-build.md](../../2026-07-10.buck-workflow-implementation-audit/phase-7-project-adaptive-build.md).
