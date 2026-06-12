# Pi Coding Agent

> Minimal terminal coding agent harness. MIT license.  
> <https://pi.dev> · <https://github.com/earendil-works/pi>

## Context Files

| File | Scope | Purpose |
|---|---|---|
| `AGENTS.md` | Global: `~/.pi/agent/AGENTS.md`; Project: `AGENTS.md` in cwd up through parents | Project-specific instructions injected into the system prompt. Multiple files concatenated (global → parent → cwd). |
| `SYSTEM.md` | Global: `~/.pi/agent/SYSTEM.md`; Project: `.pi/SYSTEM.md` | **Replaces** the default system prompt entirely. |
| `APPEND_SYSTEM.md` | Global: `~/.pi/agent/APPEND_SYSTEM.md`; Project: `.pi/APPEND_SYSTEM.md` | Appends to the system prompt without replacing it. |

### Discovery

- `AGENTS.md`: Walks up from cwd to root; `~/.pi/agent/AGENTS.md` is the global fallback. All found files are concatenated.
- `SYSTEM.md` / `APPEND_SYSTEM.md`: Checked in `.pi/` (project) and `~/.pi/agent/` (global).

## Skills

Pi implements the [Agent Skills standard](https://agentskills.io/specification).

### Locations

| Scope | Path | Notes |
|---|---|---|
| Global | `~/.pi/agent/skills/` | All projects |
| Global (shared) | `~/.agents/skills/` | Cross-tool standard location |
| Project | `.pi/skills/` | After project is trusted |
| Project (shared) | `.agents/skills/` (cwd up to repo root) | Cross-tool standard location |
| Packages | `skills/` dirs or `pi.skills` in `package.json` | Via `pi install` |
| Settings | `skills` array in `settings.json` | Arbitrary paths |
| CLI | `--skill <path>` | Additive, works with `--no-skills` |

### Structure

```
my-skill/
├── SKILL.md          # Required: frontmatter + instructions
├── scripts/          # Helper scripts
├── references/       # Loaded on-demand
└── assets/           # Templates, resources
```

### SKILL.md Frontmatter

| Field | Required | Notes |
|---|---|---|
| `name` | Yes | Max 64 chars, lowercase + hyphens. Pi does NOT require matching directory name. |
| `description` | Yes | Max 1024 chars. Determines when agent loads the skill. |
| `license` | No | License reference |
| `compatibility` | No | Max 500 chars. Environment requirements. |
| `metadata` | No | Arbitrary key-value |
| `allowed-tools` | No | Space-delimited pre-approved tools (experimental) |
| `disable-model-invocation` | No | `true` = hidden from system prompt, user must `/skill:name` |

### Invocation

- Explicit: `/skill:<name>` or `/skill:<name> <args>`
- Implicit: agent auto-loads when task matches `description`
- Disable all discovery: `--no-skills`

### Cross-Harness Compatibility

Pi can load skills from Claude Code or Codex directories:

```json
// ~/.pi/agent/settings.json
{
  "skills": ["~/.claude/skills", "~/.codex/skills"]
}
```

## Extensions

TypeScript modules that extend Pi's runtime behavior.

### Locations

| Scope | Path |
|---|---|
| Global | `~/.pi/agent/extensions/*.ts` or `~/.pi/agent/extensions/*/index.ts` |
| Project | `.pi/extensions/*.ts` or `.pi/extensions/*/index.ts` |
| CLI | `pi -e ./path.ts` |

### Capabilities

- Custom tools (`pi.registerTool()`)
- Custom commands (`pi.registerCommand()`)
- Event interception (tool_call, session_start, etc.)
- Keyboard shortcuts, status bar, custom UI components
- Session persistence
- Custom compaction logic

### Settings

Global: `~/.pi/agent/settings.json`  
Project: `.pi/settings.json`

```json
{
  "packages": ["npm:@foo/bar@1.0.0", "git:github.com/user/repo@v1"],
  "extensions": ["/path/to/extension.ts"],
  "skills": ["~/.claude/skills"],
  "enableSkillCommands": true
}
```

## Prompt Templates

Reusable prompts as Markdown files in `~/.pi/agent/prompts/` or `.pi/prompts/`.  
Type `/name` to expand.

## Other Customization

| Feature | Location |
|---|---|
| Packages | `pi install npm:…` / `pi install git:…` |
| MCP integration | Via extensions |
| Context engineering | Compaction customizable through extensions |
| Model providers | `settings.json` → `providers` block |
