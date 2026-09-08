---
date: 2026-09-08
status: completed
domains: [skill, buck-workflow, docs]
topics: [b-init-factory, software-factory, agents-md, cross-harness]
related: []
research: []
memory: [../memory/b-init-factory-2026-09-08.md]
priority: medium
---

# Plan: b-init-factory

## User Goal

A command that writes a simplistic factory-scoped `AGENTS.md` inside a nested harness folder treated as its own project (skills/commands factory, agent-agnostic, factory-local `docs/`). Target folder is **told**, a **project default**, or **asked** — not `.claude/`-specific.

## Deliverables

1. Canonical skill `skills/b-init-factory/SKILL.md` + template `references/factory-agents.md`
2. Thin prompt `prompts/b-init-factory.md` + OMP `commands/b-init-factory.md` symlink
3. Cross-harness: Codex plugin copy; Claude/OpenCode/Grok via installer glob; Goose Summon note; live `~/.agents/skills/b-init-factory`
4. README + `docs/buck-workflow.md` catalogs; Goose Cross-Agent row

## Non-goals

- Running the factory init against this repo
- Filling factory `docs/` (later pass)
- Extension code
