---
title: "Phase 2: Save-owned closeout transaction"
status: completed
priority: high
created: 2026-07-10
updated: 2026-07-10
completed: 2026-07-10
related:
  - .context/2026-07-10.buck-workflow-implementation-audit/phase-2-save-owned-closeout.md
  - .context/2026-07-10.buck-workflow-implementation-audit/plan-buck-workflow-contract-remediation-phases.md
  - .context/backlog/items/reconcile-buck-workflow-contracts.md
---

# Phase 2: Save-owned closeout transaction

## Outcome

`b-save` consumes valid review-pass evidence, closes accepted state atomically, completes current memory, and promotes exactly one dependency-ready phase.

## Start condition

Phase 1 completed and committed.

## Acceptance

- Intermediate closeout completes current phase and exposes the next while subject remains active.
- Final closeout completes parent/subject/memory.
- Missing/stale pass or active iterate refuses completion.
- `prompts/b-save.md` is thin.

Full contract: [phase-2-save-owned-closeout.md](../../2026-07-10.buck-workflow-implementation-audit/phase-2-save-owned-closeout.md).
