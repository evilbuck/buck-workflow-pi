# OpenAI Codex

> OpenAI's coding agent. CLI, IDE extension, and app. ~4M weekly active users (April 2026).  
> <https://developers.openai.com/codex> · <https://github.com/openai/codex>

## Context Files

| File | Scope | Purpose |
|---|---|---|
| `AGENTS.md` | Global: `~/.codex/AGENTS.md`; Project: walks from repo root to cwd | Custom instructions. Concatenated root→cwd; closer files override earlier ones. |
| `AGENTS.override.md` | Global or per-directory | Takes precedence over `AGENTS.md` at same level. |
| Fallback names | Configurable | `project_doc_fallback_filenames` in `config.toml` (e.g. `TEAM_GUIDE.md`, `.agents.md`). |

### Discovery

1. **Global scope**: `~/.codex/AGENTS.override.md` → `~/.codex/AGENTS.md` (first non-empty wins).
2. **Project scope**: Repo root → cwd. Each directory: `AGENTS.override.md` → `AGENTS.md` → fallback names. At most one file per directory.
3. **Merge**: Concatenated root→cwd, joined by blank lines. Capped at `project_doc_max_bytes` (default 32 KiB).
4. **Custom home**: Set `CODEX_HOME` env var.

### Configuration

```toml
# ~/.codex/config.toml
project_doc_fallback_filenames = ["TEAM_GUIDE.md", ".agents.md"]
project_doc_max_bytes = 65536
```

## Skills

Codex implements the [Agent Skills standard](https://agentskills.io/specification).

### Locations

| Scope | Path | Notes |
|---|---|---|
| REPO | `$CWD/.agents/skills` | Current working directory |
| REPO | `$CWD/../.agents/skills` up to repo root | Nested folders |
| USER | `$HOME/.agents/skills` | Personal, all repos |
| ADMIN | `/etc/codex/skills` | Machine-wide |
| SYSTEM | Bundled by OpenAI | Built-in (skill-creator, plan, etc.) |
| Plugin | Via `codex/plugins` | Distributable packages |

### Structure

```
my-skill/
├── SKILL.md           # Required: name + description + instructions
├── scripts/            # Optional: executable code
├── references/         # Optional: documentation
├── assets/             # Optional: templates, resources
└── agents/
    └── openai.yaml     # Optional: UI metadata, invocation policy, dependencies
```

### SKILL.md Frontmatter

| Field | Required | Notes |
|---|---|---|
| `name` | Yes (in `openai.yaml`) | Skill identifier |
| `description` | Yes | When to use. Front-loaded for truncation resilience. |

### Progressive Disclosure

- Initial context includes only name, description, file path (capped at ~2% of context window or 8,000 chars).
- Full `SKILL.md` loaded on-demand when skill is selected.

### Optional Metadata (`agents/openai.yaml`)

```yaml
interface:
  display_name: "Skill Name"
  icon_small: "./assets/icon.svg"
  brand_color: "#3B82F6"
  default_prompt: "Optional prompt wrapper"
policy:
  allow_implicit_invocation: false    # Require explicit $skill invocation
dependencies:
  tools:
    - type: "mcp"
      value: "openaiDeveloperDocs"
      transport: "streamable_http"
      url: "https://developers.openai.com/mcp"
```

### Invocation

- Explicit: `$skill-name` or `/skills` menu
- Implicit: automatic when task matches `description`
- Install curated: `$skill-installer <name>`

### Enable/Disable

```toml
# ~/.codex/config.toml
[[skills.config]]
path = "/path/to/skill/SKILL.md"
enabled = false
```

## Other Customization

| Feature | Mechanism |
|---|---|
| Plugins | Distributable packages bundling skills + MCP + app mappings |
| MCP integration | Built-in MCP server support |
| Subagents | Built-in subagent orchestration |
| Official Skills Catalog | <https://github.com/openai/skills> (13K+ GitHub stars, 35 curated skills) |
| Settings | `~/.codex/config.toml` |
