---
status: completed
date: 2026-08-23
subject: 2026-08-23.memory-search-agnostic
memory: [memory-search-agnostic-2026-08-23.md]
---

# Plan: Conditional Memory Search

**Status**: completed
**Created**: 2026-08-23  
**Subject**: Make memory search conditional — OMP native vs configurable skill path

## User Goal

Make memory search **conditional** based on agent harness:
- **If OMP**: use OMP native memory tools (`recall`/`reflect`/`retain`)
- **Else**: use a configurable path to another chosen memory skill (e.g., `qmd`, or agent-specific alternatives)

This is an explicit conditional with a configurable fallback path for non-OMP agents, not just renaming.

## Current State

The prior-work search order in `GLOBAL_OR_PROJECT-AGENTS.md` (lines 32-35) is a flat list:

```
1. Search prior work (first match wins):
   - OMP native memory — if recall/reflect tools exist
   - qmd (optional) — if qmd is on PATH
   - Ledger fallback — read .context/memory/index.md
```

This hardcodes `qmd` as the universal fallback for non-OMP agents. The user wants:
- Explicit conditional: IF OMP → native tools, ELSE → configured skill
- Configurable path: each project specifies which memory skill to use for non-OMP agents

## Scope

### In Scope

1. **Bootstrap (`GLOBAL_OR_PROJECT-AGENTS.md`)**: Replace flat search order with explicit conditional logic + configuration section
2. **Project `AGENTS.md`**: Update memory layers + add "Memory Search Tool" configuration section
3. **`prompts/b-save.md`**: Make steps 8 and 9 conditional (OMP vs non-OMP)
4. **`skills/b-explore/SKILL.md`**: Update to conditional logic
5. **`README.md`**: Update prerequisites
6. **`docs/buck-workflow.md`**: Update step 9 description
7. **`docs/oh-my-pi.md`**: Update prior-work search summary

### Out of Scope

- Implementing agent-specific memory skill integrations (documentation/guidance only)
- Changing the OMP native memory path (already correct)
- Modifying `b-memory-import` (Hindsight-specific, not search-related)
- Creating a configuration file format (path is specified in project `AGENTS.md`)

## Approach

### 1. Define Conditional Structure

Replace the flat search order with an explicit conditional:

```
IF running in OMP:
  - Use OMP native memory tools: recall/reflect for search, retain for save
ELSE:
  - Use configured memory skill at <path>
  - Path is specified in project AGENTS.md under "Memory Search Tool"
  - Fallback: read .context/memory/index.md
```

### 2. Update Bootstrap (`GLOBAL_OR_PROJECT-AGENTS.md`)

**Current** (lines 32-35):
```markdown
1. Search prior work (first match wins):
   - **OMP native memory** — if `recall` / `reflect` tools exist: ...
   - **qmd** (optional) — if `qmd` is on PATH: `qmd search "<topic>" -c <project>-memory`. ...
   - **Ledger fallback** — read `.context/memory/index.md` ...
```

**Proposed**:
```markdown
1. Search prior work:
   - **If OMP** (when `recall` / `reflect` tools exist): use `recall` (or `reflect` for synthesis) for decisions, conventions, and past outcomes. Treat results as background; verify against the repo.
   - **Else** (non-OMP agents): use the configured memory skill. The skill path is specified in the project's `AGENTS.md` under "Memory Search Tool" (see configuration below). Load that skill and follow its search protocol.
   - **Fallback** (if no memory skill is configured or available): read `.context/memory/index.md` (most recent 3–5 entries) and open relevant memory files.

### Memory Search Tool Configuration (non-OMP agents)

Projects using non-OMP agents (Claude Code, Codex, Pi, etc.) should specify their memory search skill in the project's `AGENTS.md`:

```markdown
## Memory Search Tool

For non-OMP agents, use: `~/.agents/skills/qmd/SKILL.md`
```

Or for agent-specific tooling:

```markdown
## Memory Search Tool

For non-OMP agents, use: `.claude/skills/memory-search/SKILL.md`
```

If no memory search tool is configured, agents fall back to reading `.context/memory/index.md`.
```

### 3. Update `prompts/b-save.md`

**Current** (lines 5, 28-36):
```markdown
- **qmd** (optional): only if `qmd` is on PATH and you will run step 9. Read `~/.agents/skills/qmd/SKILL.md` when needed.
...
8. **Native agent memory (OMP)** — After the memory file exists, mirror durable session outcomes into harness LTM when tools are available:
   - **If `retain` is available** (OMP with `memory.backend: hindsight` or `mnemopi`): call `retain` with 1–N self-contained items...
   - **If only `learn` is available** (OMP `local` backend): `learn` one concise lesson...
   - **If neither tool exists**: skip silently...
9. **QMD re-index (optional)** — Only if `qmd` is on PATH. Best-effort; failures must not block `/b-save`:
   - `qmd collection add .context/memory --name <project>-memory --mask '*.md'` ...
   - `qmd update` when available
   - Ignore errors on unrelated collections. If `qmd` is missing, skip.
```

**Proposed**:
```markdown
- **Memory skill** (non-OMP, optional): if running in a non-OMP agent and a memory search skill is configured in the project's `AGENTS.md`, load that skill for step 9.

...

8. **Native agent memory (OMP only)** — If running in OMP and `retain`/`learn` tools exist, mirror durable session outcomes into harness LTM:
   - **If `retain` is available** (OMP with `memory.backend: hindsight` or `mnemopi`): call `retain` with 1–N self-contained items covering decisions, conventions, risks, and what shipped. Each item must stand alone (who/what/when/why). Include artifact paths. Prefer structured facts over dumping the whole markdown file.
   - **If only `learn` is available** (OMP `local` backend): `learn` one concise lesson for the session outcome when it is reusable.
   - **If neither tool exists or not in OMP**: skip this step.
   - Do **not** call the Hindsight HTTP API from this prompt; do **not** run `b-memory-import` for routine saves (that skill is bulk backfill only).
9. **Memory skill re-index (non-OMP, optional)** — If running in a non-OMP agent and a memory skill is configured in the project's `AGENTS.md`:
   - Load the configured memory skill and follow its indexing protocol for `.context/memory`
   - Best-effort; failures must not block `/b-save`
   - If no memory skill is configured or not in OMP, skip this step.
```

