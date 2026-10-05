---
title: Fix buck-loop save/commit checkpoint handoff
status: active
priority: high
created: 2026-09-30
updated: 2026-09-30
completed: null
related:
  - .context/2026-09-30.buck-loop-save-commit-handoff/plan-save-commit-handoff.md
  - .context/2026-09-30.buck-loop-save-commit-handoff/research-save-commit-handoff.md
  - extensions/buck-loop/run-step.ts
  - extensions/buck-loop/loop.ts
---

# Fix buck-loop save/commit checkpoint handoff

Two failure modes from the decision-closure run: (1) save sessions with verified receipts reported as `SqlMemoryError` because teardown/`pool.end` failures latch a work-failure flag; (2) commit checkpoints blocking on the phase's own unstaged `skills/**`/`plugins/**` deliverables, forcing a manual external commit every phase.

Pickup: [plan-save-commit-handoff.md](../../2026-09-30.buck-loop-save-commit-handoff/plan-save-commit-handoff.md) — unphased, single-session, `/b-build`.

Observed 2026-10-02 in [2026-09-30.buck-loop-tui-preview](../../2026-09-30.buck-loop-tui-preview/): the commit-scope half still reproduces. An unphased plan declares no `files:`, so `prepareCommitCheckpoint` refuses every unstaged non-`.context` path and the run ends `saving → blocked`. This item does **not** cover the separate receipt subject-mismatch gate; see [buck-loop-save-receipt-subject.md](buck-loop-save-receipt-subject.md).
