---
status: completed
phase: 1
order: 1
plan: plan-b-flow-sdk-redesign.md
phases_overview: plan-b-flow-sdk-redesign-phases.md
difficulty: easy
model_hint: smaller/faster general model is fine — purely additive types + mechanical refactor
buck_hint: /b-build
ralph_complexity: single
goal: "Extend WorkerResult with SDK telemetry fields and refactor worker.ts for dual-path dispatch without breaking existing behavior."
files:
  - extensions/b-flow/types.ts
  - extensions/b-flow/worker.ts
  - extensions/b-flow/sdk-worker.ts
from_plan_steps: [1, 2]
depends_on: []
dependency_type: NONE
acceptance_criteria:
  - "[x] WorkerResult type in types.ts has optional SDK fields: toolCalls, messageCount, changedFiles"  # note: actually extended in worker.ts per code location (doc drift)
  - "[x] worker.ts exports runWorker unchanged; existing runSubprocessWorker is internal"
  - "[x] Dispatch logic: BFLOW_USE_SDK_WORKER=1 routes to runSDKWorker (currently stub)"
  - "[x] sdk-worker.ts stub exists, exports runSDKWorker that throws 'Not implemented'"
  - "[x] All existing vitest tests pass with BFLOW_USE_SDK_WORKER unset and set to 0"
  - "[x] tsc --noEmit passes (pre-existing unrelated errors only; our changes introduced 0 new errors)"
completed_at: "2026-05-30"
completed_by: "b-build (standard)"
---

# Phase 1: Types & Dual Dispatch

## Context

This phase establishes the dual-path architecture. We extend the `WorkerResult` type with optional SDK telemetry fields (non-breaking — all new fields are optional), refactor `worker.ts` to support dispatch between subprocess and SDK paths, and create a minimal stub for `sdk-worker.ts`. No new SDK behavior is introduced — the stub itself throws "Not implemented" until Phase 2 fills it in, while `runWorker()` preserves its public `WorkerResult` contract.

**Why this is Phase 1**: Zero behavioral change. Existing tests must pass identically. This gives us a safe foundation and a clean import path for Phase 2.

## Implementation Details

### Step 1: Extend WorkerResult in types.ts

Add optional SDK telemetry fields to the existing `WorkerResult` interface (defined in `worker.ts`, not `types.ts` — check actual location). The fields are additive:

```typescript
export interface WorkerResult {
  type: "WORKER_COMPLETED" | "WORKER_FAILED";
  resultFile?: string;
  status?: string;
  error?: string;
  exitCode?: number;
  // SDK telemetry (additive, optional)
  toolCalls?: Array<{ name: string; input: unknown }>;
  messageCount?: number;
  changedFiles?: string[];
}
```

**Important**: `WorkerResult` is currently defined in `worker.ts`, not `types.ts`. Add the fields there. Add JSDoc `@alpha` annotation to the new fields to indicate they're part of the SDK worker preview.

### Step 2: Create sdk-worker.ts stub

Create `extensions/b-flow/sdk-worker.ts` with a minimal stub:

```typescript
import type { ChunkQueueItem } from "./types.js";
import type { WorkerOptions, WorkerResult } from "./worker.js";

/**
 * SDK-based worker using Pi's createAgentSession().
 * Stub — implemented in Phase 2.
 */
export async function runSDKWorker(
  _chunk: ChunkQueueItem,
  _options: WorkerOptions,
): Promise<WorkerResult> {
  throw new Error("runSDKWorker not implemented (Phase 2)");
}
```

### Step 3: Refactor worker.ts for dual dispatch

1. Rename the body of `runWorker` to `runSubprocessWorker` (private, same signature):
   ```typescript
   async function runSubprocessWorker(
     chunk: ChunkQueueItem,
     options: WorkerOptions,
   ): Promise<WorkerResult> {
     // ... existing implementation unchanged ...
   }
   ```

2. Add dispatch at the top of the exported `runWorker`:
   ```typescript
   import { runSDKWorker } from "./sdk-worker.js";

   export async function runWorker(
     chunk: ChunkQueueItem,
     options: WorkerOptions,
   ): Promise<WorkerResult> {
     const useSDK = process.env.BFLOW_USE_SDK_WORKER === "1";
     if (useSDK) {
       try {
         return await runSDKWorker(chunk, options);
       } catch (error) {
         return {
           type: "WORKER_FAILED",
           error: error instanceof Error ? error.message : String(error),
         };
       }
     }
     return runSubprocessWorker(chunk, options);
   }
   ```

