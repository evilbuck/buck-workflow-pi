# Agent Install Instructions — Buck Workflow

> **For the installing agent:** Before running any install command, **ask the
> user which agent they're installing for** — Pi, OMP, Codex, OpenCode, or
> Claude Code. Then jump to that section and run only those commands.
> Do **not** blast through every section in sequence.

Buck Workflow is a portable set of agent skills (the Buck workflow: brainstorm,
explore, research, plan, build, review, save, present, grill, commit, plus
helper skills). The skills are plain Markdown following the
[Agent Skills](https://agentskills.io) open standard, so the same content loads
on every supported harness.

The canonical source lives at
<https://github.com/buckleyrobinson/buck-workflow-pi>. Every agent installs the
**same content** — only the install mechanism differs.

## What you get

After install, the agent gains these `b-*` slash commands (or `$b-*` / `/skill:*`
invocations on agents that use skill loaders):

| Command | Purpose |
|---|---|
| `/b-brainstorm` | Interview-style intake, capture initial thinking |
| `/b-explore` | Map unfamiliar codebases, trace architecture |
| `/b-research` | External/web research, source collection, evidence capture |
| `/b-plan` | Turn context into a bounded implementation plan |
| `/b-build` | Standard implementation — smallest safe code change |
| `/b-build-hard` | Complex/ambiguous/higher-risk implementation |
| `/b-iterate` | Quick follow-up fixes, polish, review-loop edits |
| `/b-review` | Review implementation for correctness and regressions |
| `/b-save` | Record session history to `.context/memory/` |
| `/b-present` | Generate async-readable presentation package |
| `/b-phase` | Break a plan into sequential phases |
| `/b-grill-me` | Stress-test a plan through structured interviewing |
| `/git-commit` | Conventional Commits message + commit |

The skills themselves live in `skills/<name>/SKILL.md` of this repo and are
agent-neutral.
| Agent | Install method | Skills land at | Commands land at |
|---|---|---|---|
| **Pi** | `pi install git:github.com/buckleyrobinson/buck-workflow-pi` | `~/.pi/agent/skills/...` (package) | `~/.pi/agent/prompts/...` (package) |
| **OMP** | `omp install git:github.com/buckleyrobinson/buck-workflow-pi` | per-plugin skill dir | per-plugin command dir |
| **Codex** | Symlink or copy the `skills/` directory | `~/.agents/skills/buck-workflow/` | n/a — invoke as `$buck-plan` (skill name) |
| **OpenCode** | Symlink or copy the `skills/` and `commands/` directories | `~/.config/opencode/skills/buck-workflow/` | `~/.config/opencode/commands/` |
| **Claude Code** | Symlink/copy the `skills/` directory, or use the marketplace | `~/.claude/skills/buck-workflow/` | derived from skill name (`/b-plan` etc.) |

---

## Pi (`pi.dev`)

Pi is the upstream of Buck Workflow and the most native install path. The
package ships a `pi` manifest in `package.json` that declares its skills,
prompts, and extensions.

### Install

From npm (when published):

```bash
pi install npm:@buckleyrobinson/buck-workflow
```

From git (today):

```bash
pi install git:github.com/buckleyrobinson/buck-workflow-pi
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
pi -e git:github.com/buckleyrobinson/buck-workflow-pi
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
omp install git:github.com/buckleyrobinson/buck-workflow-pi
```

From a local clone:

```bash
omp install ./buck-workflow-pi
```

For project-scoped install (writes to `.omp/plugins/` in the repo — useful
for teams that want to share the same plugin set without forcing it
globally):

```bash
omp install -l git:github.com/buckleyrobinson/buck-workflow-pi
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

User scope (applies to every repo):

```bash
mkdir -p ~/.agents/skills
for d in /path/to/buck-workflow-pi/skills/*/; do
  ln -s "$d" ~/.agents/skills/"$(basename "$d")"
done
```

Project scope (this repo only, safe to commit):

```bash
mkdir -p .agents/skills
for d in /path/to/buck-workflow-pi/skills/*/; do
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
$buck-plan
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
$buck-plan
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

If the command expands, install worked. The TUI's `skill` tool description
also lists every loaded skill — you should see entries for `b-plan`,
`b-build`, `b-review`, etc.

Reference: <https://opencode.ai/docs/skills/> and <https://opencode.ai/docs/commands/>

---

## Claude Code (`claude.com/code`)

Claude Code follows the [Agent Skills](https://agentskills.io) standard. A
`SKILL.md` in the right directory registers both as an auto-loaded skill
(when its `description` matches the task) and as a `/<directory-name>`
command (when invoked explicitly).

### Install — manual (recommended today)

```bash
mkdir -p ~/.claude/skills
for d in /path/to/buck-workflow-pi/skills/*/; do
  ln -s "$d" ~/.claude/skills/"$(basename "$d")"
done
```

User scope puts skills under `~/.claude/skills/` (available in all
projects). Project scope puts them under `.claude/skills/` in the current
repo. Claude Code picks them up live — no restart needed for edits.

### Install — via the plugin marketplace (when the marketplace entry ships)

Once this repo publishes a Claude Code marketplace entry:

```
/plugin marketplace add buckleyrobinson/buck-workflow-pi
/plugin install buck-workflow@buckleyrobinson
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

If you see the planning workflow, install worked. `/skills` lists every
loaded skill — confirm `b-plan`, `b-build`, `b-review`, `b-save` are
present.

Reference: <https://code.claude.com/docs/en/skills>

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

The file is plain Markdown and contains no agent-specific tool calls — it
works as-is on every harness.

## Verify it worked

After install, run a quick smoke test from any agent:

1. Type `/b-plan` (or `$buck-plan` on Codex) and confirm the planning
   skill loads.
2. Run a small task — for example, `/b-plan "Add a CONTRIBUTING.md"` —
   and confirm the agent creates `.context/<date>.<subject>/plan-*.md`.
3. Run `/b-save` and confirm it writes a memory file under
   `.context/memory/`.

If all three work, the install is complete.

## Troubleshooting

- **Skill loads but slash command does not** — every agent except Codex
  maps a skill to a `/<name>` command. On Codex, use `$<skill-name>`
  instead. On Claude Code, the directory name (not the `name` field)
  becomes the command — if the directory is `b-plan/`, the command is
  `/b-plan`.
- **Path collision with another skill of the same name** — Pi, Claude
  Code, and OpenCode all keep the first skill found and warn. Rename
  with care, or remove the conflicting copy.
- **Live edits not picked up** — Pi, OpenCode, and Claude Code watch
  skill directories; changes flow through. Codex requires a restart
  after editing `~/.agents/skills/`.
- **Symlinks broken after a repo move** — re-run the `for d in ...` loop
  from the new path. Symlinks are cheap; replace, don't fix.
- **Permission prompts on Claude Code** — Buck skills are read-mostly
  and write to `.context/` only. If prompts fire, the agent is being
  conservative; approve once and the workflow proceeds.
