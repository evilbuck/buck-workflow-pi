---
status: completed
date: 2026-09-28
updated: 2026-09-28
subject: 2026-09-28.fix-pr-native-pr-tool
topics: [review, iteration, progress, stderr-framing]
informs: []
addresses: phase-1-tool-contract-adapter.md
completed: 2026-09-28
from_review: b-review
---

# Iteration: Tool Contract + Adapter Extension (tenth review)

## Source
- Reviewed after: `/b-iterate`
- Phase: `phase-1-tool-contract-adapter.md`
- Parent plan: `plan-fix-pr-native-pr-tool.md`

## Finding and repair

Progress handling now frames stderr as newline-delimited records across arbitrary pipe chunks using a streaming UTF-8 decoder. It classifies each complete line, so coalesced stage records are all reported and split stage records are recognized. Partial and over-4-KiB lines are discarded; only the existing fixed stage messages are exposed, with de-duplication and the per-call update cap preserved.

Added a regression that splits `fetching reviews` across buffers, coalesces a second stage line in the same buffer, and verifies long/incomplete untrusted metadata is not forwarded.

## Verification

- RED: `bunx vitest run extensions/fix-pr-feedback/__tests__/index.test.ts -t 'frames split and coalesced'` failed: split reviews were missed and checks preceded reviews.
- GREEN: `bunx vitest run extensions/fix-pr-feedback/__tests__/index.test.ts` passed, 26 tests.

Supervisor owns independent re-review and loop-state selection.
