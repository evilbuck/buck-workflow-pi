---
status: active
date: 2026-06-11
subject: 2026-06-11.b-pr-skill
topics: [b-pr, pull-request, github, gh-cli, git, buck-workflow, skill]
---

# b-pr skill

## Summary

New `b-pr` skill for creating GitHub pull requests from the current feature branch. Detects the base branch (with user confirmation), verifies the branch is fully rebased, generates a dual-audience description (Humans at top, Agents at bottom) from the diff and `.context/` artifacts, optionally polishes the description via a parallel subagent, then creates the PR via `gh pr create`.

## Artifacts

- `skills/b-pr/SKILL.md` — the skill body
- `skills/b-pr/scripts/pr-preflight.ts` — deterministic git/gh plumbing
- `prompts/b-pr.md` — Pi prompt wrapper
- `commands/b-pr.md` — command wrapper for non-Pi agents
- `backlog/items/b-pr-skill.md` — backlog item

## Status

Active — skill files written, script verified (base detection + rebase detection both work). No PR created (this work was authoring the skill, not a PR-worthy change).
