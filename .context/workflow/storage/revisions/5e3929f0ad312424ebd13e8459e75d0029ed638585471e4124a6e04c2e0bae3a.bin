---
status: completed
date: 2026-10-12
updated: 2026-10-12
subject: 2026-10-10.durable-storage-adapters
topics: [review, iteration, storage, lifecycle, receipts]
informs: []
addresses: phase-3-domain-semantics.md
completed: 2026-10-12
from_review: b-review
---

# Iteration: Phase 3 domain-semantics re-review

## Source
- Reviewed after: `/b-iterate`.
- Phase: `phase-3-domain-semantics.md`.
- Parent plan: `plan-durable-storage-adapters.md`, step 3.
- Report: `review-phase-3-domain-semantics-rereview-2026-10-12.md`.
- Baseline: HEAD `849ef5a63791a4ca3e2a131067481b862f16c179`; combined staged/unstaged implementation plus untracked migration `004_domain_semantics.sql`.
- Previous seven findings have current regression evidence of resolution. This artifact covers remaining defects, not reopening publication design or requiring Phase 4/5 caller cutover.

## Critical Issues

### 1. Receipt completion has no attempt-bound metadata-closeout requirement
- **File**: `skills/_shared/storage/domain.ts`
- **Problem**: `assertReceiptComplete` (lines 106–114, 164–181) binds identity/revision set and checks only the submitted `probe` or `readback` string. It never binds or verifies the other metadata duties. `RunReceipt.metadataDuties` at `contract.ts:75–85` has no required/completed distinction; PostgreSQL and SQLite's attempted-record loaders also omit stored duty data when validating completion (`postgres-store.ts:127–136`, `sqlite-store.ts:225–235`). The Phase 3 acceptance contract explicitly says persistence alone cannot complete a save before required metadata duties succeed. Real repo-files, external-files, SQLite on disk, and PostgreSQL all accepted an attempt listing `readback`, `backlog`, `phase-status`, and `draft-commit`, followed by a complete receipt containing only `readback`, with no corresponding metadata writes. Stored readback was `status: complete`, `metadataDuties: [readback]`. No domain operation currently expresses an enforceable requirement for those duties.
- **Proposed fix**: Represent the applicable required metadata duties in the persisted attempt and verified completion separately, or an equivalent attempt-bound verified completion attestation. Validate the complete required set before committing completion, including no-fact saves, and preserve it in all adapter attempted-record loaders. Keep exact identity/revision/hash readback checks; do not use persistence/readback as metadata-closeout proof. Add all-backend regressions for a missing required duty, unchanged attempted receipt on refusal, and completion only after the required duties actually succeed.
- **Classification**: In-plan, acceptance criterion 3 and parent plan step 3.

### 2. Discovery result filters remove lifecycle evidence before completed-subject exclusion
- **File**: `skills/_shared/storage/domain.ts`
- **Problem**: `discoverStoredContext` (lines 139–154) passes the caller's `kind`, `subjectId`, and logical-name filter into the only evidence lookup, removing only limit/cursor. It then derives lifecycle solely from those result bodies. On every real backend, an unfiltered query over published closed index + completed plan + backlog returns no backlog, while the same visibility query with `kind: backlog` returns the closed subject's backlog revision. The index has been filtered out, so `inspectStoredLifecycle` returns null and completion disappears. Filtered subject/link discovery can likewise omit evidence for legacy completion or linked target subjects. Completed-subject exclusion must not depend on a result filter including its authority.
- **Proposed fix**: Resolve lifecycle authority for returned subjects and linked target subjects from the same visibility context, independently of kind/name/result filters. Apply the requested result filtering only after authority-based exclusion. Preserve current-branch overlays and immutable published revision selection. Add shared filtered backlog, filtered legacy index, and filtered links-to-completed-subject cases on every backend.
- **Classification**: In-plan, acceptance criterion 4 and implementation detail 1.

## Warnings
None outside accepted phase scope. Documentation impact belongs to the report, not this iteration.

## Verification evidence
- Fresh database-backed `npm run guardrails:check`: durable v2 pass; required unit/global-ratchet/complexity pass; coverage 90% versus baseline 84%; patch advisory, reported pass with null coverage; disabled lint/functional skipped. Contract unchanged.
- Focused file/SQLite/PostgreSQL/in-memory-conformance/lifecycle suite: five files, 117 tests passed, no skips.
- Strict storage-library TypeScript check: exit 0 (`--ignoreConfig --noEmit --strict --target ESNext --module NodeNext --moduleResolution NodeNext --skipLibCheck --types node skills/_shared/storage/*.ts`). Not a whole-repository typecheck claim.
- Independent direct API smoke on four real backends reproduced all three defects. It also asserted exact retained published bytes after private advancement, inherited correction/replay isolation, stale lifecycle refusal, published closed exclusion without result filters, private reopen isolation, reasonless reopen refusal, and wrong-run receipt refusal.
- High-rank pagination smoke: an invisible candidate matching three query terms did not displace either visible candidate matching one term, across two limit-1 pages on every backend.
- Canonical/bundled storage, lifecycle, context-helper, and recall protocol copies compare identical.
- Smoke used temporary roots/on-disk SQLite and isolated disposable PostgreSQL; it did not change implementation or pre-existing artifacts. Review report and this iteration are the only durable files created by this assignment.

## Recommended Workflow
Start with `/b-iterate` for these defects, then re-run `/b-review` against `phase-3-domain-semantics.md`. Complete this artifact after iteration work is verified, before returning to the supervisor. The supervisor owns phase/loop state, documentation closeout, save, and commit; this review selects no next loop state.

## Resolution and current verification

- Both retained ranked findings are resolved. `metadataDuties` is attempt-bound: attempted receipts declare requirements; complete receipts attest successfully executed operations. Completion refuses any missing required duty on row and no-fact saves; attempted rewrites cannot alter the required set. PostgreSQL and SQLite load the persisted duties during completion validation.
- Discovery evaluates lifecycle authority from the full authorized branch-overlay/published view before applying subject, kind, or logical-name result filters. Filtered canonical backlog, published legacy indexes, and links to completed subjects remain excluded.
- Shared adapter regressions: 127 tests passed across five files, no skips. Removing both fixes produced 15 expected mutation failures across five backend fixtures; mutants restored.
- Direct API smoke on repo-files, external-files, on-disk SQLite, and isolated PostgreSQL verified incomplete-duty refusal, unchanged attempts, completion after successful metadata writes/readback, and filtered completed-subject/link exclusion.
- Final durable v2 guardrails: pass; required unit, global-ratchet, and complexity pass; coverage 90.1% versus 84% baseline; no new complexity violations. Lint/functional disabled and skipped; patch advisory reported pass with null coverage. No contract or baseline edits.
- Strict storage-library TypeScript check passed; canonical/bundled storage copies compare identical. Temporary smoke script and database fixture removed after verification.
- Updated storage contract/domain/SQL adapters/conformance, bundled copies, living documentation, implementation notes, and the existing draft commit. Phase/loop state unchanged. Supervisor owns independent `/b-review` against `phase-3-domain-semantics.md`, documentation closeout if flagged, `/b-save`, and `/b-commit`.
