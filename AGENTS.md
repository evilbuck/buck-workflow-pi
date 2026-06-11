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
extensions/      # Pi extensions for runtime automation (b-flow, b-grill-auto)
prompts/         # Pi prompt templates — thin wrappers that invoke skills (including b-commit wrapping git-commit skill)
docs/            # Documentation
presentations/   # Output from b-present
```

# Buck Workflow Steps

Buck workflow commands follow a discoverable `/b-` prefix. The completion sequence is: review → save → commit:

```
/b-build → /b-review → /b-iterate (if needed) → /b-save → /b-commit
```

`/b-commit` is the final step after durable state has been recorded via `/b-save`. It uses the `git-commit` skill to create a Conventional Commits message and commit.

# Intention

The skills, prompts, and extensions are designed to have a loose coupling. Each can build off the other, but it's not 100% required for most skills to be used in a dogmatic workflow that encopasses an entire development pass. For example, if `b-plan` is run, but there wasn't a `b-brainstorm` step, that's ok. `b-plan` will fill in the gaps as much as possible. It won't be as thorough, and that's ok for some tasks.

# OMP integration

buck-workflow plans and phase files are omp-aware — see [docs/buck-workflow.md § OMP Autonomous Loops](docs/buck-workflow.md#omp-autonomous-loops) for the full description. Three primitives (`/goal set`, the `orchestrate` keyword, the `workflow` keyword) are user-toggled; the workflow only *recommends* them via the `omp_execution` phase field, the `eval-<topic>.py` template for `workflow` plans, and the `b-review` 6-step completion-audit. Slash-command stubs at `prompts/omp-{orchestrate,workflow,goal}.md` document each contract. Background: `.context/2026-06-06.omp-integration-buck-workflow/`. The b-flow deprecation (`.context/2026-06-01.deprecate-b-flow/`) is the lesson: no new extension-based orchestration, prompt-level / skill-level only.

