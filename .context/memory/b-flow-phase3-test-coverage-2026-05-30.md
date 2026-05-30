---
date: 2026-05-30
domains: [testing]
topics: [b-flow, sdk-worker, vitest, integration-tests, test-mocking]
subject: 2026-05-30.b-flow-sdk-redesign
artifacts: [phase-3-test-coverage.md]
related: [b-flow-sdk-phase1-build-2026-05-30.md]
priority: high
status: active
---

# Session: 2026-05-30 - Phase 3 Test Coverage & Verification

## Context
Phase 3 of the b-flow SDK redesign. Phase 1 created types + dual dispatch, Phase 2 implemented runSDKWorker. This phase writes comprehensive unit tests for sdk-worker.ts and integration tests for the SDK dispatch path.

## What Changed
- `extensions/b-flow/__tests__/sdk-worker.test.ts` — already existed with 13 comprehensive tests covering:
  - Tool selection (read-only for iterate, full coding for phase/task)
  - Model selection with difficulty tiers and explicit override
  - Prompt construction (no resultFile mention)
  - Happy path with verifyResult parsing
  - Audit JSON structure
  - Timeout path (Promise.race)
  - Error path with abort + dispose
  - Tool call tracking and changed file extraction
  - Subject-aware result paths

- `extensions/b-flow/__tests__/integration.test.ts` — added:
  - `vi.mock("@mariozechner/pi-coding-agent")` at module level (hoisted)
  - `vi.mock("@mariozechner/pi-ai")` at module level (hoisted)
  - 3 new tests replacing `.todo` items:
    1. "runWorker dispatches to SDK worker when BFLOW_USE_SDK_WORKER=1"
    2. "sdk worker failure surfaces as WORKER_FAILED"
    3. "falls back to subprocess when BFLOW_USE_SDK_WORKER is unset"

## Test Results
- **76 tests pass** (was 73 + 3 new SDK integration tests)
- **0 test failures**
- **tsc --noEmit**: 0 new errors (3 pre-existing in wire.test.ts, grill-me-dialog.ts, index.ts — not from our changes)

## Key Decisions
- Module-level `vi.mock()` must be at top of integration.test.ts file because `runWorker` is statically imported from `worker.js` which statically imports `sdk-worker.js` which imports `createAgentSession`. Dynamic `await import()` doesn't work for mocking static imports — the mock must be hoisted.

## Next Steps
- All 3 phases complete. Run `/b-review` against the full plan.
- Consider committing and pushing.
