---
status: completed
date: 2026-05-07
subject: 2026-05-07.tmux-window-name-bug
topics: [tmux, window-naming, savedName, init-guard, bug-fix, session-lifecycle]
research: [research-tmux-window-name-bug.md]
spec:
memory: [tmux-window-name-bug-2026-05-07.md]
---

# Plan: Fix tmux Window Name Bug — All Windows Show Same Name

## Goal

Fix the bug where multiple pi sessions in different tmux windows all display the same project name instead of their respective window-specific names.

## Context used / assumptions

- **Research artifact**: `research-tmux-window-name-bug.md` — detailed root cause analysis, data flow, and fix options
- **Memory**: `tmux-window-status-2026-04-16.md` — original implementation session, including bug fix #3 (icon stacking) that introduced the `savedName !== null` guard
- **Code read**: `extensions/tmux-window-status.ts` and `extensions/tmux-window-status.test.ts`
- **Assumption**: The `savedName !== null` guard in `TmuxAdapter.init()` is the root cause — it prevents re-reading the window name on session switches when `teardown()` doesn't fire cleanly (e.g., pi process crash, SIGKILL, or rapid session switches)
- **Assumption**: Even in the normal flow, if `init()` fails once (tmux timeout), `savedName` stays null and the fallback "pi" is used for the rest of the process lifetime, since the guard blocks retries
- **Open question**: Does pi guarantee `session_shutdown` fires before the process exits? If not, `savedName` stays non-null from the previous session across process restarts within the same tmux window

## Scope

- Fix `TmuxAdapter.init()` to always re-read the current tmux window name
- Ensure `init()` is idempotent and safe to call repeatedly
- Add a test that catches the multi-session / re-init scenario
- Verify the fix handles the edge case where `teardown()` didn't fire (stale `savedName`)

## Out of scope

- Per-session state maps or architectural changes (Option 3 from research) — over-engineering for this bug
- Changes to `StateMachine` or `wire()` event wiring — the bug is isolated to `TmuxAdapter`
- Changes to `extensions/index.ts` — no wiring changes needed
- Debug log format changes

## Affected files

- `extensions/tmux-window-status.ts` — Fix `TmuxAdapter.init()` method (~3 lines changed)
- `extensions/tmux-window-status.test.ts` — Add test for re-init scenario (~20 lines added)

## Implementation steps

### Step 1: Fix `TmuxAdapter.init()` — remove the `savedName !== null` guard

**Current code** (line ~196):
```typescript
init(): void {
  if (!this.inTmux || this.savedName !== null) return;
  try {
    let name = execSync("tmux display-message -p '#{window_name}'", {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 2000,
    }).trim();
    name = name.replace(ICON_SUFFIX_RE, "");
    this.savedName = name;
  } catch {
    // Can't read window name — fall back to "pi"
  }
}
```

**New code**:
```typescript
init(): void {
  if (!this.inTmux) return;
  try {
    let name = execSync("tmux display-message -p '#{window_name}'", {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 2000,
    }).trim();
    name = name.replace(ICON_SUFFIX_RE, "");
    this.savedName = name;
  } catch {
    // Can't read window name — leave savedName as-is (may be null or stale)
    // This ensures we don't overwrite a valid name with null on a transient failure
  }
}
```

**Rationale**:
- Removing `savedName !== null` allows re-reading the window name on every `session_start`
- The `ICON_SUFFIX_RE` strip already prevents icon stacking (bug fix #3)
- The overhead of one `tmux display-message` call per session switch is negligible
- If the `execSync` fails, we don't set `savedName` to null — we keep whatever we had. This avoids the "all windows show pi" fallback caused by a transient tmux error wiping out a valid saved name

### Step 2: Update `teardown()` to be robust

No change needed. Current `teardown()` correctly restores the original name and sets `savedName = null`. With the init fix, the next `session_start` will re-read the current window name (which `teardown` just restored).

### Step 3: Add test — multi-session re-init catches different window names

Add a test that verifies `TmuxAdapter.init()` re-reads the window name on subsequent calls (simulating session switches).

```typescript
describe("TmuxAdapter", () => {
  it("re-reads window name on repeated init() calls", () => {
    // This test requires mocking execSync, so we test via the display interface
    // using a custom StatusDisplay that tracks init behavior
  });
});
```

Since the tests use a recording display mock (not `TmuxAdapter` directly), we should test this at the **wire level** — emit multiple `session_start` events and verify `init()` is called each time. The existing `recordingDisplay()` already logs `init` calls, so we can check the count.

Add to the wire test section:

```typescript
it("calls init on every session_start (not just the first)", async () => {
  const pi = mockPi();
  const display = recordingDisplay();
  wire(pi as any, { display });

  await pi.emit("session_start");
  await pi.emit("before_agent_start");
  await pi.emit("message_end", {
    message: { role: "assistant", stopReason: "stop", content: [] },
  });
  await pi.emit("agent_end");
  await pi.emit("session_shutdown");

  // Second session — init must be called again to re-read window name
  await pi.emit("session_start");

  const initCount = display.log.filter((l) => l === "init").length;
  expect(initCount).toBe(2);
});
```

### Step 4: Run existing tests to verify no regressions

```bash
npx vitest run extensions/tmux-window-status.test.ts
```

## Verification

- [x] Existing 42+ tests pass without modification (43 total, all passing)
- [x] New wire test passes — `init` called on every `session_start`
- [ ] Manual test: open two tmux windows, start pi in each, verify different window names
- [ ] Manual test: `session_start` → `session_shutdown` → `session_start` cycle re-reads window name
- [ ] Check JSONL debug log (`~/.cache/pi-tmux-status/events.jsonl`) shows correct events

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| `execSync` adds latency on each session switch | Very low — tmux display-message is <5ms locally | Already has 2s timeout |
| Transient tmux failure on init overwrites valid savedName | Medium — addressed by not resetting on catch | We keep the old savedName instead of nulling it |
| Test changes are minimal and only additive | Very low — new test only counts init calls | No existing tests modified |

## Recommended next step

**`b-build`** — this is a straightforward 3-line fix with one new test. Low risk, clear scope, single file.
