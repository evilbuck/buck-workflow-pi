---
status: completed
date: 2026-09-28
updated: 2026-09-28
subject: 2026-09-28.fix-pr-native-pr-tool
topics: [review, iteration, fix-pr, setup-error]
informs: []
addresses: phase-1-tool-contract-adapter.md
completed: 2026-09-28
from_review: b-review
---

# Iteration: fix-pr feedback adapter setup failure

## Source
- Reviewed after: `/b-iterate`
- Phase: `phase-1-tool-contract-adapter.md`
- Plan: `plan-fix-pr-native-pr-tool.md`

## Critical Issues

### 1. Temporary-directory setup rejects instead of returning a structured failure
- **File**: `extensions/fix-pr-feedback/index.ts:185-191`
- **Problem**: `mkdtemp` is awaited before the `try/catch`. An unavailable or unwritable temp directory rejects the tool execution with a raw filesystem error rather than the structured `fetch_failed` result promised for adapter failures. Direct Bun probe with `feedbackTool({ tempDir: "/missing-fix-pr-feedback-test-path" }).execute(...)` printed `REJECTED ENOENT`, not a result. No child is spawned, but the error bypasses the tool's fail-closed response contract.
- **Proposed fix**: Catch temp-directory creation errors and return a static structured `fetch_failed` result; enter the cleanup scope only after creation succeeds. Cover this path with a deterministic test asserting the response contains no `inventoryPath` and `spawn` is not called.

## Warnings

None.

## Verification
- `bunx vitest run extensions/fix-pr-feedback/__tests__/index.test.ts skills/fix-pr/scripts/fetch-feedback.test.ts`: 30 passed; temp-directory creation failure not covered.
- `npm run guardrails:check`: durable v2 pass; unit, global ratchet, complexity, advisory patch pass; functional and lint skipped/disabled; coverage 87.9% against 84% baseline.
- `bun skills/fix-pr/scripts/fetch-feedback.ts invalid-repo 0` exited 2 with `error: invalid arguments` without GitHub access.

## Resolution

Temporary-directory creation now has a separate error boundary returning a static `fetch_failed` result. Cleanup scope begins only after creation succeeds. A filesystem-backed regression uses a missing child directory beneath a unique test root and verifies structured failure, no inventory/path disclosure, and no spawn.

Fresh verification: 31 focused adapter/fetcher tests pass; direct Bun tool execution against a missing temporary parent returns structured `fetch_failed` with no spawn or inventory. Durable guardrails pass (unit, ratchet, complexity, advisory patch); lint and functional gates disabled/skipped. Supervisor owns independent re-review and loop-state selection.

## Recommended Workflow

Start with `/b-iterate` on this artifact, then re-run `/b-review` against the same phase. Supervisor owns loop-state selection.
