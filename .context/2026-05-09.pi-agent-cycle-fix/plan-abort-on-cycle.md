# Plan: Abort In-Flight Request on Model Cycle

## Problem Statement

When the user presses `Ctrl+P` (model cycle shortcut), `AgentSession.cycleModel()` updates the model state and fires `model_select`, but **does not abort the in-flight HTTP request** to the current model. The request continues running indefinitely.

This causes two observable failures:

1. **Hung requests accumulate** — each `cycleModel()` call leaves the previous request hanging. Rapidly cycling through 7 models = 7 concurrent hung requests.
2. **Interactive sessions block** — new user messages are queued but never processed. The session appears stuck in "working..." spinner even after cycling to a healthy model.

## Reproduction

### Steps

1. Start an interactive session with a model whose API call hangs (e.g., `opencode-go/deepseek-v4-flash`)
2. Send any message to trigger an agent turn
3. While the request is pending, press `Ctrl+P` to cycle models
4. Observe: `model_change` events fire, but the session never processes the response
5. Rapid-cycle through several models
6. Try sending a new message — it is queued but never answered

### Evidence from session logs

Session: `~/.pi/agent/sessions/--home-buckleyrobinson-projects-qr.wt.picode--/2026-05-09T23-56-54-476Z_019e0f2c-2f4c-777d-a255-a6ad4535e81c.jsonl`

**Line 156** — Last successful assistant closeout message (00:44:50.713Z):
```json
{"type":"message","id":"dc05b6fc","parentId":"6c16655e","timestamp":"2026-05-10T00:44:50.713Z","message":{"role":"assistant","content":[{"type":"text","text":"---\n\n## Closeout\n\n### Changed files\n..."}],"api":"anthropic-messages","provider":"zai-glm","model":"glm-5.1","stopReason":"stop",...}}
```

**Lines 157–163** — Rapid model cycling (19 minutes later, 01:03:23–28):
```json
{"type":"model_change","id":"dfba8b08","timestamp":"2026-05-10T01:03:23.814Z","provider":"opencode-go","modelId":"kimi-k2.6"}
{"type":"model_change","id":"52190ece","timestamp":"2026-05-10T01:03:24.441Z","provider":"opencode-go","modelId":"qwen3.6-plus"}
{"type":"model_change","id":"29ff9efd","timestamp":"2026-05-10T01:03:25.202Z","provider":"google","modelId":"gemini-3.1-pro-preview"}
{"type":"model_change","id":"60201c27","timestamp":"2026-05-10T01:03:25.995Z","provider":"opencode","modelId":"claude-sonnet-4-6"}
{"type":"model_change","id":"beee1d72","timestamp":"2026-05-10T01:03:26.673Z","provider":"xai","modelId":"grok-4.3"}
{"type":"model_change","id":"2a31762f","timestamp":"2026-05-10T01:03:27.252Z","provider":"opencode-go","modelId":"deepseek-v4-pro"}
{"type":"model_change","id":"f79355f6","timestamp":"2026-05-10T01:03:28.228Z","provider":"opencode-go","modelId":"deepseek-v4-flash"}
```

The cycling path matches `settings.json` `enabledModels` in order. The `opencode-go` provider models (kimi, qwen, deepseek) are consecutive in that list — each call to `cycleModel()` hits another opencode-go model, each of which has a hung request.

**Lines 164–167** — User messages sent after cycling, never answered:
```json
{"type":"message","id":"b0538d62","timestamp":"2026-05-10T01:03:30.239Z","message":{"role":"user","content":"You are the b-save agent..."}}  // b-save prompt
{"type":"message","id":"50038175","timestamp":"2026-05-10T01:12:39.806Z","message":{"role":"user","content":"continue save"}}
{"type":"message","id":"dda11667","timestamp":"2026-05-10T01:13:52.071Z","message":{"role":"user","content":"You are the b-save agent..."}}  // b-save re-sent
{"type":"message","id":"be37020e","timestamp":"2026-05-10T01:16:16.233Z","message":{"role":"user","content":"continue"}}
```

Zero assistant responses after 01:03:30. The session remained blocked until the user manually cycled back to a working model.

## Root Cause

### Signal chain

```
User presses Ctrl+P
  → session.cycleModel()          (agent-session.ts:1439)
    → _cycleScopedModel()          (or _cycleAvailableModel())
      → this.agent.state.model = next.model   ← updates state
      → sessionManager.appendModelChange()   ← logs event
      → _emitModelSelect()                    ← fires model_select
      → return
    (no call to abort())
```

### Why the session blocks

The agent turn is still "running" from the perspective of the request loop. `session.prompt()` queues new messages as pending, but they are not processed until `agent.waitForIdle()` resolves — which requires the in-flight request to complete or error. Since the request never does either (opencode-go hangs), the session is permanently blocked.

### The fix exists but isn't called

`abort()` at line 1387 correctly calls `this.agent.abort() + await this.agent.waitForIdle()`, which cancels the in-flight request and waits for the agent to become idle. `cycleModel()` simply never calls it.

