---
status: completed
date: 2026-08-25
updated: 2026-08-25
subject: 2026-08-25.omp-plan-artifact-extension
topics: [review, security, path-traversal]
informs: []
addresses: plan-omp-plan-artifact-extension.md
completed: 2026-08-25
from_review: PR #8
---

# Iteration: constrain OMP plan artifacts to `local/`

## Source

PR #8 review flagged a path traversal in `resolvePlanDiskPath`: a session entry
such as `local://../../sensitive-file` escaped the session artifacts `local/`
directory and could copy a readable host file into committed `.context/` state.

## Resolution

- Accept only non-empty `local://` URLs.
- Resolve the requested path against the session `local/` root.
- Reject absolute paths and resolved paths whose relative path is empty, `..`, or
  starts outside that root.
- Add an integration regression test that places a secret outside `local/` and
  proves no subject artifact or dedupe marker is created.

## Verification

- `npx vitest run extensions/plan-artifact.test.ts` — 16 passed.
- `npx tsc --noEmit` — fails on 85 pre-existing diagnostics outside the changed
  files; LSP diagnostics for `extensions/plan-artifact.ts` are clean.
