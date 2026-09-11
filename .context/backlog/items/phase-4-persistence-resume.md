---
title: "Phase 4: Atomic persistence and resume (b-pr-manager)"
status: active
priority: medium
created: 2026-09-10
updated: 2026-09-10
completed: null
related:
  - .context/2026-09-10.b-pr-manager/phase-4-persistence-resume.md
  - .context/2026-09-10.b-pr-manager/plan-b-pr-manager-phases.md
  - .context/2026-09-10.b-pr-manager/plan-b-pr-manager.md
---

# Phase 4: Atomic persistence and resume

Gitdir checkpoints, per-PR locks, schema migration, reconcile-on-resume that never replays mutations.

- Difficulty: medium
- buck_hint: `/b-build`
- Depends on: Phase 1 (HARD); Phase 2 (SOFT)
