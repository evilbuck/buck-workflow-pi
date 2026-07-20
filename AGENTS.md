# Buck-Workflow for agents

A loose collection of skills, prompts, and extensions for agentic development workflows.

## Targets
The targets for this are pi-coding-agent, oh-my-pi (omp), claude, codex, goose.
 
 ## Cross-Platform Agent Reference
 
 Detailed docs for each agent's context files, skills, and customization:
 
 | Agent | Context File(s) | Skills Location | Skills Standard | Extensions | Doc |
 |---|---|---|---|---|---|
 | **Pi** | `AGENTS.md`, `SYSTEM.md`, `APPEND_SYSTEM.md` | `~/.pi/agent/skills/`, `.pi/skills/`, `~/.agents/skills/` | [Agent Skills](https://agentskills.io) | TypeScript (`~/.pi/agent/extensions/`) | [docs/pi.md](docs/pi.md) |
 | **Oh My Pi (omp)** | `AGENTS.md`, `CLAUDE.md`, `SYSTEM.md` | `~/.omp/agent/skills/`, `.omp/skills/` + Pi paths | [Agent Skills](https://agentskills.io) | TypeScript (`~/.omp/agent/extensions/`) | [docs/oh-my-pi.md](docs/oh-my-pi.md) |
 | **Claude Code** | `CLAUDE.md` (root + subdirs) | `~/.claude/skills/`, `.claude/skills/` | [Agent Skills](https://agentskills.io) | Plugins, hooks, subagents | [docs/claude-code.md](docs/claude-code.md) |
 | **Codex** | `AGENTS.md`, `AGENTS.override.md` (walk root→cwd) | `$HOME/.agents/skills/`, `.agents/skills/` | [Agent Skills](https://agentskills.io) | Plugins (`.codex/plugins/`) | [docs/codex.md](docs/codex.md) |
 | **Goose** | `.goosehints`, `AGENTS.md` | Via Summon extension | Skills via Summon | MCP servers (all extensions are MCP) | [docs/goose.md](docs/goose.md) |

### Bootstrap vs Project `AGENTS.md`

- `GLOBAL_OR_PROJECT-AGENTS.md` is the **installable bootstrap source** for agent-global `AGENTS.md` files (for example `~/.omp/agent/AGENTS.md`, `~/.pi/agent/AGENTS.md`, or other harness bootstrap targets).
- This repository's root `AGENTS.md` is the **project-specific directive** for work inside `buck-workflow-pi`.
- They are intentionally different:
  - `GLOBAL_OR_PROJECT-AGENTS.md` stays generic and installable across projects.
  - `AGENTS.md` carries repository-specific workflow, architecture, and packaging guidance.
- When updating bootstrap policy, update `GLOBAL_OR_PROJECT-AGENTS.md` and any docs describing install/sync behavior.
- When updating repository-local guidance, update this `AGENTS.md`.

### Shared Skill Directories
 
 The `~/.agents/skills/` and `.agents/skills/` paths are the cross-tool standard. Pi, OMP, and Codex all scan these. Claude Code uses `.claude/skills/` but Pi/OMP can be configured to load from it too:
 
 ```json
 // ~/.pi/agent/settings.json or ~/.omp/agent/settings.json
 { "skills": ["~/.claude/skills"] }
 ```
 
 ### Context File Conventions
 
 | Convention | Used by | File |
 |---|---|---|
 | `AGENTS.md` at project root | Pi, OMP, Codex, Goose | Standard cross-tool context |
 | `CLAUDE.md` at project root + subdirs | Claude Code, OMP (reads on first launch) | Claude-specific context |
 | `.goosehints` per directory | Goose | Goose-specific hints |
 | `SYSTEM.md` / `APPEND_SYSTEM.md` | Pi, OMP | System prompt customization |
 
 ### Agent Documentation Links
 
 **Skills:**
 - [pi](https://pi.dev/docs/latest/skills) · [claude](https://code.claude.com/docs/en/skills) · [codex](https://developers.openai.com/codex/skills) · [goose](https://goose-docs.ai/docs/getting-started/using-extensions/)
 
 **Prompts / Commands:**
 - [pi — Prompt Templates](https://pi.dev/docs/latest/prompt-templates) · [claude — Commands](https://code.claude.com/docs/en/commands) · [codex — Slash Commands](https://developers.openai.com/codex/guides/slash-commands/)
 
 **Extensions / Plugins:**
 - [pi — Extensions](https://pi.dev/docs/latest/extensions) · [claude — Plugins](https://code.claude.com/docs/en/plugins) · [codex — Plugins](https://developers.openai.com/codex/plugins)


## Architecture

Buck workflow uses a **three-layer model** for portability across agents (Pi, Claude Code, OpenCode, Codex):

1. **Skills** (`skills/`) — Canonical, portable workflow logic. These are the reusable instruction sets that define *how* each workflow behaves. They are agent-neutral and the source of truth.
2. **Commands / Prompts** (`prompts/`) — Agent-native thin wrappers that invoke skills. Pi uses prompt templates (`/b-*`). Claude Code, OpenCode, and Codex use their own command/skill mechanisms to load the same canonical skill.
3. **Extensions / Plugins** (`extensions/`) — Runtime automation that needs event hooks, session state, and persistence. Not portable as static instructions; stays agent-specific.

For the full rationale and migration details, see `.context/2026-05-12.prompt-to-skill-portability/plan-prompt-to-skill-portability.md`.

**Note on agent-specific syntax in skills:** Skills may reference Pi-specific syntax (e.g. `/skill:b-phase`, `/b-save`) when describing workflow handoffs. This is intentional — each agent's wrapper layer adapts these to native equivalents. The skill body remains the canonical logic; only the invocation surface varies per agent.

## Project Structure

```
skills/          # Canonical portable skills (b-brainstorm, b-research, b-plan, b-build, b-iterate, b-review, b-docs, b-save, b-present, b-phase, fix-pr, git-commit, b-grill*, run-in-idle-pane, …)
extensions/      # Pi extensions for runtime automation (b-flow, b-grill-auto)
prompts/         # Pi prompt templates — thin wrappers that invoke skills (including b-commit wrapping git-commit skill)
docs/            # Documentation
presentations/   # Output from b-present
```

## Setup

### OMP skill loading

OMP scans `.omp/skills/` (native provider, priority 100). The canonical skills live in `skills/`. Link them once:

```bash
mkdir -p .omp && ln -s ../skills .omp/skills
```

This makes all project skills load automatically on next OMP start. Pi does not need this — it scans `skills/` directly.

## Available Skills

**Vault-Native LLM Wiki** (`skills/llm-wiki-vault/`): Enables any agent to ingest sources, build interlinked research notes, and maintain the Obsidian knowledge base at `~/Documents/second brain` using the same vault-native LLM Wiki protocol Hermes uses. Agents load it automatically from this project's `skills/` directory. See the skill's Quick Agent Lookup block for invocation keys (`LLM-WIKI`, `INGEST`, `QUERY`, `LINT`, `WIKI-SCHEMA`, etc.).

# Buck Workflow Steps

Buck workflow commands follow a discoverable `/b-` prefix. The completion sequence is: review → (fix issues / sync docs) → save → commit:

```
/b-build → /b-review → /b-iterate (if in-plan issues) → /b-docs (if doc impact) → /b-save → /b-commit
```

**Out-of-plan review findings** (issues beyond the plan's scope) do **not** iterate — they spawn a separate `/b-plan` → `/b-build` cycle, after the accepted work is closed via `/b-save` → `/b-commit`. `/b-iterate` is reserved for in-plan defects.

`/b-commit` is the final step after durable state has been recorded via `/b-save`. It uses the `git-commit` skill to create a Conventional Commits message and commit.
`/b-docs` is a conditional step: when `/b-review` flags documentation impact (new conventions, architecture decisions, or domain language), run it to update the project's living docs before `/b-save`. See `skills/b-docs/SKILL.md` for the canonical doc locations.

**PR review feedback** (external comments on a PR, not your own `/b-review` loop): load `fix-pr` via `/skill:fix-pr <pr-url-or-number>`. Skill-only — no `prompts/`/`commands/` wrapper. Validates each comment against code, then fixes+pushes in-session or files GitHub issues. See `skills/fix-pr/SKILL.md`.

# Intention

The skills, prompts, and extensions are designed to have a loose coupling. Each can build off the other, but it's not 100% required for most skills to be used in a dogmatic workflow that encopasses an entire development pass. For example, if `b-plan` is run, but there wasn't a `b-brainstorm` step, that's ok. `b-plan` will fill in the gaps as much as possible. It won't be as thorough, and that's ok for some tasks.

# OMP integration

buck-workflow plans and phase files are omp-aware — see [docs/buck-workflow.md § OMP Autonomous Loops](docs/buck-workflow.md#omp-autonomous-loops) for the full description. Three primitives (`/goal set`, the `orchestrate` keyword, the `workflow` keyword) are user-toggled; the workflow only *recommends* them via the `omp_execution` phase field, the `eval-<topic>.py` template for `workflow` plans, and the `b-review` 6-step completion-audit. Slash-command stubs at `prompts/omp-{orchestrate,workflow,goal}.md` document each contract. Background: `.context/2026-06-06.omp-integration-buck-workflow/`. The b-flow deprecation (`.context/2026-06-01.deprecate-b-flow/`) is the lesson: no new extension-based orchestration, prompt-level / skill-level only.

