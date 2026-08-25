---
status: active
date: 2026-08-20
subject: 2026-08-20.deterministic-extension-progress
---

# Deterministic extension progress feedback

Slash commands like `/b-pr-improved` look frozen until they finish. This
subject covers live TUI progress for the wired deterministic command
extensions.

## Artifacts

- `plan-deterministic-extension-progress.md` — implementation plan

## User Goal

When I run `/b-pr-improved` (or `/b-commit-improved` / `/b-kamal-release`),
the TUI shows that the command is working — phase-level progress, not a
frozen last-command line until it suddenly finishes.
