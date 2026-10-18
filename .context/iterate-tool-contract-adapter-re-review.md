---
status: completed
date: 2026-09-28
updated: 2026-09-28
subject: 2026-09-28.fix-pr-native-pr-tool
topics: [review, iteration, fix-pr, seen-ids]
informs: []
addresses: phase-1-tool-contract-adapter.md
completed: 2026-09-28
from_review: b-review
---

# Iteration: fix-pr feedback adapter seen-ID contract

## Source
- Reviewed after: `/b-iterate`
- Phase: `phase-1-tool-contract-adapter.md`
- Plan: `plan-fix-pr-native-pr-tool.md`

## Critical Issues

### 1. One supplied seen ID can mark another feedback item as seen
- **File**: `extensions/fix-pr-feedback/index.ts:14,138-140`
- **Problem**: The tool allows newlines inside each `seenIds` string and writes the array as newline-separated records. Passing one ID `"review:1\nreview:2"` writes two records; the canonical CLI splits on newlines (`skills/fix-pr/scripts/fetch-feedback.ts:518-524`) and then marks *both* IDs seen (`:775-786`). A direct adapter invocation with that single value emitted `"review:1\nreview:2\n"` in the temporary file. This can silently omit an unreviewed candidate on the next poll, violating the phase's exact seen-ID handling and exhaustive feedback contract.
- **Proposed fix**: Reject newline/carriage-return-containing seen IDs at the tool boundary (schema plus runtime fail-closed handling if appropriate), preserving the CLI's one-ID-per-line format. Add a regression that submits one embedded-newline value and proves it cannot mark another ID seen. Do not change the CLI's existing newline-delimited file contract.

## Warnings

None.

## Verification
- `bunx vitest run extensions/fix-pr-feedback/__tests__/index.test.ts skills/fix-pr/scripts/fetch-feedback.test.ts`: 18 tests passed; none covered embedded newline seen IDs.
- `npm run guardrails:check`: durable v2 pass; unit, patch, ratchet, complexity pass; lint and functional skipped. Passing gates do not cover this input boundary.

## Resolution

- Schema rejects CR/LF anywhere in a seen ID, including trailing separators. Runtime validation returns `invalid_input` before creating a temporary directory, writing seen IDs, or spawning the CLI.
- The canonical CLI's one-ID-per-line format is unchanged. Malformed input cannot introduce a second seen record.
- Five regression cases cover embedded LF, CR, CRLF and trailing LF/CR; each verifies schema rejection, structured runtime rejection, no file write, and no child invocation.
- Fresh focused adapter/fetcher suites: 23 tests passed. Direct default-tool Bun smoke with `["review:1\nreview:2"]` returned `invalid_input` and no inventory.
- Durable guardrails passed: required unit, ratchet, and complexity gates passed; patch gate passed; lint/functional disabled. Independent review and loop-state selection remain with the supervisor.

## Recommended Workflow

Start with `/b-iterate` on this file, then re-run `/b-review` against the same phase. The supervisor owns loop-state selection; no source files were modified by this review.
