---
date: 2026-05-10
domains: [debugging, agent, implementation]
topics: [model-switch, race-condition, timestamp-guard, autoSwitchingModel]
subject: 2026-05-09.pi-agent-cycle-fix
artifacts: [plan-extension-model-switch-guard.md]
related: [pi-agent-cycle-fix-2026-05-09.md]
priority: high
status: active
---

# Session: 2026-05-10 - Implement Model Auto-Switch Timestamp Guard

## Context
- Previous work: May 9 session diagnosed the race condition and created `plan-extension-model-switch-guard.md`
- Goal: Implement Option A (timestamp guard) from the plan to fix the race condition in `autoSwitchingModel`

## Decisions Made
- Chose Option A (timestamp-based guard) over Option B (sequence counter) and Option C (deferred flag clear)
- Reason: Option A is robust against sync/async ambiguity of `extensionRunner.emit()` without requiring Pi core changes
- Grace window: 100ms — generous enough for any event dispatch latency

## Implementation Notes
- **File modified**: `extensions/index.ts`
- **4 surgical edits**, all in the model auto-switch logic:
  1. Module scope (~line 383): Added `lastAutoSwitchTimestamp = 0` and `AUTO_SWITCH_GRACE_MS = 100`
  2. `handleModelSwitch` (~line 905): Set `lastAutoSwitchTimestamp = Date.now()` before `pi.setModel()`
  3. `model_select` handler (~line 1154): Added grace-window check — ignore events within 100ms of auto-switch
  4. `agent_end` switch-back (~line 1192): Set `lastAutoSwitchTimestamp = Date.now()` before `pi.setModel()`

## Verification
- TypeScript compiles cleanly (0 new errors; 2 pre-existing errors in unrelated files)
- All 88 existing tests pass
- 2 pre-existing empty test suite failures unchanged

## How it works
The timestamp guard prevents the race condition where `model_select` events from auto-initiated `setModel()` calls arrive **after** `autoSwitchingModel` has been cleared. Any `model_select` within 100ms of a `lastAutoSwitchTimestamp` update is treated as our own auto-switch and ignored, preventing `userOverrode` from being incorrectly set to `true`.

## Next Steps
- [ ] Build the Pi core `cycleModel()` abort fix (see `plan-abort-on-cycle.md`) — separate repo
- [ ] Manual integration test: start session with `buckModelMapping`, run `/b-build`, verify switch-back
- [ ] Consider adding unit tests for the timestamp guard logic
