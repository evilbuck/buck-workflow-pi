---
title: "Phase 2: b-loop Private Checkpoint, Locking, Milestones & Recovery"
status: active
priority: high
created: 2026-11-17
updated: 2026-11-17
completed: null
related: [.context/2026-11-17.b-loop-repair/phase-2-checkpoint-and-recovery.md, .context/2026-11-17.b-loop-repair/plan-b-loop-repair-phases.md]
---

# Phase 2: Private Checkpoint, Locking, Milestones & Recovery

Implement one versioned private checkpoint per `(subject, branch, worktree)` with revision CAS readback, writer serialization/yield, shared four milestones (`starting`, `working`, `finished`, `verified`), derived phase progress/blockers, and proof-driven recovery.

Details and acceptance criteria: [phase-2-checkpoint-and-recovery.md](../../2026-11-17.b-loop-repair/phase-2-checkpoint-and-recovery.md). Difficulty: hard, `/b-build-hard`.
