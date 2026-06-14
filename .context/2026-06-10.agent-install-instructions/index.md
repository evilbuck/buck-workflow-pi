---
status: completed
date: 2026-06-10
subject: 2026-06-10.agent-install-instructions
topics: [install, opencode, pi, omp, claude-code, codex, agent-skills, slash-commands, bootstrap, cross-harness]
informs: []
artifacts:
  - plan-agent-install-instructions.md
  - ../../agent-install_instructions.md
  - ../../README.md
---

# agent-install_instructions

## Goal

Give an installing agent (or a human directing one) a single, self-contained
file that walks through installing the Buck workflow skills on whichever
harness they run, using each harness's native install mechanism.

## Deliverable

`agent-install_instructions.md` at the repo root. The README links to it from
the top of the Install section so any agent reading the README can find the
right install path immediately.

## Per-harness method (final)

| Harness | Install mechanism | Why this is optimal |
|---|---|---|
| **Pi** | `pi install git:github.com/buckleyrobinson/buck-workflow-pi` | Package ships `pi` manifest in `package.json`; native package install. |
| **OMP** | `omp install git:github.com/buckleyrobinson/buck-workflow-pi` | Package ships `omp` manifest; native plugin install. |
| **OpenCode** | Symlink `skills/*/` and `prompts/*.md` into `~/.config/opencode/skills/` and `~/.config/opencode/commands/` | OpenCode has no package install — it scans well-known dirs. Symlinks keep the install in sync with the source repo. |
| **Claude Code** | Symlink `skills/*/` into `~/.claude/skills/` | Native Agent Skills format; directory name becomes the `/<name>` command. Marketplace install also documented for the future. |
| **Codex** | Symlink `skills/*/` into `~/.agents/skills/` | Codex reads from the shared `.agents/skills/` location. Invocation is `$buck-plan` instead of `/b-plan` (Codex has no arbitrary slash commands). |

## What was researched

- **Pi**: `pi install` accepts npm / git / local paths; the package's
  `pi.skills`, `pi.prompts`, `pi.extensions` keys drive discovery. Skills
  land under `~/.pi/agent/`. Confirmed at <https://pi.dev/docs/latest/packages>,
  <https://pi.dev/docs/latest/skills>, <https://pi.dev/docs/latest/prompt-templates>.
- **OMP**: `omp install` with npm, github shorthand, raw URLs, and local
  paths; project scope with `-l` writes to `.omp/plugins/`. Marketplace
  supported via `omp marketplace add` + `omp install <name>@<marketplace>`.
  Confirmed at <https://omp.sh/docs/plugins>.
- **OpenCode**: Scans `.opencode/skills/`, `~/.config/opencode/skills/`,
  `.claude/skills/`, `.agents/skills/` for `SKILL.md`. Commands are
  `.md` files in `.opencode/commands/` or `~/.config/opencode/commands/`.
  No package install. Confirmed at <https://opencode.ai/docs/skills/> and
  <https://opencode.ai/docs/commands/>.
- **Claude Code**: Skills live at `~/.claude/skills/<name>/SKILL.md` and
  `.claude/skills/<name>/SKILL.md`. Plugin install via `/plugin install`
  in the TUI, with marketplace support. Confirmed at
  <https://code.claude.com/docs/en/skills> and
  <https://code.claude.com/docs/en/discover-plugins>.
- **Codex**: Skills follow the shared Agent Skills standard. Locations:
  `$CWD/.agents/skills/`, `$HOME/.agents/skills/`,
  `/etc/codex/skills/`, plus bundled system skills. Invocation is
  `$skill-name` or implicit-by-description. Plugin install via
  `$skill-installer`. Confirmed at
  <https://developers.openai.com/codex/skills> and
  <https://developers.openai.com/codex/plugins>.

## Cross-cutting decisions

- **Symlinks over copy.** The skills live in the source repo; the install
  should be a symlink so edits flow through. Pi/OpenCode/Claude Code watch
  for changes; Codex requires a restart.
- **Bootstrap (`AGENTS.md` / `CLAUDE.md`) is a separate, optional step.**
  Listed in its own section at the end of the install file, with the
  per-harness target path. The existing README "Install" section already
  covers this for Pi/OMP; the new file extends the table to all five
  harnesses.
- **Slash-command name = directory name.** The skill `b-plan/` becomes
  `/b-plan` on Pi, OMP, OpenCode, and Claude Code. Codex uses `$buck-plan`
  (skill name, not directory name) — documented as the exception.
- **No code changes.** This is a docs + install file change. No source
  files in `skills/`, `prompts/`, `commands/`, or `extensions/` were
  modified. The package.json `pi`/`omp` manifests are already correct.

## Verification

- README "Install" section now opens with a clear pointer to
  `agent-install_instructions.md` for installing agents.
- The new file has one self-contained section per harness with copy-paste
  install commands and a per-harness verify step.
- No claims about agent behavior are made without a source URL.
- All listed install paths and CLI commands are taken from the
  authoritative docs (linked at the end of each section).
