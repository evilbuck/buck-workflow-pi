---
status: completed
date: 2026-05-30
updated: 2026-05-30
subject: 2026-05-30.b-flow-sdk-redesign
topics: [review, iteration, sdk-worker]
informs: [plan-b-flow-sdk-redesign-phases.md]
addresses: plan-b-flow-sdk-redesign-phases.md
completed: 2026-05-30
ralph_status: completed
from_review: b-review
---

# Iteration: b-flow-sdk-redesign

## Source
- Reviewed after: `/b-build`
- Plan: `plan-b-flow-sdk-redesign-phases.md`
- Spec: none
- Phases: `phase-2-sdk-worker-core.md`, `phase-3-test-coverage.md`

## Critical Issues

### 1. SDK audit format drift breaks the stated compatibility contract
- **File**: `extensions/b-flow/sdk-worker.ts`
- **Problem**: The phased plan and Phase 2 acceptance criteria say the SDK worker should write audit JSON with the same shape and location as the subprocess worker. The location matches, but the JSON shape does not: the SDK path writes `workerType`, `toolCallCount`, and `changedFiles`, while omitting subprocess fields like `model` and `exitCode`.
- **Proposed fix**: Either align the SDK audit schema with the subprocess audit schema, or explicitly narrow the contract in the phase/plan docs and tests if the divergence is intentional.

### 2. Model fallback behavior is documented and tested loosely, but not actually implemented
- **File**: `extensions/b-flow/sdk-worker.ts`, `extensions/b-flow/__tests__/sdk-worker.test.ts`
- **Problem**: `selectModel()` returns only the first model in each difficulty tier. The code does not probe alternatives or implement the "first available wins" fallback behavior described in the plan and Phase 2 acceptance criteria.
- **Proposed fix**: Implement real fallback resolution, or reduce the contract/documentation/tests to "difficulty maps to a preferred model" and remove fallback claims.

## Warnings

### 1. Session-creation failures bypass runSDKWorker's local failure/audit path
- **File**: `extensions/b-flow/sdk-worker.ts`
- **Problem**: `createAgentSession()` and `getModel()` run before the worker's `try/catch`, so failures there reject out of `runSDKWorker()` instead of returning a local `WORKER_FAILED` result and finalized audit. `runWorker()` currently masks this by catching upstream, but the SDK worker helper itself does not fully honor its documented failure behavior.
- **Suggested approach**: Move model/session creation into the guarded path and finalize the audit on early failures.

### 2. Typecheck is still red at the repo level
- **File**: `extensions/b-flow/__tests__/wire.test.ts`, `extensions/grill-me-dialog.ts`, `extensions/index.ts`
- **Problem**: `pnpm tsc --noEmit` still exits non-zero due to three pre-existing unrelated errors. This matches the phase notes, so it is not a regression, but the review cannot report a fully clean typecheck.
- **Suggested approach**: Keep this as a documented exception or clear those unrelated errors before claiming repo-wide typecheck success.

## Resolution

Completed in `/b-iterate` on 2026-05-30.

### What changed
- `extensions/b-flow/sdk-worker.ts`
  - model selection now walks the override/tier candidate list and uses the first model found in the registry
  - session creation moved inside the guarded execution path
  - audit writes now preserve the subprocess-compatible core fields (`chunkId`, `chunkType`, `chunkPath`, `startedAt`, `model`, `resultFile`, `completedAt`, `exitCode`) while keeping SDK-specific extras
  - failure paths now finalize audit data even when setup or prompt execution fails
- `extensions/b-flow/__tests__/sdk-worker.test.ts`
  - added coverage for fallback-to-secondary-model behavior
  - strengthened assertions around selected model IDs
  - audit tests now verify `model` and `exitCode`
  - error-path test now verifies finalized failure audit contents

### Verification
- `pnpm vitest run extensions/b-flow/__tests__/sdk-worker.test.ts` → 14/14 passed
- `pnpm vitest run extensions/b-flow/__tests__/integration.test.ts` → 12/12 passed
- `pnpm vitest run extensions/b-flow/__tests__/` → 77/77 passed
- `pnpm tsc --noEmit` → still only the 3 pre-existing unrelated errors in `wire.test.ts`, `grill-me-dialog.ts`, and `extensions/index.ts`

## Recommended Workflow

Re-run `/b-review` against the same phased plan.
Then `/b-save` to finalize this session's record.
If running inside Ralph, do not call `ralph_done` until review passes and `/b-save` has recorded durable state.
