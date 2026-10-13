---
status: active
date: 2026-05-02
subject: 2026-05-02.b-phase-model-hints
topics: [model-auto-switch, buck-workflow, extension, b-phase, b-build]
research: []
spec:
memory: [b-phase-model-hints-2026-05-02.md]
---

# Plan: Model Auto-Switch for Buck Workflow

## Goal

Add extension logic to the Buck workflow that automatically switches the Pi model when executing a phased plan phase whose difficulty hint mismatches the current model tier. Switch back to the original model after the phase completes.

## Context used / assumptions

- **User-provided context**: 10-question brainstorm session (Q1–Q10) defining exact behavior
- **Session context**: prior work on b-phase model hints (easy/medium/hard labels in phased plans)
- **Artifacts used**: `plan-b-phase-model-hints.md` (prior plan for b-phase difficulty labels)
- **Code read**:
  - `extensions/index.ts` — existing Buck workflow extension with `input` handler tracking `/b-*` commands, `agent_end` for save warnings
  - Pi extension API: `pi.setModel()`, `ctx.modelRegistry.find()`, `ctx.model`, `model_select` event
  - Pi settings: `~/.pi/agent/settings.json` (global), `.pi/settings.json` (project-local override)
- **Assumptions**:
  - The user's `settings.json` has `enabledModels` listing available models
  - `modelRegistry.find(provider, id)` works for models listed in enabledModels
  - Model IDs in the mapping will be in `provider/model-id` format (matching how Pi displays them)

## Scope

- **In scope**:
  - Read model mapping from settings
  - Detect phased plan difficulty on `/b-build`, `/b-build-hard`, `/b-iterate`, `/b-review`
  - Auto-switch on mismatch
  - Auto-switch-back after build turn completes
  - Interactive setup prompt when no mapping is configured
  - Non-phased plan complexity check with model suggestion
  - Respect manual mid-phase switches (cancel switch-back)

- **Out of scope**:
  - Changing the b-phase skill itself (already has difficulty labels)
  - Changing b-build/b-build-hard prompt templates (already have phased plan awareness)
  - Provider-specific model ID defaults
  - Persisting mapping anywhere other than Pi settings files
  - Switching thinking levels (only model switching)

## Affected files

- `extensions/index.ts` — all new model-switching logic lives here

## Implementation steps

### Step 1: Add model mapping types and config reading

Add to `extensions/index.ts`:

```typescript
interface ModelMapping {
  easy: string;   // e.g. "zai-glm/glm-4.7-flash"
  medium: string; // e.g. "anthropic/claude-sonnet-4-6"
  hard: string;   // e.g. "anthropic/claude-opus-4-7"
}

interface ModelSwitchState {
  originalModel: { provider: string; id: string } | null;
  switchedForPhase: boolean;
  userOverrode: boolean;
  phaseDifficulty: "easy" | "medium" | "hard" | null;
}
```

Read the mapping from settings:

```typescript
function readModelMapping(): ModelMapping | null {
  // Check project .pi/settings.json first, then global ~/.pi/agent/settings.json
  // Look for a "buckModelMapping" key
  // Return null if not configured or incomplete
}
```

### Step 2: Add in-memory model switch state

Add a module-level variable to track switch state within a session:

```typescript
let modelSwitchState: ModelSwitchState = {
  originalModel: null,
  switchedForPhase: false,
  userOverrode: false,
  phaseDifficulty: null,
};
```

### Step 3: Parse difficulty from phased plan files

```typescript
function findActivePhaseDifficulty(cwd: string): "easy" | "medium" | "hard" | null {
  // 1. Find the most recent plan-*-phases.md in .context/YYYY-MM-DD.*/ or .context/plans/
  // 2. Parse the active phase (first phase without ✅ in acceptance criteria, or first phase)
  // 3. Read its **Difficulty:** line
  // 4. Return the difficulty label or null
}
```

### Step 4: Resolve model ID to provider + id

```typescript
function parseModelId(modelId: string): { provider: string; id: string } | null {
  // "anthropic/claude-opus-4-7" → { provider: "anthropic", id: "claude-opus-4-7" }
  // Handle bare IDs by searching modelRegistry
}
```

### Step 5: Determine current model tier

