---
status: completed
phase: 3
order: 3
plan: plan-b-flow-sdk-redesign.md
phases_overview: plan-b-flow-sdk-redesign-phases.md
difficulty: medium
model_hint: capable general model — mock-heavy test authoring with integration updates
buck_hint: /b-build
ralph_complexity: multi
goal: "Write comprehensive unit tests for sdk-worker.ts and integration tests for the SDK dispatch path, then verify the full test suite passes and typecheck is clean."
files:
  - extensions/b-flow/__tests__/sdk-worker.test.ts
  - extensions/b-flow/__tests__/integration.test.ts
from_plan_steps: [4, 5, 7]
depends_on: [2]
dependency_type: HARD
acceptance_criteria:
  - "[x] sdk-worker.test.ts covers: tool selection matrix, model selection + fallback, prompt construction, happy path, timeout path, error path, audit file, result markdown parseable by verifyResult"
  - "[x] integration.test.ts has describe('SDK worker path') blocks for BFLOW_USE_SDK_WORKER=1"
  - "[x] All existing subprocess tests pass with flag unset or 0 (no regressions)"
  - "[x] All new SDK path tests pass (mocked createAgentSession)"
  - "[x] tsc --noEmit passes (no errors from SDK worker or test files; 3 pre-existing errors in other files)"
  - "[x] pnpm vitest run exits 0"
completed_at: 2026-05-30
completed_by: pi
---

# Phase 3: Test Coverage & Verification

## Context

This phase covers the test suite for the SDK worker and the final typecheck/lint verification. Phase 2 produced the implementation; this phase validates it thoroughly with mocked SDK surfaces and ensures the existing subprocess tests remain green.

**Why this is Phase 3**: Tests depend on the implementation existing. Also includes the final typecheck pass (plan step 7) since all code must be in place.

## Implementation Details

### Step 1: Create sdk-worker.test.ts

New file: `extensions/b-flow/__tests__/sdk-worker.test.ts`

**Mock strategy**: Mock `@mariozechner/pi-coding-agent` at the module level to control `createAgentSession` return values. Mock `@mariozechner/pi-ai` if `getModel` is used.

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runSDKWorker } from "../sdk-worker.js";
import type { ChunkQueueItem } from "../types.js";
import type { WorkerOptions } from "../worker.js";

// Mock the SDK
vi.mock("@mariozechner/pi-coding-agent", () => ({
  createAgentSession: vi.fn(),
  SessionManager: { inMemory: vi.fn(() => ({})) },
  SettingsManager: { inMemory: vi.fn(() => ({})) },
}));
```

**Test cases to cover:**

1. **Tool selection matrix**: Verify that `selectTools` (tested indirectly via `createAgentSession` args) returns read-only set for `iterate` chunks and full set for `phase`/`task`/`backlog` chunks.

2. **Model selection + fallback + override**: Test that `selectModel` picks the right model for each difficulty tier, falls back when primary is unavailable, and respects explicit overrides.

3. **Prompt construction**: Verify `buildChunkPrompt` output includes goal, chunk ID, type, and path. Verify NO `resultFile` mention (unlike subprocess prompt).

4. **Happy path**: `session.prompt()` resolves, toolCalls captured via subscribe, resultFile written with correct YAML frontmatter, audit file written, returns `WORKER_COMPLETED` with `toolCalls`, `messageCount`, `changedFiles`.

5. **Timeout path**: `Promise.race` triggers timeout → `session.abort()` called → `session.dispose()` called → returns `WORKER_FAILED`.

6. **Error path in prompt**: `session.prompt()` rejects → `session.abort()` called → `session.dispose()` called → returns `WORKER_FAILED`.

7. **Audit file written with expected fields**: Check JSON structure matches subprocess worker's audit format.

8. **Result markdown parseable by verifyResult**: Import `verifyResult` and call it on the written result file — must return `CHUNK_VERIFIED` (or appropriate status).

**Helper: fake AgentSession**

```typescript
function createFakeSession(overrides: Partial<{
  promptResult: any;
  messages: any[];
  subscribe: any;
  abort: any;
  dispose: any;
}> = {}) {
  const listeners: Array<(event: any) => void> = [];
  return {
    prompt: vi.fn().mockResolvedValue(overrides.promptResult ?? undefined),
    messages: overrides.messages ?? [
      { role: "user", content: "test" },
      { role: "assistant", content: "Work completed successfully." },
    ],
    subscribe: overrides.subscribe ?? vi.fn((listener) => {
      listeners.push(listener);
      return { unsubscribe: () => {} };
    }),
    abort: overrides.abort ?? vi.fn().mockResolvedValue(undefined),
    dispose: overrides.dispose ?? vi.fn(),
    _listeners: listeners,
  };
}
```

**Helper: emit tool events**

```typescript
function emitToolEvent(session: any, toolName: string, input: unknown) {
  session._listeners.forEach((l: any) => l({ type: "tool_execution_start", toolName, input }));
}
```

### Step 2: Update integration.test.ts

Add `describe` blocks for the SDK worker path:

```typescript
describe("SDK worker path (BFLOW_USE_SDK_WORKER=1)", () => {
  beforeEach(() => {
    process.env.BFLOW_USE_SDK_WORKER = "1";
  });
  afterEach(() => {
    delete process.env.BFLOW_USE_SDK_WORKER;
  });

  it("routes to SDK worker when flag is set", async () => {
    // Mock createAgentSession to return a fake session
    // Verify runWorker returns WORKER_COMPLETED from SDK path
  });

  it("falls back to subprocess when flag is 0", async () => {
    process.env.BFLOW_USE_SDK_WORKER = "0";
    // Verify subprocess path used (fakePi PATH injection)
  });
});
```

**Note**: Because full SDK execution requires real LLM credentials, the integration tests mock `createAgentSession`. Document that real-path coverage is manual.

**Verify existing tests still pass**: Run the full suite with flag unset — all subprocess-path tests must be green.

### Step 3: Typecheck & Lint

```bash
# Full typecheck
pnpm tsc --noEmit

# Lint (if configured)
pnpm lint 2>/dev/null || true

# Full test suite
pnpm vitest run
```

All must pass.

### Step 4: Cross-reference & Subject Hygiene

Update the subject folder's `index.md`:
- Add a row for the phase completion
- Update next-step text to point to `/b-review` + `/b-save`

## Risks

- **Medium risk**: Mock fidelity — if mocked SDK surface doesn't match the real API, tests give false confidence. **Mitigation**: Cross-check mock shapes against SDK examples in `node_modules/@mariozechner/pi-coding-agent/examples/`.
- **Low risk**: Integration test isolation — env var flag must be cleaned up between tests. **Mitigation**: Use `beforeEach`/`afterEach` for env var management.

## Verification

```bash
# Full test suite (both subprocess + SDK paths)
pnpm vitest run extensions/b-flow/__tests__/ --reporter=verbose

# Type check
pnpm tsc --noEmit

# Verify no regressions (subprocess tests with flag unset)
unset BFLOW_USE_SDK_WORKER && pnpm vitest run extensions/b-flow/__tests__/integration.test.ts
```

## Ralph Mini-Cycle Instructions

If executing this phase inside a Ralph loop:
1. Run `/b-build` for this phase (medium difficulty, standard build).
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact, run `/b-iterate`, then re-run `/b-review`.
4. Run `/b-save` before calling `ralph_done`.