### 4. Update `skills/b-explore/SKILL.md`

**Current** (line 65):
```markdown
Prior session decisions (optional): if OMP `recall`/`reflect` tools exist, use them for past workflow/architecture choices; else optional `qmd` over `.context/memory` if installed; else `.context/memory/index.md`. Do not require qmd for exploration.
```

**Proposed**:
```markdown
Prior session decisions (optional): if OMP `recall`/`reflect` tools exist, use them for past workflow/architecture choices; else if a memory skill is configured in the project's `AGENTS.md`, load that skill and use it to search `.context/memory`; else read `.context/memory/index.md`. Do not require a memory skill for exploration.
```

### 5. Update `AGENTS.md`

**Current** (lines 127-130):
```markdown
2. **Harness LTM** — when `memory.backend` is `hindsight` or `mnemopi`, agents use `retain` / `recall` / `reflect` (and optional `learn`). `/b-save` mirrors checkpoint facts via those tools; do not call Hindsight HTTP from skills except `b-memory-import`'s deterministic importer.
3. **qmd** — optional local index over markdown; never required when OMP memory tools exist.

Prior-work search order is defined in installable bootstrap (`GLOBAL_OR_PROJECT-AGENTS.md`): OMP recall/reflect → optional qmd → `.context/memory/index.md`.
```

**Proposed**:
```markdown
2. **Harness LTM (OMP only)** — when `memory.backend` is `hindsight` or `mnemopi`, agents use `retain` / `recall` / `reflect` (and optional `learn`). `/b-save` mirrors checkpoint facts via those tools; do not call Hindsight HTTP from skills except `b-memory-import`'s deterministic importer.
3. **Memory skill (non-OMP)** — optional local search/index tool for non-OMP agents. Configure the skill path in the project's `AGENTS.md` under "Memory Search Tool".

Prior-work search is **conditional** (defined in installable bootstrap `GLOBAL_OR_PROJECT-AGENTS.md`):
- **If OMP**: use native memory tools (`recall`/`reflect`)
- **Else**: use configured memory skill (see "Memory Search Tool" section below)
- **Fallback**: read `.context/memory/index.md`

## Memory Search Tool

For non-OMP agents, use: `~/.agents/skills/qmd/SKILL.md`
```

### 6. Update `README.md`

**Current** (line 331):
```markdown
- Optional: [qmd](https://github.com/tobi/qmd) for local markdown search over `.context/memory` (never required; demoted behind OMP native memory)
```

**Proposed**:
```markdown
- Optional (non-OMP agents): configure a memory search skill (e.g., [qmd](https://github.com/tobi/qmd)) in the project's `AGENTS.md` for local markdown search over `.context/memory`. OMP agents use native memory tools instead.
```

### 7. Update `docs/buck-workflow.md`

**Current** (line 1086):
```markdown
9. **QMD re-index (optional)** — Best-effort when `qmd` is available; never required
```

**Proposed**:
```markdown
9. **Memory skill re-index (non-OMP, optional)** — Best-effort when a memory skill is configured in non-OMP agents; never required
```

### 8. Update `docs/oh-my-pi.md`

**Current** (line 92):
```markdown
**Prior-work search** (bootstrap): `recall`/`reflect` first → optional `qmd` → `.context/memory/index.md`.
```

**Proposed**:
```markdown
**Prior-work search** (bootstrap, conditional): if OMP → `recall`/`reflect`; else → configured memory skill; fallback → `.context/memory/index.md`.
```

## Risks

1. **Configuration burden**: Projects using non-OMP agents need to add a "Memory Search Tool" section to their `AGENTS.md`. Mitigation: provide clear examples in the bootstrap.
2. **Backward compatibility**: Existing projects with `qmd` will need to add the configuration section. Mitigation: document the migration path.
3. **Documentation drift**: Multiple files need updates. Mitigation: this plan lists all affected files.

## Verification

1. **Manual review**: Read each updated file to confirm conditional logic is consistent.
2. **Configuration test**: Add a "Memory Search Tool" section to this project's `AGENTS.md` and verify the bootstrap references it correctly.
3. **Workflow test**: Run `/b-save` in a test session and verify step 8 (OMP) and step 9 (non-OMP) behave correctly based on the agent harness.

## Files to Update

1. `GLOBAL_OR_PROJECT-AGENTS.md` (lines 32-35) — add conditional logic + configuration section
2. `prompts/b-save.md` (lines 5, 28-36) — make steps 8 and 9 conditional
3. `skills/b-explore/SKILL.md` (line 65) — update to conditional logic
4. `AGENTS.md` (lines 127-130) — update memory layers + add "Memory Search Tool" section
5. `README.md` (line 331) — update prerequisites
6. `docs/buck-workflow.md` (line 1086) — update step 9 description
7. `docs/oh-my-pi.md` (line 92) — update prior-work search summary

## Next Steps

1. Review this revised plan with the user
2. Implement changes across all listed files
3. Add "Memory Search Tool" section to this project's `AGENTS.md` as an example
4. Verify with manual review and workflow test
5. Commit with `/b-save` → `/b-commit`
