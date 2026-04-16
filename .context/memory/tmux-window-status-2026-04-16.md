---
date: 2026-04-16
domains: [tooling, pi-extension]
topics: [tmux, status-icons, state-machine, lifecycle-events, window-naming]
subject: 2026-04-16.tmux-window-name-pi-status
artifacts:
  - .context/2026-04-16.tmux-window-name-pi-status/plan-tmux-window-name-pi-status.md
related: []
priority: high
status: active
---

# Session: tmux window name status for pi

## What was built
A pi extension module (`extensions/tmux-window-status.ts`) that renames the active tmux window with status icons based on pi lifecycle events.

## Status icons
- ⚙️ working — agent processing
- 🧠 thinking — streaming thinking output
- ✅ done — clean completion (stopReason === "stop")
- 🚧 stuck — agent ended by asking user a question (heuristic)
- 🛑 timed out — error/length/aborted stop

## Architecture
- **State machine** with priority-based transitions and terminal-state locks
- **Fail-soft tmux detection** — no-ops cleanly outside tmux
- **Original window name saved/restored** on session start/shutdown
- **Stuck detection** uses regex heuristics on the last ~500 chars of assistant text
- **Separated module** (`tmux-window-status.ts`) imported by `extensions/index.ts`

## Key decisions
- Used `before_agent_start` for reset + working transition (clears prior terminal state)
- Used `message_update` with `thinking_delta` for thinking icon
- Used `message_end` for stop reason and final text capture
- Used `agent_end` for terminal status finalization
- `toolUse` stop reason treated as "done" (agent made progress)
- Multi-turn handling: stop reason and text get overwritten each turn, final values used
- **Icon is always appended** to original window name (e.g., `bash ⚙️`), never replaces it
- Added `clearIcon()` method to remove icon without full cleanup

## Files modified
- `extensions/tmux-window-status.ts` — new module (state machine + tmux helpers + pi wiring)
  - Icon appended to original name: `{original_name} {icon}`
  - On cleanup: restores original name without icon
  - Falls back to `"pi"` as base name if original can't be determined
- `extensions/index.ts` — added import and wire call for tmux status; fixed qmd re-index call (was using non-existent `qmd index` subcommand)

## QMD fix
- **Problem**: `b-save` called `qmd index .context/memory --collection memory` which doesn't exist
- **Solution**: Changed to `qmd collection add .context/memory --name buck-workflow-memory --mask '*.md'`
- **Why not `qmd update`**: It crashes on the vault collection (tracked as `fix-qmd-index-crash` in backlog)
- **Collection registered**: `buck-workflow-memory` → `/home/buckleyrobinson/projects/development_tools/buck-workflow-pi/.context/memory` with `*.md` pattern

## Risks
- Stuck detection heuristic may misclassify some messages
- `execSync` for tmux rename blocks the event loop briefly (~2ms typically)
- Module-level state (`_savedWindowName`, `_isTmux`) persists across hot reloads

## Verification needed
- Test inside tmux: window title changes at each state
- Test outside tmux: no errors or side effects
- Test multi-turn agent loop: only final terminal state shown
- Test stuck detection with real assistant questions
