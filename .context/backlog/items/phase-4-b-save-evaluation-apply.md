---
title: "b-save Phase 4: Evaluation & journaled apply"
status: active
priority: high
created: 2026-09-10
updated: 2026-09-10
completed: null
related:
  - .context/2026-09-10.b-save-state-machine-analysis/phase-4-evaluation-and-apply.md
  - .context/2026-09-10.b-save-state-machine-analysis/plan-b-save-state-machine-phases.md
  - .context/backlog/items/b-save-state-machine.md
---

# b-save Phase 4: Evaluation & journaled apply

Deterministic-first evaluation of the twelve responsibilities (closed results or typed `NeedsJudgmentError` routed to Phase 3 roles) plus the recoverable journaled `.context/**` apply: whole-patch validation, write-ahead journal, atomic replacement, mid-apply failure recovery, rerun idempotency. `/b-build-hard`.