3. Keep everything else in `worker.ts` identical. The `buildWorkerPrompt` helper and subprocess logic remain untouched.

4. Update JSDoc on `runWorker`: mention dual dispatch and the `BFLOW_USE_SDK_WORKER` flag.

### Step 4: Verify

- Run `pnpm tsc --noEmit` — must pass (stub is type-compatible).
- Run `pnpm vitest run extensions/b-flow/__tests__/` — all existing tests pass (they don't set the flag, so subprocess path runs).
- Run with `BFLOW_USE_SDK_WORKER=1 pnpm vitest run ...` — `runWorker` should return a structured `WORKER_FAILED` result carrying the stub message `runSDKWorker not implemented (Phase 2)`.

## Risks

- **Low risk**: All changes are additive. The dispatch is gated behind an env var that defaults to off. Existing behavior is 100% preserved.
- **Minor**: If any test directly imports internal helpers from `worker.ts`, the rename to `runSubprocessWorker` would break it. Check imports before renaming.

## Verification

```bash
# Type check
pnpm tsc --noEmit

# Existing tests pass (subprocess path)
pnpm vitest run extensions/b-flow/__tests__/

# Verify SDK-path contract is preserved when stub is hit
BFLOW_USE_SDK_WORKER=1 pnpm vitest run extensions/b-flow/__tests__/integration.test.ts
```

## Ralph Mini-Cycle Instructions

If executing this phase inside a Ralph loop:
1. Run `/b-build` for this phase only (easy difficulty, standard build is fine).
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact, run `/b-iterate`, then re-run `/b-review`.
4. Run `/b-save` before calling `ralph_done`.

## Completion (2026-05-30, /b-build standard)

**Status**: completed

**What was done** (exact scope of this phase):
- WorkerResult interface (in worker.ts) extended with 3 optional @alpha SDK fields + JSDoc
- worker.ts refactored for dual dispatch behind BFLOW_USE_SDK_WORKER env var
- Internal rename: original logic → runSubprocessWorker (not exported)
- New file: extensions/b-flow/sdk-worker.ts (stub only, throws "not implemented (Phase 2)")

**Verification executed**:
- Baseline: 60/60 vitest green (subprocess path)
- Flag=1: `runWorker` returns `WORKER_FAILED` with the stub message, preserving queue/machine contracts
- tsc --noEmit: delta clean (0 new errors)
- All 6 acceptance criteria checked (with note on doc location drift for WorkerResult)

**Artifacts updated**:
- This phase file (checkboxes + frontmatter + this section)
- phases overview (table + Ralph checklist + completion note)
- subject index.md, backlog items/todo
- draft-commit.md written in subject folder
- Session memory + index updated

**No scope creep**: Did not touch types.ts (per live code), did not implement any real SDK logic, and kept the follow-up iteration confined to failure-path contract handling.

### Post-review iteration (2026-05-30, /b-iterate)

A follow-up review found that the stubbed SDK path broke the `runWorker(): Promise<WorkerResult>` contract in real queue execution. The review also exposed that the queue retry transition did not re-enter its invoked state, causing the retry path to stall.

**Iteration fix applied**:
- `worker.ts`: wraps `runSDKWorker()` in `try/catch` so the Phase 1 stub returns structured `WORKER_FAILED` output through the public worker entrypoint
- `chunk-queue-machine.ts`: marks retry self-transition with `reenter: true` so retries actually re-invoke the worker
- `chunk-queue-machine.ts`: preserves the stub error as `blockReason` and syncs final failed chunk status into the queue output
- `integration.test.ts`: adds regression coverage for both direct `runWorker()` contract preservation and top-level machine blocking behavior under `BFLOW_USE_SDK_WORKER=1`

**Post-iteration verification**:
- `pnpm vitest run extensions/b-flow/__tests__/integration.test.ts` → 11/11 green
- `pnpm vitest run extensions/b-flow/__tests__/` → 62/62 green
- Manual machine probe with `BFLOW_USE_SDK_WORKER=1` now blocks with `Chunk phase-phase-1-test blocked: runSDKWorker not implemented (Phase 2)` and queue item status `failed`

**Next for caller**: /b-review (phase file or phases overview) → /b-save → Phase 2 (hard).