```typescript
function getCurrentModelTier(
  currentModel: { provider: string; id: string },
  mapping: ModelMapping,
): "easy" | "medium" | "hard" | "unknown" {
  const currentId = `${currentModel.provider}/${currentModel.id}`;
  if (currentId === mapping.easy) return "easy";
  if (currentId === mapping.medium) return "medium";
  if (currentId === mapping.hard) return "hard";
  return "unknown";
}
```

### Step 6: Wire model switching into the `input` handler

Inside the existing `input` event handler for `/b-*` commands, after tracking the command:

```typescript
const BUILD_COMMANDS = ["b-build", "b-build-hard", "b-iterate", "b-review"];

if (BUILD_COMMANDS.includes(command)) {
  await handleModelSwitch(pi, ctx);
}
```

### Step 7: Implement `handleModelSwitch`

```typescript
async function handleModelSwitch(pi: ExtensionAPI, ctx: any): Promise<void> {
  // 1. Read model mapping from settings
  const mapping = readModelMapping();

  // 2. No mapping configured — check if this is first time
  if (!mapping) {
    // Interactive setup prompt (Q4 answer: C)
    await offerModelMappingSetup(ctx);
    return;
  }

  // 3. Find active phase difficulty
  const difficulty = findActivePhaseDifficulty(cwd);

  if (!difficulty) {
    // Non-phased plan — suggest model based on plan complexity (Q10 answer: B)
    await suggestModelForNonPhasedPlan(ctx, mapping);
    return;
  }

  // 4. Check for mismatch
  const currentModel = ctx.model;
  if (!currentModel) return;

  const currentTier = getCurrentModelTier(currentModel, mapping);
  if (currentTier === difficulty || currentTier === "unknown") return; // no mismatch

  // 5. Switch model
  const targetModelId = mapping[difficulty];
  const parsed = parseModelId(targetModelId);
  if (!parsed) return;

  const targetModel = ctx.modelRegistry.find(parsed.provider, parsed.id);
  if (!targetModel) {
    ctx.ui.notify(`Model ${targetModelId} not found in registry`, "warning");
    return;
  }

  const success = await pi.setModel(targetModel);
  if (!success) {
    ctx.ui.notify(`No API key for ${targetModelId}`, "error");
    return;
  }

  // 6. Save original model for switch-back
  modelSwitchState = {
    originalModel: { provider: currentModel.provider, id: currentModel.id },
    switchedForPhase: true,
    userOverrode: false,
    phaseDifficulty: difficulty,
  };

  ctx.ui.notify(
    `🔄 Switched to ${targetModelId} for ${difficulty} phase (was ${currentModel.provider}/${currentModel.id})`,
    "info",
  );
}
```

### Step 8: Detect manual model override via `model_select`

```typescript
pi.on("model_select", async (event, _ctx) => {
  if (!modelSwitchState.switchedForPhase) return;

  // If the model changed and it's NOT our auto-switch completing,
  // the user manually overrode
  if (event.source === "set" || event.source === "cycle") {
    modelSwitchState.userOverrode = true;
  }
});
```

### Step 9: Switch back on `agent_end`

```typescript
pi.on("agent_end", async (_event, ctx) => {
  // ... existing save warning logic ...

  // Model switch-back
  if (!modelSwitchState.switchedForPhase) return;
  if (modelSwitchState.userOverrode) {
    // User manually switched — cancel switch-back (Q9 answer: B)
    modelSwitchState = {
      originalModel: null,
      switchedForPhase: false,
      userOverrode: false,
      phaseDifficulty: null,
    };
    return;
  }

  const original = modelSwitchState.originalModel;
  if (!original) return;

  const originalModel = ctx.modelRegistry.find(original.provider, original.id);
  if (!originalModel) return;

  const success = await pi.setModel(originalModel);
  if (success) {
    ctx.ui.notify(
      `🔄 Switched back to ${original.provider}/${original.id}`,
      "info",
    );
  }

  modelSwitchState = {
    originalModel: null,
    switchedForPhase: false,
    userOverrode: false,
    phaseDifficulty: null,
  };
});
```

### Step 10: Interactive setup prompt

