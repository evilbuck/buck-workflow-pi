---
name: run-in-idle-pane
description: Detect the least-active tmux pane and run a dev server or long-running command there. Use whenever starting a dev server, build process, or background process in a tmux session.
---

# Run in Idle Pane Skill

Detect the least-active (idle) tmux pane in the current session and run a command there. Falls back to creating a new tmux window if no idle pane exists.

## When to Use

When the user asks you to start a dev server, build process, or any long-running command, **always prefer `run-in-idle-pane.sh`** over:

- `tmux new-window` (creates a new window even when an idle one exists)
- Inline `tmux send-keys` without checking pane state (might pick a pane the user is watching)
- Running in the foreground of the current pane (blocks the conversation)

## The Script

The script is installed at `~/.bin/run-in-idle-pane.sh` (managed via chezmoi).

**Location**: `~/.bin/run-in-idle-pane.sh` (deployed from `~/.local/share/chezmoi/executable_run-in-idle-pane.sh`)

## Usage

```bash
# Basic — auto-detect current tmux session, find idle pane, run command
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

## How It Works

1. **Auto-detect session**: If no session is given, uses the current tmux session/window.
2. **Find idle pane**: Scans all panes in the session for the one with the smallest history (least activity). Excludes the active pane the user is watching.
3. **Send command**: Sends the command to the idle pane via `tmux send-keys`.
4. **Fallback**: If no idle pane is found, creates a new tmux window.

## Idle Detection Heuristic

A pane is considered "idle" when:
- `pane_active == 0` (the user is not currently viewing it)
- `history_size < 20` lines of scrollback (very low activity)

## Verification After Starting

After running the script, verify the server is up:

```bash
# Check the pane/window output
tmux capture-pane -t <session>.<pane_id> -p | tail -15

# Or curl the endpoint
curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/health
```

## Keyboard Shortcut

You can also manually target an idle pane with:
```bash
# List all panes with their activity level (history size)
tmux list-panes -a -F '#{session_name}:#{window_index}.#{pane_index} [#{history_size} lines]'
```
