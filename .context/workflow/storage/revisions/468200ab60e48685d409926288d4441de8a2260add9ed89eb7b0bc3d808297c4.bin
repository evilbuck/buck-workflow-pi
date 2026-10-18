# Plan: Cross-Platform Extension Loading (OMP + Pi)

## Goal

Make `@buckleyrobinson/buck-workflow` load cleanly under both OMP and Pi from a single source-of-truth checkout, so a user listing the package directory in either runtime's config gets **extensions, slash commands, and skills** without per-runtime configuration tweaks.

## Context used / assumptions

### Verified from OMP source (`can1357/oh-my-pi`, main branch)

**OMP directory resolution** (`packages/coding-agent/src/extensibility/extensions/loader.ts:355-393`):
- Given a directory, OMP reads `package.json` → `omp` field, falling back to `pi`.
- `omp.extensions` (or `pi.extensions`) → loaded as factory modules.
- Otherwise: `index.ts` / `index.js` → one-level discovery of `*.{ts,js}` and `*/index.{ts,js}`.

**OMP sub-discovery** (`packages/coding-agent/src/discovery/omp-plugins.ts`):
- For every extension root, auto-discovers the following sibling directories:
  - `skills/` → `Skill` items
  - `commands/` → `SlashCommand` items (these become `/foo` slash commands)
  - `prompts/` → `Prompt` items (reusable prompt templates, **not** slash commands)
  - `rules/`, `hooks/pre/`, `hooks/post/`, `tools/`, `.mcp.json`/`mcp.json`
- The provider header comment is explicit: "The package's sibling directories — `skills/`, `hooks/pre|post/`, `tools/`, `commands/`, `rules/`, `prompts/`, and `.mcp.json` — are picked up by omp's standard discovery surfaces."

**OMP `ExtensionManifest` interface** (`extensions/loader.ts:357`):
```ts
interface ExtensionManifest { extensions?: string[]; themes?: string[]; skills?: string[]; }
```
**No `prompts` key.** Even with a `pi.prompts` array in `package.json`, OMP's extension loader ignores it. (OMP's `omp-plugins.ts` handles prompts via directory auto-discovery, not the manifest.)

**OMP plugin manifest** (`plugins/loader.ts:185-201`):
- For `omp install`-managed packages, reads `omp.tools`, `omp.hooks`, `omp.commands`, `omp.extensions`, `omp.features`.
- Each entry is a path; if a directory, resolves via `index.{ts,js,mjs,cjs}`. **Not** a `*.md` glob, so a directory of prompt files is **not** resolvable through `omp.commands`.

### Verified from Pi docs + source

**Pi package config** (`settings.json#packages`):
- `packages: [string | { source, extensions?, skills?, prompts? }]`
- Filter arrays accept `+` include / `-` exclude globs.
- Pi auto-discovers `prompts/*.md` as slash commands without a manifest (per the docs: "Pi auto-discovers from each package path... `prompts/` → Prompt templates").

### Current buck-workflow-pi state

```
package.json:
  "pi": {
    "extensions": ["./extensions/index.ts"],
    "prompts":    ["./prompts"],
    "skills":     ["./skills"]
  }
  (no `omp` field)

prompts/         12 *.md files (b-plan.md, b-build.md, ...)
skills/          18 skill dirs
extensions/
  index.ts       1 entry file (loads b-save, b-mode, b-flow, b-grill-auto, etc.)
```

Deployed configs:
- `~/.pi/agent/settings.json` — explicit filter object listing every skill and prompt
- `~/.omp/agent/config.yml` — single line `- ~/projects/development_tools/buck-workflow-pi`

### The actual cross-platform gap

| Surface              | Pi        | OMP (today) | OMP (after fix) |
|----------------------|-----------|-------------|-----------------|
| `extensions/index.ts`| ✅        | ✅ (via `pi.extensions` fallback) | ✅ |
| `skills/*`           | ✅        | ✅ (auto-discovered from `skills/`) | ✅ |
| `prompts/*.md` as slash commands (`/b-plan`, etc.) | ✅ | ❌ loaded as `Prompt` items, not `SlashCommand` items | ✅ (via `commands/` mirror) |
| `prompts/*.md` as reusable templates | n/a | ✅ | ✅ |

