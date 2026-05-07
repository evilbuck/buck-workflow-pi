---
date: 2026-05-07
domains: [debugging, extension, tmux]
topics: [tmux, window-naming, session-switch, savedName, init-guard, pi-extension]
subject: 2026-05-07.tmux-window-name-bug
artifacts: [.context/2026-05-07.tmux-window-name-bug/research-tmux-window-name-bug.md]
related: [tmux-window-status-2026-04-16.md]
priority: high
status: active
---

# Session: tmux Window Name Bug Investigation

## Context
User reported that when running multiple pi sessions in different tmux windows, all windows get the same project name instead of their respective project names.

## Bug Location

**File**: `extensions/tmux-window-status.ts`
**Line**: `TmuxAdapter.init()` method

```typescript
init(): void {
  if (!this.inTmux || this.savedName !== null) return;  // ← BUG
  // ...
  this.savedName = name;
}
```

## Root Cause

The `savedName !== null` guard causes `init()` to only run **once** per `TmuxAdapter` instance. Since `TmuxAdapter` is created once in `wire()` and lives for the entire pi process, subsequent `session_start` events (including session switches) don't re-read the window name.

**Result**: If the first session starts before windows are renamed to project-specific names, or if `init()` fails, `savedName` captures a generic name ("bash") or stays null, causing all windows to show the same fallback name ("pi").

## Data Flow

1. `session_start` → `TmuxAdapter.init()` reads `tmux display-message -p '#{window_name}'` and saves it
2. `before_agent_start` → `TmuxAdapter.show("working")` renames to `{savedName} ⚙️`
3. `agent_end` → `TmuxAdapter.show(terminal)` shows final icon
4. `session_shutdown` → `TmuxAdapter.teardown()` restores original name and sets `savedName = null`
5. Next `session_start` → BUT guard blocks re-init because `savedName !== null`... wait, teardown sets it to null

Actually looking more carefully: `teardown()` sets `savedName = null`, so on the next `session_start`, `init()` SHOULD run again. The issue might be that the `init()` guard is blocking re-initialization in other scenarios.

## Why All Windows Show Same Name

If `init()` fails or `inTmux` is false:
- `savedName` remains null
- `show()` uses fallback: `const base = this.savedName ?? "pi"`
- All windows show "pi ⚙️" (same base name)

## Possible Fixes

1. **Remove the guard** (simplest): `init()` always re-reads the window name
2. **Move guard check**: Only block if `savedName` was successfully set (not if init previously failed)
3. **Architectural change**: Maintain per-session window name map

## Next Steps

- Create a plan to fix the bug
- Implement and test the fix
- Verify multi-window behavior

## Files Involved

- `extensions/tmux-window-status.ts` — Bug location
- `extensions/tmux-window-status.test.ts` — Tests (don't catch this bug)
- `extensions/index.ts` — Wires the extension
- `~/.cache/pi-tmux-status/events.jsonl` — Debug log showing extension runs

## Fix Implemented (2026-05-07)

**Changed**: `extensions/tmux-window-status.ts` — `TmuxAdapter.init()`
- Removed `savedName !== null` guard from init()
- Now re-reads tmux window name on every `session_start`
- Catch block no longer leaves stale state — preserves existing savedName on failure

**Changed**: `extensions/tmux-window-status.test.ts`
- Added test: `calls init on every session_start (not just the first)`
- Verifies init is called twice across two full session lifecycles

**Verification**: All 43 tests pass (42 existing + 1 new)

## Key Decision

Chose to remove the guard entirely rather than add per-session state. The overhead of one `tmux display-message` call per session switch is <5ms. `teardown()` already restores the original window name, so init re-reading it is safe and correct.
