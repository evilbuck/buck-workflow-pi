---
status: completed
date: 2026-10-12
updated: 2026-10-12
subject: 2026-10-10.durable-storage-adapters
topics: [review, iteration, storage, branch-isolation]
informs: []
addresses: phase-3-domain-semantics.md
completed: 2026-10-12
from_review: b-review
---

# Iteration: Phase 3 domain semantics

## Source
- Reviewed after: `/b-build-hard`
- Phase: `phase-3-domain-semantics.md`
- Plan: `plan-durable-storage-adapters.md`, step 3.
- Report: `review-phase-3-domain-semantics-2026-10-12.md`.
- Baseline: HEAD `849ef5a`; combined staged/unstaged source state plus new domain module and migration. Existing changes belong to the implementation; this review changed no source.

All seven issues are in-plan defects. Preserve the explicit Phase 4/5 caller-cutover and Phase 6 publication boundaries; these fixes concern the domain operations already claimed by Phase 3.

## Critical Issues

### 1. Page body loading bypasses the revision that passed visibility
- **File**: `skills/_shared/storage/file-store.ts:232-237`; `skills/_shared/storage/postgres-store.ts:162-168`; `skills/_shared/storage/sqlite-store.ts:174-180` and bundled copies.
- **Problem**: Metadata selects an allowed revision, but body loading calls `read(item.key)` rather than reading that immutable revision. Both real file adapters returned a newly reconciled `PRIVATE direct edit` body to branch B while the query allowed only published `v1`. A real PostgreSQL write scheduled between metadata selection and body loading likewise returned revision `private` and `UNPUBLISHED private bytes` instead of allowed revision `published`. This leaks unmerged knowledge before it reaches callers.
- **Proposed fix**: Reconcile editable state only in its owning private scope, then resolve visibility/ranking/page against a consistent view. Load every selected body by its exact selected immutable revision; do not follow a mutable current pointer at that stage. Preserve private direct-edit reconciliation without exposing it to another branch. Add shared selected-revision/concurrent-pointer coverage and file direct-edit published-only coverage.
- **Reproduction**: Write main-owned memory `v1`; query branch B with `publishedRevisionIds: [v1]`. Before lookup, directly edit its file projection. File lookup returned the edit and a new private revision. PostgreSQL scheduling seam committed `private` after metadata selected `published` but before the real `read`; lookup returned the private body.


- **Jev failure**: Jev failed: missing, unreadable, or oversized file skills/_shared/storage/file-store.ts:232-237`; `skills/_shared/storage/postgres-store.ts:162-168`; `skills/_shared/storage/sqlite-store.ts:174-180` and bundled copies.. Re-review this finding with Jev.

### 2. New private revisions remove the previously published baseline
- **File**: `skills/_shared/storage/file-store.ts:223-229`; `skills/_shared/storage/postgres-store.ts:24-36`; `skills/_shared/storage/sqlite-store.ts:40-50` and bundled copies.
- **Problem**: Candidates come only from current branch pointers. An immutable published `v1` becomes invisible when its owning branch advances to unpublished `v2`. All four real backends returned `[v1]` before the draft and `[]` afterwards, even though branch B still explicitly selected published `v1`. This violates the published baseline/COW read contract, independent of implementing publication proof in Phase 6.
- **Proposed fix**: Resolve exact published revision candidates independently of mutable branch-current pointers, union them with current-branch candidates, and overlay/tombstone by logical identity before ranking/page/body load. Retain baseline bytes until the published pointer changes explicitly. Cover v1 published / v2 private / branch-B list and search with pagination on every adapter.


- **Jev failure**: Jev failed: missing, unreadable, or oversized file skills/_shared/storage/file-store.ts:223-229`; `skills/_shared/storage/postgres-store.ts:24-36`; `skills/_shared/storage/sqlite-store.ts:40-50` and bundled copies.. Re-review this finding with Jev.

### 3. Store lifecycle does not preserve lifecycle authority/refusal rules
- **File**: `skills/_shared/storage/contract.ts:50-68`; `skills/_shared/storage/file-store.ts:185-201`; `skills/_shared/storage/postgres-store.ts:88-110`; `skills/_shared/storage/sqlite-store.ts:213-221`; existing authority `skills/_shared/scripts/subject-lifecycle.ts:355-401`.
- **Problem**: Initial store transitions ignore `fromRevision` and the index's actual state; later transitions accept arbitrary next-state strings and completed-to-active without a reopen reason. All four backends accepted a first close with `fromRevision: NOT-current-index`, then accepted reasonless reopen. The API cannot express the existing initialize/activate/reopen intent contract, and inspection merely returns an independent lifecycle row rather than applying the authoritative index/legacy/provenance semantics.
- **Proposed fix**: Reuse one text-based lifecycle authority for file and adapter paths, with typed legal intents/states and required reopen reason. Bind the first conditional write to actual current evidence/index revision, not merely `expectedState: active`. Implement initialization/activation and authoritative inspection without mandatory filesystem materialization; retain malformed and ambiguous refusal and legacy effective-state semantics. Add all-backend stale-initial-write, legal-transition, reasonless-reopen, draft activation and malformed inspection cases.


