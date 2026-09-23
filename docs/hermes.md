# Hermes Agent (`nousresearch.com`)

> Open-source AI agent framework by Nous Research. CLI, Ink TUI, native desktop app, web dashboard, and a multi-platform messaging gateway (Telegram, Discord, Slack, WhatsApp, …).
> <https://hermes-agent.nousresearch.com> · <https://github.com/NousResearch/hermes-agent>

## Skills

Hermes implements a skills system compatible in spirit with the
[Agent Skills](https://agentskills.io) standard, but with two differences
that matter for install placement:

1. **Skills are nested one level under a category directory**:
   `~/.hermes/skills/<category>/<name>/SKILL.md`, not flat
   `~/.hermes/skills/<name>/SKILL.md`. Buck Workflow installs under a single
   `buck-workflow` category, so every skill lands at
   `~/.hermes/skills/buck-workflow/<name>/SKILL.md`.
2. **No file-based slash-command loader.** Hermes' in-session `/` commands
   come from a fixed built-in registry (`hermes_cli/commands.py`), not from
   scanning a `commands/`-style directory. There is nothing to wire the
   `prompts/`/`commands/` mirror into — skills are invoked by name
   (`/skill:b-plan`) or auto-loaded when the task matches a skill's
   `description`.

### Locations

| Scope | Path | Notes |
|---|---|---|
| Global | `~/.hermes/skills/<category>/<name>/SKILL.md` | All projects; category is a plain subdirectory, not part of the skill's own frontmatter |
| Profile | `~/.hermes/profiles/<name>/skills/...` | Same layout under a named profile's home |
| External (shared, read-only) | `skills.external_dirs` in `config.yaml` (e.g. `~/.agents/skills`) | Cross-tool sharing without copying; local skills take precedence on a name collision |

### Discovery

- `hermes skills list` / in-session `/skills` enumerate every `SKILL.md`
  under `~/.hermes/skills/` (or `$HERMES_HOME/skills/` for a profile) plus
  any `external_dirs`, recursively — the category subdirectory is just
  another path segment, not a separate registration step.
- A skill loads automatically when its `description` matches the task, or
  explicitly via `/skill:<name>`.
- `hermes skills check` / `update` / `uninstall` operate on the installed
  copy; `hermes skills tap add <repo>` adds a GitHub repo as a skill source.

## Project Context Files

Hermes reads **one** project context source per session — first match
wins, no concatenation across sources:

| File (priority order) | Discovery |
|---|---|
| `.hermes.md` / `HERMES.md` | Walks parents up to the git root |
| `AGENTS.md` / `agents.md` | **Cwd only** |
| `CLAUDE.md` / `claude.md` | Cwd only |
| `.cursorrules` / `.cursor/rules/*.mdc` | Cwd only |

There is no global, always-loaded bootstrap file analogous to
`~/.pi/agent/AGENTS.md` or `~/.claude/CLAUDE.md` — a home-level `AGENTS.md`
at `~/.hermes/AGENTS.md` would only apply when Hermes happens to run with
`~/.hermes` as its cwd, which is not the normal case. `SOUL.md` (in
`$HERMES_HOME`) is the closest analog, but it sets agent identity, not
project rules, and Hermes' own docs steer away from repurposing it for
that. **Use a project-root `./AGENTS.md`** (already the Buck Workflow
convention for every other harness) instead of trying to install a global
bootstrap for Hermes.

## Install

Buck Workflow installs only the skills surface for Hermes — no bootstrap
symlink, no commands mirror.

```bash
git clone https://github.com/evilbuck/buck-workflow-pi ~/.local/share/buck-workflow-pi
node ~/.local/share/buck-workflow-pi/scripts/install.mjs --harness hermes
```

From an existing checkout (development):

```bash
node scripts/install.mjs --harness hermes
```

### Where things go

| Surface | Location |
|---|---|
| Skills | `~/.hermes/skills/buck-workflow/<name>/SKILL.md` — one symlink per skill directory |
| Commands | n/a — no commands surface; invoke `/skill:b-plan` etc. |
| Bootstrap | n/a — no global bootstrap surface; add `./AGENTS.md` in the project instead |

The installer's harness detector looks for `~/.hermes` to decide whether
Hermes is present; `--harness hermes` targets it explicitly regardless of
detection when you already know it's installed (e.g. under `$HERMES_HOME`
pointed elsewhere — pass `--source`/inspect the profile manually in that
case, the detector only checks the default home).

### Verify

```bash
node ~/.local/share/buck-workflow-pi/scripts/install.mjs --verify --harness hermes
```

In a Hermes session:

```
/skills
```

confirm `b-build`, `b-review`, `b-save`, etc. appear under the
`buck-workflow` category, then `/skill:b-plan` to run one.

## Other Customization

| Feature | Mechanism |
|---|---|
| Skill categories | Any subdirectory under `~/.hermes/skills/` — purely organizational, agent-facing behavior is identical regardless of category name |
| Skills Hub | `hermes skills install <id-or-url>`, `hermes skills tap add <repo>` — install skills from curated registries or a GitHub repo, independent of this installer |
| MCP integration | `hermes mcp add/list/catalog/install` |
| Profiles | `hermes profile create <name>` — isolated config/session/skills/memory; re-run the installer with the profile's home if you want Buck Workflow in more than the default profile |
| Cron / delegation | `hermes cron`, `delegate_task` — see the bundled `hermes-agent` skill's `references/background-systems.md` |

Reference: <https://hermes-agent.nousresearch.com/docs/user-guide/features/skills>
