---
title: Add /worktrees-active-recap
status: active
priority: medium
created: 2026-10-06
updated: 2026-10-06
completed: null
related:
  - .context/2026-10-06.worktrees-active-recap/plan-worktrees-active-recap.md
  - extensions/index.ts
  - extensions/subprocess.ts
  - skills/git-clean-orphans/SKILL.md
---

# Add /worktrees-active-recap

## Problem

Listing unmerged worktrees currently takes a model turn over `git worktree list`, ancestor checks, and status. That recap is slow and spends tokens on facts git already has.

## Acceptance criteria

- [ ] `/worktrees-active-recap` reports unmerged worktrees, a 4-day default window, committed subjects, and dirty paths with no model call
- [ ] Implementation follows `.context/2026-10-06.worktrees-active-recap/plan-worktrees-active-recap.md`
