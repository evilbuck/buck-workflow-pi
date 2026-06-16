---
title: Add b-fix-rebase-conflict skill
status: completed
priority: medium
created: 2026-06-16
updated: 2026-06-16
completed: 2026-06-16
related:
  - .context/2026-06-16.b-fix-rebase-conflict/index.md
  - skills/b-fix-rebase-conflict/SKILL.md
  - skills/b-fix-rebase-conflict/scripts/rebase-conflict-analyze.ts
  - skills/b-fix-rebase-conflict/scripts/rebase-conflict-analyze.test.ts
  - prompts/b-fix-rebase-conflict.md
  - commands/b-fix-rebase-conflict.md
  - README.md
---

# Add b-fix-rebase-conflict skill

## Problem

Large rebases and merges are high-risk when the agent only sees raw conflict markers. The repository lacked a dedicated conflict-resolution skill that could gather commit intent, `.context/` artifacts, and operation semantics before editing conflicted files.

## Desired outcome

A `b-fix-rebase-conflict` skill that:
- detects active rebase or merge conflict state
- gathers structured conflict hunks and per-file commit history with a bun helper script
- reads relevant `.context/` artifacts when present
- resolves conflicts semantically in batch and stages files
- stops at a manual gate before any `git ... --continue`

## Acceptance criteria

- `skills/b-fix-rebase-conflict/SKILL.md` documents the workflow and safety rules
- `skills/b-fix-rebase-conflict/scripts/rebase-conflict-analyze.ts` reports operation type, hunk data, commit intent, and context artifacts
- `prompts/b-fix-rebase-conflict.md` and `commands/b-fix-rebase-conflict.md` expose the skill
- README documents the new command, skill, and workflow route
- targeted merge/rebase conflict checks and Vitest coverage pass
