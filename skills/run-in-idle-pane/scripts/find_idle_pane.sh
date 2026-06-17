#!/usr/bin/env bash
# tmux-idle-pane.sh
# Finds an idle pane in the current tmux window, or creates one.
# Prints the target identifier: "session:window.pane" (e.g. main:1.2)
# Exit codes: 0 = success, 1 = not running inside tmux

set -euo pipefail

if [[ -z "${TMUX:-}" ]]; then
  echo "Error: not running inside a tmux session" >&2
  exit 1
fi

# Resolve current context so we skip ourselves.
# Use TMUX_PANE (set by tmux for every process in a pane) to find our
# originating pane. display-message without -t resolves to the *active*
# pane, which may be in a different window than the one we're running in.
if [[ -z "${TMUX_PANE:-}" ]]; then
  echo "Error: TMUX_PANE not set — not running inside a tmux pane" >&2
  exit 1
fi
CURRENT_PANE="$TMUX_PANE"
SESSION=$(tmux display-message -t "$CURRENT_PANE" -p '#S')
WINDOW=$(tmux display-message -t "$CURRENT_PANE" -p '#I')

# is_idle <pane_id>
# Returns 0 (true) if the pane has no running foreground process —
# i.e. its current command is the shell itself.
is_idle() {
  local pane_id="$1"
  local cmd
  cmd=$(tmux display-message -t "$pane_id" -p '#{pane_current_command}')

  # Common shell basenames that indicate an idle pane
  case "$cmd" in
    bash|zsh|fish|sh|dash|ksh|tcsh|csh)
      return 0 ;;
    *)
      return 1 ;;
  esac
}

# Iterate over all panes in this window, skip the calling pane
IDLE_PANE=""
while IFS= read -r pane_id; do
  [[ "$pane_id" == "$CURRENT_PANE" ]] && continue
  if is_idle "$pane_id"; then
    IDLE_PANE="$pane_id"
    break
  fi
done < <(tmux list-panes -t "${SESSION}:${WINDOW}" -F '#{pane_id}')

if [[ -n "$IDLE_PANE" ]]; then
  # Convert the %N pane_id to a window.pane index for keystroke targeting
  PANE_INDEX=$(tmux display-message -t "$IDLE_PANE" -p '#{pane_index}')
  TARGET="${SESSION}:${WINDOW}.${PANE_INDEX}"
  echo "$TARGET"
else
  # No idle pane found — create a new split and capture its index
  NEW_PANE_ID=$(tmux split-window -t "${SESSION}:${WINDOW}" -P -F '#{pane_id}' -d)
  PANE_INDEX=$(tmux display-message -t "$NEW_PANE_ID" -p '#{pane_index}')
  TARGET="${SESSION}:${WINDOW}.${PANE_INDEX}"
  echo "$TARGET"
fi
