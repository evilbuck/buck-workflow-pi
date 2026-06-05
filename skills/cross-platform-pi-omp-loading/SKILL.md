---
name: cross-platform-pi-omp-loading
description: Author a package that loads cleanly under both Pi and OMP from a single source-of-truth checkout. Covers directory layout, manifest keys, slash command resolution, sub-directory auto-discovery, and OMP extension API shim gaps. Use when publishing a package that targets both runtimes, debugging why a slash command or skill works in one runtime but not the other, or adopting the buck-workflow-pi pattern for a new package.
---

# Cross-Platform Pi + OMP Package Loading

Pi and OMP are two runtime surfaces for the same underlying agent protocol. They share a directory-walk discovery model but disagree on three points that bite every cross-platform package author:

1. **Slash command location** — Pi reads `prompts/*.md` as `/foo` commands; OMP reads `commands/*.md`. Same content, different registration surface.
2. **Manifest key** — Pi reads `pi.*` from `package.json`; OMP reads `omp.*` with a `pkg.omp ?? pkg.pi` fallback. The `pi` field works in OMP today but is not idiomatic.
3. **Extension API surface** — OMP's `pi` parameter is a shim. Methods Pi ships (`getModel`, certain `appendEntry` flavors, some event hooks) may be missing or behavior-different in OMP.

This skill captures the pattern for shipping one package that works in both. The slash command mirror is its own sub-skill — see `slash-command-mirror/SKILL.md`.

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

`prompts/` is the single source of truth. `commands/` is a per-file symlink mirror so OMP's `omp-plugins` provider registers them as `SlashCommand` items. See the sub-skill for why this is the only working pattern.

## Manifest keys in `package.json`

```json
{
  "pi": {
    "extensions": ["./extensions/index.ts"],
    "prompts":    ["./prompts"],
    "skills":     ["./skills"]
  },
  "omp": {
    "extensions": ["./extensions/index.ts"]
  }
}
```

Rules of thumb:
- The `pi` key lists `extensions`/`prompts`/`skills` because Pi's filter-object schema exposes them as first-class filter arrays.
- The `omp` key lists only `extensions`. The other surfaces are auto-discovered by OMP's `omp-plugins` provider (see below), so duplicating them in the manifest is redundant and brittle.
- JSON disallows comments; the rationale for why the `omp` field is intentionally minimal lives in this skill (or the package's `docs/`), not in `package.json`.
- Adding `omp` is cosmetic for OMP's directory resolver (the `pi` fallback in `loader.ts` makes `pi.extensions` work in OMP today). Add it for explicitness and to make the package self-describing for OMP consumers reading the manifest.

## OMP sub-directory auto-discovery

OMP's `omp-plugins` provider (`packages/coding-agent/src/discovery/omp-plugins.ts`) walks each registered package root and reads these sibling directories unconditionally:

| Sibling | Loaded as |
|---|---|
| `skills/` | `Skill` items (`skills/<name>/SKILL.md`) |
| `commands/` | `SlashCommand` items (`commands/<name>.md` → `/foo`) |
| `prompts/` | `Prompt` items (reusable templates, **not** slash commands) |
| `rules/` | `Rule` items |
| `hooks/pre/`, `hooks/post/` | pre/post-run hooks |
| `tools/` | `Tool` items |
| `.mcp.json` / `mcp.json` | MCP server config |

This provider is independent of the `omp` field in `package.json`. The `omp` field is read by the extension loader for `extensions`/`themes`/`skills` arrays; `omp-plugins` handles the rest by directory walk.

## OMP `omp.commands` manifest entry is a dead end for `*.md` prompts

OMP's plugin manifest only resolves directory entries via `index.{ts,js,mjs,cjs}`. Pointing `omp.commands` at `prompts/` doesn't work because `prompts/` has no `index.ts`. The only paths to slash commands in OMP are:

1. A `commands/` directory at the package root (auto-discovered by `omp-plugins`), or
2. Per-file entries in a `plugin.json` manifest.

For Pi-style packages, option 1 is the answer — see the sub-skill.

## Extension API shim gaps

OMP's extension loader imports a package's `extensions/index.ts` and invokes its default factory with a `pi` parameter. The parameter is a shim — its method surface overlaps Pi but is not identical. Known gaps that have caused issues in this ecosystem:

| Pi method | OMP status | Workaround |
|---|---|---|
| `pi.registerCommand(name, ...)` | **Limited** — slash commands must also exist in `commands/` for OMP discovery; `registerCommand` alone won't surface `/foo` to OMP users | Add a `commands/<name>.md` symlink AND keep the `registerCommand` call |
| `pi.getModel()` | Missing in some OMP builds | Read model from `ctx.model` instead, or guard with a feature check |
| `pi.setModel()` | Behaves differently; some event hooks are no-ops | Test in OMP explicitly; don't rely on `model_select` round-trip semantics |
| `pi.appendEntry(type, data)` | Some custom entry types are not registered | Use standard entry types only, or write to disk directly |
| `pi.on(eventName, handler)` | All standard events present; some custom events no-op | Stick to documented event names |

**The b-save lesson:** the `b-save` slash command in `extensions/index.ts` is registered via `pi.registerCommand("b-save", ...)` AND tracked in the `input` event handler (which only fires in Pi). For OMP users, `/b-save` was invisible because:
- `commands/b-save.md` did not exist as a symlink, so `omp-plugins` did not register it as a slash command.
- Even if it did, the extension's `input` hook wouldn't fire because OMP's slash command dispatch does not pass through Pi's `input` event.

**Resolution in this repo:** the b-save prompt body was extracted from the inline `registerCommand` handler in `extensions/index.ts` into `prompts/b-save.md`, and `commands/b-save.md` was created as a symlink (`commands/b-save.md` → `../prompts/b-save.md`). The extension now reads the template at handler invocation, replaces the `{{SESSION_STATE}}` placeholder with the actual state JSON, and dispatches via `pi.sendUserMessage` (Pi path). OMP reads the same file via the symlink and dispatches the file content directly to the LLM, which reads `.context/workflow/current-session.json` itself per step 1 of the prompt. Both runtimes converge on the same prompt body. See `extensions/index.ts` lines 1085–1119 for the refactor.

**b-mode and b-restrict remain Pi-only.** They are state toggles (`buck_workflow_mode_active`, `plan_mode_active`, `restrict_cwd_active`) on `.context/workflow/current-session.json`. Making them work in OMP would require a prompt that asks the LLM to read and rewrite the JSON state file with no validation — fragile and prone to race conditions. The current `registerCommand` path gives atomic, validated state updates. Defer until OMP's extension API surface has parity.

## Verification checklist

Run before tagging a release that claims cross-platform support:

```bash
# 1. All commands/ symlinks resolve
for f in commands/*.md; do readlink "$f" | grep -q "../prompts/" || echo "BROKEN: $f"; done

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

# 5. New slash command works in Pi
pi -p "/b-foo: smoke test"

# 6. New slash command works in OMP
omp -p "what does /b-foo do"
```

## Cross-references

- `slash-command-mirror/SKILL.md` — the `prompts/` ↔ `commands/` symlink pattern in depth
- `docs/extension-loading.md` — long-form reference for this package's specific layout
- `.context/2026-06-05.cross-platform-extension-loading/plan-cross-platform-extension-loading.md` — the original plan that established this pattern in this repo
