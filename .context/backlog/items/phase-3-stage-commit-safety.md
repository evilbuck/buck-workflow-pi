---
title: "Phase 3: Stage and commit safety"
status: active
priority: high
created: 2026-07-10
updated: 2026-07-10
completed: null
related:
  - .context/2026-07-10.buck-workflow-implementation-audit/phase-3-stage-commit-safety.md
  - .context/backlog/items/b-commit-final-step.md
  - .context/backlog/items/reconcile-buck-workflow-contracts.md
---

# Phase 3: Stage and commit safety

## Outcome

Every closeout uses explicit staging, and `b-commit` validates subject-scoped drafts against staged reality.

## Start condition

Phase 2 completed and committed.

## Acceptance

- Executable loops say save → stage → commit.
- Explicit/current subject wins over mtime.
- Wrong/stale drafts cannot override staged scope.
- Manual staging and protected-branch safeguards remain.

Full contract: [phase-3-stage-commit-safety.md](../../2026-07-10.buck-workflow-implementation-audit/phase-3-stage-commit-safety.md).
