---
name: run-in-idle-pane
description: Detect the least-active tmux pane and run a dev server or long-running command there. Use whenever starting a dev server, build process, or background process in a tmux session.
---

# Run in Idle Pane Skill

Detect the least-active (idle) tmux pane and run a command there, or just find the target pane for custom command dispatch.

## When to Use

When the user asks you to start a dev server, build process, or any long-running command, **always prefer targeting an idle pane** over:

- `tmux new-window` (creates a new window even when an idle one exists)
- Inline `tmux send-keys` without checking pane state (might pick a pane the user is watching)
- Running in the foreground of the current pane (blocks the conversation)

## Scripts

### `find_idle_pane.sh` — Quick Target Finder (Preferred)

**Location**: `skills/run-in-idle-pane/scripts/find_idle_pane.sh`

Finds an idle pane in the current tmux window and **prints the target identifier** (`session:window.pane`). Does not run a command — you send keys yourself. This is the simplest and most composable approach.

```bash
# Find an idle pane target
TARGET=$(bash skills/run-in-idle-pane/scripts/find_idle_pane.sh)
# → quokka:1.3

# Send a command to the found pane
tmux send-keys -t "$TARGET" 'npm run dev' Enter

# Chain into verification
tmux capture-pane -t "$TARGET" -p | tail -15
```

How it works:
 1. Resolves the originating pane via `$TMUX_PANE` (the pane the script runs in, not the currently active pane) to skip itself and scope the search to the correct window.
 2. Iterates all panes in that window, skipping the calling pane.
 3. Checks each pane's foreground process via `pane_current_command` — shells (`bash`, `zsh`, `fish`, `sh`, `dash`, `ksh`, `tcsh`, `csh`) are idle; everything else (nvim, node, python, etc.) is occupied.
 4. Returns the first idle pane's `session:window.pane` target.
 5. **Fallback**: if no idle pane exists, splits a new pane in the originating window and returns its target.

Exit codes: `0` = target found/created, `1` = not inside tmux.

### `run-in-idle-pane.sh` — Full Runner (Chezmoi-managed)

**Location**: `~/.bin/run-in-idle-pane.sh` (deployed from `~/.local/share/chezmoi/executable_run-in-idle-pane.sh`)

The full-featured script that finds an idle pane **and** sends the command in one step. Supports explicit sessions, `--new` flag, and verbose mode.

```bash
# Basic — auto-detect session, find idle pane, run command
run-in-idle-pane.sh npm run dev

# Explicit session
run-in-idle-pane.sh Projects:3 npm run dev

# Always create a new window (never use existing panes)
run-in-idle-pane.sh --new 'npm run dev'

# Verbose output
VERBOSE=1 run-in-idle-pane.sh npm run dev

# Help
run-in-idle-pane.sh --help
```

## Idle Detection Heuristic

Two heuristics are used, depending on the script:

| Script | Method | Criteria |
|---|---|---|
| `find_idle_pane.sh` | **Process-based** (preferred) | Originates from `$TMUX_PANE`; `pane_current_command` matches a shell and the pane is not the calling pane |
| `run-in-idle-pane.sh` | **History-based** | `pane_active == 0` and `history_size < 20` lines of scrollback; uses `display-message` (active-pane context) |

Process-based detection is more reliable: a shell at the prompt is idle regardless of scrollback depth, and a running process (nvim, node) is occupied even with minimal history.

## Verification After Starting

After sending a command, verify the server is up:

```bash
# Check the pane output
tmux capture-pane -t <target> -p | tail -15

# Or curl the endpoint
curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/health
```

## Manual Inspection

List all panes with activity info:
```bash
# By process (most useful)
tmux list-panes -t "$(tmux display-message -p '#S:#I')" -F '#{pane_id} cmd=#{pane_current_command} active=#{pane_active}'

# By history size
tmux list-panes -a -F '#{session_name}:#{window_index}.#{pane_index} [#{history_size} lines]'
```
