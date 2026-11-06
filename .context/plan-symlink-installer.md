---
status: active
date: 2026-06-12
subject: 2026-06-12.multi-harness-symlink-installer
topics: [installer, symlink, multi-harness, claude, codex, cursor, opencode, pi, omp, node-bin]
research: []
iterations: []
spec:
memory: []
---

# Plan: Multi-Harness Symlink Installer

## User Goal

A developer (or the agent they're running) who wants to use buck-workflow across **more than one coding harness**. Today, installing means a manual `pi install` plus a hand-copied `AGENTS.md`, and only Pi/OMP are actually wired — Claude Code, Codex, Cursor, and OpenCode get nothing. The goal: run **one `buck-workflow install` command**; it detects which harnesses are installed on the machine and symlinks the bootstrap instructions + skill/command trees into each harness's expected locations, so the workflow is usable in every detected harness immediately, and a `git pull` + re-run keeps every harness in sync with no manual copying.

> *Synthesized from this session — confirm or refine.* The three scope decisions are locked: all six harnesses, bootstrap + skill/command trees, Node ESM bin (runtime = Node, already required; bun not currently a declared repo requirement).

## Context used / assumptions

**Locked decisions (from clarification batch):**
- **Agent scope**: all six — Pi, OMP, Claude Code, Codex, Cursor, OpenCode.
- **What's centralized**: bootstrap `AGENTS.md` **and** the skill/command trees (native wrapper layers per harness).
- **Installer form**: a `package.json` `bin` entry, runtime = **Node** (declared via `mise.toml [tools] node = "24"`). Bun is installed globally on the author's machine but is **not** a declared repo requirement, so the bin stays Node-portable ESM (`.mjs`) to avoid a new consumer dependency. No transpile step.

**Verified per-harness load locations (web research, 2026-06-12):**

| Harness | Global instructions | Custom slash commands | Global skills dir | Detect by |
|---------|--------------------|-----------------------|-------------------|-----------|
| **Pi** | `~/.pi/agent/AGENTS.md` | package `prompts/` (via `pi install`) | package `skills/` | `~/.pi/agent/` exists |
| **OMP** | `~/.omp/agent/AGENTS.md` | package `commands/` (via `config.yml`) | package `skills/` | `~/.omp/agent/` exists |
| **Claude Code** | `~/.claude/CLAUDE.md` (also reads `AGENTS.md`) | `~/.claude/commands/*.md` | `~/.claude/skills/<name>/SKILL.md` (verify) | `~/.claude/` exists |
| **Codex** | `~/.codex/AGENTS.md` (`CODEX_HOME`) | **none** (no slash commands; uses `config.toml`) | `~/.codex/skills/` (Agent Skills — verify) | `~/.codex/` exists |
| **Cursor** | global User Rules = app-settings (uncertain file path); project `.cursor/rules/*.mdc` | `.cursor/rules/*.mdc` (rules, not commands) | n/a (rules-based) | `~/.cursor/` exists |
| **OpenCode** | `~/.config/opencode/AGENTS.md` | `~/.config/opencode/commands/*.md` | `~/.config/opencode/skills/` | `~/.config/opencode/` exists |

**Sources**: code.claude.com/docs/en/commands; developers.openai.com/codex/guides/agents-md + config-advanced; opencode.ai/docs/rules + commands + config; cursor.com/docs/rules.

**Key architectural constraints:**
1. **Pi/OMP already load skills+commands via the package** (`pi install` / `config.yml`). The installer must symlink **bootstrap only** for these — symlinking skills into `~/.pi/agent/skills/` would double-load. (OMP already has a `~/.omp/agent/skills` symlink; do not clobber it.)
2. **Codex has no slash-command system.** It's a bootstrap-only harness (optionally skills).
3. **Cursor's global rules are app-settings-based**, not a reliably writable file. Realistic Cursor support is project-scoped (`.cursor/rules/buck-workflow.mdc`); global is a documented limitation.
4. **Central source of truth = the package repo itself.** Symlinks resolve to the live repo files (`prompts/`, `commands/`, `skills/`, `GLOBAL_OR_PROJECT-AGENTS.md`), so `git pull` + re-run = fully updated. No separate `~/.agents/` copy to keep in sync. (`--source` flag can point elsewhere if a decoupled install is wanted later.)
5. **Bootstrap drift** is the primary bug being fixed: today `GLOBAL_OR_PROJECT-AGENTS.md` is `cp`'d, so repo edits never propagate. Symlinks fix this permanently.

## Current state (the gap)

- `README.md` §Install: 2-step manual — `pi install` then `cp GLOBAL_OR_PROJECT-AGENTS.md <global>`.
- No install script exists (`find install*/setup*/*.sh` → only `scripts/security-audit.sh`).
- README's compatibility table marks Claude/Cursor/OpenCode/Codex ❌ "Not yet".
- `package.json` has no `bin`. `mise.toml` pins `node = "24"`.
- `commands/*.md` are symlinks to `prompts/*.md` (the existing Pi↔OMP pattern — this is the model the installer generalizes).

## Design

### 1. Harness registry (the heart of the installer)

A data-driven table where each harness declares which surfaces it uses and where. The installer walks detected harnesses and symlinks only their declared surfaces.

```js
// Per-harness surface declaration
{
  id: 'claude',
  detect: (home) => exists('~/.claude'),
  surfaces: {
    bootstrap: { src: 'GLOBAL_OR_PROJECT-AGENTS.md', dest: '~/.claude/CLAUDE.md' },
    commands:  { src: 'prompts/',                    dest: '~/.claude/commands/', glob: '*.md' },
    skills:    { src: 'skills/',                     dest: '~/.claude/skills/',   perDir: true }, // verify
  },
}
```

Surface rules:
- `bootstrap` — single file, may rename (AGENTS.md → CLAUDE.md). Always a symlink.
- `commands` — `prompts/*.md` symlinked into the harness commands dir. Skipped for Pi/OMP (package) and Codex (no commands).
- `skills` — `skills/<name>/` symlinked into the harness skills dir. Skipped for Pi/OMP (package) and Cursor (n/a).

### 2. Symlink fan-out behavior

For each *detected* harness, for each declared surface, create a symlink `dest → src` (repo-relative absolute path). Idempotent:
- If `dest` is already a symlink to the right target → skip (no-op).
- If `dest` is a symlink to the **wrong** target → replace (warn).
- If `dest` is a real file → **stop and warn** (don't clobber user edits); require `--force`.
- Missing parent dirs → `mkdir -p`.

### 3. CLI surface

```
buck-workflow install [--dry-run] [--force] [--source <path>] [--harness <id>...] [--list]
```
- `--dry-run` — print planned symlinks, write nothing.
- `--force` — replace real files at dest (with confirmation).
- `--source <path>` — repo path symlinks resolve from (default: installer's own repo root).
- `--harness claude,codex` — wire only named harnesses (default: all detected).
- `--list` — print detected harnesses + their wired surfaces, exit.

Exit non-zero if zero harnesses detected (suggest installing at least one).

### 4. What gets symlinked, per harness (final matrix)

| Harness | bootstrap | commands | skills |
|---------|:---------:|:--------:|:------:|
| Pi | ✅ symlink | ❌ (package) | ❌ (package) |
| OMP | ✅ symlink | ❌ (package) | ❌ (package) |
| Claude Code | ✅ → `CLAUDE.md` | ✅ `~/.claude/commands/` | ✅ (verify format) |
| Codex | ✅ | ❌ (no commands) | ⚠️ optional (verify) |
| OpenCode | ✅ | ✅ `~/.config/opencode/commands/` | ✅ `~/.config/opencode/skills/` |
| Cursor | ⚠️ project rules only | `.cursor/rules/*.mdc` (project) | n/a |

## Scope

**In scope:**
- `scripts/install.mjs` — the installer (Node ESM, zero deps beyond Node builtins).
- `package.json` `bin` entry → `scripts/install.mjs`, `#!/usr/bin/env node` shebang + chmod +x.
- Harness registry covering all six, with the surface matrix above.
- `--dry-run`, `--force`, `--source`, `--harness`, `--list` flags.
- Idempotent re-runs (skip/replace logic, no clobber without `--force`).
- `README.md` §Install rewrite: replace the 2-step manual copy with the one-command installer; update the compatibility table (Claude/OpenCode/Cursor/Codex → ✅ with the installer).
- `docs/extension-loading.md` addendum: how the installer relates to package loading for Pi/OMP (bootstrap-only) vs full fan-out for others.

**Out of scope (explicit):**
- Pi/OMP package registration (`pi install` / `config.yml` editing). Those remain the native step 1; the installer handles the wrapper fan-out that the package system can't. (A future `--with-package` flag could add this, but chezmoi-managed configs make it fiddly — defer.)
- Windows symlink support (Unix only; document).
- Auto-detection of *project-local* `.claude/`/`.cursor/` wiring (global install only this pass; project-scoped Cursor rules noted as a follow-up).
- Generating harness-specific **skill format conversions** (e.g. Cursor `.mdc` frontmatter). If a harness needs format translation beyond a symlink, that surface is marked "needs adapter" and skipped with a warning, not silently faked.

## Affected files

| File | Change |
|------|--------|
| `scripts/install.mjs` | **new** — installer (harness registry + symlink fan-out + CLI) |
| `package.json` | add `"bin"` → `scripts/install.mjs`; bump version |
| `README.md` | rewrite §Install; update compatibility + cross-agent tables |
| `docs/extension-loading.md` | addendum: installer vs package loading |
| `mise.toml` | unchanged (node already declared) |

## Implementation steps

1. **Scaffold the bin** — `scripts/install.mjs` with shebang, `process.argv` flag parsing (`--dry-run`, `--force`, `--source`, `--harness`, `--list`), help text, zero-dep Node builtins (`fs`, `path`, `os`).
2. **Harness registry** — data table for all six with `detect()` + `surfaces` per the matrix. Resolve `~` via `os.homedir()`.
3. **Symlink engine** — `ensureSymlink(src, dest, { dryRun, force })` implementing the skip/replace/stop-warn rules; `mkdir -p` parents; compare existing link targets via `fs.readlink`.
4. **Detection + dispatch** — detect installed harnesses, iterate, symlink declared surfaces; `--list` path; non-zero exit when none detected.
5. **Pi/OMP safety** — confirm bootstrap-only for these (no skills/commands symlink); assert no clobber of existing `~/.omp/agent/skills`.
6. **Wire `package.json` bin** — `chmod +x`, add `bin`, smoke-test `node scripts/install.mjs --list` and `--dry-run`.
7. **Docs** — rewrite README §Install (one command), update compatibility table, add extension-loading addendum.
8. **Verify per harness** (see Verification).

## Risks & mitigations

| Risk | Mitigation |
|------|-----------|
| Double-load skills on Pi/OMP | Bootstrap-only for Pi/OMP by design (registry). |
| Clobbering chezmoi-managed `~/.pi`/`~/.omp` files | Detect real files at dest → stop+warn, require `--force`. Document chezmoi interaction. |
| Claude Code skill format wrong | Mark Claude skills "verify"; if `SKILL.md` doesn't load from `~/.claude/skills/<name>/`, ship Claude as commands-only and document. |
| Cursor global rules not file-writable | Scope Cursor to project `.cursor/rules/*.mdc`; document global as limitation, not silent skip. |
| Codex "skills" uncertain | Codex = bootstrap-only by default; add skills only if `~/.codex/skills/` convention confirmed. |
| Broken symlinks if repo moved/deleted | Document: symlinks resolve to repo; `--source` relocates. Print resolved source on run. |
| Non-idempotent re-runs breaking existing installs | Target-aware skip/replace; `--dry-run` first is the documented habit. |

## Verification

- `node scripts/install.mjs --list` → prints exactly the harnesses present on this machine (`~/.pi`, `~/.omp`, `~/.claude`, …) with their surfaces.
- `--dry-run` → prints each planned symlink with resolved src→dest, writes nothing; `ls -la` confirms no filesystem change.
- Real run: for each detected harness, `readlink <dest>` points at the repo file; `cat <dest>` shows live content.
- Idempotency: re-run → all surfaces report "already linked, skip"; exit 0.
- **Pi/OMP non-regression**: `pi -p /extensions` / `omp list` still load the package unchanged; `~/.pi/agent/skills` untouched (not created).
- Bootstrap drift fix: edit `GLOBAL_OR_PROJECT-AGENTS.md`, `cat ~/.claude/CLAUDE.md` shows the edit immediately (symlink, not copy).
- Force guard: pre-create a real file at a dest → installer stops+warns, does not overwrite; with `--force` it replaces after confirmation.
- Behavior tested (not just "it ran"): assert (a) correct skip on existing-correct, (b) replace on stale target, (c) stop-warn on real file, (d) bootstrap-only surface set for Pi/OMP. A small Vitest unit suite over the symlink-engine pure functions is in scope.

## Open questions

1. Claude Code: does it auto-load `~/.claude/skills/<name>/SKILL.md`, or only via plugin install? → verify in build; fallback = commands-only.
2. Cursor: is there a writable global rules file (`~/.cursor/rules/`)? → verify; else project-scoped only.
3. Codex: is `~/.codex/skills/` a real convention, or does Codex load skills only from the project? → verify; else bootstrap-only.
4. Should the installer also offer `--with-package` to run `pi install` / edit `config.yml`? → deferred; flagged for a follow-up backlog item.

## Ralph Instructions

This is a non-phased Ralph-ready plan. Treat the whole plan as one unit. Use **`/b-build-hard`** (not `/b-build`) — the per-harness unknowns (Claude skill format, Cursor global rules, Codex skills) are genuine ambiguity that warrants the hard-mode loop.

1. Run `/b-build-hard` against this plan.
2. Run `/b-review` against this plan.
3. If review creates an `iterate-*.md` artifact, run `/b-iterate`, then re-run `/b-review`.
4. Run `/b-save` to consolidate memory and draft commits.
5. Run `/b-commit` to checkpoint durable state before `ralph_done`.
6. If interrupted, leave a note in memory and resume from the active plan or iterate artifact.

> **OMP execution**: `none`. Non-phased, single-session, bounded. No `orchestrate`/`workflow`/`goal` recommendation.
