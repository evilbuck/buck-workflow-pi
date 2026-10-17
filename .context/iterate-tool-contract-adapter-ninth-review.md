---
status: completed
date: 2026-09-28
updated: 2026-09-28
subject: 2026-09-28.fix-pr-native-pr-tool
topics: [review, iteration, progress]
informs: []
addresses: phase-1-tool-contract-adapter.md
completed: 2026-09-28
from_review: b-review
---

# Iteration: Tool Contract + Adapter Extension (ninth review)

## Source
- Reviewed after: `/b-iterate`
- Phase: `phase-1-tool-contract-adapter.md`
- Parent plan: `plan-fix-pr-native-pr-tool.md`

## Critical Issues

### 1. CLI progress is discarded rather than forwarded in bounded form
- **File**: `extensions/fix-pr-feedback/index.ts:93-101,194-195`
- **Problem**: The phase requires bounded forwarding of stderr progress. The adapter emits the same static text once on the first stderr chunk and discards every subsequent update, including reviews, comments, checks, and thread-page progress emitted by the CLI. A long-running fetch gives the operator no stage updates.
- **Proposed fix**: Map only known-safe CLI progress stage patterns to a bounded set of trusted stage updates, with a per-call update budget. Never include PR titles, check names, CI text, arbitrary suffixes, or filesystem paths. Test multiple distinct CLI stages, repeated heartbeats, and adversarial metadata; verify progression without leaking untrusted text.

## Warnings

### 1. Every call creates an unused private directory
- **File**: `extensions/fix-pr-feedback/index.ts:207-218,243-249`
- **Problem**: Calls without `seenIds` still create and remove a temporary directory, adding avoidable filesystem operations to the common path.
- **Suggested approach**: Only create a temporary directory when a nonempty seen-ID list needs a file, while retaining fail-closed cleanup for calls that do create one.

## Resolution

Mapped only recognized fetcher stages to five static updates, de-duplicated with an eight-update per-call cap, and retained no stderr text. Unrecognized chunks and repeated heartbeats do not produce updates. The adapter now creates a private temporary directory only when nonempty `seenIds` require a file; cleanup remains fail-closed for that path.

Focused adapter/fetcher tests pass 36 tests. Durable guardrails v2 passes: required unit, ratchet, and complexity gates; patch advisory passes; lint and functional gates are disabled/skipped.

## Verification
- `npm run guardrails:check`: durable v2 pass (required unit, ratchet, and complexity pass; advisory patch pass; lint/functional skipped). Coverage 87.9% against 84% baseline.
- `bun skills/fix-pr/scripts/fetch-feedback.ts acme/widgets not-a-number`: exit 2, `error: invalid arguments`, confirming direct CLI entry without network access.
- No live OMP registered-tool or successful GitHub fetch verified here; these belong to Phase 4.

## Recommended Workflow

Start with `/b-iterate` — it will pick up this file automatically. Then re-run `/b-review` against the same phase. Inside an OMP execution session, this artifact is not done until completed, review passes, and `/b-save` has recorded durable state.
