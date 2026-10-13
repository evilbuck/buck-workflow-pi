---
status: completed
date: 2026-10-12
updated: 2026-10-12
subject: 2026-10-10.durable-storage-adapters
topics: [review, iteration, storage-adapters, atomicity, migrations]
informs: []
addresses: phase-2-four-adapters.md
completed: 2026-10-12
from_review: b-review
---

# Iteration: Phase 2 four storage adapters

## Source
- Reviewed after: `/b-build-hard`
- Phase: `phase-2-four-adapters.md`
- Plan: `plan-durable-storage-adapters.md`, step 2 only.
- Review: `review-phase-2-four-adapters-2026-10-12.md`.
- Baseline: `065b776` plus the staged/unstaged implementation present at review entry. No implementation files were changed by the reviewer.

## Critical Issues

### 1. R1 — Same-instance file operations bypass mutual exclusion
- **File**: `skills/_shared/storage/file-store.ts:372-426` (also bundled copy).
- **Problem**: `#lockDepth > 0` treats every overlapping asynchronous operation on one store instance as a recursive lock holder. There is no operation ownership. `#mutate`, `#touched`, `manifest.next`, `.projections.tmp`, and lock release consequently race. Runtime reproduction starts a 100-artifact batch, observes `.lock` creation, then starts an independent one-artifact batch on the same instance while the first is active. The first batch fulfilled; the second failed with `ENOENT` renaming `.projections.tmp`; its artifact was absent after readback. Independent writes should both succeed, not collide in temporary commit files. This is not merely the expected stale-writer rejection.
- **Proposed fix**: Serialize public mutations/recovery on each instance as well as across instances/processes. Remove the unowned recursive-depth bypass; keep internally locked helpers explicit so nested calls do not deadlock. Preserve independent manifest loads, touched IDs, and lock ownership through publication. Add behavior regressions for overlapping disjoint writes and overlapping stale writes; synchronize the bundled copy.


- **Jev failure**: Jev failed: missing, unreadable, or oversized file skills/_shared/storage/file-store.ts:372-426` (also bundled copy).. Re-review this finding with Jev.

### 2. R2 — Failed file projection leaves a committed revision
- **File**: `skills/_shared/storage/file-store.ts:214-234,263-268,271-307` (also bundled copy).
- **Problem**: Revision validation does not validate editable paths. `#publish` renames the manifest before `#projectIds` validates/writes each projection. A valid-hash revision with logical name `../escape.md` causes `writeBatch` to throw `unsafe editable artifact path`, but exact `read(key, revision)` returns that newly committed revision. The failed generation changed authoritative state. Ordinary I/O failures in projection have the same post-commit boundary risk; overlapping operations also hit this boundary in R1.
- **Proposed fix**: Validate all artifact and namespace identities and projection destinations before advancing the manifest. Define a recoverable post-pointer projection path whose failures do not masquerade as a rolled-back batch; persist enough state to distinguish committed-but-unprojected content from direct user edits. Add a behavior test that a refused unsafe batch leaves both current and historical lookups unchanged, plus a post-manifest interruption/recovery fixture. Do not weaken validation or return fake success.


- **Jev failure**: Jev failed: missing, unreadable, or oversized file skills/_shared/storage/file-store.ts:214-234,263-268,271-307` (also bundled copy).. Re-review this finding with Jev.

### 3. R3 — Expanded migration grammar admits unacknowledged computed expressions
- **File**: `extensions/sql-memory/sql-gate.ts:319-368`.
- **Problem**: `isAdditiveCreateTable` checks only the header, balanced parentheses, and a small denied-token list. It accepts arbitrary function calls in DEFAULT/CHECK/type expressions despite the existing policy that computed/unparsed SQL requires exact-file acknowledgment. Disposable PostgreSQL reproduction: define `review_erase()` as a PL/pgSQL function deleting rows from `review_victim`; `containsDestructiveMigration('CREATE TABLE IF NOT EXISTS review_expression (id int DEFAULT review_erase());')` returns `false`. The table is created without acknowledgment; `INSERT ... DEFAULT VALUES` invokes the function and empties the victim table. The prior gate rejected this form. No function definition or DELETE token has to appear in the submitted migration.
- **Proposed fix**: Extend the positive additive grammar only for the literal defaults, type casts, FK/composite-key/check forms required by the reviewed schema. Unknown functions/computed expressions and unparsed forms must still require exact-file acknowledgment. Add a behavioral migration-policy regression showing the arbitrary default is refused without acknowledgment while the real numbered migration remains accepted. Keep the bootstrap checksum unchanged.


- **Jev failure**: Jev failed: missing, unreadable, or oversized file extensions/sql-memory/sql-gate.ts:319-368`.. Re-review this finding with Jev.

### 4. R4 — PostgreSQL branch persistence schema is missing
- **File**: `migrations/002_durable_storage.sql:1-76`.
- **Problem**: Phase 2 criterion 4 explicitly requires schema for revisions/pointers/**branches**/checkpoints/publications/runs/receipts/attachments/import provenance. The applied database has artifact_attachments, artifact_checkpoints, artifact_import_provenance, artifact_lifecycle, artifact_pointers, artifact_publications, artifact_revisions, and artifact_runs, but no branch-record table. `branch_id` columns are references by value, not persistent branch incarnation/ref/lineage records. This leaves that named schema group missing before later domain/publication consumers are built.
- **Proposed fix**: Add the required project-scoped branch identity/incarnation records using a new numbered migration; do not change a migration that may already have been applied. Use the Phase 1 identity contract and parent plan identity design. Prove two project/branch incarnations can be persisted independently and retain the branch/ref/lineage evidence later consumers require. Synchronize any affected adapter/bundle sources. Do not pull Phase 6 publication policy into this fix.


- **Jev failure**: Jev failed: missing, unreadable, or oversized file migrations/002_durable_storage.sql:1-76`.. Re-review this finding with Jev.

## Warnings

None requiring Phase 2 iteration beyond R1–R4. Later-phase visibility/domain/publication/cutover behavior remains excluded; see the review report for verification boundaries.

## Recommended Workflow

Start with `/b-iterate` on this artifact, then re-run `/b-review` against `phase-2-four-adapters.md`. Complete this iteration artifact when its fixes and verification are finished; do not leave it active merely awaiting review/save. Supervisor owns subsequent loop state and closeout. Do not stage the pre-existing implementation changes on the reviewer's behalf.

## Applied Fixes and Verification

- R1–R4 repaired; details and file inventory: `research-phase-2-iteration-verification.md`.
- Final focused real-backend suite: 114 tests passed. Unit contract: 1869 passed, 8 skipped. Final full guardrails: pass; coverage 89 >= 84; no new complexity violations; lint/functional disabled and patch advisory.
- Separate actual-adapter smoke proves overlapping writes, unsafe-batch refusal, committed projection recovery, computed-default migration refusal, and branch schema/repeated migration behavior.
- **Assignment staging failure:** isolated source hunks cannot apply to the older index without staging pre-existing unstaged Phase 2 build machinery, which this assignment forbids. Source repairs remain in the working tree. Independently stageable assignment artifacts/new migration/policy regression are staged; the owner must stage the prerequisite build baseline or authorize complete affected-file staging. No loop state selected.
- Implementation iteration is completed, not awaiting implementation work. Supervisor owns subsequent review against this same phase, save, and commit; this artifact does not waive the staging failure.
