---
name: slash-command-mirror
description: The `prompts/` ↔ `commands/` symlink pattern for cross-platform slash command registration. Use when a slash command works in Pi but not OMP, when adding a new cross-platform slash command, when debugging "omp doesn't see /b-foo", or when adopting this pattern in a new package.
---

# Slash Command Mirror: `prompts/` ↔ `commands/`

The pattern that makes `/b-plan`, `/b-build`, etc. visible as slash commands in both Pi and OMP from a single source of truth.

## The problem

Two runtimes, two discovery paths, one set of command bodies:

| Runtime | Reads | Registers as |
|---|---|---|
| **Pi** | `prompts/*.md` | `/foo` slash command |
| **OMP** | `commands/*.md` | `/foo` slash command |
| **OMP** | `prompts/*.md` | reusable `Prompt` item (invoked via tool, **not** `/foo`) |

The same `b-plan.md` file becomes a `/b-plan` slash command in Pi and a `Prompt` template in OMP. OMP ignores `prompts/` for slash command registration — it walks `commands/` instead.

The blocker: OMP's `omp.commands` manifest entry (in `plugin.json`) only resolves directory paths via `index.{ts,js,mjs,cjs}`. Pointing `omp.commands` at `prompts/` doesn't work because `prompts/` has no `index.ts`. For Pi-style packages (no `plugin.json`), `omp-plugins` only auto-discovers the `commands/` sibling directory.

## The solution: per-file symlink mirror

Keep `prompts/*.md` as the source of truth. Add a `commands/` directory at the package root containing one symlink per prompt file:

```
my-package/
├── prompts/
│   ├── b-plan.md
│   ├── b-build.md
│   └── b-review.md
└── commands/                      # symlink mirror
    ├── b-plan.md    -> ../prompts/b-plan.md
    ├── b-build.md   -> ../prompts/b-build.md
    └── b-review.md  -> ../prompts/b-review.md
```

OMP's `omp-plugins` provider walks `commands/`, `fs.readdir` follows each symlink, and the file content is registered as a `SlashCommand`. Pi continues to read `prompts/` directly — the symlinks in `commands/` are ignored by Pi's discovery.

## Setup

One-time, when adopting the pattern:

```bash
mkdir -p commands
for f in prompts/*.md; do
  name=$(basename "$f")
  ln -s "../$f" "commands/$name"
done

# Verify
for f in commands/*.md; do
  target=$(readlink "$f")
  [ -f "$f" ] && echo "OK   $f -> $target" || echo "BROKEN $f"
done
```

Commit the symlinks. Git preserves symlinks on Linux/macOS by default — no `.gitattributes` needed. The existing `buck-workflow-pi` repo uses the same pattern for `.agents/skills/*`.

## Adding a new cross-platform slash command

```bash
# 1. Author the prompt body (Pi source of truth)
$EDITOR prompts/b-newcommand.md

# 2. Mirror it for OMP discovery
ln -s ../prompts/b-newcommand.md commands/b-newcommand.md

# 3. Verify
ls -la commands/b-newcommand.md  # should show -> ../prompts/b-newcommand.md
```

If the slash command requires logic beyond prompt-template substitution (e.g. writes to disk, fires state transitions), the corresponding `pi.registerCommand` call in `extensions/index.ts` will still fire in Pi. OMP will execute the prompt-template body instead — keep both in sync or document the divergence.

## Alternative: single directory symlink

A single `commands` → `prompts` directory symlink would also work in OMP, because `fs.readdir` follows symlinks by default. The trade-off is self-documentation:

| Aspect | Per-file symlinks (12 entries) | Single directory symlink (1 entry) |
|---|---|---|
| Runtime behavior | Slash commands registered | Slash commands registered (same) |
| `ls -la commands/` | Explicit 1:1 mapping visible | One line: `commands -> ../prompts` |
| Self-documenting | Yes | No (must follow the link) |
| Drift mitigation | New prompt needs matching `ln -s` | New prompt is auto-included |
| Matches repo convention | Yes (`.agents/skills/*` pattern) | New pattern |

Per-file is the safer default because the relationship is visible at a glance and contributors notice when they add a prompt without a matching symlink. Use the directory symlink only when you specifically want auto-inclusion of all prompt files.

## Drift mitigation

Without a script, contributors may add a new `prompts/foo.md` and forget the matching `commands/foo.md` symlink. The slash command will work in Pi but not OMP — silent breakage.

Two options:

1. **Document the step in a CONTRIBUTING note** — minimal, easy to skip.
2. **Add a `scripts/sync-commands.sh` and a `bun run sync-commands` npm script** — runs the `mkdir -p commands && for f in prompts/*.md; do ln -sf ...` loop. Reference it from `CONTRIBUTING.md` and run it in CI as a check (`[ $(ls commands/*.md | wc -l) -eq $(ls prompts/*.md | wc -l) ]`).

The plan that introduced this pattern in `buck-workflow-pi` deliberately did not auto-run the sync from `prepare`/`postinstall` to keep the package install-clean. The CI check is enough for a small package; the auto-run becomes valuable above ~10 prompt files.

## Verification

Before merging changes that touch the mirror:

```bash
# 1. Every commands/ entry resolves
for f in commands/*.md; do
  [ -f "$f" ] || echo "BROKEN: $f"
done

# 2. Every prompts/ entry has a matching commands/ entry
diff <(ls prompts/ | sort) <(ls commands/ | sort) && echo "in sync"

# 3. Pi still sees the slash command
pi -p "/b-plan: what does this do?"

# 4. OMP sees the slash command
omp -p "what does /b-plan do"
```

If step 3 works but step 4 returns "command not found", the symlink for that specific command is missing or broken. Check `ls -la commands/<name>.md`.

## Why this works (deep dive)

OMP's slash command discovery for package roots (`packages/coding-agent/src/discovery/omp-plugins.ts`):

1. Provider iterates over the registered package paths.
2. For each path, it constructs candidate subdirectory paths via `path.join(root.path, "commands")`, `path.join(root.path, "prompts")`, etc.
3. It calls `fs.readdir` (or equivalent) on each candidate. `readdir` follows symlinks by default, returning entries from the resolved target.
4. For each entry in `commands/`, the file's content is loaded and registered as a `SlashCommand` item.

The per-file symlink approach leverages step 3 — `commands/b-plan.md` is a symlink, `readdir` returns it, OMP reads its content (which is the `prompts/b-plan.md` content), and registers `/b-plan`. The single-directory-symlink variant also works because step 3 resolves `commands` → `prompts` and the entries returned are the prompt files.

The `omp.commands` manifest entry does NOT use this path. It's resolved by the extension loader's `resolveManifestEntryFile` helper, which only handles `index.{ts,js,mjs,cjs}` for directory entries. A directory of `*.md` files has no `index.ts`, so the manifest entry fails silently or throws — there's no glob support.

## Cross-references

- Parent skill: `../SKILL.md` — broader cross-platform package authoring
- This pattern's origin: `.context/2026-06-05.cross-platform-extension-loading/plan-cross-platform-extension-loading.md`
- Reference doc: `docs/extension-loading.md`
