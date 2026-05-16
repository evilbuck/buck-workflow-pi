---
status: active
date: 2026-05-12
subject: 2026-05-12.prompt-to-skill-portability
topics: [prompts, skills, portability, agents, commands, plugins]
research: []
spec: null
memory: []
---

# Plan: Convert Buck workflow prompts into portable skills with thin agent command wrappers

## Goal
Make Buck workflow reusable across Pi, Claude Code, OpenCode, and Codex by treating skills as the canonical portable workflow units while preserving each agent's native command/prompt entry points as thin wrappers.

## Recommendation
Yes, converting the workflow bodies from prompts into skills is the right direction for portability, but do **not** convert everything into skills and delete prompts/commands.

Use a layered model:

1. **Canonical workflow logic** → portable `skills/<workflow>/SKILL.md`
2. **Agent-native invocation surface** → thin prompts/commands that load or invoke the skill
3. **Runtime/session automation** → extensions/plugins, not skills

This keeps the workflow portable without losing ergonomics in each agent.

## Context used / assumptions
- User-provided context: The project targets Pi, Claude Code, OpenCode, and Codex and wants prompts converted to skills for portability.
- Session context: `AGENTS.md` was just expanded with direct documentation links for skills, prompts/commands, and extensions/plugins per agent.
- Project context:
  - `README.md` currently says most `/b-*` commands map to Pi prompt templates in `prompts/`.
  - `package.json` currently declares Pi package entries for `extensions`, `prompts`, and `skills`.
  - Existing prompt templates live in `prompts/`: `b-brainstorm`, `b-research`, `b-plan`, `b-present`, `b-build`, `b-build-hard`, `b-iterate`, `b-review`, `git-commit`.
  - Existing skills already cover selected reusable helpers: `b-grill-*`, `b-phase`, `b-present`, `run-in-idle-pane`.
- Pi docs used:
  - Skills are loaded progressively from `SKILL.md`; only name/description are always in context.
  - Prompt templates are Markdown snippets expanded by slash commands.
  - Packages can export `pi.skills`, `pi.prompts`, and `pi.extensions` together.
- Assumption: The desired portable unit is the workflow instruction set, not necessarily identical command syntax across all agents.
- Open question: Whether this repo should ship generated Claude/OpenCode/Codex command files directly, or only source templates/scripts that generate them.

## Scope
- Define a canonical skill-first architecture for Buck workflow.
- Migrate prompt bodies that represent reusable workflow behavior into skills.
- Keep prompts/commands as agent-specific shims for discoverability and fast invocation.
- Document how each agent maps skills, commands/prompts, and plugins/extensions.
- Add validation guidance so converted skills preserve behavior.

## Out of scope
- Rewriting runtime automation such as `/b-save` into a skill. Runtime/session state should remain an extension/plugin concern.
- Forcing a lowest-common-denominator command format across all agents.
- Removing Pi prompt templates before equivalent skill wrappers are proven.
- Building full marketplace/distribution packaging for every agent in the same pass.

## Affected files
Likely files/directories for a future implementation pass:

- `prompts/*.md` — existing Pi prompt templates to be reduced to thin wrappers or retained as compatibility launchers.
- `skills/<workflow>/SKILL.md` — new canonical skills for workflows currently implemented only as prompts.
- `skills/b-present/SKILL.md` — existing overlap with `prompts/b-present.md`; decide canonical ownership and remove duplication.
- `README.md` — update the Pi-native mapping to a cross-agent layered architecture.
- `AGENTS.md` — optionally add short guidance: "use skills for portable workflow logic; use commands/prompts as wrappers; use plugins/extensions for runtime automation."
- `package.json` — keep Pi package exports for prompts/skills/extensions; add metadata only if needed.
- Potential future directories if this repo ships native adapters:
  - `.claude/commands/` or package/plugin equivalent for Claude Code command shims.
  - `.opencode/commands/` or package/plugin equivalent for OpenCode command shims.
  - Codex plugin/package files for Codex skill/plugin distribution.

## Proposed architecture

### Canonical skill layer
Create one portable skill per major workflow:

- `skills/b-brainstorm/SKILL.md`
- `skills/b-research/SKILL.md`
- `skills/b-plan/SKILL.md`
- `skills/b-build/SKILL.md`
- `skills/b-build-hard/SKILL.md`
- `skills/b-iterate/SKILL.md`
- `skills/b-review/SKILL.md`
- Keep or reconcile existing `skills/b-present/SKILL.md`

Each skill should include:

