---
title: "Git cleanup — Phase 2: Apply deletes"
status: completed
priority: high
created: 2026-10-26
updated: 2026-10-27
completed: 2026-10-27
related:
  - .context/2026-10-26.git-cleanup-skill/phase-2-apply-deletes.md
  - .context/2026-10-26.git-cleanup-skill/plan-git-cleanup-phases.md
  - .context/2026-10-26.git-cleanup-skill/phase-1-classify-json.md
---

# Phase 2: Apply deletes

Add `--apply` to the Phase 1 classifier. Delete only the fresh `auto-delete` intersection. No `--force`. Do not start until Phase 1 is completed.

Scope and acceptance criteria: [phase-2-apply-deletes.md](../../2026-10-26.git-cleanup-skill/phase-2-apply-deletes.md)

Archived 2026-10-27: the phase file is `status: completed` with every acceptance criterion checked, and the phases overview lists Phase 2 as completed. `skills/git-cleanup/scripts/classify.ts` gained the `--apply` path: it re-runs the classifier, deletes only the intersection of the requested names and the fresh `auto-delete` set, removes worktrees with `git worktree remove` and never `--force`, skips the branch when that remove fails, uses `git branch -d` for ancestor tips and `git branch -D` only while the fresh disposition is still `auto-delete`, and runs `git worktree prune` only for registrations the fresh classify already marked prunable. Stdout stays one JSON document with added `applied` and `refused` arrays. Verified: 31 focused classifier tests pass and durable v2 guardrails pass (unit, patch, ratchet, complexity; functional and lint skipped).

Execution: `/b-build-hard` against the phase file. No `orchestrate` keyword.
