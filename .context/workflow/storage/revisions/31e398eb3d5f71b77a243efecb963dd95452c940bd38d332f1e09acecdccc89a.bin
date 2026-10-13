---
status: completed
date: 2026-08-25
updated: 2026-08-25
subject: 2026-08-20.deterministic-extension-progress
topics: [review, iteration, extensions, kamal]
informs: []
addresses: plan-deterministic-extension-progress.md
completed: 2026-08-25
from_review: b-review
---

# Iteration: deterministic extension progress

## Source
- Reviewed after: `/b-build`
- Plan: `plan-deterministic-extension-progress.md`
- Spec: none

## Resolved Issues

### 1. Signal-terminated Kamal deploy was reported as successful
- **File**: `extensions/b-kamal-release/index.ts:327-350,469-474`
- **Fix**: Preserve the `close` signal, normalize a missing numeric exit code to failure code `1`, and include `signal SIGTERM` in the error notification.
- **Verification**: A fake Kamal executable that self-terminates with `SIGTERM` now produces an error notification and never emits `✅ Deployed`.

## Remaining Verification

### 1. Required interactive TUI smoke remains unverified
- **File**: `extensions/b-pr-improved/index.ts:313-314`, `extensions/b-commit-improved/index.ts:378-379`
- **Problem**: Source order and targeted tests prove `progress.step("preflight…")` is called before the awaited preflight, but the plan explicitly requires observing the OMP TUI while the child is running. This review environment has no display server, so the actual TUI surface could not be exercised.
- **Suggested approach**: After the Kamal fix, run `/b-pr-improved --dry-run` and `/b-commit-improved --dry-run` in OMP and confirm the dim `preflight…` status appears before preflight finishes.

## Recommended Workflow

Run `/b-review` against `plan-deterministic-extension-progress.md`.
If it passes after the manual OMP smoke, run `/b-save`, then `/b-commit`.
