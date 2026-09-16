---
date: 2026-09-12
domains: [context, tooling, testing, security]
topics: [pluggable-artifact-store, ensure-context-store, xdg, gitignore, dual-mode, containment, iteration]
related:
  - 2026-09-12.pluggable-artifact-store/plan-pluggable-artifact-store.md
  - 2026-09-12.pluggable-artifact-store/iterate-pluggable-artifact-store.md
priority: high
status: active
subject: 2026-09-12.pluggable-artifact-store
artifacts:
  - plan-pluggable-artifact-store.md
  - iterate-pluggable-artifact-store.md
  - draft-commit.md
---

# Pluggable artifact store v1 — build and iteration

## Current state

`ensure-context-store.ts` provides dual-mode `.context` setup: it preserves a
real directory, creates an XDG-backed symlink only for an ignored project with
a valid `host/org/repo` origin, and otherwise creates in-repo `memory/`.
`.context` without a trailing slash remains the external-store opt-in.

## Review iteration

The review found two path-containment defects. The iteration now rejects
absolute or traversal origins before creating `.context`, and rejects existing
symlinks unless they resolve exactly to the current origin's derived store.
Correct relative symlinks still repair a dangling store layout.

## Files modified

- `skills/_shared/scripts/ensure-context-store.ts`
- `skills/_shared/scripts/ensure-context-store.test.ts`
- `.context/2026-09-12.pluggable-artifact-store/iterate-pluggable-artifact-store.md`
- `.context/2026-09-12.pluggable-artifact-store/draft-commit.md`

## Verification

- `bun test skills/_shared/scripts/ensure-context-store.test.ts` — 14 passed.
- `bunx vitest run` — 558 passed across 36 files.
- CLI smoke checks: traversal origins and foreign symlink targets exit 1
  without creating `.context` or a foreign store layout.

## Remaining blocker

The durable full guardrails check remains blocked by unrelated pre-existing
complexity drift outside this plan's changed files. Unit, patch, and global
coverage gates passed in the review.