- **Jev failure**: Jev failed: missing, unreadable, or oversized file skills/_shared/storage/contract.ts:50-68`; `skills/_shared/storage/file-store.ts:185-201`; `skills/_shared/storage/postgres-store.ts:88-110`; `skills/_shared/storage/sqlite-store.ts:213-221`; existing authority `skills/_shared/scripts/subject-lifecycle.ts:355-401`.. Re-review this finding with Jev.

### 4. Discovery exposes completed subjects from the published view
- **File**: `skills/_shared/storage/domain.ts:99-114`; `skills/_shared/storage/contract.ts:98`; adapter `inspectLifecycle` implementations cited in issue 3.
- **Problem**: Discovery asks for lifecycle only under the querying branch. A subject closed in main and visible through published index/plan revisions has no branch-B lifecycle row, so it remains selectable. All four real backends returned subject index `index1` from `discoverStoredContext` on branch B after the main subject had been closed. Completed-subject exclusion therefore only works for the exact branch that wrote the lifecycle row.
- **Proposed fix**: Resolve lifecycle authority from the same current-branch-overlay/published-baseline view as subject artifacts, with explicit versioned close/reopen evidence. Inspect canonical/legacy stored index state even without a separately written lifecycle row. Exclude completed subjects and links/backlog targets in that view, while allowing explicit private reopen overlays. Add shared published-closed subject and private-reopen discovery fixtures.


- **Jev failure**: Jev failed: missing, unreadable, or oversized file skills/_shared/storage/domain.ts:99-114`; `skills/_shared/storage/contract.ts:98`; adapter `inspectLifecycle` implementations cited in issue 3.. Re-review this finding with Jev.

### 5. Correction cannot create an overlay for an inherited published predecessor
- **File**: `skills/_shared/storage/file-store.ts:180-183`; `skills/_shared/storage/postgres-store.ts:188-194`; `skills/_shared/storage/sqlite-store.ts:198-203`; `skills/_shared/storage/contract.ts:43-48`.
- **Problem**: Correction requires the predecessor to be the current pointer of the correcting branch. With only a main-owned published predecessor and no branch-A local pointer, every backend rejects the first branch-A correction as `stale correction rejected`. The conformance case pre-creates independent A/B revisions and never exercises correcting an inherited predecessor.
- **Proposed fix**: Bind correction to the trusted visible predecessor (branch-local or published baseline), then conditionally create/update only the current branch overlay/tombstone. Carry the exact authorized baseline reference in the domain operation as needed; do not mutate the predecessor's owning pointer or accept arbitrary cross-branch revisions. Preserve idempotency/history and verify branch B still sees the predecessor. Add first inherited correction and inherited tombstone fixtures on all adapters.


- **Jev failure**: Jev failed: missing, unreadable, or oversized file skills/_shared/storage/file-store.ts:180-183`; `skills/_shared/storage/postgres-store.ts:188-194`; `skills/_shared/storage/sqlite-store.ts:198-203`; `skills/_shared/storage/contract.ts:43-48`.. Re-review this finding with Jev.

### 6. Receipt readback accepts another run/worktree's private revisions
- **File**: `skills/_shared/storage/file-store.ts:252-256`; `skills/_shared/storage/postgres-store.ts:217-220`; `skills/_shared/storage/sqlite-store.ts:246-251`.
- **Problem**: Readability checks filter only project + branch + revision ID. An attempted receipt in run S/worktree S completes using a run-private revision belonging to run O/worktree O on the same branch. All four backends returned `ACCEPTED`; IDs used the required `run-<uuid>`/`worktree-<uuid>` formats. Matching receipt identity does not establish same-scope artifact readback.
- **Proposed fix**: Resolve the attempt's exact artifact revision set under project/branch/worktree/run visibility, permitting reusable branch knowledge but refusing other runs' private revisions. Verify persisted bodies/expected identities rather than only row/manifest membership. Add shared wrong-run and wrong-worktree completion refusal fixtures; preserve valid branch-knowledge and matching-run saves.


- **Jev failure**: Jev failed: missing, unreadable, or oversized file skills/_shared/storage/file-store.ts:252-256`; `skills/_shared/storage/postgres-store.ts:217-220`; `skills/_shared/storage/sqlite-store.ts:246-251`.. Re-review this finding with Jev.

