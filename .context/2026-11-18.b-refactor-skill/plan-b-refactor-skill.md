---
title: b-refactor skill
status: completed
date: 2026-11-18
subject: 2026-11-18.b-refactor-skill
---

# b-refactor

## User Goal

A skill that removes one piece of accidental complexity per run, targeted or found, so a night loop can land 1–4 reviewable PRs without turning into a rewrite.

## Decision

One invocation, one force, one PR-sized diff. The night loop is the caller. The skill does not commit or open the PR. Behavior is pinned before the first structural edit. Book patterns lose to the written canon, the local exemplar, and the framework's ordinary form.

## Landed

- `skills/b-refactor/SKILL.md`
- `prompts/b-refactor.md`
- `commands/b-refactor.md` symlink
- README and `docs/buck-workflow.md` rows
- Not bundled in the Codex plugin. Does not consult `buckModels`.
