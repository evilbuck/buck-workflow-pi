---
title: "b-save Phase 3: Bounded semantic roles"
status: active
priority: high
created: 2026-09-10
updated: 2026-09-10
completed: null
related:
  - .context/2026-09-10.b-save-state-machine-analysis/phase-3-bounded-semantic-roles.md
  - .context/2026-09-10.b-save-state-machine-analysis/plan-b-save-state-machine-phases.md
  - .context/backlog/items/b-save-state-machine.md
---

# b-save Phase 3: Bounded semantic roles

Extend `runOmpModelSession` in place and add scribe / evidence-auditor / goal-classifier sessions with zero ambient capability, strict schemas, bounded evidence IDs, and one retry from the original snapshot. Prompt-injection fixtures required. `/b-build`.
