---
name: cross-platform-pi-omp-loading
description: Author a package that loads cleanly under both Pi and OMP from a single source-of-truth checkout. Covers directory layout, manifest keys, slash command resolution, sub-directory auto-discovery, and OMP extension API shim gaps. Use when publishing a package that targets both runtimes, debugging why a slash command or skill works in one runtime but not the other, or adopting the buck-workflow-pi pattern for a new package.
---

# Cross-Platform Pi + OMP Package Loading

Pi and OMP are two runtime surfaces for the same underlying agent protocol. They share a directory-walk discovery model but disagree on three points that bite every cross-platform package author:

1. **Slash command location** — Pi reads `prompts/*.md` as `/foo` commands; OMP reads `commands/*.md`. Same content, different registration surface.
2. **Manifest key** — Pi reads `pi.*` from `package.json`; OMP reads `omp.*` with a `pkg.omp ?? pkg.pi` fallback. The `pi` field works in OMP today but is not idiomatic.
3. **Extension API surface** — OMP's `pi` parameter is a shim. Methods Pi ships (`getModel`, certain `appendEntry` flavors, some event hooks) may be missing or behavior-different in OMP.

This document captures the pattern for shipping one package that works in both, including the `prompts/` ↔ `commands/` per-file symlink mirror.

## When to use

- Publishing a Pi-compatible package that should also work when listed in `~/.omp/agent/config.yml`.
- Adding a new slash command (`/b-foo`) to an existing cross-platform package.
- Debugging "works in Pi, missing in OMP" (or vice versa).
- Reviewing a package's `package.json` manifest for runtime portability.

## Directory layout that loads in both runtimes

```
my-package/
├── package.json          # declares pi + omp keys
├── extensions/
│   └── index.ts          # runtime extension (commands, hooks, tools)
├── skills/               # auto-discovered by both runtimes
│   └── <name>/SKILL.md
├── prompts/              # source of truth for slash command bodies
│   └── <name>.md         # Pi reads these as /<name>
├── commands/             # symlink mirror for OMP discovery
│   └── <name>.md         # → ../prompts/<name>.md
└── (optional) rules/, hooks/pre/, hooks/post/, tools/, .mcp.json
    # OMP-only — ignored by Pi
```

`prompts/` is the single source of truth. `commands/` is a per-file symlink mirror so OMP's `omp-plugins` provider registers them as `SlashCommand` items.

## Manifest keys in `package.json`

```json
{
  "pi": {
    "extensions": ["./extensions/index.ts"],
    "prompts": ["./prompts"],
    "skills": ["./skills"]
  },
  "omp": {
    "extensions": ["./extensions/index.ts"],
    "commands": ["./commands"],
    "skills": ["./skills"]
  }
}
```

Rules of thumb:

- Pi declares `extensions`, `prompts`, and `skills`.
- OMP declares `extensions`, `commands`, and `skills`. Keep these explicit
  arrays as the package's published registration contract even though OMP also
  auto-discovers supported sibling directories.
- OMP slash commands come from `commands/`, not `prompts/`; keep
  `commands/*.md` as same-named symlinks to the canonical prompt bodies.
- JSON disallows comments. Keep loader rationale in this skill or project docs,
  not in `package.json`.

## OMP sub-directory auto-discovery

OMP's `omp-plugins` provider walks registered package roots and discovers
supported sibling directories:

| Sibling | Loaded as |
|---|---|
| `skills/` | `Skill` items (`skills/<name>/SKILL.md`) |
| `commands/` | `SlashCommand` items (`commands/<name>.md` → `/foo`) |
| `prompts/` | `Prompt` items (reusable templates, **not** slash commands) |
| `rules/` | `Rule` items |
| `hooks/pre/`, `hooks/post/` | pre/post-run hooks |
| `tools/` | `Tool` items |
| `.mcp.json` / `mcp.json` | MCP server config |

Auto-discovery supplements the explicit `omp` manifest arrays. In this repo,
`package.json` declares `extensions`, `commands`, and `skills`, while the
root sibling layout provides the same surfaces to directory-based installs.

## Slash Command Mirror: `prompts/` ↔ `commands/`

Point `omp.commands` at `./commands`, where each Markdown file is a
same-named symlink to its canonical `prompts/` source. Do not point it at
`prompts/`: OMP loads that directory as reusable prompt templates rather than
slash commands. Root-level `commands/` auto-discovery and the explicit
`omp.commands` entry intentionally agree on the same directory.

