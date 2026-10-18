---
status: below-waterline
date: 2026-10-16
updated: 2026-10-16
subject: 2026-10-10.durable-storage-adapters
topics: [review, iteration, publication, branch-isolation]
informs: []
addresses: phase-6-publication-recovery.md
completed: null
from_review: b-review
---

# Iteration: Phase 6 existing-pointer projection boundary

## Source
- Reviewed after: `/b-iterate`.
- Phase: `phase-6-publication-recovery.md`.
- Parent plan: `plan-durable-storage-adapters.md`, step 6, publication contract and material risk 1.
- Baseline: HEAD `390bc3b8accc64b5a9cfea7864501f79e0c9ce91` plus existing staged/unstaged Phase 6 implementation.
- Report: `review-phase-6-owned-projection-rereview-2026-10-16.md`.
- The previous missing-pointer import defect is repaired; this finding exercises the separate, still-unconditional existing-pointer reconciliation path.

## Critical Issues

## Warnings

No new warning in this iteration. The previously ranked below-waterline branch-incarnation issue is retained in the review report without rerunning its known counterexample or modifying its ranking disposition. Documentation/how-to impact is non-blocking and separate.

## Verification

- Actual configured fresh-process CLI plus runtime seal/commit/bind on repo-files, external-files, SQLite and disposable PostgreSQL 18: each produced `before: []`, `after: ["sealed v1"]`, `revoked: []`. Published IDs were derived by trusted reconciliation, not injected into reader contexts.
- Separate actual repo-files existing-pointer/two-worktree scenario produced the counterexample above.
- All-backend publication/adapter fixtures: 126 passed across 4 files, no skips, using a reviewer-owned disposable PostgreSQL fixture.
- Canonical/plugin storage directory and changed workflow service/CLI/publication tests/file tests/access-document pairs match byte-for-byte.
- Installer inventory inspection reports 19 files, publication module included, missing files `[]`; no installer actions executed.
- Application source, permanent tests, existing staged content, phase/lifecycle metadata and supervisor state were not changed by this review.

## Recommended Workflow

Return this finding to the supervisor. Corrective route is `/b-iterate` against this artifact, followed by `/b-review` against the exact Phase 6 path. Inside an OMP execution session the iterate stage completes this artifact before returning; the supervisor owns subsequent review and routing. This report does not select a loop state.
