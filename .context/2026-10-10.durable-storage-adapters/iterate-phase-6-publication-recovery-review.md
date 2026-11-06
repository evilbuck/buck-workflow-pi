---
status: completed
date: 2026-10-16
updated: 2026-10-16
subject: 2026-10-10.durable-storage-adapters
topics: [review, iteration, publication, recovery]
informs: []
addresses: phase-6-publication-recovery.md
completed: 2026-10-16
from_review: b-review
---

# Iteration: Phase 6 publication and recovery

## Source
- Reviewed after: `/b-build-hard`
- Phase: `phase-6-publication-recovery.md`
- Plan: `plan-durable-storage-adapters.md`, step 6 and design contract §4.
- Baseline: HEAD `390bc3b`; staged and unstaged implementation reviewed as current source. Existing staged work and phase status were not modified by this review.
- Review report: `review-phase-6-publication-recovery-2026-10-16.md`.

## Critical Issues

### 1. Integrate sealing, commit binding, persisted publication and ordinary retrieval
- **File**: `skills/_shared/storage/file-store.ts:255-284`; corresponding SQLite `262-280` and PostgreSQL `214-232`; `extensions/buck-loop/loop.ts:483-509`; `skills/_shared/scripts/workflow-state.ts:161-176,255-266`.
- **Problem**: Phase criteria 1, 2 and 5 are not delivered. Production code never calls `sealCheckpoint` or `bindCheckpoint`; successful loop commit handling stores only target/base HEAD, without a sealed artifact snapshot. All three underlying adapters implement `reconcile()` as a no-op. The new reconciliation helper has no production caller, no persisted versioned publication view or proof history, and trusted contexts always begin with `publishedRevisionIds: []`. A real file-store smoke wrote a revision, sealed it at a newly integrated source commit, bound it, invoked reconcile, and still read `[]` on another branch. Rewrites cannot revoke a persisted view that does not exist. Implementation notes explicitly acknowledge these gaps despite the phase's completed status.
- **Proposed fix**: Wire exact immutable snapshot sealing into the actual save/checkpoint path and bind only after verified commit success (or explicit eligible source selection); failed binding must retain the private seal. Implement transactional/atomic, adapter-backed versioned publication/proof state and reconciliation on all four adapters. Derive trusted ordinary retrieval's publication set from the current proven integration view, including revocation. Exercise actual save→commit→merge→fresh-context retrieval with v1 sealed and v2 private, plus rewrite and failure recovery; do not manually inject publication IDs as proof of integration.


- **Jev failure**: Jev failed: missing, unreadable, or oversized file skills/_shared/storage/file-store.ts:255-284`; corresponding SQLite `262-280` and PostgreSQL `214-232`; `extensions/buck-loop/loop.ts:483-509`; `skills/_shared/scripts/workflow-state.ts:161-176,255-266`.. Re-review this finding with Jev.

### 2. Reconciliation ignores the commit actually bound to the checkpoint
- **File**: `skills/_shared/storage/publication.ts:130-132`.
- **Problem**: Any truthy `boundCommit` passes the binding gate, but ancestry is checked against `checkpoint.commit`, not the bound commit. With a merged `commit` and a later unmerged `boundCommit`, the helper returns `published`. Adapter binding accepts a commit independently without enforcing equality or a validated relation. This violates criterion 2's exact eligible source-checkpoint proof.
- **Proposed fix**: Establish one immutable, verified binding contract and prove the commit that actually authorizes publication; reject mismatched/unresolvable bindings. Record resolved OIDs once and use those same OIDs in proof and persisted evidence. Add mismatched binding and mutable-ref fixtures.


- **Jev failure**: Jev failed: missing, unreadable, or oversized file skills/_shared/storage/publication.ts:130-132`.. Re-review this finding with Jev.

### 3. Partial rewrite attestations publish unattested snapshot members
- **File**: `skills/_shared/storage/publication.ts:92-106,133-139`.
- **Problem**: Criterion 4 requires an exact source-checkpoint mapping. The attestation has no source checkpoint identity, and `every()` checks only that supplied hashes are a subset of the seal. A real Git scenario with an unmerged two-member seal and an attestation naming only the first hash returned both members as published. A hash shared by another checkpoint can authorize its additional private members. Nonempty arbitrary evidence is accepted without identifying a source mapping.
- **Proposed fix**: Persist an explicit selected source-checkpoint→target mapping; validate trusted project, full exact revision/hash snapshot, target reachability in the configured integration view and explicit mapping evidence. Reject missing/extra/duplicate/subset members and mappings for other checkpoints, even if hashes overlap. Keep patch-id-only mappings rejected. Add actual squash and rebase fixtures with negative visibility before mapping.


