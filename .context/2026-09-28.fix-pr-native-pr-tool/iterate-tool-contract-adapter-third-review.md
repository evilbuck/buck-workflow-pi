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

# Iteration: fix-pr feedback adapter output boundary

## Source
- Reviewed after: `/b-iterate`
- Phase: `phase-1-tool-contract-adapter.md`
- Plan: `plan-fix-pr-native-pr-tool.md`

## Critical Issues

### 1. Failure results expose untrusted PR and CI text
- **File**: `extensions/fix-pr-feedback/index.ts:159-167`; `skills/fix-pr/scripts/fetch-feedback.ts:96-101,758-761,818-826`
- **Problem**: Success/progress strip raw payloads, but a nonzero exit copies the final 2,000 characters of CLI stderr into the tool's structured error. The CLI prints the PR title and the first CI log/annotation signal to stderr. On a later fetch or inventory-write failure, the error returned to the agent can include that untrusted text, contrary to the phase's no-raw-review/CI-payload response boundary. For example, after a failed Actions job emits its signal preview, an inventory write failure exits nonzero and the adapter returns the preview in `message`.
- **Proposed fix**: Keep the exit code and a bounded trusted failure category, but do not copy arbitrary CLI stderr into tool content/details. Preserve raw diagnostics only outside the agent response if needed. Cover a failed child emitting a unique PR title/CI signal in stderr; assert that failure is structured, contains no inventory path, and includes neither untrusted string.

## Warnings

### 1. CLI stdout has no bound before parsing or compacting
- **File**: `extensions/fix-pr-feedback/index.ts:155-170,102-129`
- **Problem**: Every stdout chunk is appended without a size ceiling; the CLI summary has one candidate per unseen feedback item, and its `pathLine`/`id` fields are copied into the result without length caps. The 25-candidate *count* cap does not bound process memory or the eventual tool response when a PR has many candidates or unusually long metadata. The phase calls for a compact, bounded response.
- **Suggested approach**: Set a generous deterministic stdout byte ceiling above legitimate expected summaries, stop/kill and fail closed when exceeded, and cap or reject oversized candidate metadata before constructing the tool result. Cover oversized stdout and a single oversized candidate field.

## Verification
- `bunx vitest run extensions/fix-pr-feedback/__tests__/index.test.ts skills/fix-pr/scripts/fetch-feedback.test.ts`: 23 tests passed; these scenarios are not covered.
- `npm run guardrails:check`: durable v2 pass; unit, patch, ratchet, complexity pass; lint and functional skipped.

## Resolution
- Nonzero child exits return only the trusted `fetch_failed` category and numeric exit code; stderr is drained for a single static progress update and never retained or returned.
- Stdout accumulation is limited to 1 MiB of UTF-8 bytes. Overflow discards buffered output, kills the child with SIGKILL, and returns `invalid_output` without an inventory.
- Each returned candidate string is limited to 1,024 characters; oversized metadata fails closed rather than truncating feedback identifiers.
- Fresh focused suites: 27 tests passed. Real Bun subprocess smoke verified stderr redaction, overflow termination, private-file cleanup, and canonical CLI resolution. The incidental default-path permanent test was replaced by this smoke.
- Durable guardrails pass: required unit, ratchet, and complexity gates pass; patch passes; lint/functional disabled. Initial complexity failure was fixed with a shared narrowing predicate for the four bounded metadata fields; no baseline changed.
- Supervisor owns independent re-review and loop-state selection.

## Recommended Workflow

Start with `/b-iterate` on this artifact, then re-run `/b-review` against the same phase. Supervisor owns loop-state selection.
