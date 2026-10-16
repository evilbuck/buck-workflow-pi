# Tasks: Prompt to Skill Portability

**Created**: 2026-05-12
**Status**: in-progress

## Tasks

- [ ] Inventory prompt templates and classify each as canonical skill, thin wrapper, runtime automation, or helper.
- [ ] Create canonical skills for prompt-only Buck workflows.
- [ ] Convert Pi prompt templates into thin wrappers around canonical skills.
- [ ] Resolve duplication between `prompts/b-present.md` and `skills/b-present/SKILL.md`.
- [ ] Add or document Claude Code, OpenCode, and Codex command/plugin adapter strategy.
- [ ] Update README/AGENTS documentation for the layered architecture.
- [ ] Verify representative workflows through direct skill invocation and command wrappers.

## Notes
- Recommended architecture: skills hold portable workflow logic; commands/prompts provide native invocation; extensions/plugins handle runtime automation.
- Candidate next workflow: `/skill:b-phase` before implementation because this touches multiple agent surfaces.
