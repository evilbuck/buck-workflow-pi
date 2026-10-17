---
status: below-waterline
date: 2026-10-12
updated: 2026-10-12
subject: 2026-10-10.durable-storage-adapters
topics: [review, iteration, native-access, confinement, project-binding]
informs: []
addresses: phase-4-native-access.md
completed: null
from_review: b-review
---

# Iteration: Phase 4 trusted child boundary

## Source
- Reviewed after: `/b-iterate` completed `iterate-phase-4-native-access-rereview.md`.
- Phase: `phase-4-native-access.md`.
- Parent: `plan-durable-storage-adapters.md`.
- Report: `review-phase-4-native-access-boundary-2026-10-12.md`.
- Baseline: `db3157532de611c1ce2d990c0d18e4fb984ee313` plus current Phase 4 implementation.
- Current Phase 5 remaining-consumer boundary remains accepted. These defects are in the new access/permission binding, not the deferred durable-consumer sweep or publication/migration phases.

## Critical Issues

## Warnings
- Fresh durable v2 guardrails pass: coverage 88.9% against baseline 84%; required unit/ratchet/complexity pass; functional/lint skipped and patch advisory by contract. These passing gates do not exercise the two failing boundary scenarios.
- Focused access tests: 10 files / 167 tests passed. Command wrappers: 1 file / 4 tests passed.
- Native/CLI/token/correction/lifecycle and two independent complete receipt attempts passed against repo-files, external-files, on-disk SQLite and disposable PostgreSQL 18 + pgvector. Normal branch-switch receipt/token privacy and original-branch resume work; do not regress the repaired receipt semantics.
- Canonical/bundle/migration byte parity passes; copied bundle CLI and fully linked isolated installer verification pass (17 shipping files).
- All review data were fixture-only. Review-owned container stopped and throwaway scripts/roots removed. No production source, phase/lifecycle status or loop state changed.
- No out-of-plan discoveries are included. Documentation/how-to impact belongs to the separate non-blocking report path.

## Recommended Workflow

Start with `/b-iterate` against these two in-plan trust-boundary defects, then re-run `/b-review` against `phase-4-native-access.md`. Inside the configured execution session, `/b-iterate` completes this artifact before returning; the supervisor owns subsequent review and routing. Do not soften the child boundary, receipt guards, guardrails or accepted later-phase scope.
