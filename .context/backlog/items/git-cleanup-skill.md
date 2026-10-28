---
title: Add git-cleanup skill
status: active
priority: high
created: 2026-10-26
updated: 2026-10-26
completed: null
related:
  - .context/2026-10-26.git-cleanup-skill/plan-git-cleanup.md
  - .context/2026-10-26.git-cleanup-skill/plan-git-cleanup-phases.md
  - .context/2026-10-26.git-cleanup-skill/phase-1-classify-json.md
  - skills/git-clean-orphans/SKILL.md
  - prompts/git-clean-orphans.md

# Add git-cleanup skill

## Problem

`git-clean-orphans` treats ancestry as "merged" and asks before every delete. Squash and rebase land code without making the branch an ancestor. Worktrees outside the main repo parent are skipped even when they belong to the repo.

## Acceptance criteria

- [ ] Follow `.context/2026-10-26.git-cleanup-skill/plan-git-cleanup.md`
- [ ] Proven-landed clean local branches and worktrees are deleted without a second prompt
- [ ] Unproven, dirty, and unique-`.context` items are asked, with description and planning / building / finished

Execution is phased. Start at [phase-1-classify-json.md](../../2026-10-26.git-cleanup-skill/phase-1-classify-json.md). Do not build the delete path or the redirect in that session.
