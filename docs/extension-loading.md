# Extension Loading: Pi vs Oh My Pi

## Terminology

| Concept | Pi | Oh My Pi |
|---------|----|-----------|
| Config file | `~/.pi/agent/settings.json` | `~/.omp/agent/config.yml` |
| Config key | `packages: [...]` | `extensions: [...]` |
| Unit of install | Package | Plugin |
| Install command | `pi install` | `omp install` |
| Managed by chezmoi | `dot_pi/agent/settings.local.jsonc` | `dot_omp/private_agent/config.local.yml` |

**Packages (Pi) and plugins (OMP) are the same concept.** OMP's `extensions` list can load Pi packages directly — it's a superset of the Pi package resolution logic.

## How Pi Loads Packages

Pi reads `settings.json` → `packages`. Each entry is a source string or a filter object:

```jsonc
"packages": [
  "npm:pi-mcp-adapter",                          // npm package
  "git:github.com/tmustier/pi-extensions",       // git repo
  "../../projects/development_tools/buck-workflow-pi",  // local path
  {
    // Filter object — load only specific resources
    "source": "../../projects/development_tools/buck-workflow-pi",
    "extensions": ["+extensions/index.ts"],
    "skills": ["+skills/b-build/", "+skills/b-plan/"],
    "prompts": ["+prompts/b-build.md"]
  }
]
```

Pi auto-discovers from each package path:

| Directory | What it provides |
|-----------|-----------------|
| `extensions/` | Runtime extensions (commands, hooks, tools) |
| `skills/` | Skills (`skills/<name>/SKILL.md`) |
| `prompts/` | Prompt templates (`prompts/<name>.md`) |
| `themes/` | Theme files |

Filter objects use `+` to include and `-` to exclude specific paths. Without a filter object, Pi loads everything it discovers.

## How OMP Loads Packages/Plugins

OMP reads `config.yml` → `extensions`. Each entry is a path (string):

```yaml
extensions:
  - ~/.pi/agent/extensions/omarchy-system-theme.ts  # single .ts file
  - ~/.pi/agent/git/github.com/tmustier/pi-extensions/agent-guidance  # directory
  - ~/projects/development_tools/buck-workflow-pi  # local project package
```

OMP resolves each path using the same rules as Pi:

| Path type | Resolution |
|-----------|-----------|
| Single file (`*.ts`, `*.js`) | Loaded as one extension module |
| Directory with `plugin.json` | Reads manifest for entry points (OMP plugin format) |
| Directory with `package.json` | Reads `omp.extensions` / `pi.extensions` manifest key |
| Directory with `index.ts` | Loaded as the package entry |
| Directory with `extensions/`, `skills/`, `prompts/`, `themes/` subdirs | Auto-discovers each |

## The `commands/` vs `prompts/` Discrepancy

OMP's `omp-plugins` provider reads `commands/` for **slash commands** (`/foo`) and `prompts/` for **reusable prompt templates** (invoked via tool). Pi inverts this: it reads `prompts/*.md` and exposes them as slash commands. The two runtimes use the same physical content for two different registration surfaces.

```
my-plugin/                       my-package/
  plugin.json                      package.json
  commands/<name>.md  ←slash       prompts/<name>.md  ←slash
  prompts/<name>.md  ←template     (no `commands/`)
```

For OMP-installed plugins with a `plugin.json`, the manifest can list `commands` as a path or glob. OMP's `omp.commands` manifest entry resolves directories only via `index.{ts,js,mjs,cjs}` — a directory of `*.md` files is **not** resolvable through that key. For Pi-style packages, `commands/` is auto-discovered from the package root.

**This package resolves the discrepancy with a `commands/` mirror.** `prompts/*.md` is the single source of truth. `commands/*.md` are symlinks (`commands/b-plan.md` → `../prompts/b-plan.md`) so OMP's `omp-plugins` provider picks them up as slash commands without duplicating content. Adding a new prompt is one `ln -s` away.

### Cross-Platform Slash Command Pattern

```
buck-workflow-pi/
  prompts/                       # source of truth (Pi reads these as slash commands)
    b-plan.md
    b-build.md
    ...
  commands/                      # symlink mirror (OMP reads these as slash commands)
    b-plan.md    -> ../prompts/b-plan.md
    b-build.md   -> ../prompts/b-build.md
    ...
```

To add a new slash command for both runtimes:

