---
status: completed
date: 2026-10-27
updated: 2026-10-27
subject: 2026-10-26.git-cleanup-skill
topics: [review, iteration, git-cleanup]
informs: []
addresses: phase-2-apply-deletes.md
completed: 2026-10-27
from_review: b-review
---

# Iteration: git-cleanup Phase 2

## Source
- Reviewed after: `/b-build-hard`
- Plan: `plan-git-cleanup.md`

## Critical Issues

### 1. Phase 2 guardrails fail; fixture classifier tests cannot resolve the base
- **File**: `skills/git-cleanup/scripts/classify.ts`, `skills/git-cleanup/scripts/classify.test.ts`
- **Problem**: `npm run guardrails:check` reports required unit-test and global-ratchet failures; the focused classifier run has 27/28 tests failing at `No base found (expected refs/remotes/origin/HEAD, local master, or local main)`. This prevents verification of the new apply path. The observed failures include both existing classifier cases and both new apply cases.
- **Proposed fix**: Diagnose why the fixture's `refs/remotes/origin/HEAD`/local base is not visible to the classifier under the test Git shim, fix the fixture or implementation without weakening fail-closed base resolution, then rerun the focused test and durable guardrails contract.


- **Jev failure**: Jev failed: missing, unreadable, or oversized file skills/git-cleanup/scripts/classify.ts`, `skills/git-cleanup/scripts/classify.test.ts. Re-review this finding with Jev.

Resolution: escaped the newline in the generated Git shim and updated the squash fixture's remote base after landing. Split apply validation into helpers to satisfy the complexity gate. Focused suite: 28 passed; durable guardrails: pass (unit, ratchet, complexity); fixture CLI smoke deleted a landed branch and refused the current integration branch.

## Warnings

None beyond the blocking verification and complexity failures.

## Recommended Workflow

Start with `/b-iterate` — it will pick up this file automatically. Then re-run `/b-review` against `phase-2-apply-deletes.md`.
