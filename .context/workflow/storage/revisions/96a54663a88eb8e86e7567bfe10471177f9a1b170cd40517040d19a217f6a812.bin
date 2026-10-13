---
status: active
date: 2026-06-01
subject: 2026-06-01.skill-universality-exploration
topics: [skills, portability, universal, deployment, claude, opencode, codex, omp, oh-my-pi, pi-coding-agent, installation, distribution]
informs: []
---

# Research: Universal Skill Deployment — Installation Paths & Distribution

## Summary

The core skills are already portable (SKILL.md format). The unsolved problem is **deployment**: how does a user install buck-workflow-pi skills so each agent discovers them? This document maps every agent's discovery paths, installation mechanisms, and constraints, then proposes a deployment strategy.

## Agent Discovery Paths

### 1. Pi Coding Agent

| Level | Path | Notes |
|-------|------|-------|
| **Package install** | `pi install <path-or-git>` → registers in `package.json` `pi.skills` | Current mechanism. Packages export `pi.skills`, `pi.prompts`, `pi.extensions` |
| **User-level** | `~/.pi/agent/skills/<name>/SKILL.md` | Available in all projects |
| **Project-level** | `.pi/skills/<name>/SKILL.md` | Per-project |
| **Invocation** | `/skill:<name>`, `/b-*` (prompt templates) | Prompts handle `$ARGUMENTS` |

**Distribution**: `pi install git:github.com/buckleyrobinson/buck-workflow-pi` — registers skills, prompts, and extensions from package.json.

### 2. Claude Code

| Level | Path | Notes |
|-------|------|-------|
| **Enterprise** | Managed settings | Org-wide deployment |
| **User-level** | `~/.claude/skills/<name>/SKILL.md` | Available in all projects |
| **Project-level** | `.claude/skills/<name>/SKILL.md` | Committed to repo |
| **Plugin** | `<plugin>/skills/<name>/SKILL.md` | Namespaced as `plugin-name:skill-name` |
| **Additional dirs** | `--add-dir` directories | Skills loaded from `.claude/skills/` in added dirs |
| **Invocation** | `/<name>`, `/<plugin-name>:<skill-name>` | Command name = directory name |

**Key constraints**:
- Non-recursive discovery: one level under `skills/` only
- Symlinks work for skill directories
- `.claude/commands/` still supported (legacy, lower precedence than skills)
- `$ARGUMENTS`, `$0`, `$1` substitution supported in skill content
- `${CLAUDE_SKILL_DIR}` references skill directory
- `disable-model-invocation: true` for manual-only skills
- Plugin distribution via npm package with `skills/` directory

**Frontmatter support**: `name`, `description`, `when_to_use`, `argument-hint`, `arguments`, `disable-model-invocation`, `user-invocable`, `allowed-tools`, `disallowed-tools`, `model`, `effort`, `context`, `agent`, `hooks`, `paths`, `shell`

### 3. OpenCode

| Level | Path | Notes |
|-------|------|-------|
| **User-level** | `~/.config/opencode/skills/<name>/SKILL.md` | Native path |
| **User-level** | `~/.claude/skills/<name>/SKILL.md` | Claude-compatible |
| **User-level** | `~/.agents/skills/<name>/SKILL.md` | Agent-compatible |
| **Project-level** | `.opencode/skills/<name>/SKILL.md` | Native project path |
| **Project-level** | `.claude/skills/<name>/SKILL.md` | Claude-compatible |
| **Project-level** | `.agents/skills/<name>/SKILL.md` | Agent-compatible |
| **Invocation** | `skill({ name: "<name>" })` tool | Loaded on demand |

**Key constraints**:
- Walks up from CWD to git worktree root
- Discovers from multiple compatible paths
- `name` must match directory name, lowercase alphanumeric with hyphens
- `description` required, 1-1024 chars
- Frontmatter: `name` (required), `description` (required), `license`, `compatibility`, `metadata`
- Permission control via `opencode.json`

### 4. Codex CLI

| Level | Path | Notes |
|-------|------|-------|
| **Repo-level** | `$CWD/.agents/skills/<name>/SKILL.md` | Current working directory |
| **Repo-level** | `$REPO_ROOT/.agents/skills/<name>/SKILL.md` | Repository root |
| **User-level** | `$HOME/.agents/skills/<name>/SKILL.md` | Personal skills |
| **Admin-level** | `/etc/codex/skills/<name>/SKILL.md` | System-wide |
| **Plugin** | Plugin distribution | Bundle skills as plugins |
| **Invocation** | `$<name>` or `/skills` | Explicit or implicit |

