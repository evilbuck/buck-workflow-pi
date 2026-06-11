---
title: Add b-pr skill for GitHub PR creation
status: completed
priority: medium
created: 2026-06-11
updated: 2026-06-11
completed: 2026-06-11
related:
  - .context/2026-06-11.b-pr-skill/index.md
  - skills/b-pr/SKILL.md
  - skills/b-pr/scripts/pr-preflight.ts
  - prompts/b-pr.md
  - commands/b-pr.md
---

# Add b-pr skill for GitHub pull request creation

## Problem

No skill existed for the final step of the Buck workflow after committing: opening a GitHub pull request. Manual `gh pr create` invocations required the user to figure out base branches, write descriptions, and verify rebase status themselves.

## Desired outcome

A `b-pr` skill that:
- Detects candidate base branches (`main`/`master`/`dev`/`develop`) from remote refs
- Confirms the base branch with the user before proceeding
- Verifies the feature branch is fully rebased (exits with code 2 if behind)
- Generates a PR description with two distinct sections: one for humans (scannable, impact-focused) and one for agents (technical, copy-pasteable verification steps)
- Uses `.context/` artifacts (plans, specs, brainstorms) to enrich the description
- Optionally polishes the description via a parallel subagent when the harness supports it
- Creates the PR via `gh pr create` with `--draft` and `--dry-run` flags

## Acceptance criteria

- `skills/b-pr/SKILL.md` documents the 7-phase procedure
- `skills/b-pr/scripts/pr-preflight.ts` runs deterministically with `bun`, handles base detection, rebase check, diff gathering, and `.context/` artifact scanning
- `prompts/b-pr.md` wraps the skill for Pi invocation
- `commands/b-pr.md` mirrors the skill for non-Pi agents
- Script verified to exit 0 on base detection and exit 2 on rebase-needed (tested 2026-06-11)

## Out of scope

- Posting PR comments/reviews (already covered by `skills/code-review/`)
- PR templates or `gh` repo configuration
- Auto-push (the skill tells the user to push if needed; never auto-pushes)