- `name` and high-signal `description`
- role and behavior instructions
- write boundaries
- context resolution rules
- output contract
- references to helper scripts/assets using relative paths
- agent-neutral terminology where possible

**Context bloat mitigation**: Keep frontmatter (name/description) minimal; load full SKILL.md body on demand. Pi's progressive loading model means only name/description are always in context. Large skills should defer non-essential content (examples, references) to separate `.md` files in the skill directory.

### Command / prompt shim layer
For each supported agent, expose native commands that simply activate the canonical skill:

| Agent | Skill invocation | Command/prompt invocation | Notes |
|-------|-----------------|---------------------------|-------|
| **Pi** | `/skill:<name>` | `/b-*` prompt templates | Prompts invoke skills via wrapper text |
| **Claude Code** | Skill in `.claude/skills/` | `claude -p` or `/command` | Commands call skill functions |
| **OpenCode** | Skill in `.opencode/skills/` | Slash commands (`/b-*`) | Commands route to skill instructions |
| **Codex** | Plugin-bundled skills | Slash commands | Skills are primary; commands are UI affordances |

- **Pi**: keep `/b-*` prompt templates in `prompts/`, but shrink them to wrappers such as "Load and follow `/skill:b-plan` with these arguments: `$ARGUMENTS`."
- **Claude Code**: command files or plugin-bundled commands should call/activate the matching skill.
- **OpenCode**: command markdown should route to the matching skill instructions, preserving `$ARGUMENTS` semantics where possible.
- **Codex**: plugin-bundled skills should be the primary portable unit; slash commands remain control/UI affordances where available.

### Extension / plugin layer
Keep behavior that needs runtime state, event hooks, persistence, or custom tools outside skills:

- `/b-save` — **currently implemented as**: check `AGENTS.md` and package.json for runtime command definitions. Do NOT convert to a skill; this remains an extension/plugin concern.
- session state orchestration
- background/flow automation
- tmux/dev-server integration where tool behavior is required

## Implementation steps
See `tasks.md` for a persistent checklist.

1. Inventory every prompt and classify it as:
   - workflow skill candidate,
   - thin command wrapper,
   - runtime automation command,
   - or one-off helper.
2. Create canonical skills for prompt-only workflows.
3. Extract common workflow boilerplate into shared references where useful, but avoid over-abstracting before behavior is stable.
4. Convert Pi prompts to thin wrappers that invoke or strongly direct the agent to the matching skill.
5. Resolve duplication between `prompts/b-present.md` and `skills/b-present/SKILL.md`. **Decision**: `skills/b-present/SKILL.md` becomes the canonical source; `prompts/b-present.md` becomes a thin wrapper that invokes the skill. Delete redundant content from the prompt after migration.
6. Add agent adapter docs or generated shim templates for Claude Code, OpenCode, and Codex.
7. Update `README.md` and `AGENTS.md` to describe the layered model.
8. Validate by running one representative workflow through each layer: plan → build → review → save.

## Verification
- Confirm each canonical skill has valid `SKILL.md` frontmatter and a specific description.
- Confirm Pi still lists `/b-*` entries and the user-facing command surface remains familiar.
- Confirm skill invocation works directly, e.g. `/skill:b-plan ...` or equivalent.
- Compare behavior of old prompt vs new skill for at least:
  - `b-plan`
  - `b-build`
  - `b-review`
- Confirm runtime commands such as `/b-save` remain extension/plugin-backed rather than converted into static skills.
- Run package/type checks if implementation touches TypeScript extension code.

## Risks
- **Over-conversion risk**: Skills are not a full replacement for commands/plugins. Converting runtime automation into skills would lose event hooks and persistence.
- **Invocation mismatch**: Agents differ in how users invoke skills and commands; wrappers may need agent-specific syntax.
- **Context bloat**: Large skills can become expensive if loaded eagerly or if wrapper prompts paste too much content. **Mitigation**: Skill frontmatter should only include name/description; body loaded on demand. Defer non-essential content to separate `.md` files in the skill directory.
- **Duplicate source of truth**: Keeping full prompt bodies and full skills in parallel will drift. Thin wrappers reduce this risk.
- **Behavior regressions**: Some prompts contain Pi-specific assumptions that need agent-neutral wording before becoming portable skills.

## Recommended next step
This plan looks large enough to benefit from phasing. Run `/skill:b-phase` to break it into sequential phases with dependency analysis and per-phase model hints.

If proceeding without phasing, use `b-build-hard` because the migration spans multiple agent surfaces and risks documentation/source-of-truth drift.
