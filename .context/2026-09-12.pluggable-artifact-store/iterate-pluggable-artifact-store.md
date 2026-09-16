---
status: completed
date: 2026-09-12
updated: 2026-09-12
subject: 2026-09-12.pluggable-artifact-store
topics: [review, iteration, security, artifact-store]
informs: []
addresses: plan-pluggable-artifact-store.md
completed: 2026-09-12
from_review: b-review
---

# Iteration: Pluggable Artifact Store

## Source
- Reviewed after: `/b-build`
- Plan: `plan-pluggable-artifact-store.md`
- Spec: none

## Critical Issues

### 1. Origin slug can escape the XDG store root
- **File**: `skills/_shared/scripts/ensure-context-store.ts:74-95,109-115,156-160`
- **Problem**: `normalizeOriginUrl()` accepts `..` path components, then `storePathForSlug()` passes the unvalidated result to `path.join()`. A remote such as `https://github.com/../../../../escaped.git` makes the resulting store path escape `$XDG_DATA_HOME/buck/projects/`; the script creates `memory/` and `backlog/` there and points `.context` at it. Direct reproduction produced a store outside the configured XDG root.
- **Proposed fix**: Parse and validate the remote into path segments before constructing the store path. Reject absolute paths, empty segments, `.`/`..`, and non-`host/org/repo` forms (or encode arbitrary forms); assert the resolved store path remains beneath the XDG project root. Add regression tests for traversal and local-path remotes.

### 2. Existing symlink targets are trusted as writable stores
- **File**: `skills/_shared/scripts/ensure-context-store.ts:170-212`
- **Problem**: For any existing `.context` symlink, the script resolves the target and calls `ensureStoreLayout()` when it is missing or incomplete. A link to an arbitrary directory therefore receives `memory/` and `backlog/`, violating the plan's invariant that writes stay inside the designated store (or the `.context` link itself).
- **Proposed fix**: Validate the symlink target as a contained external-store path before ensuring its layout. On an unrecognized or out-of-root target, return a nonzero error without writing; cover existing, dangling, relative, and out-of-root targets in tests.


## Recommended Workflow

Start with `/b-iterate` — it will pick up this file automatically.
Then re-run `/b-review` against the same plan.
Inside an OMP execution session, the iterate artifact is not done until it is completed, review passes, and `/b-save` has recorded durable state.
For larger rework, use `/b-build` or `/b-build-hard`.
