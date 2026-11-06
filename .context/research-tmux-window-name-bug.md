---
status: active
date: 2026-05-07
subject: 2026-05-07.tmux-window-name-bug
topics: [tmux, window-naming, bug, extension, state-machine, session-lifecycle]
informs: [plan-fix-tmux-window-name.md]
---

# Research: tmux Window Name Bug in pi Extension

## Bug Description

When running multiple pi sessions in different tmux windows, all windows show the **same project name** instead of their respective project names.

## Key Files

- `extensions/tmux-window-status.ts` — The buggy extension
- `extensions/tmux-window-status.test.ts` — Tests (don't catch this bug)
- `extensions/index.ts` — Wires `wireTmuxStatus(pi)` on line 309
- `~/.cache/pi-tmux-status/events.jsonl` — Debug log (shows extension is running)

## Architecture Overview

```
pi lifecycle events
        ↓
    wire() function (in tmux-window-status.ts)
        ↓
    StateMachine (pure logic, tracks session state)
        ↓
    TmuxAdapter (executes tmux rename-window)
        ↓
    tmux rename-window -- "original-name ⚙️"
```

## Data Flow

### How window names are set:

1. **Session start** → `session_start` event fires
2. **`TmuxAdapter.init()`** is called:
   ```typescript
   init(): void {
     if (!this.inTmux || this.savedName !== null) return;  // ← GUARD CAUSES BUG
     const name = execSync("tmux display-message -p '#{window_name}'").trim();
     name = name.replace(ICON_SUFFIX_RE, "");  // Strip trailing icons
     this.savedName = name;
   }
   ```
3. **Agent work starts** → `before_agent_start` event fires
4. **`TmuxAdapter.show("working")`** is called:
   ```typescript
   show(status: Status): void {
     const base = this.savedName ?? "pi";  // ← Uses savedName
     const name = `${base} ${STATUS_ICONS[status]}`;
     execSync(`tmux rename-window -- "${name}"`);
   }
   ```

### Session end flow:

1. `agent_end` → `show(terminalStatus)` sets final icon
2. `session_shutdown` → `teardown()` restores original name:
   ```typescript
   teardown(): void {
     if (this.savedName !== null) {
       execSync(`tmux rename-window -- "${this.savedName}"`);
     }
     this.savedName = null;  // ← Resets for next session
   }
   ```

## The Bug

**Location**: `TmuxAdapter.init()` line with `savedName !== null` guard

**Problem**: The guard `if (!this.inTmux || this.savedName !== null) return` means:
- `init()` only runs **once** per `TmuxAdapter` instance
- `TmuxAdapter` is created once in `wire()` and lives for the entire pi process
- Subsequent `session_start` events (session switches) don't re-read the window name

**Impact scenarios**:

1. **First session started before window renamed**: If the user starts pi before renaming their tmux window to a project name, `savedName` captures "bash" and all subsequent sessions use "bash".

2. **`savedName` is null**: If `init()` fails (tmux command times out, tmux not detected via `process.env.TMUX`), `savedName` stays null and `show()` uses "pi" as the base.

3. **Race condition on session switch**: After `teardown()` restores the original name and before `init()` captures it for the new session, the timing could cause issues.

## Root Cause Analysis

### Why `savedName !== null` guard exists:

Looking at the memory file (`tmux-window-status-2026-04-16.md`), bug fix #3 addressed "Icon stacking" where:
- **Problem**: Window name accumulated icons: `bash 🧠 ⚙️ ⚙️`
- **Root cause**: `TmuxAdapter.init()` saved the current window name including previously appended icons
- **Fix**: Added `ICON_SUFFIX_RE` regex to strip trailing status icons from captured name

The `savedName !== null` guard was meant to prevent re-running `init()` unnecessarily, but it has the side effect of **never re-reading the window name on session switches**.

### Why the bug manifests as "all same names":

If `init()` fails or `inTmux` is false:
- `savedName` remains null
- `show()` uses fallback: `const base = this.savedName ?? "pi"`
- All windows show "pi ⚙️" (or "pi" with whatever icon)

## Code Evidence

```typescript
// tmux-window-status.ts — TmuxAdapter class
export class TmuxAdapter implements StatusDisplay {
  private savedName: string | null = null;
  private readonly inTmux: boolean;

  constructor() {
    this.inTmux = !!process.env.TMUX;  // ← Set once in constructor
  }

  init(): void {
    if (!this.inTmux || this.savedName !== null) return;  // ← BUG: blocks re-init
    // ... reads current tmux window name ...
    this.savedName = name;
  }

  show(status: Status): void {
    const base = this.savedName ?? "pi";  // ← Falls back to "pi" if null
    const name = `${base} ${STATUS_ICONS[status]}`;
    execSync(`tmux rename-window -- "${name}"`);
  }

  teardown(): void {
    // ... restores original name ...
    this.savedName = null;  // ← Resets for next session
  }
}
```

## Possible Fixes

### Option 1: Remove the guard (simplest)

```typescript
init(): void {
  if (!this.inTmux) return;
  // Always re-read the current window name on each session
  // (teardown() already restored the original name)
  const name = execSync("tmux display-message -p '#{window_name}'").trim();
  this.savedName = name.replace(ICON_SUFFIX_RE, "");
}
```

**Pros**: Simple, handles session switches correctly
**Cons**: Slight overhead of tmux call on each session

### Option 2: Reset savedName only in teardown, remove guard

Keep `teardown()` resetting `savedName = null` and remove the guard:

```typescript
init(): void {
  if (!this.inTmux) return;
  // savedName is guaranteed null here due to teardown() reset
  const name = execSync("tmux display-message -p '#{window_name}'").trim();
  this.savedName = name.replace(ICON_SUFFIX_RE, "");
}
```

**Pros**: Clearer intent, no unnecessary re-reads if teardown works correctly
**Cons**: Depends on teardown being called before init

### Option 3: Add per-session state (architectural)

Instead of a single `savedName`, maintain a map of window names per session:

```typescript
private readonly windowNames = new Map<string, string>();

init(sessionId: string): void {
  if (!this.inTmux) return;
  const name = execSync("tmux display-message -p '#{window_name}'").trim();
  this.windowNames.set(sessionId, name.replace(ICON_SUFFIX_RE, ""));
}
```

**Pros**: Proper session isolation
**Cons**: More complex, requires passing session ID through

## Recommended Fix

**Option 1** is recommended as the minimal fix. The overhead of one `tmux display-message` call per session switch is negligible, and it ensures correct behavior in all scenarios.

## Verification

After fixing, verify:
1. Open tmux window 1, cd to project A, start pi → window name: "A ⚙️"
2. Open tmux window 2, cd to project B, start pi → window name: "B ⚙️"
3. Switch session in window 1 to project B → window name should update to "B ✅" (or other appropriate icon)
4. Both windows maintain correct project-specific names throughout session lifecycle

## Related Artifacts

- `.context/memory/tmux-window-status-2026-04-16.md` — Previous session implementing this extension
- `.context/2026-04-16.tmux-window-name-pi-status/plan-tmux-window-name-pi-status.md` — Original plan
- `extensions/tmux-window-status.ts` — The buggy code
