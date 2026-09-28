---
status: completed
date: 2026-09-28
updated: 2026-09-28
subject: 2026-09-28.fix-pr-native-pr-tool
topics: [review, iteration, fix-pr, output-boundary]
informs: []
addresses: phase-1-tool-contract-adapter.md
completed: 2026-09-28
from_review: b-review
---

# Iteration: fix-pr feedback adapter output settlement and UTF-8

## Source
- Reviewed after: `/b-iterate`
- Phase: `phase-1-tool-contract-adapter.md`
- Plan: `plan-fix-pr-native-pr-tool.md`

## Critical Issues

### 1. Oversized stdout can leave the tool pending indefinitely
- **File**: `extensions/fix-pr-feedback/index.ts:156-177,195-202`
- **Problem**: On the 1 MiB limit the adapter kills the child but resolves only on `close`/`error`. If the child ignores the signal or another process holds the stdout/stderr pipes open, the invocation remains pending; adapter-owned temp files remain until cancellation. A direct Bun fake-child smoke emitted 1 MiB + 1 byte and withheld `close`: the tool was still pending after 80 ms; explicit abort was required to settle it, yielding `cancelled` rather than `invalid_output`.
- **Proposed fix**: On overflow, terminate and settle within a bounded period even when `close` never arrives; destroy the adapter-owned pipes when necessary, then return `invalid_output` without an inventory. Add a regression with an oversized stream and no `close`, verifying temp cleanup without external cancellation.

### 2. Splitting UTF-8 code points corrupts candidate metadata
- **File**: `extensions/fix-pr-feedback/index.ts:161-171`
- **Problem**: Decoding each stdout chunk independently replaces a multibyte character split across buffers with two U+FFFD characters. A direct Bun fake-child smoke fed two chunks splitting `é` in `src/café.ts:2`; the successful tool result returned `src/caf��.ts:2`. GitHub permits non-ASCII paths; the candidate no longer matches the inventory and cannot be located reliably.
- **Proposed fix**: Buffer bounded stdout bytes until `close` and decode once, or use a streaming UTF-8 decoder. Add a regression splitting a multibyte path/code point across chunks and asserting exact candidate metadata.

## Warnings

None.

## Verification
- `bunx vitest run extensions/fix-pr-feedback/__tests__/index.test.ts skills/fix-pr/scripts/fetch-feedback.test.ts`: 29 tests passed; neither edge case covered.
- `npm run guardrails:check`: durable v2 pass; required unit, global ratchet, complexity pass; patch pass (advisory); lint and functional skipped/disabled. Coverage 87.9% against 84% baseline.
- Direct Bun fake-child smokes reproduced both issues without GitHub access; the overflow smoke explicitly aborted to release its pending promise.

## Recommended Workflow

Start with `/b-iterate` on this artifact, then re-run `/b-review` against the same phase. Supervisor owns loop-state selection.

## Resolution

- Oversized stdout now triggers SIGKILL, destroys both adapter-owned output pipes, and explicitly settles `invalid_output` without waiting for `close` or external cancellation. The existing `finally` removes the private seen-ID directory.
- A streaming UTF-8 decoder preserves multibyte characters across stdout buffer boundaries while retaining the 1 MiB byte limit.
- Regression coverage withholds `close` on overflow and verifies cleanup; a split-`é` candidate path must match exactly.
- Fresh verification: 30 focused adapter/fetcher tests passed. A throwaway real-child Bun smoke verified overflow settlement, destroyed pipes, removed private files, and exact split-UTF-8 metadata. Durable v2 guardrails passed; lint and functional gates disabled/skipped, coverage 87.9% against 84%.
- Independent re-review and loop-state selection remain with the supervisor.
