---
status: completed
date: 2026-10-16
updated: 2026-10-16
subject: 2026-10-10.durable-storage-adapters
topics: [review, iteration, publication, recovery, branch-isolation]
informs: []
addresses: phase-6-publication-recovery.md
completed: 2026-10-16
from_review: b-review
---

# Iteration: Phase 6 publication-boundary re-review

## Source
- Reviewed after: `/b-iterate`.
- Phase: `phase-6-publication-recovery.md`.
- Plan: `plan-durable-storage-adapters.md`, step 6, fetching/publication contract, material risks 1–2.
- Baseline: HEAD `390bc3b8accc64b5a9cfea7864501f79e0c9ce91` plus the pre-existing staged and unstaged Phase 6 implementation; source-state verification, not the whole long-lived branch diff.
- Report: `review-phase-6-publication-boundary-rereview-2026-10-16.md`.
- Earlier helper-only defects have substantially been repaired. These are current consumer-visible failures, not a repetition of that obsolete implementation review.

## Critical Issues

### 1. Repo-files discovery imports unsealed merged projections over the proven snapshot
- **File**: `skills/_shared/scripts/workflow-state.ts`
- **Location**: `importSubjectProjection`, lines 434–448; `executeWorkflowState`, lines 472–475. Mirror: `plugins/buck-workflow/skills/_shared/scripts/workflow-state.ts`.
- **Severity**: High.
- **Classification**: In-plan; criteria 1 and 3 explicitly require sealed v1 publication while post-seal v2 remains private, and criterion 5 requires ordinary access to use the proven integration view.
- **Problem**: Reconciliation correctly selects sealed v1, but ordinary list/search/discover/lifecycle inspection then scans the checkout's `.context` files. If the receiving branch has no local pointer, `importSubjectProjection` unconditionally copies the physical body into a fresh current-branch revision. A tracked post-seal v2 that arrives through Git therefore becomes an ordinary branch overlay without any checkpoint authorizing v2. That overlay masks the exact v1 selected by the ledger. Default repo-files consequently has a second publication path outside the new proof boundary.
- **Reproduction**: In an isolated configured repo-files project, write `subject/plan-smoke.md` = `sealed v1`; seal the runtime snapshot; commit tracked v1 and bind that checkpoint; write `UNSEALED v2`, commit it without another seal; merge into a fresh reader worktree and advance configured `refs/heads/main` to the integrated topic tip. A fresh CLI `list` returns v2 while CLI `publication-view` selects v1.
- **Observed output**: `{"scenario":"tracked-postseal-edit","expected":"sealed v1","actual":[{"text":"UNSEALED v2","revision":"a2be43f8-4957-4318-a8b7-d0e48ffeb8ad"}],"publishedRevision":"7b517275-d413-4f71-a6a0-32662883812e"}`.
- **Proposed fix**: Make projection reconciliation distinguish explicitly authored current-branch edits from inherited/merged projections. Do not create a local overlay merely because another branch's projection exists at the same physical path. Use the immutable manifest/provenance and sealed integration view as authority; keep ambiguous legacy/inherited bytes available through explicit import/recovery rather than normal retrieval. Preserve legitimate repo-files direct-edit support and Git portability without an alternate auto-publication route. Add a configured CLI/two-worktree regression with real tracked `.context` bodies, sealed v1, committed-but-unsealed v2 and an advanced integration ref; assert list/search/read/discovery expose only v1, including after a fresh process. Synchronize the canonical/plugin copies.

## Warnings

No separate in-plan warning. Required guardrails pass; those gates do not cover the two runtime counterexamples above. Documentation/how-to impact is recorded only in the report, not as an iteration defect.

## Verification

- Fresh `npm run guardrails:check`: durable v2 **pass**, unit/global-ratchet/complexity pass; coverage **88%** against unchanged **84%** baseline; functional/lint skipped (disabled); patch advisory, no measured percentage. No thresholds, enforcement or baseline changed.
- Disposable PostgreSQL 18 + pgvector fixture: `npx vitest run skills/_shared/scripts/storage-publication.test.ts skills/_shared/scripts/file-store.test.ts skills/_shared/scripts/sqlite-store.test.ts skills/_shared/scripts/postgres-store.test.ts`: **125 passed, 4 files passed, exit 0**, no skipped tests.
- Actual fresh-process CLI/runtime smoke on **repo-files, external-files, SQLite and PostgreSQL**: ordinary retrieval before merge `[]`, after advancing integration `["sealed v1"]`, after rewriting integration `[]`; private v2 never appears in those non-inherited-projection cases.
- Separate real tracked-projection and same-tip-recreation CLI scenarios reproduced issues 1 and 2. No published revision IDs were injected into reader contexts.
- Canonical/bundled storage directory and changed publication/workflow/CLI/file-store-test/access-document pairs: byte parity passes.
- Two review axes completed with explicitly scoped sequential standards fallback because no sub-agent dispatch tool is available. Per-axis findings remain separate in the report.
- No application source, permanent tests, pre-existing index content, phase/overview status or supervisor routing state changed by this review. Disposable smoke script, temporary checkouts/stores and database container are removed after verification.

## Recommended Workflow

Start with `/b-iterate` against this phase and these two defects. Then re-run `/b-review` against `phase-6-publication-recovery.md` with the new real-Git regression cases.

Inside an OMP execution session, `/b-iterate` completes this artifact before it returns; the supervisor then re-reviews. Do not leave the file active waiting for review or save. Larger rework can use `/b-build-hard` within the existing phase scope. This review returns evidence only; it does not choose the next loop state or change phase acceptance markers.

## Applied iteration

- Fixed the current ranked blocking issue: configured repo-files discovery no longer imports clean tracked projections into a missing current-branch pointer. Only observable local changes/new untracked files initialize drafts; failed Git observation refuses import. Branch-owned direct edits remain supported.
- Real-Git regression uses tracked sealed plan/index v1 and committed unsealed plan/index v2 in two worktrees. Fresh CLI list/search/read/discover/lifecycle requests retain v1; new local files and explicit edits remain usable.
- Focused publication/file-store/workflow-state run: 89 passed. Standalone fresh-process CLI smoke returned list/read `sealed v1`, search for `UNSEALED` returned `[]`. Temporary smoke files/checkouts removed; three canonical/plugin pairs match.
- Boundary semantics documented in workflow-state-access.md. Execution record: implementation-notes-phase-6.md. Supervisor owns rereview, save, commit and loop routing.
