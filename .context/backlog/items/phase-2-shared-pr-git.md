---
title: "Phase 2: Extract shared PR git primitives (b-pr-manager)"
status: active
priority: medium
created: 2026-09-10
updated: 2026-09-10
completed: null
related:
  - .context/2026-09-10.b-pr-manager/phase-2-shared-pr-git.md
  - .context/2026-09-10.b-pr-manager/plan-b-pr-manager-phases.md
  - .context/2026-09-10.b-pr-manager/plan-b-pr-manager.md
---

# Phase 2: Extract shared PR git primitives

Move base-cache, rebase, conflict enumeration, safe push, and remote-OID helpers out of `/b-pr-improved`. Preserve that command's external behavior.

- Difficulty: hard
- buck_hint: `/b-build-hard`
- Depends on: none (∥ Phase 1)
