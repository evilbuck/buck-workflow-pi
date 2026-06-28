---
date: 2026-06-28
domains: [docs, bootstrap, agent]
topics: [global-agents, response-style, concise-default, semantic-summary]
related: ["GLOBAL_OR_PROJECT-AGENTS.md"]
priority: medium
status: completed
artifacts: ["GLOBAL_OR_PROJECT-AGENTS.md"]
---

# Bootstrap response style update

Added a new `Default Response Style` section to `GLOBAL_OR_PROJECT-AGENTS.md`.

## What changed

The bootstrap guidance now tells the agent to default to concise, semantic answers:
- overview first
- why it matters second
- implementation detail only on request or when a material risk requires it

It also makes branch-status answers explicitly semantic rather than file-by-file.

## Verification

- Re-read the inserted section in `GLOBAL_OR_PROJECT-AGENTS.md` after editing.
