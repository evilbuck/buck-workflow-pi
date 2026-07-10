---
title: "Phase 6: Subject-aware runtime state"
status: active
priority: high
created: 2026-07-10
updated: 2026-07-10
completed: null
related:
  - .context/2026-07-10.buck-workflow-implementation-audit/phase-6-subject-aware-runtime-state.md
  - .context/backlog/items/reconcile-buck-workflow-contracts.md
---

# Phase 6: Subject-aware runtime state

## Outcome

Model switching and shared resolution use the actual explicit/active subject and phase, with ambiguity failing safe.

## Start condition

Phases 1 and 5 completed and committed.

## Acceptance

- Explicit older target and active `in-progress` phase win over newest folders.
- Ambiguous subjects produce no unsafe switch.
- Deprecated orchestration/session files do not own current state.

Full contract: [phase-6-subject-aware-runtime-state.md](../../2026-07-10.buck-workflow-implementation-audit/phase-6-subject-aware-runtime-state.md).