```bash
# 1. Write the prompt body in prompts/ (Pi auto-discovers)
$EDITOR prompts/b-newcommand.md

# 2. Mirror it into commands/ for OMP discovery
ln -s ../prompts/b-newcommand.md commands/b-newcommand.md
```

## Current State of buck-workflow-pi

```
buck-workflow-pi/
  package.json              # @buckleyrobinson/buck-workflow
                            # `pi` and `omp` keys: extensions entry point
  extensions/
    index.ts                # Model auto-switch for phased plans + TPS tracker
    tps-tracker.ts          # Token-per-second tracking
    b-flow/                 # (unwired) b-flow orchestration subsystem
    b-grill-auto/           # (unwired) b-grill-auto RPC subsystem
    grill-me-dialog.ts      # (unwired) grill-me dialog
    tmux-window-status.ts   # (unwired) tmux window status
    buck-mode.test.ts       # Tests for extension behavior
  skills/
    b-build/SKILL.md
    b-plan/SKILL.md
    b-research/SKILL.md
    b-save/SKILL.md         # b-save as pure skill (no extension backing)
    ... (19 skill directories)
  prompts/                  # source of truth for slash command bodies
    b-build.md
    b-plan.md
    b-save.md               # b-save prompt (reads state file directly)
    b-commit.md             # b-commit prompt (git-commit skill wrapper)
    ... (14 prompt files)
  commands/                 # symlink mirror so OMP discovers slash commands
    b-build.md    -> ../prompts/b-build.md
    b-save.md     -> ../prompts/b-save.md
    b-commit.md   -> ../prompts/b-commit.md
    ... (14 symlinks)
```

`package.json` declares both `pi` and `omp` keys. The `pi` key lists `extensions`, `prompts`, and `skills` because Pi's filter-object schema exposes them as first-class. The `omp` key lists only `extensions` because OMP's `omp-plugins` provider auto-discovers `skills/`, `commands/`, `prompts/`, and the other sibling directories directly from the package root — duplicating them in the `omp` manifest would be redundant and brittle. (JSON disallows comments, so this rationale lives here rather than in `package.json`.)

### Extension contents

The extension (`extensions/index.ts`) is minimal — it contains only:

1. **Model auto-switch** — Reads `buckModelMapping` from Pi settings, inspects the active phase difficulty in phased plans, and auto-switches the model on `/b-build`, `/b-build-hard`, `/b-iterate`, and `/b-review`. Switches back to the original model on `agent_end`. Includes a TUI model picker for initial setup.
2. **TPS tracker** — Token-per-second tracking during model generation.

Everything else (b-mode, b-restrict, plan mode write guard, b-save command, b-flow, b-grill-auto, session state machine, tmux status) has been removed from the extension. `/b-save` is now a pure skill + prompt — the LLM reads `.context/workflow/current-session.json` directly instead of receiving injected state from an extension handler. See `skills/b-save/SKILL.md` for details.


## Sub-directory auto-discovery in OMP

OMP's `omp-plugins` provider (`packages/coding-agent/src/discovery/omp-plugins.ts`) walks each registered package root and reads these sibling directories unconditionally:

| Sibling | Loaded as | Notes |
|---------|-----------|-------|
| `skills/` | `Skill` items | `skills/<name>/SKILL.md` |
| `commands/` | `SlashCommand` items | `commands/<name>.md` — registers `/foo` |
| `prompts/` | `Prompt` items | `prompts/<name>.md` — reusable prompt template, not a slash command |
| `rules/` | `Rule` items | `rules/<name>.md` |
| `hooks/pre/` | Pre-run hooks | `hooks/pre/<name>.{ts,js}` |
| `hooks/post/` | Post-run hooks | `hooks/post/<name>.{ts,js}` |
| `tools/` | `Tool` items | `tools/<name>.{ts,js}` |
| `.mcp.json` / `mcp.json` | MCP server config | JSON manifest of `mcpServers` |

This provider is independent of the `omp` field in `package.json`. The `omp` field is read by the extension loader for `extensions`/`themes`/`skills` arrays; the `omp-plugins` provider handles the rest by directory walk.

## Loading in Each Environment

### Pi (`~/.pi/agent/settings.json`)

