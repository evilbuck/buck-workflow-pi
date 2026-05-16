---
date: 2026-05-12
domains: [planning, docs, agent]
topics: [prompts, skills, portability, commands, plugins]
subject: 2026-05-12.prompt-to-skill-portability
artifacts: [plan-prompt-to-skill-portability.md, tasks.md]
related: []
priority: high
status: active
---

# Session: 2026-05-12 - Prompt to Skill Portability Plan

## Context
- User asked whether converting Buck workflow prompts to skills is the right approach for portability across Pi, Claude Code, OpenCode, and Codex.
- Prior session change expanded `AGENTS.md` documentation links for skills, prompts/commands, and extensions/plugins.

## Decisions Made
- Recommended a layered architecture, not a wholesale prompt-to-skill replacement:
  - Skills hold canonical portable workflow logic.
  - Prompts/commands remain thin native invocation wrappers.
  - Extensions/plugins keep runtime automation, persistence, hooks, and custom tools.
- Recommended `b-phase` before implementation because the migration spans multiple agent surfaces and has source-of-truth drift risk.

## Artifacts Written
- `.context/2026-05-12.prompt-to-skill-portability/plan-prompt-to-skill-portability.md`
- `.context/2026-05-12.prompt-to-skill-portability/tasks.md`

## Next Steps
- Run `/skill:b-phase` on the plan, or proceed with `b-build-hard` if implementing directly.
