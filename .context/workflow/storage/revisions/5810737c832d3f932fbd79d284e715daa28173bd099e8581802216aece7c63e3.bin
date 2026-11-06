---
status: completed
date: 2026-09-28
updated: 2026-09-28
subject: 2026-09-28.fix-pr-native-pr-tool
topics: [review, iteration, fix-pr, output-validation, cleanup]
informs: []
addresses: phase-1-tool-contract-adapter.md
completed: 2026-09-28
from_review: b-review
---

# Iteration: fix-pr feedback adapter output and cleanup boundaries

## Source
- Reviewed after: `/b-iterate`
- Phase: `phase-1-tool-contract-adapter.md`
- Plan: `plan-fix-pr-native-pr-tool.md`

## Critical Issues

### 1. Invalid successful stdout can claim a usable inventory
- **File**: `extensions/fix-pr-feedback/index.ts:120-135`
- **Problem**: `compactSummary` treats any string as an `inventoryPath` and allows `headRefOid` to be absent or non-string. A process emitting `{"ok":true,"repo":"acme/widgets","number":42,"inventoryPath":"","counts":{},"candidates":[]}` with exit 0 produces `ok: true`, but the advertised inventory cannot be read; malformed successful output is not fail-closed. An empty path also passes. This is the phase's summary/inventory and invalid-output contract, not a later-phase skill concern.
- **Proposed fix**: Validate required summary metadata (including a nonempty inventory path and the fetcher's required head OID) before constructing `CompactSummary`; return structured `invalid_output` on missing/malformed fields. Add a malformed-success regression using the existing fake child.

### 2. Cleanup errors bypass the structured failure contract
- **File**: `extensions/fix-pr-feedback/index.ts:185-217`
- **Problem**: `rm(tempDirectory, ...)` runs in `finally` outside any error boundary. If deletion fails after a CLI result or cancellation, `execute` rejects with a filesystem exception instead of returning a structured error. If the CLI succeeded, that exception masks the summary; if cleanup failed, private seen IDs may remain on disk. The phase explicitly requires structured failures and cleanup across success/failure/cancellation.
- **Proposed fix**: Preserve a fail-closed structured result when cleanup fails, never return success after unsuccessful cleanup, and do not expose private filesystem paths in the response. Add deterministic cleanup-failure and cancellation-cleanup-failure regressions through a narrowly injected removal operation or equivalent controlled fixture; do not claim deleted resources when deletion was impossible.

## Warnings

None.

## Verification
- `bunx vitest run extensions/fix-pr-feedback/__tests__/index.test.ts skills/fix-pr/scripts/fetch-feedback.test.ts`: 31/31 pass; neither boundary above is covered.
- `npm run guardrails:check`: durable v2 pass; unit/ratchet/complexity and advisory patch pass, lint/functional skipped.
- Direct default-tool Bun execution with CLI-invalid PR number returned structured `fetch_failed` with exit 2; no network access.
- Standards axis used a sequential pass because no background `task` tool is available. TypeScript, concurrency, error-handling, and security review guides plus the relevant Long Method, Duplicate Code, and Speculative Generality catalog entries were consulted.

## Recommended Workflow

Start with `/b-iterate` on this artifact; then re-run `/b-review` against the same phase. The supervisor owns loop-state selection.
