---
title: "Git cleanup — Phase 2: Apply deletes"
status: active
priority: high
created: 2026-10-26
updated: 2026-10-26
completed: null
related:
  - .context/2026-10-26.git-cleanup-skill/phase-2-apply-deletes.md
  - .context/2026-10-26.git-cleanup-skill/plan-git-cleanup-phases.md
  - .context/2026-10-26.git-cleanup-skill/phase-1-classify-json.md
---

# Phase 2: Apply deletes

Add `--apply` to the Phase 1 classifier. Delete only the fresh `auto-delete` intersection. No `--force`. Do not start until Phase 1 is completed.

Scope and acceptance criteria: [phase-2-apply-deletes.md](../../2026-10-26.git-cleanup-skill/phase-2-apply-deletes.md)

Execution: `/b-build-hard` against the phase file. No `orchestrate` keyword.