**Key constraints**:
- Walks from CWD up to repo root, discovers `.agents/skills/`
- **Symlinks supported** for skill folders
- Plugin distribution bundles skills
- `$skill-installer` for local setup
- Frontmatter: `name`, `description`
- `agents/openai.yaml` for UI metadata and invocation policy
- 8000 char budget for skill listing in prompt

### 5. OMP (oh-my-pi)

| Level | Path | Priority | Notes |
|-------|------|----------|-------|
| **Native user** | `.omp/skills/<name>/SKILL.md` | 100 | Highest priority |
| **Plugin** | `<extension>/skills/<name>/SKILL.md` | 90 | Extension-bundled |
| **Claude user** | `~/.claude/skills/<name>/SKILL.md` | 80 | Claude-compatible |
| **Claude project** | `.claude/skills/<name>/SKILL.md` | 70 | |
| **Agents user** | `~/.agents/skills/<name>/SKILL.md` | 70 | |
| **Agents project** | `.agents/skills/<name>/SKILL.md` | 70 | |
| **Codex user** | `~/.codex/skills/<name>/SKILL.md` | 70 | |
| **OpenCode user** | `~/.config/opencode/skills/<name>/SKILL.md` | 55 | Lowest priority |
| **Custom dirs** | Configured in settings | Varies | `skills.customDirectories` |
| **Invocation** | `/skill:<name>`, `skill://<name>` | | |

**Key constraints**:
- **Symlink-safe** dedup by realpath
- Multi-source discovery with priority ordering
- Source toggles for each provider
- `skills.customDirectories` for arbitrary paths
- Frontmatter: `name`, `description` (required for native), `globs`, `alwaysApply`, `hide`

---

## The Deployment Problem

Each agent discovers skills from different paths. A user who wants buck-workflow in all their agents must install into multiple locations. The challenge:

| Problem | Details |
|---------|---------|
| **Different base paths** | Pi (`~/.pi/agent/`), Claude (`~/.claude/`), OpenCode (`~/.config/opencode/`), Codex (`$HOME/.agents/`), OMP (`.omp/`) |
| **Different project paths** | Pi (`.pi/`), Claude (`.claude/`), OpenCode (`.opencode/`), Codex (`.agents/`) |
| **Symlink support varies** | Codex supports symlinks, Claude supports symlinks, OMP is symlink-safe |
| **No shared install command** | `pi install` works for Pi only; other agents have their own mechanisms |
| **Extensions are Pi-only** | b-save, b-flow, plan mode are TypeScript extensions using Pi APIs |

---

## Deployment Strategy Options

### Option A: Single-Source Symlinks (Recommended)

**Core idea**: Install once, symlink everywhere.

```
# Clone the repo (or pi install)
~/.local/share/buck-workflow-pi/     ← Single source of truth

# Symlink skills to each agent's discovery path
~/.claude/skills/b-plan → ~/.local/share/buck-workflow-pi/skills/b-plan
~/.config/opencode/skills/b-plan → ~/.local/share/buck-workflow-pi/skills/b-plan
~/.agents/skills/b-plan → ~/.local/share/buck-workflow-pi/skills/b-plan
~/.omp/skills/b-plan → ~/.local/share/buck-workflow-pi/skills/b-plan
```

**Pros**:
- Single source of truth — update once, all agents see changes
- No code duplication
- Works with all agents (symlinks supported by Claude, Codex, OMP)

**Cons**:
- Requires install script or manual symlinking
- Agent-specific frontmatter fields not leveraged per-agent
- Extensions only work in Pi

