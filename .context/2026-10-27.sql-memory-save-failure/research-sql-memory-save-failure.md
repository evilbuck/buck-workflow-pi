---
date: 2026-10-27
status: completed
---
# SQL memory save failure

## Scope
Diagnose and fix the SQL memory error visible in the other Herdr tab, including `/buck-loop` logging. Preserve existing uncommitted work in the `fix/sql-memory` checkout. Do not bypass receipts or invent checkpoint identities.

## Captured evidence
- Affected pane: `w1E:p3`, worktree `/home/buckleyrobinson/.worktrees/buck-workflow-pi/feat.git-cleanup-skill`.
- Loop subject: `2026-10-26.git-cleanup-skill`; projection is `saving` during inspection.
- `.context/workflow/buck-loop.log.jsonl`, invocation `ac930d84-022d-4e5b-a862-2ed50990477a`: recalls succeed; save calls repeatedly fail with truncated notices `memory content and provenance are…` and `SQL correction target was superse…`.
- Earlier invocation `4ac82fe9-5f7b-473f-810c-5973dc0008d0` blocked with `SQL save receipt ids were not readable for this project: 01a17acb-c885-70f5-87a0-4c6b3311cc27`.
- Secondary model-written recall errors: nonexistent `subject` column; disallowed `LEFT` and `sql_memory_attempts`. These do not explain successful recalls followed by failing saves.
- Native screenshot unavailable: Wayland capture requires the `wayland-pipewire` feature. Herdr read-only CLI inspection is available.

## Feedback loop
Real-trigger reproduction exited 1 with PostgreSQL `P0001`: `memory content and provenance are immutable; insert a successor memory`. The stateful attempt-binding test also failed with this exact error after its fixture was corrected to enforce the database invariant.

## Repair and verification
`bindSaveAttempt` was updating immutable `memories.context` after saving. It now inserts idempotent membership in existing `tags`/`memory_tags`, and the supervisor derives receipt ids from that membership. Fresh saves, retry identity, corrections, later attempts, project isolation, and receipt reconstruction passed against PostgreSQL's real trigger using temporary tables. Focused regressions: 74 passed, 1 skipped. Final authoritative guardrails: pass; coverage 89.3%. See `research-verification.md` and `review-sql-memory-save-failure.md`.

The user approved the minimal `machine.ts::next` complexity refactor and chose to handle the neighboring OMP restart personally. No process, loop projection, checkpoint, or production memory row was changed manually; no commit was made.
