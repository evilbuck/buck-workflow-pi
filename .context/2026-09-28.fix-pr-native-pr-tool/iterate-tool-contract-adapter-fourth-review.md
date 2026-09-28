---
status: completed
date: 2026-09-28
updated: 2026-09-28
subject: 2026-09-28.fix-pr-native-pr-tool
topics: [review, iteration, fix-pr, cancellation]
informs: []
addresses: phase-1-tool-contract-adapter.md
completed: 2026-09-28
from_review: b-review
---

# Iteration: fix-pr feedback adapter cancellation termination

## Source
- Reviewed after: `/b-iterate`
- Phase: `phase-1-tool-contract-adapter.md`
- Plan: `plan-fix-pr-native-pr-tool.md`

## Critical Issues

### 1. Cancellation can wait indefinitely for a child that does not exit on SIGTERM
- **File**: `extensions/fix-pr-feedback/index.ts:137-157,174-197`; `extensions/fix-pr-feedback/__tests__/index.test.ts:156-178`
- **Problem**: Abort requests `SIGTERM`, but `collectOutput` only resolves on `close`/`error` and never escalates if the child ignores SIGTERM or a descendant keeps its output pipes open. The tool invocation remains pending and its adapter-owned temporary seen-ID directory is not removed. A read-only real-child smoke injected a Bun subprocess with a SIGTERM handler; after abort, the tool was still pending after 500 ms. The smoke then killed the child with SIGKILL and awaited cleanup. The current fake always emits `close` after `kill`, hiding this path.
- **Proposed fix**: Establish a bounded cancellation deadline; escalate to SIGKILL and settle the tool without waiting indefinitely for a reluctant child/held-open pipe. Preserve no-success-inventory behavior, ensure adapter-owned temporary files are removed, and cover a child that ignores SIGTERM as well as a descendant holding the pipe open. Do not return success if an abort arrives during execution.

## Warnings

None.

## Verification
- `bunx vitest run extensions/fix-pr-feedback/__tests__/index.test.ts skills/fix-pr/scripts/fetch-feedback.test.ts`: 27 tests passed.
- `npm run guardrails:check`: durable v2 pass; required unit, ratchet, complexity pass; patch pass; lint and functional skipped.
- Direct real-child smoke: cancellation remained pending after 500 ms while the child ignored SIGTERM; forced SIGKILL released the invocation.
- Direct default-path smoke: canonical CLI argument validation returned structured `fetch_failed` with exit code 2; no GitHub access.

## Recommended Workflow

Start with `/b-iterate` on this artifact, then re-run `/b-review` against the same phase. Supervisor owns loop-state selection.

## Repair evidence

- Cancellation now sends SIGTERM, allows 250 ms for normal closure, then sends SIGKILL, destroys the adapter's stdout/stderr pipes, and settles without requiring `close`. Timer and abort subscription are cleaned on settlement.
- Aborted execution returns only `cancelled`; the existing `finally` removes adapter-owned seen IDs and their directory.
- Two deterministic regressions cover ignored SIGTERM and process exit without pipe closure. Focused adapter/fetcher suites: 29 tests passed.
- Real-child Bun smoke exercised a Node child ignoring SIGTERM and a Node parent whose descendant retained both pipes: both returned cancellation, destroyed pipes, and removed the private directory. Smoke-owned descendants were explicitly killed afterward; adapter cancellation does not promise descendant process-tree termination.
- `npm run guardrails:check`: durable v2 pass; unit, ratchet, complexity and patch pass; lint/functional disabled. Throwaway smoke removed.
- Supervisor owns independent re-review and subsequent loop state; no commit or state transition performed.