**Install script**:
```bash
#!/bin/bash
# install.sh — Install buck-workflow skills for all agents

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SKILLS_DIR="$REPO_DIR/skills"

install_for_agent() {
  local agent_path="$1"
  local agent_name="$2"
  
  mkdir -p "$agent_path"
  
  for skill_dir in "$SKILLS_DIR"/*/; do
    skill_name=$(basename "$skill_dir")
    # Skip _shared
    [[ "$skill_name" == _* ]] && continue
    
    target="$agent_path/$skill_name"
    if [ -L "$target" ]; then
      rm "$target"
    elif [ -d "$target" ]; then
      echo "⚠️  $agent_name/$skill_name exists (not a symlink), skipping"
      continue
    fi
    
    ln -s "$skill_dir" "$target"
    echo "✅ Linked $agent_name/$skill_name"
  done
}

# Pi
install_for_agent "$HOME/.pi/agent/skills" "pi"

# Claude Code
install_for_agent "$HOME/.claude/skills" "claude"

# OpenCode
install_for_agent "$HOME/.config/opencode/skills" "opencode"

# Codex
install_for_agent "$HOME/.agents/skills" "codex"

# OMP
install_for_agent "$HOME/.omp/skills" "omp"

echo ""
echo "Buck workflow skills installed. Run 'buck-workflow uninstall' to remove."
```

### Option B: Project-Level `.agents/skills/` (Cross-Agent Standard)

**Core idea**: Use the emerging `.agents/skills/` standard path that multiple agents already support.

```
project/
├── .agents/
│   └── skills/
│       ├── b-plan/SKILL.md
│       ├── b-build/SKILL.md
│       └── ...
```

**Agents that support `.agents/skills/`**:
- ✅ Codex — native discovery from `$HOME/.agents/skills/` and `$REPO_ROOT/.agents/skills/`
- ✅ OpenCode — discovers from `~/.agents/skills/` and `.agents/skills/`
- ✅ OMP — discovers from agents provider (priority 70)
- ❌ Claude Code — does NOT discover from `.agents/skills/`
- ❌ Pi — uses `.pi/skills/` or package install

**Pros**:
- One path works for Codex, OpenCode, OMP
- Emerging standard (agentskills.io)
- Repo-committable

**Cons**:
- Doesn't cover Claude Code or Pi
- No prompt/command wrappers for agents that need them
- Need separate installation for Claude and Pi

### Option C: Agent-Specific Adapter Package (Maximum Compatibility)

**Core idea**: Create per-agent adapter packages that include skill files + agent-specific extras.

```
buck-workflow-pi/
├── skills/                          # Canonical source
├── adapters/
│   ├── claude/
│   │   ├── install.sh               # Symlinks skills + creates commands
│   │   └── commands/                # Claude command wrappers
│   │       ├── b-plan.md
│   │       └── ...
│   ├── opencode/
│   │   ├── install.sh
│   │   └── commands/
│   ├── codex/
│   │   ├── install.sh
│   │   └── agents/                  # Codex agents config
│   │       └── openai.yaml
│   └── omp/
│       ├── install.sh
│       └── manifest.yaml
├── scripts/
│   └── install-all.sh               # Master installer
└── prompts/                         # Pi-only wrappers
```

**Pros**:
- Maximum compatibility per agent
- Agent-specific frontmatter/features leveraged
- Clear ownership of adapters

**Cons**:
- More maintenance surface
- More files to keep in sync

### Option D: `.agents/skills/` + Claude Symlink + Pi Package (Hybrid)

**Core idea**: Use `.agents/skills/` as the primary cross-agent path, with targeted adapters for Claude and Pi.

```
# Clone repo
git clone https://github.com/buckleyrobinson/buck-workflow-pi ~/.local/share/buck-workflow-pi

# Option 1: Pi users
pi install git:github.com/buckleyrobinson/buck-workflow-pi

# Option 2: All agents — symlink to user-level .agents/
for skill in ~/.local/share/buck-workflow-pi/skills/*/; do
  name=$(basename "$skill")
  [[ "$name" == _* ]] && continue
  ln -s "$skill" ~/.agents/skills/"$name"
done

# Claude Code — also symlink to ~/.claude/skills/
for skill in ~/.local/share/buck-workflow-pi/skills/*/; do
  name=$(basename "$skill")
  [[ "$name" == _* ]] && continue
  ln -s "$skill" ~/.claude/skills/"$name"
done
```

**Pros**:
- Leverages `.agents/skills/` standard for Codex/OpenCode/OMP
- Targeted Claude adapter
- Pi keeps its native package install
- Minimal adapter code

**Cons**:
- Still needs install script
- Two paths to maintain (`.agents/` + `.claude/`)

---

## Frontmatter Compatibility Matrix