```jsonc
{
  "source": "../../projects/development_tools/buck-workflow-pi",
  "extensions": ["+extensions/index.ts"],
  "skills": [
    "+skills/b-blueprint/", "+skills/b-brainstorm/", "+skills/b-build/",
    "+skills/b-explore/", "+skills/b-grill/", "+skills/b-grill-auto/",
    "+skills/b-grill-me/", "+skills/b-grill-with-docs/", "+skills/b-iterate/",
    "+skills/b-phase/", "+skills/b-plan/", "+skills/b-present/",
    "+skills/b-research/", "+skills/b-review/", "+skills/crawl4ai/",
    "+skills/git-commit/", "+skills/pi-rpc/", "+skills/run-in-idle-pane/",
    "+skills/_shared/"
  ],
  "prompts": [
    "+prompts/b-brainstorm.md", "+prompts/b-build-hard.md",
    "+prompts/b-build.md", "+prompts/b-explore.md",
    "+prompts/b-grill-me.md", "+prompts/b-grill-with-docs.md",
    "+prompts/b-iterate.md", "+prompts/b-plan.md",
    "+prompts/b-present.md", "+prompts/b-research.md",
    "+prompts/b-review.md", "+prompts/b-commit.md"
  ]
}
```

Pi requires explicit filter objects because its `packages` config supports `+`/`-` filtering.

### OMP (`~/.omp/agent/config.yml`)

```yaml
extensions:
  - ~/projects/development_tools/buck-workflow-pi
```

OMP auto-discovers `extensions/`, `skills/`, `prompts/`, and `commands/` from the path. No filtering needed — it loads everything it finds. The `commands/` mirror makes this package's slash commands visible to OMP the same way `prompts/` makes them visible to Pi.

## Debugging Load Failures

### Check what loaded

```
omp list                              # installed plugins
omp -p '/extensions'                  # every surface that resolved this session
pi list                               # Pi equivalent
```

### Check logs

```
omp logs                              # OMP session logs
pi logs                               # Pi session logs
```

### Common failures

| Symptom | Cause | Fix |
|---------|-------|-----|
| Extension not in `omp list` | Path wrong or not in `config.yml` | Verify path, run `chezmoi apply` |
| Extension listed but commands missing | Missing `plugin.json` or wrong dir layout | Add manifest or restructure |
| `getModel` not found | OMP API shim gap | See broken list in `config.local.yml` |
| Skills load in Pi but not OMP | `~/.omp/agent/skills` symlink broken | `ls -la ~/.omp/agent/skills` |
| Slash commands missing in OMP | `commands/` mirror absent or symlinks broken | `ls -la commands/` — each entry should resolve to `../prompts/<name>.md`; recreate with `ln -s` |

## Applying Config Changes

```bash
# Edit the chezmoi source
# For Pi:  ~/.local/share/chezmoi/dot_pi/agent/settings.local.jsonc
# For OMP: ~/.local/share/chezmoi/dot_omp/private_agent/config.local.yml

chezmoi apply                          # Deploy config changes
pi update --extensions                 # Reload Pi packages
omp update                             # Reload OMP plugins
```

Restart the agent after updating for changes to take effect.

## See also

- `skills/cross-platform-pi-omp-loading/SKILL.md` — package authoring pattern for shipping one package that works in both runtimes (manifest keys, directory layout, OMP API shim gaps).
- `skills/cross-platform-pi-omp-loading/slash-command-mirror/SKILL.md` — the `prompts/` ↔ `commands/` symlink pattern in depth, including the per-file vs single-directory trade-off and drift mitigation.

## Multi-Harness Installer (`buck-workflow install`)

The installer (`scripts/install.mjs`) handles the **external fan-out** that the package system cannot: symlinking bootstrap instructions and skill/command trees into harness directories that don't use Pi or OMP's package loading.

### How it relates to package loading

For **Pi and OMP**, the installer symlinks **bootstrap only** (`GLOBAL_OR_PROJECT-AGENTS.md` → harness AGENTS.md). Skills and commands are already loaded by the package system (`pi install` / OMP auto-discovery). Duplicating them via installer symlinks would cause double-loading.

For **Claude Code, OpenCode, and Codex**, the installer symlinks bootstrap + commands + skills (where applicable), because these harnesses don't use Pi/OMP's package system and have no other way to discover the content.

**Cursor** is project-scoped only — the installer detects it but does not create global symlinks.

### Idempotency

The installer is idempotent: re-running it skips symlinks that already point to the correct target, replaces stale ones, and warns about conflicts (real files at the destination). Use `--force` to overwrite conflicts. This makes `git pull && buck-workflow install` safe as a sync workflow.

### Chezmoi interaction

If harness config files are managed by chezmoi, they'll appear as real files (not symlinks). The installer detects this and reports a conflict rather than clobbering. Use `--force` to replace, or manage the symlink through chezmoi's `dot_*` source files instead.