**The blocker**: in OMP, the 12 `prompts/*.md` files are loaded as `Prompt` items (reusable templates invoked via tool). They are not registered as `/b-plan` slash commands. The `omp-plugins.ts` provider reads `commands/` for slash commands — that directory doesn't exist in this package today.

The Pi config in `~/.pi/agent/settings.json` also doesn't include `pi.commands` (Pi doesn't have one — Pi uses `prompts/` for slash commands). So Pi's `prompts/` discovery is what makes `/b-plan` work there.

### Design decision: symlinks vs copies vs manifest entry

Three options to make slash commands visible in OMP:

1. **Symlinks in `commands/`** — `commands/b-plan.md` → `../prompts/b-plan.md`. Single source of truth in `prompts/`, zero drift, OMP discovers them as slash commands. **Selected.**
2. **Real file copies in `commands/`** — duplicates content, drifts on edits. Rejected.
3. **Manifest only (`omp.commands: ["./prompts"]`)** — OMP's plugin manifest only resolves directories via `index.{ts,js,mjs,cjs}`, not `*.md` globs. So this doesn't work. Rejected.

Symlinks committed in git are portable on Linux/macOS. Windows requires admin / developer mode. The existing repo's `.agents/skills/*` already uses symlinks (`→ ../../../.agents/skills/<name>`), so the pattern is established.

### Assumptions / open questions