| Field | Pi | Claude Code | OpenCode | Codex | OMP |
|-------|----|-------------|----------|-------|-----|
| `name` | ✅ | ✅ | ✅ required | ✅ | ✅ |
| `description` | ✅ | ✅ recommended | ✅ required | ✅ | ✅ required (native) |
| `when_to_use` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `globs`/`paths` | ❌ | ✅ `paths` | ❌ | ❌ | ✅ `globs` |
| `alwaysApply` | ❌ | ❌ | ❌ | ❌ | ✅ |
| `hide` | ❌ | ✅ `user-invocable:false` | ❌ | ❌ | ✅ |
| `disable-model-invocation` | ❌ | ✅ | ❌ | ✅ `policy` | ❌ |
| `allowed-tools` | ❌ | ✅ | ❌ | ❌ | ❌ |
| `model` | ❌ | ✅ | ❌ | ❌ | ❌ |
| `context`/`agent` | ❌ | ✅ subagent | ❌ | ❌ | ❌ |
| `arguments` | ❌ | ✅ | ❌ | ❌ | ❌ |
| `$ARGUMENTS` | ✅ | ✅ | ❌ | ❌ | ✅ |
| `${SKILL_DIR}` | ❌ | ✅ | ❌ | ❌ | ✅ `skill://` |

**Intersection** (universally supported): `name`, `description`

**Pi-extended fields** (via skill tool): `when_to_use`, `procedure_steps`, `pitfalls`, `verification_steps`

**Conclusion**: Keep frontmatter to the universal subset (`name`, `description`). Agent-specific features are extras that won't break other agents (unknown fields are ignored).

---

## Skill Content Compatibility

### Tool References in Skills

Skills reference tools like `read`, `write`, `bash`, `edit`. These are available across all agents:

| Tool | Pi | Claude | OpenCode | Codex | OMP |
|------|----|--------|----------|-------|-----|
| Read files | ✅ | ✅ | ✅ | ✅ | ✅ |
| Write files | ✅ | ✅ | ✅ | ✅ | ✅ |
| Bash | ✅ | ✅ | ✅ | ✅ | ✅ |
| Edit files | ✅ | ✅ | ✅ | ✅ | ✅ |
| Web search | ✅ | ✅ | varies | varies | ✅ |
| Browser tools | ✅ | ✅ | varies | varies | ✅ |

### Path References

Skills reference helper files with relative paths. Current approaches:

| Agent | Mechanism | Example |
|-------|-----------|---------|
| Pi | Relative from skill directory | `skills/_shared/subject-resolution.md` |
| Claude | `${CLAUDE_SKILL_DIR}` | `${CLAUDE_SKILL_DIR}/references/tables.md` |
| OMP | `skill://<name>/<path>` | `skill://b-grill-with-docs/CONTEXT-FORMAT.md` |
| pi-skills | `{baseDir}` placeholder | `{baseDir}/search.js` |

**Problem**: Skills reference `_shared/subject-resolution.md` and other cross-skill files. These relative paths work in Pi but may break when symlinked to other agents.

**Solution options**:
1. **Inline shared content** — copy shared files into each skill (no cross-references)
2. **Absolute path resolution** — use a variable like `${SKILL_DIR}/../_shared/...`
3. **Self-contained skills** — each skill includes all needed content, no cross-references

**Recommended**: Option 3 (self-contained). Each skill should be self-contained. Shared references like `subject-resolution.md` can be duplicated into each skill that needs them, or the relevant content can be inlined.

---

## Recommended Deployment Architecture

### Layer 1: Canonical Skills (Agent-Neutral)

All skills in `skills/` with universal frontmatter:

```yaml
---
name: b-plan
description: Turn user-provided context into a bounded implementation plan with scope, risks, and verification. Use when the user wants a formal, structured plan.
---
```

Content rules:
- Use only `name` and `description` in frontmatter
- Reference tools generically (not agent-specific tool names)
- Be self-contained (no cross-skill file references)
- Use `$ARGUMENTS` for user input (supported by Pi, Claude, OMP)

### Layer 2: Agent-Specific Commands (Thin Wrappers)

Each agent gets command wrappers that invoke the canonical skill:

**Claude Code** (`~/.claude/commands/` or `~/.claude/skills/`):
```markdown
# b-plan.md (as command)
---
name: b-plan
description: Create a bounded implementation plan
disable-model-invocation: true
arguments: [description]
---

Load and follow the b-plan skill:

Read `${CLAUDE_SKILL_DIR}/SKILL.md` from the b-plan skill.

$ARGUMENTS
```

**OpenCode**: No command wrappers needed — skills are directly invokable via `skill({ name: "b-plan" })`.