## Affected Files

### Primary change

- `packages/coding-agent/src/core/agent-session.ts`

## Fix

Add `await this.abort()` as the **first step** in both `_cycleScopedModel()` and `_cycleAvailableModel()`, before any model state is mutated.

## Affected Files

### Primary change

- `packages/coding-agent/src/core/agent-session.ts`

### Tests

- `packages/coding-agent/src/core/agent-session.ts` — no existing tests found; vitest config exists but no test files in `src/`. Consider adding a test (see §Verification).

## Implementation Steps

### 1. `_cycleScopedModel()` — add abort before model switch

**File:** `packages/coding-agent/src/core/agent-session.ts`
**Location:** ~line 1446–1472

**Before:**
```typescript
private async _cycleScopedModel(direction: "forward" | "backward"): Promise<ModelCycleResult | undefined> {
    const scopedModels = this._scopedModels.filter((scoped) => this._modelRegistry.hasConfiguredAuth(scoped.model));
    if (scopedModels.length <= 1) return undefined;

    const currentModel = this.model;
    // ... index computation ...

    const next = scopedModels[nextIndex];
    const thinkingLevel = this._getThinkingLevelForModelSwitch(next.thinkingLevel);

    // Apply model
    this.agent.state.model = next.model;   // ← sets model while old request is still running
    this.sessionManager.appendModelChange(next.model.provider, next.model.id);
    this.settingsManager.setDefaultModelAndProvider(next.model.provider, next.model.id);
    // ...
}
```

**After:**
```typescript
private async _cycleScopedModel(direction: "forward" | "backward"): Promise<ModelCycleResult | undefined> {
    const scopedModels = this._scopedModels.filter((scoped) => this._modelRegistry.hasConfiguredAuth(scoped.model));
    if (scopedModels.length <= 1) return undefined;

    const currentModel = this.model;
    // ... index computation ...

    const next = scopedModels[nextIndex];
    const thinkingLevel = this._getThinkingLevelForModelSwitch(next.thinkingLevel);

    // Abort in-flight request before switching model
    await this.abort();

    // Apply model
    this.agent.state.model = next.model;
    this.sessionManager.appendModelChange(next.model.provider, next.model.id);
    this.settingsManager.setDefaultModelAndProvider(next.model.provider, next.model.id);
    // ...
}
```

### 2. `_cycleAvailableModel()` — add abort before model switch

**File:** `packages/coding-agent/src/core/agent-session.ts`
**Location:** ~line 1475–1498

Same pattern — add `await this.abort();` before `this.agent.state.model = nextModel;`

**After:**
```typescript
private async _cycleAvailableModel(direction: "forward" | "backward"): Promise<ModelCycleResult | undefined> {
    const availableModels = await this._modelRegistry.getAvailable();
    if (availableModels.length <= 1) return undefined;

    const currentModel = this.model;
    // ... index computation ...

    const nextModel = availableModels[nextIndex];
    const thinkingLevel = this._getThinkingLevelForModelSwitch();

    // Abort in-flight request before switching model
    await this.abort();

    this.agent.state.model = nextModel;
    this.sessionManager.appendModelChange(nextModel.provider, nextModel.id);
    this.settingsManager.setDefaultModelAndProvider(nextModel.provider, nextModel.id);
    // ...
}
```

### 3. Update JSDoc to document the abort behavior

Add to the docstring of `cycleModel()`:
```
* Aborts any in-flight agent request before cycling.
```

And to `_cycleScopedModel()` / `_cycleAvailableModel()`:
```
* Aborts any in-flight request before switching model.
```

## Verification

### Manual test

1. Start an interactive session with a slow/hanging model (e.g. `opencode-go/deepseek-v4-flash`)
2. Wait for the agent to start a turn (send a message)
3. While the request is pending, press `Ctrl+P` to cycle models
4. Confirm that `model_change` events still fire (they do — `cycleModel` doesn't call `abort()` for the UI event), but the previous request is cancelled
5. Cycle rapidly through 7 models — verify only 1 request is in-flight at a time (check network tab or logs)
6. Send a new message while a request is pending — verify it is processed after the cycle completes

### Existing behavior preserved

- `setModel()` does NOT need this change — it is called by `handleModelSwitch` in extensions, which already wraps the call and doesn't have a pending request problem in the same way
- `Ctrl+P` during idle (no in-flight request) should behave identically to before

## Alternative Considered: Timeout

Adding `timeoutMs` to `settings.json` would make hung requests die after 60s and trigger auto-retry, but:
- It doesn't prevent the accumulation of hung requests during rapid cycling
- It kills legitimate slow requests, not just hung ones
- It doesn't fix the root cause (failure to abort on model switch)

## Out of Scope

- Changes to the opencode-go provider itself (why it hangs is a separate issue)
- Changes to `setModel()` — only `cycleModel()` has this problem because the user-initiated cycle can happen at any time during a request
