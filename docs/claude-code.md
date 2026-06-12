# Claude Code

> Anthropic's agentic coding tool. Terminal, IDE, desktop, and browser.  
> <https://claude.com/product/claude-code> · <https://code.claude.com/docs/en/overview>

## Context Files

| File | Scope | Purpose |
|---|---|---|
| `CLAUDE.md` | Project root + subdirectories | Persistent project context loaded at session start. Subdirectory files append, not override. |
| `CLAUDE.md` | Global: `~/.claude/CLAUDE.md` | Personal defaults across all projects. |

### Discovery

- Project root `CLAUDE.md` is loaded first.
- Subdirectory `CLAUDE.md` files append additional context.
- Generate with `/init` — Claude scans the project and creates the file.
- Auto-memory: Claude saves learnings across sessions automatically.

## Skills

Claude Code implements the [Agent Skills](https://agentskills.io) open standard with extensions.

### Locations

| Scope | Path | Notes |
|---|---|---|
| Enterprise | Managed settings | Org-wide |
| Personal | `~/.claude/skills/<skill-name>/SKILL.md` | All projects |
| Project | `.claude/skills/<skill-name>/SKILL.md` | This project only |
| Plugin | `<plugin>/skills/<skill-name>/SKILL.md` | Namespaced as `plugin-name:skill-name` |
| Legacy commands | `.claude/commands/*.md` | Still works; skills recommended |

### Discovery

- Skills load from `.claude/skills/` in cwd and every parent directory up to repo root.
- Nested `.claude/skills/` directories discovered on-demand when editing files in subdirectories.
- `--add-dir` directories also load skills from `.claude/skills/`.
- Live change detection: edits to skill files take effect in current session.

### SKILL.md Frontmatter

| Field | Required | Notes |
|---|---|---|
| `name` | No | Display name. Defaults to directory name. |
| `description` | Recommended | When to use. Truncated at 1,536 chars in listing. |
| `when_to_use` | No | Appended to description in listing. |
| `argument-hint` | No | Autocomplete hint, e.g. `[issue-number]`. |
| `arguments` | No | Named positional args for `$name` substitution. |
| `disable-model-invocation` | No | `true` = manual-only (`/skill-name`). |
| `user-invocable` | No | `false` = hidden from `/` menu. |
| `allowed-tools` | No | Pre-approved tools during skill execution. |
| `disallowed-tools` | No | Removed tools during skill execution. |
| `model` | No | Model override while skill is active. |
| `effort` | No | Effort level override: `low`/`medium`/`high`/`xhigh`/`max`. |
| `context` | No | `fork` = run in subagent context. |
| `agent` | No | Subagent type when `context: fork`. |
| `hooks` | No | Scoped to skill lifecycle. |
| `paths` | No | Glob patterns limiting activation to specific file paths. |
| `shell` | No | `bash` (default) or `powershell`. |

### Dynamic Context Injection

```
!`git diff HEAD`           # Run command, inline output
```! block                   # Multi-line shell injection
```

### String Substitutions

`$ARGUMENTS`, `$ARGUMENTS[N]`, `$N`, `$name` (declared args), `${CLAUDE_SESSION_ID}`, `${CLAUDE_EFFORT}`, `${CLAUDE_SKILL_DIR}`.

## Plugins (May 2026+)

- Marketplace + `.zip` and URL loading
- Bundle skills, hooks, subagents, and MCP servers
- `.claude-plugin/plugin.json` in a skill folder makes it a plugin

## Hooks

Run shell commands before/after Claude Code actions:
- Auto-formatting after file edits
- Run lint before commit

## Other Customization

| Feature | Mechanism |
|---|---|
| Subagents | Multi-agent orchestration via managed agents |
| Dynamic workflows | `/workflows` (trigger: `ultracode` in v2.1.160+) |
| Dreaming | Cross-session memory (managed default) |
| MCP integration | Built-in MCP server support |
| Context management | `/context`, auto-compact at ~95% window |
| File attachment | `@` triggers file path autocomplete |
| Settings | `~/.claude/settings.json` |
| Bundled skills | `/code-review`, `/batch`, `/debug`, `/loop`, `/claude-api`, `/run`, `/verify` |
