# Goose (AAIF / Block)

> Open-source AI agent. Desktop app, CLI, and API. Rust core.  
> <https://goose-docs.ai> · <https://github.com/aaif-goose/goose>  
> Part of the [Agentic AI Foundation (AAIF)](https://aaif.io/) at the Linux Foundation.

## Context Files

| File | Scope | Purpose |
|---|---|---|
| `.goosehints` | Per-directory | Project context: tech stack, conventions, file organization, style. Goose-specific. Loaded per-directory. |
| `AGENTS.md` | Project root | Cross-tool standard context file. Goose reads this too. |

### `.goosehints` Format

Plain text. Be specific:

```
Use CSS custom properties for theming
Create separate files for countdown logic, facts rotation, and form handling
Always check rust compiles, cargo fmt etc and `cargo clippy -- -D warnings`
```

### `AGENTS.md` Format

Standard markdown. Goose reads `AGENTS.md` in the repo root for project instructions (same file used by Codex, Claude Code, etc.).

**Recommendation from Goose docs:** For most projects, `AGENTS.md` is sufficient. Use `.goosehints` only when you need directory-scoped, Goose-specific hints.

## Extensions (MCP Servers)

Goose's extension model is MCP-based — all extensions are MCP servers.

### Built-in Extensions

| Extension | Purpose |
|---|---|
| Developer | General dev tools (file ops, shell, search). **Enabled by default.** |
| Computer Controller | Web scraping, file caching, automations |
| Memory | Persistent preference learning |
| Tutorial | Interactive learning |
| Auto Visualiser | Data visualization in conversations |
| Apps | Create/manage HTML apps |
| Chat Recall | Search conversation history across sessions |
| Code Mode | Execute JS for tool discovery |
| Extension Manager | Discover/enable/disable extensions dynamically |
| Summon | Load skills/recipes, delegate to subagents |
| Todo | Task list management across sessions |
| Top of Mind | Persistent instructions injected every turn |

### Adding Extensions

```bash
# Built-in
goose configure   # → Add Extension → Built-In Extension

# MCP server
goose configure   # → Add Extension → Command-Line Extension
# e.g.: npx -y @modelcontextprotocol/server-github

# Direct
goose mcp <name>
```

### Configuration

Extension config is stored in `~/.config/goose/config.yaml` (CLI) or managed through the desktop UI.

## Recipes

Reusable YAML workflows packaging extensions, prompts, and settings.

```yaml
# Example recipe structure
name: my-workflow
instructions: |
  Do X, then Y, then Z.
extensions:
  - developer
  - memory
parameters:
  - name: input_file
    description: The file to process
```

- Run: `goose run --recipe my-workflow.yaml`
- Sub-recipes run in isolation (no shared history/state, no nesting)
- Share with team via repo or recipe marketplace

## Skills

Goose has a skills system via the Summon extension:

- Skills are reusable instruction sets that shape agent behavior across sessions
- Loaded via `/summon` or automatically
- Skills can reference recipes and subagents

## `.gooseignore`

Control which files/directories goose can access (similar to `.gitignore` syntax).

## Other Customization

| Feature | Mechanism |
|---|---|
| Custom distributions | Preconfigured providers, extensions, branding |
| Permission modes | `goose-permissions` config for tool access control |
| Tool permissions | Per-tool allow/deny configuration |
| Hooks | `PreToolUse` denial and extensibility |
| Planning | `/plan` (interactive), `goose run -i FILE` (automated), TODO extension (structured) |
| `/goal` command | Agent self-evaluation before finishing |
| ACP providers | Use Claude/ChatGPT/Gemini subscriptions directly |
| 15+ LLM providers | Anthropic, OpenAI, Google, Ollama, OpenRouter, Azure, Bedrock, etc. |

## Cross-Harness Notes

Goose reads the standard `AGENTS.md` file, making it compatible with projects that already have context files for Codex or Claude Code. The `.goosehints` file is Goose-specific and directory-scoped.

The Goose repo itself demonstrates cross-harness skill placement:
```
.claude/skills/       # Claude Code skills
.codex/skills/        # Codex skills  
.cursor/skills/       # Cursor skills
.github/recipes/      # Goose recipes
```

## Key Paths

| Item | Path |
|---|---|
| Global config | `~/.config/goose/config.yaml` |
| Session history | `~/.config/goose/sessions/` |
| Extensions data | `~/.config/goose/` |
| Project hints | `.goosehints` (per directory) |
| Project context | `AGENTS.md` (repo root) |
| Access control | `.gooseignore` (per directory) |
