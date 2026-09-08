---
date: 2026-09-08
domains: [skill, buck-workflow, docs]
topics: [b-init-factory, software-factory, agents-md, cross-harness]
related: []
priority: medium
status: completed
subject: 2026-09-08.b-init-factory
artifacts:
  - skills/b-init-factory/SKILL.md
  - skills/b-init-factory/references/factory-agents.md
  - prompts/b-init-factory.md
  - commands/b-init-factory.md
  - plugins/buck-workflow/skills/b-init-factory/SKILL.md
  - README.md
  - docs/buck-workflow.md
  - docs/goose.md
---

# b-init-factory skill and cross-harness command

User asked to turn nested-factory AGENTS.md instructions into an OMP prompt/command, then make it compatible with other agents. Follow-up: do not hardcode `.claude/`; resolve factory root as told, project default, or ask.

Shipped:

- Skill `b-init-factory`: resolve root → write factory `AGENTS.md` from template → mkdir factory `docs/` (empty). Agent-agnostic; always `AGENTS.md` even under `.claude/`.
- `/b-init-factory` prompt + OMP symlink; Codex plugin copy; installer globs cover Claude/OpenCode/Grok; Goose via Summon (documented).
- Catalogs: README command/skill tables + Cross-Agent Goose row; `docs/buck-workflow.md` QRT + section.

This pass does not run the factory init and does not write factory documentation.