```typescript
async function offerModelMappingSetup(ctx: any): Promise<void> {
  const setup = await ctx.ui.confirm(
    "No Buck model mapping configured",
    "To enable automatic model switching based on phase difficulty, " +
    "add a `buckModelMapping` to your Pi settings:\n\n" +
    "  ~/.pi/agent/settings.json (global)\n" +
    "  .pi/settings.json (project override)\n\n" +
    "Example:\n" +
    '  "buckModelMapping": {\n' +
    '    "easy": "zai-glm/glm-4.7-flash",\n' +
    '    "medium": "anthropic/claude-sonnet-4-6",\n' +
    '    "hard": "anthropic/claude-opus-4-7"\n' +
    "  }\n\n" +
    "Set it up now?"
  );

  if (setup) {
    // Guide user through setup — they can add to settings manually
    ctx.ui.notify(
      "Add `buckModelMapping` to your settings file and run /reload",
      "info",
    );
  }
}
```

### Step 11: Non-phased plan suggestion

```typescript
async function suggestModelForNonPhasedPlan(ctx: any, mapping: ModelMapping): Promise<void> {
  const currentModel = ctx.model;
  if (!currentModel) return;

  // Read the regular plan and do a quick complexity assessment
  // If the plan has >8 steps or touches >5 files, suggest the "hard" model
  // If it's simple, suggest the "easy" model
  // Otherwise, suggest "medium"

  // This is a soft suggestion — just notify, don't switch
  // Implementation: parse plan-*.md for step count and file count
  const planPath = findMostRecentPlan(cwd);
  if (!planPath) return;

  const planContent = readFileSync(planPath, "utf-8");
  const stepCount = (planContent.match(/^\d+\./gm) || []).length;
  const fileCount = (planContent.match(/`[^`]+`/g) || []).length;

  let suggested: "easy" | "medium" | "hard" | null = null;
  if (stepCount > 8 || fileCount > 5) suggested = "hard";
  else if (stepCount <= 3 && fileCount <= 2) suggested = "easy";
  else suggested = "medium";

  const currentTier = getCurrentModelTier(currentModel, mapping);
  if (currentTier === suggested) return; // already on the right tier

  const suggestedModelId = mapping[suggested];
  ctx.ui.notify(
    `💡 Tip: This plan looks ${suggested}. Consider switching to ${suggestedModelId} ` +
    `(currently on ${currentModel.provider}/${currentModel.id})`,
    "info",
  );
}
```

### Step 12: Settings file schema

The `buckModelMapping` key in Pi settings:

```json
{
  "buckModelMapping": {
    "easy": "provider/model-id",
    "medium": "provider/model-id",
    "hard": "provider/model-id"
  }
}
```

Resolution: project `.pi/settings.json` overrides global `~/.pi/agent/settings.json`.

## Verification

- [ ] Extension reads `buckModelMapping` from settings (project overrides global)
- [ ] Running `/b-build` with a phased plan that mismatches triggers auto-switch
- [ ] After the build turn completes, model switches back to original
- [ ] Manual model change mid-phase cancels the switch-back
- [ ] No mapping configured → interactive setup prompt appears
- [ ] Non-phased plan → soft suggestion notification, no forced switch
- [ ] `/b-iterate` and `/b-review` also trigger auto-switch for phased plans
- [ ] `model_select` event correctly detects user-initiated vs auto switches
- [ ] State resets cleanly on session end

## Risks

- **`model_select` source detection**: Pi's `model_select` event has `source: "set" | "cycle" | "restore"`. We need to verify that `pi.setModel()` triggers with source `"set"` so we can distinguish our auto-switch from a user manual switch. If `pi.setModel()` doesn't fire `model_select` at all, we need a different approach (boolean flag before calling `pi.setModel()`).
- **Model ID format**: The mapping uses `"provider/model-id"` but `ctx.modelRegistry.find()` takes separate provider and id args. Parsing must handle edge cases (model IDs containing `/`).
- **Settings file writes**: The interactive setup only shows instructions — it doesn't write settings automatically. User must edit the file themselves. This is intentional (settings are user-owned).
- **Non-phased suggestion heuristic**: Counting steps via regex is fragile. A more robust approach would parse markdown structure, but regex is good enough for a first pass.
