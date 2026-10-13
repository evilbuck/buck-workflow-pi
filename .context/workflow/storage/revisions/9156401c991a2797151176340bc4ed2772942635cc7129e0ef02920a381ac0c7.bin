# Plan: Fix Race Condition in Model Auto-Switch Guard

## Problem

The `autoSwitchingModel` boolean guard in `extensions/index.ts` is vulnerable to a race condition where a `model_select` event from an auto-initiated `setModel()` call can incorrectly set `userOverrode = true`, causing `agent_end` to skip switch-back and permanently leave the session on the wrong model.

## Root Cause

### The guard pattern

```typescript
// handleModelSwitch (line 901-903)
autoSwitchingModel = true;
const success = await pi.setModel(targetModel);
autoSwitchingModel = false;  // ← set AFTER the await
```

```typescript
// model_select handler (line 1147-1153)
pi.on("model_select", async (event, _ctx) => {
  if (!modelSwitchState.switchedForPhase) return;
  if (autoSwitchingModel) return;           // ← guard
  modelSwitchState.userOverrode = true;     // ← wrong if we get here
});
```

### Why the guard can fail

`pi.setModel()` internally calls `await _emitModelSelect()` which emits `model_select` to extension handlers. The question is whether `extensionRunner.emit()` processes handlers synchronously (during the `emit()` call) or asynchronously (queued and run after `emit()` returns).

- **If synchronous**: `model_select` fires while `autoSwitchingModel = true` — guard works
- **If asynchronous**: `model_select` fires after `setModel()` returns and `autoSwitchingModel = false` has been set — guard fails, `userOverrode = true`

The `extensionRunner.emit()` interface is async (returns a Promise), but the handler execution itself could be sync or async. Without access to the extension runner source, the safest assumption is that handlers run after `emit()` returns — making the race condition possible.

### Consequence

Once `userOverrode = true`, `agent_end` resets `modelSwitchState` and returns WITHOUT switching back to the original model. The session stays on the auto-switched model permanently. On the next `b-build` call, the same cycle repeats: auto-switch → `userOverrode` incorrectly set → no switch-back.

This alone doesn't cause an "endless loop" — it causes a "stuck on wrong model" failure. The actual endless loop you observed was the `cycleModel()` bug (see plan `plan-abort-on-cycle.md`).

## Affected Files

- `extensions/index.ts`

## Implementation Steps

### Option A: Timestamp-based guard (simplest, time-insensitive)

Add a `lastAutoSwitchAt` timestamp. The guard accepts `model_select` events that fire within a short window after an auto-switch.

**Add to module scope:**
```typescript
let lastAutoSwitchTimestamp = 0;
const AUTO_SWITCH_GRACE_MS = 100;  // accept model_select events within 100ms of auto-switch
```

**In `handleModelSwitch`:**
```typescript
// Set flag BEFORE calling setModel so model_select handler knows it's us
autoSwitchingModel = true;
lastAutoSwitchTimestamp = Date.now();
const success = await pi.setModel(targetModel);
autoSwitchingModel = false;
```

**In `model_select` handler:**
```typescript
pi.on("model_select", async (event, _ctx) => {
  if (!modelSwitchState.switchedForPhase) return;
  if (autoSwitchingModel) return;

  // Accept our own auto-switch events within the grace window
  const now = Date.now();
  if (now - lastAutoSwitchTimestamp < AUTO_SWITCH_GRACE_MS) return;

  modelSwitchState.userOverrode = true;
});
```

**In `agent_end` switch-back (line 1186-1188):** Same pattern:
```typescript
autoSwitchingModel = true;
lastAutoSwitchTimestamp = Date.now();
const success = await pi.setModel(originalModel);
autoSwitchingModel = false;
```

**Pros:** Simple, handles both `setModel` and `cycleModel` switch-backs
**Cons:** Relies on timing; 100ms is arbitrary but generous (model_select events from the same operation fire within milliseconds)

### Option B: Sequence counter (strict, no time dependency)

Use a counter that increments on each auto-switch. Pass the counter value in the `model_select` event data to distinguish our own events.

**However:** `model_select` event shape is defined by the pi-coding-agent core — we can't add fields to it without core changes.

### Option C: Deferred flag clear (cleanest)

Only clear `autoSwitchingModel` after all synchronous `model_select` processing is done. This requires understanding whether `extensionRunner.emit()` is fully synchronous.

**If** `extensionRunner.emit()` processes all handlers synchronously (during the `emit()` call, before returning), then the current code IS correct and the race condition doesn't exist. The fix is to verify this assumption.

**If** `extensionRunner.emit()` queues handlers to run later (fire-and-forget Promise), then we need Option A or B.

## Recommended

**Option A** (timestamp guard) — it's robust against the sync/async ambiguity of `emit()` without requiring core changes.

## Verification

1. Start a session with `buckModelMapping` configured
2. Run `/b-build` to trigger auto-switch
3. Verify `model_select` fires with correct `source: "set"` (not `"cycle"`)
4. Verify `agent_end` switches back to original model after the turn completes
5. Run `/b-build` again — verify auto-switch still works (not blocked by previous state)

## Interaction with cycleModel fix

The `model_select` guard is also relevant when the **core `cycleModel()` fix** (adding `await this.abort()`) is applied. After that fix, `cycleModel` calls `abort()` before switching, which would trigger `agent_end` → switch-back. The `model_select` handler would see `autoSwitchingModel = false` (we're not the ones who called `setModel` for switch-back) and correctly set `userOverrode = true`. The switch-back `setModel` call from `agent_end` would then be guarded by the timestamp mechanism.
