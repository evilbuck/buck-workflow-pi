---
status: completed
date: 2026-09-18
subject: 2026-09-18.buck-loop-extension
plan: plan-buck-loop-extension.md
memory:
  - buck-loop-live-feedback-2026-09-18.md
---

# Iterate: buck-loop live feedback and nested failure handoff

## Reported behavior

`/buck-loop <subject>` appeared idle while nested work ran. A real Todo CLI smoke then exposed three independent blockers: the commit worker left changes staged, a protected-branch commit was refused, and the loop parsed the worker's abbreviated review summary instead of the fresh review artifact.

## Changes

- The command now owns one visible activity for the full run and updates it for build, review, iterate, docs, save, commit, and closed-set choice work.
- Every failed nested model call emits a parent-agent message containing loop state, operation, attempted action, exact prompt, agent kind/id/role/model, and a serialized error. Delivery triggers the parent on its next turn while the durable blocked projection remains authoritative.
- Commit work is staged before the nested commit step. The local projection is excluded through Git's per-worktree exclude file and any legacy tracked projection is removed from the index.
- Explicit `/buck-loop` invocation authorizes the nested commit as `/b-commit force`, including protected branches.
- A fresh durable `b-review` artifact now wins over an abbreviated assistant summary; the summary remains the fallback only when no review artifact changed.

## Regression evidence

- Protected-branch authorization test failed before the prompt directive and passed after it.
- Fresh-review-artifact test reproduced the live block and passed after artifact precedence changed.
- Buck-loop suite: 7 files, 165 tests passed.
- Isolated real OMP smoke transitioned `idle → resolving → building → reviewing → saving → committing → done`.
- Smoke repository commit advanced from `b3e0fb3` to `209fbca` with a clean worktree.
- Smoke project: `npm test` passed 18/18; manual add → list → done → list produced the exact planned output.
- Required guardrails passed after complexity refactoring and restoring the Codex curated bundle's canonical-copy parity; the focused Codex bundle test passed 7/7.
