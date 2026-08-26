# Agent Install Instructions — Buck Workflow

> **For the installing agent:** Before running any install command, **ask the
> user which agent they're installing for** — Pi, OMP, Codex, OpenCode,
> Claude Code, or Grok Build. Then jump to that section and run only those
> commands. Do **not** blast through every section in sequence.

Buck Workflow is a portable set of agent skills (the Buck workflow: brainstorm,
explore, research, plan, build, review, save, present, grill, commit, plus
helper skills such as `fix-pr`). The skills are plain Markdown following the
[Agent Skills](https://agentskills.io) open standard, so the same content loads
on every supported harness.

The canonical source lives at
<https://github.com/evilbuck/buck-workflow-pi>. Every agent installs the
**same content** — only the install mechanism differs.

## Detect active capabilities before installing

Installation state and active-session capability are different signals:

| Signal | What it proves |
|---|---|
| Harness directory/executable detected | The harness exists on the machine |
| Buck source checkout present | Files are available somewhere |
| Package/install record present | An install command previously registered the package |
| Skill resolves in the active loader catalog | The current session can use that capability |

B-Plan probes the active loader for `b-build`, `b-review`, and `b-save` before
using full-workflow behavior:

| State | Active-session result | Handoff |
|---|---|---|
| `full` | All three resolve | Continue with the full workflow |
| `partial` | One or two resolve | Repair the installation; name the missing skills |
| `standalone` | None resolve and the loader inventory is authoritative | Install the full workflow if wanted |
| `unknown` | The harness exposes no reliable skill inventory/resolver | Continue planning; make install guidance conditional |

Filesystem paths, `.context/`, bootstrap instructions, package manifests, and
install records must not upgrade a session to `full`. B-Plan works by itself
in every non-full state: it writes an active subject index and bounded plan,
then gives the applicable GitHub handoff. It does not install automatically.

After installation or repair, start a refreshed agent session and repeat the
same three-sentinel probe. A successful command or source checkout is
supporting evidence, not proof that the refreshed session loaded the skills.


## What you get

After install, the agent gains these `b-*` slash commands (or `$b-*` / `/skill:*`
invocations on agents that use skill loaders):

| Command | Purpose |
|---|---|
| `/b-brainstorm` | Interview-style intake, capture initial thinking |
| `/b-explore` | Map unfamiliar codebases, trace architecture |
| `/b-research` | External/web research, source collection, evidence capture |
| `/b-plan` | Create a bounded plan standalone or within the full workflow; detect missing companions |
| `/b-build` | Standard implementation — smallest safe code change |
| `/b-build-hard` | Complex/ambiguous/higher-risk implementation |
| `/b-iterate` | Quick follow-up fixes, polish, review-loop edits |
| `/b-review` | Review implementation for correctness and regressions |
| `/b-save` | Record session history to `.context/memory/` |
| `/b-present` | Generate async-readable presentation package |
| `/b-phase` | Break a plan into sequential phases |
| `/b-grill-me` | Stress-test a plan through structured interviewing |
| `/git-commit` | Conventional Commits message + commit |
| `/skill:fix-pr` | Validate PR review comments; fix+push or file issues (**skill-only** — no slash wrapper) |

The skills themselves live in `skills/<name>/SKILL.md` of this repo and are
agent-neutral. Skill-only entries (no `prompts/` + `commands/` pair) are
invoked by skill name — e.g. `/skill:fix-pr` on OMP/Pi — not via `/fix-pr`.
| Agent | Install method | Skills land at | Commands land at |
|---|---|---|---|
| **Pi** | `pi install git:github.com/evilbuck/buck-workflow-pi` | `~/.pi/agent/skills/...` (package) | `~/.pi/agent/prompts/...` (package) |
| **OMP** | `omp install git:github.com/evilbuck/buck-workflow-pi` | per-plugin skill dir | per-plugin command dir |
| **Codex** | Symlink or copy each skill directory | `~/.agents/skills/<name>/` | n/a — invoke by skill name |
| **OpenCode** | Durable clone + `scripts/install.mjs --harness opencode` | `~/.config/opencode/skills/<name>/` | `~/.config/opencode/commands/` |
| **Claude Code** | Durable clone + `scripts/install.mjs --harness claude`, or marketplace | `~/.claude/skills/<name>/` | derived from skill name (`/b-plan` etc.) |
| **Grok Build** | Durable clone + `scripts/install.mjs --harness grok` | `~/.grok/skills/<name>/` | `~/.grok/commands/` (`/b-plan` etc.) |

---

## Pi (`pi.dev`)

Pi is the upstream of Buck Workflow and the most native install path. The
package ships a `pi` manifest in `package.json` that declares its skills,
prompts, and extensions.

### Install

From npm (when published):

```bash
pi install npm:buck-workflow
```

From git (today):

```bash
pi install git:github.com/evilbuck/buck-workflow-pi
```

From a local clone (development / offline):

```bash
pi install /absolute/path/to/buck-workflow-pi
# or
pi install ./relative/path/to/buck-workflow-pi
```

Use `-l` (or `--scope project`) to install into the project's `.pi/`
directory instead of the user's `~/.pi/agent/` settings. Project installs
auto-reconcile for any teammate who trusts the project.

For one-off use without modifying settings:

```bash
pi -e git:github.com/evilbuck/buck-workflow-pi
```

### Where things go

| Surface | Location |
|---|---|
| Skills | discovered from the package's `skills/` dir (per `pi.skills` in `package.json`) |
| Prompts (slash commands) | discovered from the package's `prompts/` dir (per `pi.prompts` in `package.json`) |
| Extensions | `./extensions/index.ts` (per `pi.extensions`) |
| Bootstrap (recommended) | copy `GLOBAL_OR_PROJECT-AGENTS.md` to `~/.pi/agent/AGENTS.md` |

### Verify

```bash
pi list                              # package is listed
ls ~/.pi/agent/git/                  # cloned package should be present
# In a pi session, type /b- and confirm b-plan, b-build, etc. appear
```

Reference: <https://pi.dev/docs/latest/packages>

---

## OMP (Oh My Pi, `omp.sh`)

OMP is a Pi fork with a plugin marketplace model. The package ships an `omp`
manifest in `package.json`. OMP's `commands/` directory in this repo is a
symlink mirror of `prompts/` — OMP discovers commands from `commands/`, Pi
discovers them from `prompts/`.

### Install

From git:

```bash
omp install git:github.com/evilbuck/buck-workflow-pi
```

From a local clone:

```bash
omp install ./buck-workflow-pi
```

For project-scoped install (writes to `.omp/plugins/` in the repo — useful
for teams that want to share the same plugin set without forcing it
globally):

```bash
omp install -l git:github.com/evilbuck/buck-workflow-pi
```

If/when a marketplace entry is published, install by short name:

```bash
omp install buck-workflow@buck-workflow
```

### Where things go

| Surface | Location |
|---|---|
| Skills | per-plugin skill dir under OMP's plugin store |
| Commands | per-plugin command dir (mirrored from this repo's `commands/`) |
| Extensions | loaded from the package's `extensions/index.ts` (per `omp.extensions`) |
| Bootstrap (recommended) | copy `GLOBAL_OR_PROJECT-AGENTS.md` to `~/.omp/agent/AGENTS.md` |

### Verify

```bash
omp list                                       # plugin appears
# In an omp session, type /b- and confirm b-plan, b-build, etc. appear
omp -p '/extensions'                           # shows every surface this session resolved
```

Reference: <https://omp.sh/docs/plugins>

---

## Codex (`developers.openai.com/codex`)

Codex also follows the [Agent Skills](https://agentskills.io) standard. The
shared `.agents/skills/` directory is the simplest install path. Codex
discovers skills both implicitly (by `description` match) and explicitly via
`$skill-name`.

### Install

Use a durable clone path: every symlink below points back into the checkout.
Do not use a temporary clone that may disappear after installation. If the
checkout does not already exist:

```bash
git clone https://github.com/evilbuck/buck-workflow-pi ~/.local/share/buck-workflow-pi
```

User scope (applies to every repo):

```bash
mkdir -p ~/.agents/skills
for d in "$HOME"/.local/share/buck-workflow-pi/skills/*/; do
  ln -s "$d" ~/.agents/skills/"$(basename "$d")"
done
```

Project scope (this repo only, safe to commit):

```bash
mkdir -p .agents/skills
for d in "$HOME"/.local/share/buck-workflow-pi/skills/*/; do
  ln -s "$d" .agents/skills/"$(basename "$d")"
done
```

### Alternative — plugin installer

Codex ships a built-in skill installer that fetches from a marketplace:

```
$skill-installer buck-workflow
```

This works once a marketplace entry is published.

### Invocation

Codex doesn't expose a `/b-plan` style slash command for arbitrary skills.
Invoke a Buck skill by its name:

```
$b-plan
```

Or let Codex match the `description` automatically — describing a planning
task in natural language is enough for Codex to load the `b-plan` skill
itself.

### Where things go

| Surface | Location |
|---|---|
| Skills (user) | `~/.agents/skills/<name>/SKILL.md` |
| Skills (repo) | `<cwd>/.agents/skills/<name>/SKILL.md` (walks up to git root) |
| Skills (admin) | `/etc/codex/skills/<name>/SKILL.md` |
| Bootstrap (recommended) | place `AGENTS.md` in the repo root; Codex discovers it automatically |

### Verify

In a Codex session:

```
$b-plan
```

Or run `/skills` to list every loaded skill and confirm the Buck set is
present.

Reference: <https://developers.openai.com/codex/skills>

---
## OpenCode (`opencode.ai`)

OpenCode has no package install command. It scans well-known directories for
`SKILL.md` files and `.md` command files. Drop the canonical `skills/` and
`commands/` directories into the right place — symlinks are fine and let
edits to this repo flow through live.

### Install

Recommended user-scope install from a durable clone:

```bash
git clone https://github.com/evilbuck/buck-workflow-pi ~/.local/share/buck-workflow-pi
~/.local/share/buck-workflow-pi/scripts/install.mjs \
  --source ~/.local/share/buck-workflow-pi --harness opencode
```

If that clone already exists, update it in place instead of cloning over it.
The installer's default non-force behavior preserves real destination files.
The manual equivalent is:

Global (available in every project):

```bash
# Skills — symlink each skill under one shared namespace
mkdir -p ~/.config/opencode/skills
for d in /path/to/buck-workflow-pi/skills/*/; do
  ln -s "$d" ~/.config/opencode/skills/"$(basename "$d")"
done

# Slash commands — each prompt file becomes a /<name> command
mkdir -p ~/.config/opencode/commands
for f in /path/to/buck-workflow-pi/prompts/*.md; do
  ln -s "$f" ~/.config/opencode/commands/"$(basename "$f")"
done
```

> OpenCode also reads `.claude/skills/` and `.agents/skills/` automatically, so
> if you already share skills with Claude Code or Codex, OpenCode picks them
> up with no extra work.

Project-scoped (only this repo, safe to commit):

```bash
mkdir -p .opencode/skills .opencode/commands
for d in /path/to/buck-workflow-pi/skills/*/; do
  ln -s "$d" .opencode/skills/"$(basename "$d")"
done
for f in /path/to/buck-workflow-pi/prompts/*.md; do
  ln -s "$f" .opencode/commands/"$(basename "$f")"
done
```

### Where things go

| Surface | Location |
|---|---|
| Skills (global) | `~/.config/opencode/skills/<name>/SKILL.md` |
| Skills (project) | `.opencode/skills/<name>/SKILL.md` |
| Skills (Claude compat) | `~/.claude/skills/<name>/SKILL.md` (auto-loaded) |
| Skills (agent compat) | `~/.agents/skills/<name>/SKILL.md` (auto-loaded) |
| Commands (global) | `~/.config/opencode/commands/<name>.md` |
| Commands (project) | `.opencode/commands/<name>.md` |
| Bootstrap (recommended) | place `AGENTS.md` in project root; OpenCode walks up from cwd |

### Verify

In the OpenCode TUI:

```
/b-plan
```

Command expansion proves only that B-Plan resolves. The TUI's loader-native
`skill` catalog must also resolve `b-build`, `b-review`, and `b-save` before
the session reports `full`.

Reference: <https://opencode.ai/docs/skills/> and <https://opencode.ai/docs/commands/>

---

## Claude Code (`claude.com/code`)

Claude Code follows the [Agent Skills](https://agentskills.io) standard. A
`SKILL.md` in the right directory registers both as an auto-loaded skill
(when its `description` matches the task) and as a `/<directory-name>`
command (when invoked explicitly).

### Install — durable clone + installer (recommended)

```bash
git clone https://github.com/evilbuck/buck-workflow-pi ~/.local/share/buck-workflow-pi
~/.local/share/buck-workflow-pi/scripts/install.mjs \
  --source ~/.local/share/buck-workflow-pi --harness claude
```

If that clone already exists, update it in place instead of cloning over it.
The checkout must remain at a durable path because the installer creates
symlinks into it. Its default non-force behavior preserves real destination
files; use `--dry-run` first when reconciling an existing setup. User scope
lands under `~/.claude/`; for project-only scope, link the same skill
directories under `.claude/skills/` in the project.

### Install — via the plugin marketplace (when the marketplace entry ships)

Once this repo publishes a Claude Code marketplace entry:

```
/plugin marketplace add evilbuck/buck-workflow-pi
/plugin install buck-workflow@evilbuck
```

Or install a local clone directly:

```
/plugin install /absolute/path/to/buck-workflow-pi
```

### Where things go

| Surface | Location |
|---|---|
| Skills (user) | `~/.claude/skills/<name>/SKILL.md` |
| Skills (project) | `.claude/skills/<name>/SKILL.md` |
| Skills (legacy commands) | `~/.claude/commands/<name>.md` (still supported) |
| Bootstrap (recommended) | copy `GLOBAL_OR_PROJECT-AGENTS.md` to `~/.claude/CLAUDE.md` |

Claude Code uses `CLAUDE.md` for its global memory file, not `AGENTS.md`.
The bootstrap content is identical; the file name differs.

### Verify

In a Claude Code session:

```
/b-plan
```

Seeing the planning workflow proves only that B-Plan resolves. Use Claude
Code's loader-native skill catalog to confirm `b-build`, `b-review`, and
`b-save` before the session reports `full`.

Reference: <https://code.claude.com/docs/en/skills>

---

## Grok Build (`grok`)

Grok Build follows the [Agent Skills](https://agentskills.io) standard and
scans `~/.grok/skills/` plus `~/.grok/commands/` natively. It also reads
Claude / `.agents` skill dirs for compatibility, but that is not a complete
install — use the Grok surfaces below so `/b-plan` and companions resolve
from this checkout.

### Install — durable clone + installer (recommended)

```bash
git clone https://github.com/evilbuck/buck-workflow-pi ~/.local/share/buck-workflow-pi
~/.local/share/buck-workflow-pi/scripts/install.mjs \
  --source ~/.local/share/buck-workflow-pi --harness grok
```

From an existing checkout (this machine):

```bash
/path/to/buck-workflow-pi/scripts/install.mjs \
  --source /path/to/buck-workflow-pi --harness grok
```

If that clone already exists, update it in place instead of cloning over it.
The checkout must remain at a durable path because the installer creates
symlinks into it.

### Install — plugin (optional)

Grok can also load the repo as a plugin (`skills/` + `commands/` at the
root). Plugin copies are not live-linked to the checkout:

```bash
grok plugin install /absolute/path/to/buck-workflow-pi --trust
```

Then enable it in `~/.grok/config.toml` under `[plugins].enabled` if it does
not appear after install. Prefer the symlink installer for a local checkout.

### Where things go

| Surface | Location |
|---|---|
| Skills (user) | `~/.grok/skills/<name>/SKILL.md` |
| Commands (user) | `~/.grok/commands/<name>.md` |
| Bootstrap (recommended) | `~/.grok/rules/buck-workflow.md` (Grok home rules) |
| Skills (project) | `.grok/skills/<name>/SKILL.md` or `.agents/skills/` |

### Verify

```bash
grok inspect
```

Confirm `b-build`, `b-review`, and `b-save` list with source path under
`~/.grok/skills/`. In a refreshed Grok session, type `/b-plan`.

Command expansion proves only that B-Plan resolves. All three sentinels must
resolve before the session reports `full`.

Reference: Grok user guide — Skills (`~/.grok/docs/user-guide/08-skills.md`)
and Plugins (`09-plugins.md`).

---

## Companion bootstrap (`.context/` conventions)

Buck workflow is durable by design — the skills write session memory,
backlog updates, and subject-folder artifacts under `.context/`. The
durable-artifact conventions are described in `GLOBAL_OR_PROJECT-AGENTS.md`
in this repo. Without it, the skills still run, but the agent has no
durable conventions to follow.

Install it once per agent:

| Agent | Global path | Project path (alternative) |
|---|---|---|
| Pi | `~/.pi/agent/AGENTS.md` | `./AGENTS.md` |
| OMP | `~/.omp/agent/AGENTS.md` | `./AGENTS.md` |
| Codex | `~/.codex/AGENTS.md` (or any ancestor of cwd) | `./AGENTS.md` |
| OpenCode | `~/.config/opencode/AGENTS.md` (or any ancestor) | `./AGENTS.md` |
| Claude Code | `~/.claude/CLAUDE.md` | `./CLAUDE.md` |
| Grok Build | `~/.grok/rules/buck-workflow.md` | `./AGENTS.md` |

The file is plain Markdown and contains no agent-specific tool calls — it
works as-is on every harness.

## Verify it worked

After install or repair:

1. Restart/reload the agent so the active skill catalog refreshes.
2. Use the harness's loader-native catalog/resolver to check the exact names
   `b-build`, `b-review`, and `b-save`. All three must resolve before reporting
   `full`.
3. Type `/b-plan` (or invoke `b-plan` by skill name on Codex), run a small task
   such as planning `CONTRIBUTING.md`, and confirm it creates
   `.context/<date>.<subject>/index.md` plus `plan-*.md`.
4. In a `full` session, run `/b-save` and confirm it writes a memory file under
   `.context/memory/`.

Package listings and files on disk may help diagnose an install, but they do
not replace the active-session sentinel check.

## Troubleshooting

- **Skill loads but slash command does not** — every agent except Codex
  maps a skill to a `/<name>` command. On Codex, use `$<skill-name>`
  instead. On Claude Code, the directory name (not the `name` field)
  becomes the command — if the directory is `b-plan/`, the command is
  `/b-plan`.
- **Path collision with another skill of the same name** — Pi, Claude
  Code, and OpenCode all keep the first skill found and warn. Rename
  with care, or remove the conflicting copy.
- **Live edits or installs not picked up** — even on harnesses that watch skill
  directories, start a refreshed session after installation or repair before
  repeating the sentinel probe. Codex always requires a restart after editing
  `~/.agents/skills/`.
- **Symlinks broken after a repo move** — re-run the `for d in ...` loop
  from the new path. Symlinks are cheap; replace, don't fix.
- **Permission prompts on Claude Code** — Buck skills are read-mostly
  and write to `.context/` only. If prompts fire, the agent is being
  conservative; approve once and the workflow proceeds.
