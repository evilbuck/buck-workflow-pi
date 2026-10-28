---
title: "Git cleanup — Phase 1: Classifier JSON"
status: completed
priority: high
created: 2026-10-26
updated: 2026-10-27
completed: 2026-10-27
related:
  - .context/2026-10-26.git-cleanup-skill/phase-1-classify-json.md
  - .context/2026-10-26.git-cleanup-skill/plan-git-cleanup-phases.md
  - .context/2026-10-26.git-cleanup-skill/plan-git-cleanup.md
---

# Phase 1: Classifier JSON

Classify every local branch and registered worktree as `skip`, `auto-delete`, or `ask`. Print one JSON document. No delete flag.

Scope and acceptance criteria: [phase-1-classify-json.md](../../2026-10-26.git-cleanup-skill/phase-1-classify-json.md)

Archived 2026-10-27: the phase file is `status: completed` with every acceptance criterion checked, and the phases overview lists Phase 1 as completed. `skills/git-cleanup/scripts/classify.ts` is read-only and fails closed on any unrecognized `git merge-tree --write-tree -z` record; `git cherry` counts are evidence only. Verified: 24 focused classifier tests plus 6 catalog tests, TypeScript exit 0, durable v2 guardrails pass (coverage 89.4% against an 84 baseline), and a real read-only CLI smoke with `feat/git-cleanup-skill` reported as `skip`. SQL receipt `9c0f2c43-e666-416a-a0aa-61d7167e86c2-d3545f4d-e750-4320-9a78-e1d9f8ebb292` records the closeout fact under memory id `01a17acd-c885-70f5-87a0-4c6b3311cc27`.

One in-plan finding from the second review round is retained below the waterline rather than iterated: when a branch commit changes `.context/workflow` metadata alongside its own feature subject, the ask-list description can fall back to the commit subject even though a feature plan H1 exists. The disposition stays `ask`, so no false delete is authorized. Phase 3 owns the published procedure and re-checks description precedence against the landed apply interface.

A second in-plan finding from the 2026-10-28 review round is also retained below the waterline and is a safety defect, not a labelling one: `classify.ts` uses `%(refname:short)` as canonical branch identity, so a tag whose name collides with a branch name makes Git emit the branch as `heads/main`, the integration-branch skip check misses it, and the integration branch is classified `auto-delete` (`skip_reason: null`, `contained: true`, reproduced in a disposable repo). Tracked as `.context/backlog/items/phase-1-refname-collision.md` and blocks Phase 2: `--apply` must not trust the `auto-delete` set until the fix lands.

Execution: `/b-build-hard` against the phase file. No `orchestrate` keyword.
