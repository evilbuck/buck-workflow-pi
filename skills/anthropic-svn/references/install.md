# Install anthropic-svn as a harness output style

`skills/anthropic-svn/SKILL.md` is the source of truth. Its description asks Pi/OMP to load it when the current model is Claude (Opus, Sonnet, or Haiku); model-invoked discovery is not a guaranteed per-turn hook.

These steps export the contract as a harness-level instruction, without relying on skill discovery. Claude Code uses an output style; OpenCode uses an instruction file; Pi uses `APPEND_SYSTEM.md`. These exports apply to every model using that configuration, not only Claude. Prefer the skill for model-selective use.

Copy the **Contract / Shape / Examples** sections from `SKILL.md` (not the YAML frontmatter, not Surface). `Codex.claude.frontmatter.md` is Claude-only.

## Behavior and limits

- **`keep-coding-instructions: true` is required** on the Claude Code style. Without it Claude Code drops its built-in software-engineering instructions. This style changes tone and shape only, so it keeps them.
- **Main conversation only.** A subagent runs its own system prompt, so delegated work is unaffected. A fork inherits the parent's prompt and is affected.
- **Takes effect next session.** Claude Code `outputStyle` is read once at session start; the system prompt is rebuilt on `/clear` or restart.
- **The value is the style name, not the filename.** Here they match: frontmatter `name: Codex`, file `Codex.md`. The frontmatter wins if they ever diverge.
- **Not a place for project facts.** Conventions and codebase context belong in `AGENTS.md` / `CLAUDE.md`.

## Global Install (Claude Code)

Run from `skills/anthropic-svn/`.

### 1. Copy the style into place

```bash
mkdir -p ~/.claude/output-styles
{
  cat ./references/Codex.claude.frontmatter.md
  echo
  # Contract + Shape + Examples from SKILL.md (skip YAML + Surface)
  awk 'BEGIN{p=0} /^## Contract$/{p=1} /^## Surface$/{p=0} p' ./SKILL.md
} > ~/.claude/output-styles/Codex.md
```

### 2. Select it in `~/.claude/settings.json`

`outputStyle` is a top-level key holding the style name. Merge it with `jq` so the rest of the file (plugins, hooks, env, permissions) survives:

```bash
SETTINGS="$HOME/.claude/settings.json"
[ -f "$SETTINGS" ] || echo '{}' > "$SETTINGS"
tmp="$(mktemp -t cc-outputstyle-settings.XXXXXX)"
jq --arg style "Codex" '.outputStyle = $style' "$SETTINGS" > "$tmp" && mv "$tmp" "$SETTINGS"
```

A human can do the same through `/config` → **Output style** → **Codex**, which writes the key at project-local scope instead. The standalone `/output-style` command was removed in v2.1.91.

### 3. Verify

```bash
jq -r '.outputStyle' ~/.claude/settings.json     # -> Codex
head -5 ~/.claude/output-styles/Codex.md          # -> frontmatter with name: Codex
```

The style applies in the next session, or after `/clear` in this one.

## Global Install (OpenCode)

Run from `skills/anthropic-svn/`.

### 1. Copy the instruction file into place

```bash
mkdir -p ~/.config/opencode/instructions
awk 'BEGIN{p=0} /^## Contract$/{p=1} /^## Surface$/{p=0} p' ./SKILL.md \
  > ~/.config/opencode/instructions/codex-output-style.md
```

### 2. Add it to `~/.config/opencode/opencode.json`

```bash
SETTINGS="$HOME/.config/opencode/opencode.json"
[ -f "$SETTINGS" ] || echo '{"$schema":"https://opencode.ai/config.json"}' > "$SETTINGS"
tmp="$(mktemp -t oc-instructions.XXXXXX)"
jq '.instructions = ((.instructions // []) + ["~/.config/opencode/instructions/codex-output-style.md"] | unique)' "$SETTINGS" > "$tmp" && mv "$tmp" "$SETTINGS"
```

### 3. Verify

```bash
jq -r '.instructions // []' ~/.config/opencode/opencode.json
```

Restart OpenCode after changing config files; it reads config at startup.

## Global Install (Pi)

Run from `skills/anthropic-svn/`.

Pi appends to its system prompt from [`APPEND_SYSTEM.md`](https://github.com/earendil-works/pi/blob/main/docs/usage.md#system-prompt-files). There is no config key to set — the file being there is the selection — so this is a one-step install.

Use this **only** if every Pi session should get the style. Prefer the skill when the same Pi install also runs GPT, Codex, Grok, or Gemini: `APPEND_SYSTEM.md` fires for every model; the skill description does not.

### 1. Copy the instruction file into place

```bash
mkdir -p ~/.pi/agent
awk 'BEGIN{p=0} /^## Contract$/{p=1} /^## Surface$/{p=0} p' ./SKILL.md \
  > ~/.pi/agent/APPEND_SYSTEM.md
```

### 2. Verify

```bash
head -3 ~/.pi/agent/APPEND_SYSTEM.md
```

Pi's startup header lists the context and system-prompt files it loaded. `/reload` re-reads them in place, so unlike Claude Code and OpenCode this does not need a restart.

### Pi-specific behavior

- **`APPEND_SYSTEM.md`, not `SYSTEM.md`.** `SYSTEM.md` *replaces* the default prompt, which drops Pi's built-in coding instructions — the same failure as Claude Code's `keep-coding-instructions: false`. `APPEND_SYSTEM.md` adds to the default prompt and is the equivalent of keeping them.
- **A project file replaces the global one; it does not merge.** Pi takes `.pi/APPEND_SYSTEM.md` if the project is trusted, and only falls back to `~/.pi/agent/APPEND_SYSTEM.md` if that is absent. A repo carrying its own file silently loses this style rather than adding to it.
- **Project-local files need trust.** `.pi/` resources load only after the folder is trusted (`/trust`, or the startup prompt). The global install above is unaffected.
- **Near the end of the prompt, not at the very end.** It lands after the whole default system prompt, but Pi then appends project context files (`AGENTS.md`/`CLAUDE.md`), the skills list, and the working directory after it. So it sits later than the default instructions it is there to override, but — unlike Claude Code — project context files sit later still.
- **One-off, without installing:** `pi --append-system-prompt "<text>"`.

## Reverting

Claude Code:

```bash
tmp="$(mktemp -t cc-outputstyle-settings.XXXXXX)"
jq 'del(.outputStyle)' ~/.claude/settings.json > "$tmp" && mv "$tmp" ~/.claude/settings.json
```

Deleting the key returns Claude Code to the **Default** style. The built-in alternatives are `Proactive`, `Explanatory`, and `Learning`.

Pi — remove the file, since its presence is what selects it:

```bash
rm ~/.pi/agent/APPEND_SYSTEM.md
```

## Updating

Edit `skills/anthropic-svn/SKILL.md`, then re-run step 1 to redeploy. Step 2 only needs to run once — and Pi has no step 2. Pi picks the change up on `/reload`; Claude Code and OpenCode need a new session.