**Codex**: Skills discoverable from `.agents/skills/`. No command wrappers needed.

### Layer 3: Installation

```bash
# Master install script
./scripts/install.sh [--agent claude|opencode|codex|omp|all] [--user|--project]
```

The script:
1. Resolves the skills source directory
2. Symlinks each skill to the target agent's discovery path
3. Optionally creates command wrappers for agents that need them
4. Reports what was installed

### Project-Level Installation

For teams that want buck-workflow in their repo:

```bash
# Install buck-workflow skills into project
./scripts/install-project.sh

# Creates:
# .agents/skills/b-plan/SKILL.md → symlink
# .agents/skills/b-build/SKILL.md → symlink
# .claude/skills/b-plan/SKILL.md → symlink (for Claude)
```

---

## What Can't Be Universal

These features are Pi-only and must stay in the Pi extension:

| Feature | Why Pi-only | Agent Workaround |
|---------|-------------|------------------|
| **b-save** | Requires Pi event hooks (`tool_call`, `input`, `agent_end`) | Manual memory updates |
| **b-flow** | XState state machine with Pi SDK worker | Run b-* commands manually |
| **Plan mode** | Tool interception via Pi extension | Agent constrains itself from instructions |
| **Session tracking** | Pi session state persistence | Agent tracks state in .context/ manually |
| **Model auto-switch** | Pi model registry access | Manual model selection |
| **Tmux window status** | Pi registerTool API | Not available |
| **b-grill-auto** | Pi RPC subprocess | Not available |

---

## Implementation Checklist

### Phase 1: Make Skills Self-Contained

- [ ] Inline or duplicate `_shared/subject-resolution.md` into each skill that references it
- [ ] Remove cross-skill file references
- [ ] Standardize frontmatter to `name` + `description` only
- [ ] Remove Pi-specific `$ARGUMENTS` from skill content (agents handle this differently)
- [ ] Test each skill works when loaded standalone

### Phase 2: Create Installation Infrastructure

- [ ] Create `scripts/install.sh` — master installer with agent selection
- [ ] Create `scripts/install-project.sh` — project-level installer
- [ ] Create `scripts/uninstall.sh` — clean removal
- [ ] Test symlinks work on all target agents

### Phase 3: Agent-Specific Adapters

- [ ] Claude Code: Create `adapters/claude/` with command files for `/b-*`
- [ ] OpenCode: Verify `.agents/skills/` discovery works
- [ ] Codex: Verify `.agents/skills/` discovery works, add `agents/openai.yaml` if desired
- [ ] OMP: Test multi-source discovery, possibly create extension package

### Phase 4: Documentation

- [ ] Update README.md with multi-agent installation instructions
- [ ] Update AGENTS.md with deployment strategy
- [ ] Create `INSTALL.md` with per-agent setup guides

---

## Open Questions

1. **Shared content inlining**: Should we inline `subject-resolution.md` into every skill, or accept the dependency and document it?
   - **Recommendation**: Inline key sections. Each skill should work standalone.

2. **Skill name collisions**: If a user has other skills named `b-plan`, whose wins?
   - **Answer**: Depends on agent priority ordering. Buck workflow names are distinctive enough.

3. **Extension portability**: Should we port b-save/b-flow to other agents?
   - **Answer**: Not in scope. Document the limitation and provide manual fallbacks in skill content.

4. **Version pinning**: How do users pin to a specific version of buck-workflow?
   - **Answer**: Git tags. `pi install git:...#v0.2.0` for Pi; clone at tag for others.

5. **Auto-update**: Should the install script support auto-updating?
   - **Answer**: `git pull` in the source repo updates all symlinked skills. Simple and reliable.

---

## References

- [Agent Skills Standard](https://agentskills.io) — emerging cross-agent standard
- [Agent Skills Spec](https://agentskills.io/specification) — formal specification
- [pi-skills](https://github.com/badlogic/pi-skills) — existing multi-agent skill collection by badlogic
- [OpenAI Skills](https://github.com/openai/skills) — official Codex skills
- [Claude Code Skills](https://code.claude.com/docs/en/skills)
- [OpenCode Skills](https://opencode.ai/docs/skills/)
- [Codex Skills](https://developers.openai.com/codex/skills)
- [OMP Skills](https://github.com/can1357/oh-my-pi/blob/main/docs/skills.md)