### 7. PostgreSQL verifies close evidence before the transaction and can close an open plan
- **File**: `skills/_shared/storage/postgres-store.ts:88-100`.
- **Problem**: `#evidenceBodies` and `assertStoredClose` run before `connect()`/`BEGIN`; locking the lifecycle row later does not protect evidence revisions. A deterministic scheduling seam committed an open plan (`status: active`, unchecked acceptance) using the real writer after evidence reads and before BEGIN. The real closer then committed lifecycle `state: completed` while the current plan remained open.
- **Proposed fix**: Resolve/check evidence in the same transactional snapshot and concurrency boundary as lifecycle mutation. Coordinate artifact writers and lifecycle writes through deterministic subject/evidence locks or conditional evidence revision verification that remains protected through commit. Also serialize initial lifecycle writes when no row exists. Add a real-database concurrent evidence-change refusal/retry regression; never close against stale evidence.


- **Jev failure**: Jev failed: missing, unreadable, or oversized file skills/_shared/storage/postgres-store.ts:88-100`.. Re-review this finding with Jev.

## Warnings
None outside the accepted phase scope. Documentation impact is recorded in the report, not a correctness iteration item.

## Verification evidence
- Fresh database-backed `npm run guardrails:check`: durable v2 pass; unit/global-ratchet/complexity/patch pass; functional/lint skipped; coverage 89.9% against 84% baseline. Patch enforcement remains advisory and runner reported `patch: null`.
- Focused current-state conformance + lifecycle suite: 5 files, 88 tests passed, no skips, including disposable PostgreSQL.
- Separate direct API smokes against real repository/external file roots, SQLite on disk, and disposable PostgreSQL reproduced issues 1–6; PostgreSQL real-write scheduling scenarios reproduced issues 1 and 7.
- Canonical/bundled storage directories and lifecycle/context-helper copies compare identical.
- Passing tests do not cover the reproduced failing boundaries above; no test/source/contract changes were made by the reviewer.

## Recommended Workflow
Start with `/b-iterate` for these in-plan defects, then re-run `/b-review` against `phase-3-domain-semantics.md`.
Inside an OMP execution session, `/b-iterate` completes this artifact before returning; the supervisor then re-reviews. Do not leave the artifact active waiting for review/save once iteration work is actually complete.
For larger rework, use `/b-build` or `/b-build-hard` within this same accepted scope. The supervisor owns phase/loop state; the review does not select it.

## Applied resolutions

| Issue | Resolution | Verification |
|---|---|---|
| 1 | Exact selected immutable revision body loading; file reconciliation restricted to querying owner scope. | Shared concurrent-pointer regression on all backends; both file direct-edit published-only regressions. |
| 2 | Published exact history candidates independent of current pointers; branch overlay before ranking/page. | Published v1/private v2 list/search/pagination regression on all backends. |
| 3 | Shared filesystem/store text authority; typed legal intents, index-bound first conditional write, initialize/activate, required reopen reason, canonical/legacy/malformed inspection. | Existing lifecycle suite plus all-backend first-write/stale-write/close/reopen conformance. |
| 4 | Lifecycle state is a versioned canonical index artifact in the same published/overlay view as plans and discovery. | All-backend published-close exclusion and private-reopen discovery. |
| 5 | Authorize the exact visible inherited predecessor, then conditionally create only the correcting branch pointer/tombstone. | All-backend first inherited correction/tombstone, unauthorized predecessor refusal, replay, and retained branch-B baseline. |
| 6 | Persisted exact-body SHA-256 readback and project/branch/worktree/run scope checks. | All-backend wrong-run/wrong-worktree refusal plus reusable branch and matching-run completion. |
| 7 | Evidence selected inside the PostgreSQL transaction after sorted subject locks shared with artifact writers; absent-index initialization serialized. | Real PostgreSQL evidence writer scheduled before closer BEGIN is refused; concurrent initial writes yield exactly one successful initialization. |

Final focused suite: 5 files, 117 tests passed, no skips, with disposable PostgreSQL. Direct API smoke passed on repo-files, external-files, on-disk SQLite, and PostgreSQL. Regression mutation runs failed at the intended boundaries (17 + 10 failures); all mutations restored before final verification.

Final `npm run guardrails:check`: durable v2 `pass`; required unit, global-ratchet, and complexity gates pass; coverage 90% against 84% baseline; no new complexity violations. Lint/functional disabled and skipped by contract; patch advisory, runner reports `patch: null`. No contract/baseline weakening.

Canonical and bundled storage/lifecycle/changed tests are byte-identical. `docs/context-artifacts.md` documents these semantics; existing draft and implementation notes updated. Temporary smoke script and disposable database removed after verification. No phase/loop state was selected or changed.

Supervisor handoff: independently re-run `/b-review` against `phase-3-domain-semantics.md`, then own documentation closeout, `/b-save`, and `/b-commit`.
