# Buck-Workflow for agents

A loose collection of skills, prompts, and extensions for agentic development workflows.

## Targets
The targets for this are pi-coding-agent, opencode, claude, codex.

## Agent Documentation
Do not guess at implementation. Look it up.

### Skills
- [pi](https://pi.dev/docs/latest/skills)
- [claude](https://code.claude.com/docs/en/skills)
- [opencode](https://opencode.ai/docs/skills/)
- [codex](https://developers.openai.com/codex/skills)

### Prompts / Commands
- [pi — Prompt Templates](https://pi.dev/docs/latest/prompt-templates)
- [claude — Commands](https://code.claude.com/docs/en/commands)
- [opencode — Commands](https://opencode.ai/docs/commands/)
- [codex — Slash Commands](https://developers.openai.com/codex/guides/slash-commands/)

### Extensions / Plugins
- [pi — Extensions](https://pi.dev/docs/latest/extensions)
- [claude — Plugins](https://code.claude.com/docs/en/plugins)
- [opencode — Plugins](https://opencode.ai/docs/plugins/)
- [codex — Plugins](https://developers.openai.com/codex/plugins)

## Architecture

Buck workflow uses a **three-layer model** for portability across agents (Pi, Claude Code, OpenCode, Codex):

1. **Skills** (`skills/`) — Canonical, portable workflow logic. These are the reusable instruction sets that define *how* each workflow behaves. They are agent-neutral and the source of truth.
2. **Commands / Prompts** (`prompts/`) — Agent-native thin wrappers that invoke skills. Pi uses prompt templates (`/b-*`). Claude Code, OpenCode, and Codex use their own command/skill mechanisms to load the same canonical skill.
3. **Extensions / Plugins** (`extensions/`) — Runtime automation that needs event hooks, session state, and persistence. Not portable as static instructions; stays agent-specific.

For the full rationale and migration details, see `.context/2026-05-12.prompt-to-skill-portability/plan-prompt-to-skill-portability.md`.

**Note on agent-specific syntax in skills:** Skills may reference Pi-specific syntax (e.g. `/skill:b-phase`, `/b-save`) when describing workflow handoffs. This is intentional — each agent's wrapper layer adapts these to native equivalents. The skill body remains the canonical logic; only the invocation surface varies per agent.

## Project Structure

```
skills/          # Canonical portable skills (b-brainstorm, b-research, b-plan, b-build, b-iterate, b-review, b-present, b-phase, git-commit, b-grill*, run-in-idle-pane)
prompts/         # Pi prompt templates — thin wrappers that invoke skills
extensions/      # Pi extensions for runtime automation (b-flow, b-grill-auto)
docs/            # Documentation
presentations/   # Output from b-present
```

# Intention

The skills, prompts, and extensions are designed to have a loose coupling. Each can build off the other, but it's not 100% required for most skills to be used in a dogmatic workflow that encompasses an entire development pass. For example, if `b-plan` is run, but there wasn't a `b-brainstorm` step, that's ok. `b-plan` will fill in the gaps as much as possible. It won't be as thorough, and that's ok for some tasks.

