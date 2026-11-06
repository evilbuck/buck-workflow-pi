---
status: completed
date: 2026-09-28
updated: 2026-09-28
subject: 2026-09-28.fix-pr-native-pr-tool
topics: [review, iteration]
informs: []
addresses: phase-1-tool-contract-adapter.md
completed: 2026-09-28
from_review: b-review
---

# Iteration: fix-pr feedback adapter phase 1

## Source
- Reviewed after: `/b-build-hard`
- Phase: `phase-1-tool-contract-adapter.md`
- Plan: `plan-fix-pr-native-pr-tool.md`

## Critical Issues

### 1. Default tool resolves the fetcher outside the repository
- **File**: `extensions/fix-pr-feedback/index.ts:78-80`
- **Problem**: `dirname(import.meta.dirname)` already points at `extensions/`. Two subsequent `..` segments resolve to the parent of the package, not its root. A direct `feedbackTool().execute(...)` smoke returned `fetch_failed` with `Module not found "/home/buckleyrobinson/projects/development_tools/skills/fix-pr/scripts/fetch-feedback.ts"`. Existing tests override `scriptPath` and miss this default-path failure.
- **Proposed fix**: Resolve the sibling script from the extension directory through exactly two parent segments; add a default-path execution smoke that asserts the real CLI starts (not a fake injected script path).

### 2. Progress forwarding is not bounded across the invocation
- **File**: `extensions/fix-pr-feedback/index.ts:82-85,151-154`
- **Problem**: Each stderr chunk is independently sliced to 2,000 characters, but every chunk emits a separate `onUpdate`. The fetcher emits heartbeat updates repeatedly and includes PR titles and pending-check names in stderr (`skills/fix-pr/scripts/fetch-feedback.ts:96-101,118-125,823-824,893-899`). Long-running or malicious PR metadata can therefore generate unlimited untrusted context despite the phase's bounded-progress requirement.
- **Proposed fix**: Enforce a cumulative progress budget or throttled/coalesced bounded set of updates, avoiding raw untrusted metadata where possible; test repeated large chunks and heartbeat output.

## Warnings

### 1. Seen-ID file setup bypasses cleanup
- **File**: `extensions/fix-pr-feedback/index.ts:129-137,169-171`
- **Problem**: `writeFile` runs before the `try/finally` that removes the adapter-owned directory. If writing the seen-ID file rejects after `mkdtemp`, the tool rejects instead of returning its structured failure and leaks the directory. This violates fail-closed cleanup on failure.
- **Suggested approach**: Begin the cleanup scope immediately after `mkdtemp`; catch setup failure as `fetch_failed` and remove the directory in `finally`. Cover a deterministic write failure.

## Resolution and Verification

- Corrected default resolution to traverse two parents from the extension directory. The real default tool now starts the canonical CLI; offline invalid-input smoke returns `fetch_failed` with `exited 2: error: invalid arguments`.
- Replaced raw stderr progress with a single static update per invocation. Repeated large chunks and heartbeats cannot grow progress context or forward PR metadata. The final failure diagnostic retains its existing 2,000-character cap.
- Moved seen-ID setup inside the cleanup scope. Injected write failure returns a structured error without spawning and removes the adapter-owned directory.
- Focused adapter/fetcher suites: 18 tests passed. Durable guardrails: pass; unit, coverage ratchet, complexity and patch gates passed; lint and functional gates disabled/skipped. Coverage 87.9% against 84% baseline.
- Fixes ready for the supervisor's independent phase review; no loop-state transition or commit performed.

## Recommended Workflow

Start with `/b-iterate` — it will pick up this file automatically. Then re-run `/b-review` against the same phase. Inside an OMP execution session, the iterate artifact is not done until it is completed, review passes, and `/b-save` has recorded durable state.
