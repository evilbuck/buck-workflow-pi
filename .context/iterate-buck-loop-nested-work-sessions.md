---
status: completed
date: 2026-09-18
updated: 2026-09-18
subject: 2026-09-18.buck-loop-extension
topics: [review, iteration]
informs: []
addresses: phase-4-nested-work-sessions.md
completed: 2026-09-18
from_review: b-review
---

# Iteration: nested work sessions

## Source
- Reviewed after: `/b-build-hard`
- Plan: `phase-4-nested-work-sessions.md`
- Spec: none

## Critical Issues

### 1. Review/docs tool allowlists cannot execute the injected skill contracts
- **File**: `extensions/buck-loop/run-step.ts`
- **Problem**: Phase 4 requires least-privilege *per skill*, not a shared union, and the nested worker must actually run the injected Buck skill. Current `b-review` tools are `read, grep, find, ls` — no `bash` (git status/diff/log) and no `write` (iterate artifact). Current `b-docs` tools omit `bash` even though that skill's discovery protocol uses git. A nested `b-review` therefore cannot persist `iterate-*.md`, so Phase 5's deterministic iterate>document>save path can never fire.
- **Proposed fix**: Keep distinct per-skill lists. Add `bash` and `write` to `b-review` (still no coding `edit` union). Add `bash` to `b-docs` (and `b-howto` if its contract also shells out to git). Do not collapse to one allowlist. Add focused tests for each affected skill.

### 2. Timeout/abort can return `{ ok: true }` when prompt resolves with partial text
- **File**: `extensions/buck-loop/run-step.ts`
- **Problem**: `runOmpModelSession` arms `session.abort()` on its timer, then `await session.prompt()`. If the SDK resolves the prompt after abort with nonempty assistant text (`stopReason=aborted`), `runOmpModelSession` returns that text and `runStep` reports `{ ok: true }`. Phase acceptance requires abort, timeout, throw, or empty result to be a failed step. Current tests reject `prompt()` with `AbortError`, which is not the abort-resolves-with-text path.
- **Proposed fix**: Detect abort/timeout in `runStep` even when `prompt()` resolves with text (own abort flag and/or assistant `stopReason`). Return `{ ok: false, text }`. Add a regression test that simulates timer abort + nonempty aborted assistant message.

## Warnings

None.

## Recommended Workflow

Start with `/b-iterate` — it will pick up this file automatically.
Then re-run `/b-review` against `phase-4-nested-work-sessions.md`.
