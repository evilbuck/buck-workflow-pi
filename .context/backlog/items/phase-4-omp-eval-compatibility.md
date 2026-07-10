---
title: "Phase 4: OMP eval-kernel compatibility"
status: active
priority: high
created: 2026-07-10
updated: 2026-07-10
completed: null
related:
  - .context/2026-07-10.buck-workflow-implementation-audit/phase-4-omp-eval-compatibility.md
  - .context/backlog/items/reconcile-buck-workflow-contracts.md
---

# Phase 4: OMP eval-kernel compatibility

## Outcome

Generated and canonical eval cells execute on the maintained OMP runtime using current helpers/signatures.

## Start condition

Phase 3 completed and committed.

## Acceptance

- No stale `llm`, `agent_type`, or prelude-import contract in runtime-facing cells.
- Package metadata is not runtime detection.
- Generated starter and canonical example both run in the real OMP kernel.

Full contract: [phase-4-omp-eval-compatibility.md](../../2026-07-10.buck-workflow-implementation-audit/phase-4-omp-eval-compatibility.md).