- **Jev failure**: Jev failed: missing, unreadable, or oversized file skills/_shared/storage/publication.ts:92-106,133-139`.. Re-review this finding with Jev.

### 4. Conflict detection compares immutable revision IDs instead of logical artifacts
- **File**: `skills/_shared/storage/publication.ts:141-151`.
- **Problem**: Criterion 5 requires conflicts between independently published revisions of the same artifact. The helper groups by revision ID and flags different hashes under that same ID. A second real Git/file-store smoke created independent left/right branches, wrote different immutable revisions of `p/s/plan/same-plan.md`, sealed and bound each, and merged both code branches; reconciliation returned both as `published`, not `conflict`. The helper does not receive logical artifact identity or correction lineage. Its existing conflict fixture manufactures the same immutable ID with two hashes, rather than two revisions of one artifact. No explicit persisted resolution operation exists.
- **Proposed fix**: Resolve sealed revisions to logical artifact keys and lineage; reconcile per artifact, preserve both independent candidates and its last unambiguous baseline, and provide explicit durable resolution. Unrelated artifacts must still advance. Test two actual stored revisions of the same logical artifact on independent branches and inspect ordinary retrieval before/after resolution.


- **Jev failure**: Jev failed: missing, unreadable, or oversized file skills/_shared/storage/publication.ts:141-151`.. Re-review this finding with Jev.

### 5. Deleted named refs disappear from recovery and explicit recovery is incomplete
- **File**: `skills/_shared/storage/publication.ts:168-180`; `skills/_shared/scripts/workflow-state.ts:560-564`.
- **Problem**: Criterion 6 is not satisfied by the helper or existing recovery entry point. A scope retaining `ref: refs/heads/deleted` with no matching live ref falls through to `[]`; only scopes whose ref field is already absent are labelled deleted. The native recovery handler lists other named branch records without checkpoint provenance, excludes workspace-only detached/unborn scopes, and offers no selection-bound rebind/export. The new helper has no production caller. Parent material risk 2's explicit recovery/rebinding fallback is therefore unproven and incomplete.
- **Proposed fix**: Classify absent live named refs as deleted, retain incarnation/provenance/checkpoint information, enumerate named and workspace-only orphan scopes from the selected adapter, and implement explicit scope selection before validated rebind or export. Prove deleted/recreated/renamed/detached/unborn scopes remain private and retained, with successful selected recovery and no same-name inheritance.


- **Jev failure**: Jev failed: missing, unreadable, or oversized file skills/_shared/storage/publication.ts:168-180`; `skills/_shared/scripts/workflow-state.ts:560-564`.. Re-review this finding with Jev.

### 6. Required Git and cross-scope acceptance matrix is missing
- **File**: `skills/_shared/scripts/storage-publication.test.ts:22-117`.
- **Problem**: Criterion 3 and the phase Verification section explicitly require the full publication/recovery fixture matrix, not seven helper tests. Current publication tests do not exercise a real branch merge/FF, squash/rebase mapping, rename/delete/recreate Git operations, publication from detached/unborn identities, stale integration refs, overlapping real artifact revisions, code revert, actual post-seal edits through publication, or two-project/two-worktree default-tool retrieval of the resulting integration view. Existing identity tests (`workflow-state.test.ts:260-305`) cover rewritten/unborn scope isolation separately, and inherited anchor/ancestor/error helper checks exist; none establishes the missing seal→bind→merge→retrieve/recover behavior. PostgreSQL focused tests were skipped, not verified.
- **Proposed fix**: Add consumer-visible, real Git/storage fixtures covering every named case, including negative retrieval through fresh trusted contexts and recovery operations across all required adapters. Cover the defects above with failing-before/passing-after regressions. Do not replace the matrix with synthetic input objects or manually supplied published revision IDs.


- **Jev failure**: Jev failed: missing, unreadable, or oversized file skills/_shared/scripts/storage-publication.test.ts:22-117`.. Re-review this finding with Jev.