- **Symlinks on Windows**: not portable to Win32 git checkouts without elevated privileges. The user is on Linux (per the workstation block), so this is a non-issue today. If the package is ever published to npm and consumed on Windows, a `postinstall` script could regenerate the symlinks. Defer.
- **OMP `omp` field in `package.json`**: adding it makes the package idiomatic for OMP. Today the `pi` field's `extensions` is what's read (via the `pi` fallback in `loader.ts:386` `pkg.omp ?? pkg.pi`). Adding `omp` is purely cosmetic for OMP's directory resolver; the real fix is the `commands/` mirror. **Will add** for explicitness; the `pi` field stays for Pi.
- **`omp.commands` manifest entry**: cannot point to a directory of `.md` files (per the loader's `resolveManifestEntryFile` logic — directories resolve via `index.{ts,js,mjs,cjs}`). Not used.

## Scope

1. Add a `commands/` directory at the package root containing symlinks to each `*.md` file in `prompts/`. Committed to the repo.
2. Add a top-level `omp` field in `package.json` mirroring `pi` for the keys OMP reads (`extensions`, plus a comment explaining `prompts` and `skills` are picked up by auto-discovery so they are not listed). This makes the package self-describing for OMP consumers.
3. Update `docs/extension-loading.md` to reflect the new state and document the cross-platform loading rules of each runtime.

## Out of scope

- Changes to `extensions/index.ts` (the existing entry point loads cleanly under both runtimes — verified by reading the `omp-plugins.ts` provider header and the OMP extension loader's `pi.extensions` fallback).
- Pi-side filter object changes — `~/.pi/agent/settings.json` already enumerates all skills and prompts explicitly; the `+`/`-` filter objects continue to work.
- Migrating away from `prompts/` to a unified `commands/` directory. Pi would need `commands/` support added (it does not currently) — not worth the upstream change.
- Windows / npm-publish portability for the symlinks. Defer.
- A `postinstall` script to regenerate symlinks (only relevant if symlinks aren't preserved through git).

## Affected files

| File | Change |
|------|--------|
| `package.json` | Add `omp` field with `extensions: ["./extensions/index.ts"]`; keep `pi` field unchanged |
| `commands/<name>.md` (×12) | New symlinks to each `prompts/<name>.md` |
| `docs/extension-loading.md` | Update "Current State", "Loading in Each Environment", and the `commands/` vs `prompts/` section; add verified OMP sub-discovery rules |

## Implementation steps

1. **Create the `commands/` directory and 12 symlinks.**
   - One symlink per `prompts/*.md` file: `commands/b-plan.md` → `../prompts/b-plan.md`, etc.
   - Use a `bash -lc` script to enumerate `prompts/*.md` and create the symlinks deterministically (so adding a new prompt file is one `ln -s` away).
   - Commit the symlinks to git.

2. **Add the `omp` field to `package.json`.**
   - Place it next to the existing `pi` field.
   - `omp` field contains only `extensions: ["./extensions/index.ts"]` — the same value the loader reads via the `pi` fallback today, but explicit for OMP consumers reading the manifest.
   - Add a one-line comment in the field noting that `skills/` and `prompts/` are auto-discovered from the package's sub-trees by the `omp-plugins` provider, so they are intentionally absent from the `omp` manifest.

3. **Update `docs/extension-loading.md`.**
   - Replace the "No `plugin.json` or `pi.extensions` manifest exists" claim — the manifest now exists with both `pi` and `omp` keys.
   - Add a new section: **Sub-directory auto-discovery in OMP** documenting the seven sibling directories the `omp-plugins.ts` provider reads (`skills/`, `commands/`, `prompts/`, `rules/`, `hooks/pre/`, `hooks/post/`, `tools/`, `.mcp.json`).
   - Update the "The `commands/` vs `prompts/` Discrepancy" section to state the resolution: OMP reads `commands/` for slash commands; Pi reads `prompts/`; this package now ships both via the symlink mirror.
   - Add a "Cross-Platform Slash Command Pattern" subsection with the canonical layout: `prompts/*.md` is the source of truth, `commands/*.md` are symlinks for OMP discovery.

4. **Verify in both runtimes.**

## Verification

| Check | How |
|-------|-----|
| All 12 symlinks resolve | `ls -la commands/` — each entry shows `→ ../prompts/<name>.md` |
| `package.json` valid JSON | `node -e 'JSON.parse(require("fs").readFileSync("package.json","utf8"))'` |
| Both `pi` and `omp` keys present with `extensions` | `jq '.pi.extensions, .omp.extensions' package.json` |
| Existing tests still pass | `bun test` (or `npx vitest run`) — only file-system shape changes, no source code touched |
| Pi still loads | `pi -p '/extensions'` (or `cat ~/.pi/agent/settings.json | jq` to confirm the existing filter object is still valid; no change needed) |
| OMP discovers `commands/` as slash commands | `omp plugin list --json` should still show the package; new manual check: confirm `/b-plan` resolves in an OMP session — `omp -p "what does /b-plan do"` triggers the prompt template via slash command (if not, the symlink mirror isn't wired) |
| OMP sub-discovery picks up `skills/`, `prompts/`, `commands/` | Inspect OMP's logs (`~/.omp/agent/sessions/<latest>.jsonl` → `loadedCapabilities` payload) or run with `PI_TIMING=1 omp -p ""` and check timing labels for `omp-plugins:loadSlashCommands`, `omp-plugins:loadPrompts`, `omp-plugins:loadSkills` |
| Docs reflect new state | Manual review of `docs/extension-loading.md` — confirm no claim contradicts the new `commands/` mirror or the `omp` field |

## Risks

- **Symlinks not preserved on `git clone`**: modern git preserves symlinks by default on Linux/macOS. The repo has no `.gitattributes` for symlink normalization. Acceptable risk for this user's Linux-only environment.
- **OMP's `omp-plugins` provider doesn't list `commands/` from a path that is itself a symlink**: the provider uses `path.join(root.path, "commands")`, not filesystem traversal of a symlink. Since `commands/` is a real directory in the package, not a symlink, this is fine. The individual files inside it are symlinks, which is what OMP reads.
- **Drift between `prompts/` and `commands/`**: a contributor could add a new prompt without creating the matching symlink. Mitigation: keep the link step scriptable and reference it from the package's `scripts` (e.g. `bun run sync-commands`), but do not auto-run it from `prepare`/`postinstall` to keep the package install-clean.
- **Extension loader `pi.extensions` fallback becomes redundant** after adding the `omp` field — both fields point to the same file. OMP reads `omp` first, so `pi.extensions` becomes a pure-Pi key. No behavior change.

## Ralph Instructions

Non-phased plan — small enough for one build/review cycle.

1. Run `/b-build` against this plan.
2. Run `/b-review` against this plan.
3. If review creates an `iterate-*.md`, run `/b-iterate`, then `/b-review` again.
4. Run `/b-save` to consolidate memory, draft commits, and review artifacts.
5. Run `/git-commit` to checkpoint durable state before `ralph_done`.
6. If interrupted before completion, leave a clear note in memory and resume from the active plan next iteration.
