---
status: completed
date: 2026-09-21
updated: 2026-09-21
subject: 2026-09-21.buck-loop-midrun-deadlock
topics: [review, iteration, buck-loop, rpc]
informs: []
addresses: research-buck-loop-midrun-deadlock.md
completed: 2026-09-21
from_review: b-review
---

# Iteration: buck-loop mid-run deadlock

## Source
- Reviewed after: D1 diagnosis fix implementation
- Contract: `research-buck-loop-midrun-deadlock.md` § “Fix applied (D1)”
- Baseline: `origin/master` / `7dc2aaf`; implementation is uncommitted working-tree state

## Critical Issues

### 1. Dirty-tree confirmation can hang forever in RPC mode
- **File**: `extensions/buck-loop/index.ts:120,134-145,232`
- **Problem**: The new guard assumes `ctx.hasUI` is false in RPC mode. Pi defines it as true, and RPC `confirm()` waits for an `extension_ui_response`. This call supplies no timeout, so an RPC client that does not implement the dialog sub-protocol can leave unattended `/buck-loop` runs pending forever instead of failing closed. The local `confirm` type also omits the host API’s third `ExtensionUIDialogOptions` argument.
- **Proposed fix**: Use the real host `confirm` signature, pass a bounded timeout, and treat timeout/cancel as denial. Correct the JSDoc and ADR: print/JSON deny because `hasUI` is false; RPC can prompt through the sub-protocol and must be bounded. Add command-surface coverage for interactive approval, denial, no-UI denial, and RPC-style timeout.

## Warnings

### 1. Resume prompts before proving a saved run exists
- **File**: `extensions/buck-loop/loop.ts:212-220`
- **Problem**: `resumeRun` asks for approval before reading `.context/workflow/buck-loop.json`. On a dirty tree with no saved run, the operator can approve inclusion of files in a commit, then immediately receive `no projection to resume`.
- **Suggested approach**: Read and validate the projection first; only run the workspace gate when a resumable run exists. Add a regression case proving dirty `--resume` with no projection never calls `confirmDirty`.

### 2. Production confirmation wiring is not exercised
- **File**: `extensions/buck-loop/__tests__/wire.test.ts:19-188`
- **Problem**: Supervisor tests inject `confirmDirty` directly and prove the loop seam, but command-surface tests never exercise `confirmDirtyTree`, `ctx.hasUI`, `ctx.ui.confirm`, the displayed paths, or the timeout/denial behavior. The production wiring can regress while the new supervisor tests remain green.
- **Suggested approach**: Extend `wire.test.ts` to invoke the registered handler with interactive and non-interactive contexts and assert the dependency’s observable result and dialog message.

### 3. The presentation path regression test removes the condition being fixed
- **File**: `scripts/serve-presentations.test.ts:20-24`
- **Problem**: Production now canonicalizes a symlink-reached root, but the test canonicalizes `root` before every call. On macOS, the old implementation rejects an existing file when passed `/var/...`, yet passes when given the test’s canonical `/private/var/...`; deleting the production hunk leaves the suite green.
- **Suggested approach**: Keep existing canonical-root cases, then add a case that passes a deliberately non-canonical or symlinked root and asserts an existing file resolves inside it. The regression must fail without `serve-presentations.ts:125-130`.

### 4. Headless denial text promises a prompt that never appeared
- **File**: `extensions/buck-loop/loop.ts:563-569`
- **Problem**: The denial reason says “Approve when prompted” even when print/JSON mode returned false without showing a prompt.
- **Suggested approach**: Distinguish `declined` from `unavailable`, or use a remedy that is true for both modes.

## Recommended Workflow

Start with `/b-iterate` — it will pick up this file automatically.
Then re-run `/b-review` against the same research contract.
Inside an OMP execution session, the iterate artifact is not done until it is completed, review passes, and `/b-save` has recorded durable state.

## Resolution

- Bounded dirty-tree confirmations at 30 seconds with the host dialog timeout
  and an `AbortSignal`; timeout, cancellation, and dialog errors deny.
- Moved saved-projection validation before the resume workspace prompt.
- Added command-surface coverage for approval, denial, no UI, and RPC-style
  timeout; added a resume-without-projection regression.
- Added a symlink-root presentation regression that fails without production
  root canonicalization.
- Reworded denial guidance for both interactive and headless callers.
- Verified 222/222 changed-area tests and the live `lever.data-api` Herdr pane.
  The live prompt listed the exact dirty file and displayed its countdown. A
  deliberate No verified denial; a second run selected Yes and advanced into
  the real `b-build-hard` child, whose live activity showed reads and edits.
