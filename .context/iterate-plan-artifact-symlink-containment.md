---
status: completed
date: 2026-08-25
updated: 2026-08-25
subject: 2026-08-25.omp-plan-artifact-extension
topics: [review, security, symlink, path-traversal]
informs: []
addresses: plan-omp-plan-artifact-extension.md
completed: 2026-08-25
from_review: PR #8
---

# Iteration: canonicalize plan artifact source paths

## Source

PR #8 review (HEAD `f48646b`) flagged that the lexical `resolve()`/`relative()`
containment check in `resolvePlanDiskPath` does not constrain symbolic links.
`readFileSync()` follows a `local://plan.md` symlink (or a symlinked ancestor)
under `local/` that targets a file outside it, then persists that external file
into `.context/`.

## Resolution

- Keep the lexical escape check (still rejects `local://../../…` before any I/O).
- If the candidate exists, `realpathSync()` both `localRoot` and the candidate.
- Reject when the canonical relative path escapes the canonical root.
- Missing or unresolvable paths return `null` (same silent skip as a missing plan).
- In-root symlinks remain allowed.

## Verification

- `npx vitest run extensions/plan-artifact.test.ts` — 19 passed.
- LSP diagnostics — `extensions/plan-artifact.ts` clean.