### 7. Required complexity guardrail fails on the new reconciler
- **File**: `skills/_shared/storage/publication.ts:120-152`.
- **Problem**: The authoritative durable-v2 `npm run guardrails:check` exits 1 on both initial and coherent-tree repeat runs: new `reconcilePublishedView` complexity is 11 against the maximum of 10. Unit and global coverage ratchet gates pass (87.9% versus 84%); lint/functional are disabled and patch coverage advisory. Required complexity failure independently blocks Phase 6 verification.
- **Proposed fix**: Refactor the reconciler into cohesive proof/mapping/conflict operations while fixing issues 2–4, then rerun the unchanged deterministic contract. Do not weaken enforcement, add a baseline exception, or lower thresholds.


- **Jev failure**: Jev failed: missing, unreadable, or oversized file skills/_shared/storage/publication.ts:120-152`.. Re-review this finding with Jev.

## Warnings

### 1. Shipped publication tests are stale
- **File**: `plugins/buck-workflow/skills/_shared/scripts/storage-publication.test.ts:6-61`; `scripts/sync-storage-bundle.mjs`.
- **Problem**: Canonical publication tests have seven cases; the plugin copy retains only the original three. `cmp` exits 1 at line 6. The publication source itself matches. The sync script also removes the existing `plan-source.test.ts` sync entry while adding publication tests, unrelated to the needed addition.
- **Suggested approach**: Preserve the existing sync inventory, add the new test entry, synchronize after the final implementation, and run canonical/bundle parity verification. This is an in-plan delivery defect, not a new feature request.


- **Jev failure**: Jev failed: missing, unreadable, or oversized file plugins/buck-workflow/skills/_shared/scripts/storage-publication.test.ts:6-61`; `scripts/sync-storage-bundle.mjs`.. Re-review this finding with Jev.

## Recommended Workflow

Start with `/b-iterate` against this phase. Re-run `/b-review` against the same phase after implementing and exercising the missing behavior. The completed phase/overview markers are not evidence of acceptance; reconcile phase status with verified results through the owning workflow, without choosing the supervisor's next state here.

Inside an OMP execution session, `/b-iterate` completes this artifact before it returns; the supervisor then re-reviews. Do not leave the file active waiting for review or save. For larger rework use `/b-build-hard` within the existing phase contract; no new feature scope is required.

## Applied repair

1. `sealWorkflowCheckpoint` and `bindWorkflowCheckpoint` now participate in real loop commit preparation/verified advancement. The commit projection retains the seal ID. Every adapter persists reconciled integration views/proofs via immutable revisions and CAS; configured ordinary retrieval derives publication IDs from that current view.
2. Binding freezes validated Git OIDs and proves the actual bound commit. A later unmerged binding cannot borrow the sealed base's ancestry.
3. Mapping selects one checkpoint and the full exact revision/hash set, validates trusted project and target reachability, and records non-patch-id evidence. Explicit revocation removes mapping visibility.
4. Logical artifact identity groups independent revisions. Conflicts retain their reachable baseline and all candidates; unrelated artifacts advance. Cross-branch supersession requires persisted artifact correction ancestry, never code ancestry alone. Durable resolutions bind the exact candidate set. Tombstone result IDs remain in correction metadata while deletion replay still returns null.
5. Recovery combines identity provenance and selected-adapter retained scopes, including detached/unborn workspaces. Explicit scopeToken export/rebind retains originals and refuses collisions. Workspace-private checkpoints remain ineligible even if their commits become integrated.
6. Real Git/store fixtures now exercise the production retrieval/recovery path on repo-files, external-files, SQLite and PostgreSQL 18. The matrix includes configured fresh-process/two-worktree retrieval; no publication IDs are injected into reader contexts.
7. Reconciliation and checkpoint parsing were refactored. The unchanged durable v2 contract passes required unit, coverage-ratchet and complexity gates: 89.4% coverage against 84%, no new/hard complexity violations. Lint/functional remain disabled and patch advisory by existing contract.

Warning resolved: restored the plan-source test sync entry, synchronized canonical/bundled implementation, tests and access documentation, and included publication.ts in installer shipped-storage inspection (19 files; none missing). Diff/cmp parity passes.

Evidence and decisions: `implementation-notes-phase-6.md`. Draft: `draft-commit.md`.

Verification: 125 publication/adapter tests passed across all four backends. Actual configured runtime smoke on each adapter preserved baseline plus two independent candidates despite code ancestry, then selected only the explicit resolution. Exact final durable verdict: guardrails-verdict.json. No baseline/enforcement changes; no save, commit or supervisor routing decision.