### Why per-file symlinks work

OMP's `omp-plugins` provider walks `commands/`, `fs.readdir` follows each symlink, and the file content is registered as a `SlashCommand`. Pi continues to read `prompts/` directly — the symlinks in `commands/` are ignored by Pi's discovery. The `omp.commands` manifest entry in `plugin.json` only resolves directory paths via `index.{ts,js,mjs,cjs}`, which does not apply to `.md` directories; `omp-plugins` sibling discovery handles `commands/*.md`.

### One-time setup & adding a new command

```bash
# One-time setup
mkdir -p commands
for f in prompts/*.md; do
  name=$(basename "$f")
  ln -s "../$f" "commands/$name"
done

# Adding a new cross-platform slash command
$EDITOR prompts/b-newcommand.md
ln -s ../prompts/b-newcommand.md commands/b-newcommand.md
```

Commit the symlinks. Git preserves symlinks on Linux/macOS by default. Per-file symlinks are preferred over a single `commands -> ../prompts` directory symlink because the 1:1 mapping is self-documenting in `ls -la commands/`.

### Drift mitigation

Without enforcement, contributors may add `prompts/foo.md` without `commands/foo.md` (breaking OMP discovery) or create a physical `commands/foo.md` file that diverges from `prompts/foo.md`.

`buck-workflow-pi` enforces the all-symlink contract with **zero physical-file exceptions** via `scripts/commands-mirror.test.ts`: it asserts every `prompts/*.md` has a `commands/<name>.md` symlink to `../prompts/<name>.md`, every `commands/*.md` is such a symlink, and there are no extras. Any prompt addition or deletion must update `prompts/<name>.md` and `commands/<name>.md` together.

## Extension API shim gaps

OMP's extension loader imports a package's `extensions/index.ts` and invokes its default factory with a `pi` parameter. The parameter is a shim — its method surface overlaps Pi but is not identical. Known gaps that have caused issues in this ecosystem:

| Pi method | OMP status | Workaround |
|---|---|---|
| `pi.registerCommand(name, ...)` | **Limited** — slash commands must also exist in `commands/` for OMP discovery; `registerCommand` alone won't surface `/foo` to OMP users | Add a `commands/<name>.md` symlink AND keep the `registerCommand` call |
| `pi.getModel()` | Missing in some OMP builds | Read model from `ctx.model` instead, or guard with a feature check |
| `pi.setModel()` | Behaves differently; some event hooks are no-ops | Test in OMP explicitly; don't rely on `model_select` round-trip semantics |
| `pi.appendEntry(type, data)` | Some custom entry types are not registered | Use standard entry types only, or write to disk directly |
| `pi.on(eventName, handler)` | All standard events present; some custom events no-op | Stick to documented event names |

**The b-save lesson:** the `b-save` slash command in `extensions/index.ts` is registered via `pi.registerCommand("b-save", ...)` AND tracked in the `input` event handler (which only fires in Pi). For OMP users, `/b-save` was invisible until `prompts/b-save.md` and `commands/b-save.md` (`-> ../prompts/b-save.md`) were created so both runtimes converge on the same prompt/skill surface.

**b-mode and b-restrict remain Pi-only.** They are state toggles (`buck_workflow_mode_active`, `plan_mode_active`, `restrict_cwd_active`) on `.context/workflow/current-session.json`.

## Verification checklist

Run before tagging a release that claims cross-platform support:

```bash
# 1. All commands/ symlinks resolve and mirror prompts/ 1:1
npx vitest run scripts/commands-mirror.test.ts

# 2. package.json is valid JSON with both keys
node -e '
  const p = JSON.parse(require("fs").readFileSync("package.json", "utf8"));
  if (!p.pi?.extensions) throw new Error("missing pi.extensions");
  if (!p.omp?.extensions) throw new Error("missing omp.extensions");
  console.log("ok");
'

# 3. Pi loads (smoke test)
pi -p "/extensions" 2>&1 | head -5

# 4. OMP loads (smoke test)
omp plugin list --json | jq '.[] | select(.path | contains("my-package"))'
```

## Cross-references

- `docs/extension-loading.md` — long-form reference for this package's specific layout
- `scripts/commands-mirror.test.ts` — deterministic 1:1 `prompts/` ↔ `commands/` symlink invariant test
- `.context/2026-06-05.cross-platform-extension-loading/plan-cross-platform-extension-loading.md` — the original plan that established this pattern in this repo
