---
status: completed
date: 2026-09-28
updated: 2026-09-28
subject: 2026-09-28.fix-pr-native-pr-tool
topics: [review, iteration, fix-pr, cancellation, output-boundary]
informs: []
addresses: phase-1-tool-contract-adapter.md
completed: 2026-09-28
from_review: b-review
---

# Iteration: fix-pr feedback adapter completion boundary

## Source
- Reviewed after: `/b-iterate`
- Phase: `phase-1-tool-contract-adapter.md`
- Plan: `plan-fix-pr-native-pr-tool.md`

## Critical Issues

### 1. Abort during asynchronous cleanup can still return a successful inventory
- **File**: `extensions/fix-pr-feedback/index.ts:215-240`
- **Problem**: `invokeFeedback` checks `signal.aborted` immediately after collecting the child's output, then awaits `deps.remove(tempDirectory)` and returns the earlier response. When the host aborts while removal is pending, the tool can return `ok: true` and `inventoryPath` after cancellation. This violates the phase's fail-closed cancellation contract. Existing cancellation tests abort before the child closes, not during cleanup.
- **Proposed fix**: Recheck cancellation after cleanup settles and before returning the success response; return structured `cancelled` with no inventory when the signal was aborted. Keep cleanup-failure precedence fail-closed. Add a controlled removal-promise regression that aborts after a valid child result but before removal resolves.

### 2. Arbitrary count keys can carry raw feedback into the tool result
- **File**: `extensions/fix-pr-feedback/index.ts:95-103,129-145`
- **Problem**: `compactCounts` copies every string key in successful stdout's `counts` object directly to both `details` and `content`. A zero-exit child can return `counts: { "<raw review or CI text>": 1 }` and the adapter emits that text, despite filtering `rawReviews` and omitting candidate claims. This violates the phase's metadata-only, no-raw-payload output boundary; the current fixture tests only top-level `rawReviews` leakage.
- **Proposed fix**: Accept only the fixed count keys emitted by the canonical fetcher (`needs_judgment`, `resolved_thread`, `duplicate_id`, `empty`, `pending_checks`), with finite nonnegative integer values; reject unexpected keys rather than forwarding them. Add a regression with a raw-content key in a successful summary and assert `invalid_output` without any raw text.

## Warnings

### 1. Setup error messages reveal private filesystem details
- **File**: `extensions/fix-pr-feedback/index.ts:232-234`
- **Problem**: Seen-ID write and child-spawn exceptions are returned verbatim in `content` and `details`. A failed `writeFile` commonly includes the private `seen-ids` path, while other setup/cleanup errors have static messages. The phase's private temp-file and bounded output contract is undermined on this failure path.
- **Suggested approach**: Return a static structured setup failure rather than interpolating the exception message; keep diagnostic details out of the agent response. Assert that a write error containing the temp path is not reflected in either output field.

## Resolution
- Recheck cancellation after private-directory cleanup; cleanup failure remains the higher-priority fail-closed result.
- Whitelist the fetcher's five fixed count keys and require nonnegative integer values; unknown keys produce `invalid_output` without being returned.
- Replace setup exception interpolation with static `fetch_failed` output, preventing temporary filesystem paths from entering agent context.

## Verification
- `bunx vitest run extensions/fix-pr-feedback/__tests__/index.test.ts skills/fix-pr/scripts/fetch-feedback.test.ts` — 36/36 passed.
- `npm run guardrails:check` — durable v2 passed; required unit, ratchet, and complexity gates passed; patch passed advisory; lint and functional skipped.
- Real default-path Bun smoke returned `{ "error": true, "code": "fetch_failed", "message": "fix_pr_feedback exited 2" }` for the canonical invalid-number path, with no GitHub access.

## Result
All eighth-review findings are resolved. The supervisor owns independent re-review and loop-state selection.
