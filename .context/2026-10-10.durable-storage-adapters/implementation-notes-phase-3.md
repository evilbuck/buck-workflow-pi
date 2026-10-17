---
date: 2026-10-12
domains: [storage, lifecycle]
topics: [phase-3, branch-overlay, visibility, receipts]
related: [phase-3-domain-semantics.md]
priority: high
status: active
subject: 2026-10-10.durable-storage-adapters
artifacts: [skills/_shared/storage/domain.ts, skills/_shared/storage/file-store.ts, skills/_shared/storage/sqlite-store.ts, skills/_shared/storage/postgres-store.ts, skills/_shared/storage/conformance.ts, migrations/004_domain_semantics.sql]
---

# Phase 3 implementation notes

## Selected course

Branch-scoped lifecycle, tombstones, receipt completion, and visibility-before-page live in the existing store adapters plus `skills/_shared/storage/domain.ts`. Filesystem lifecycle and discovery callers stay. Publication stays in Phase 6.

Minimal-change sequence: the phase required these semantics on every backend, so a local shared policy was enough. No new package. The domain module is the first option that avoids copying close/receipt rules into four adapters. Settled decisions were not reopened.

## Evidence

- `npx vitest run` of file, SQLite, PostgreSQL, in-memory SQLite conformance, and subject-lifecycle: 88 passed before the final overlay assertion; the overlay case then passed on all five backends (5 passed).
- PostgreSQL: disposable `pgvector/pgvector:pg18` at `127.0.0.1:56442`, `BUCK_WORKFLOW_TEST_DATABASE_URL=postgres://postgres:phase3-only@127.0.0.1:56442/storage_phase3`. No skip.
- `npm run guardrails:check`: status pass. Unit and complexity required gates pass. Coverage 88.4 >= 84. Patch advisory. Lint and functional skipped by contract.
- Acceptance Jev (`jev-1.13.0`): criteria 1–5 noul 0.81–0.86 on the first call; criterion 6 was 0.43 until the baseline-byte assertion, then 0.86. All six boxes checked. Phase `status` left `in-progress` for the supervisor stamp.

## Assumptions

| id | statement | status | blocking | evidence | validation_path |
|---|---|---|---|---|---|
| A-1 | Phase 4/5 still own caller cutover, so leaving filesystem lifecycle and buck-loop save paths in place does not violate this phase. | validated | false | Phase risk text and implementation details say old callers may keep working until Phase 4/5. | — |
| A-2 | Additive migration `004_domain_semantics.sql` is accepted by the existing checksummed migration gate. | validated | false | `extensions/sql-memory/migrations.test.ts` and `sql-gate.test.ts` passed (70 tests). PostgreSQL migrate() applied it during conformance. | — |

## Material risks

- **failure_mode:** a later caller still uses project-wide SQL recall. **impact:** private bodies can enter model context outside the store. **mitigation:** `lookupKnowledge` is the store read surface; the legacy SQL protocol is labeled as the old tool path, not the overlay surface. **rollback_or_fallback:** disable the leaking caller; do not fall back to project-wide recall. **validation_path:** Phase 4 cutover plus the private high-score pagination fixture already in conformance.
- **failure_mode:** repo-files tombstone projection wipes a shared editable file. **impact:** published projection bytes disappear. **mitigation:** tombstone sources are not projected. **rollback_or_fallback:** store read of a tombstone returns null; explicit revision read still returns history. **validation_path:** tombstone conformance on repo-files and external-files passed.

## Excluded scope

Phase 4/5 caller cutover, Phase 6 publication/reconcile, host LTM replacement, and deletion of filesystem lifecycle paths.

## Next action

Run `/b-review` against this phase file. The supervisor stamps `status: completed` only after that closeout path accepts the checked criteria.

## Phase 3 review iteration

- Assignment: `iterate-phase-3-domain-semantics.md`; all seven findings are within Phase 3. Supervisor recall was reused as untrusted reference evidence; current phase/iteration files governed scope.
- Lifecycle now persists canonical subject-index revisions, not independent state rows. File and store paths share text inspection and legal-intent authority, including legacy completed canonicalization, effective-state discovery, stale initial-index refusal, initialize/activate, and reason-required reopen.
- Exact published history is unioned with branch-current candidates before overlay/ranking/page. Bodies load by selected immutable revision. File direct edits reconcile only for the querying owner branch; a foreign published view never follows the editable projection.
- First inherited correction/tombstone uses an authorized visible predecessor and a conditional branch-local pointer write; correction replay/history remain intact.
- Receipt completion reads persisted exact revision bytes, verifies SHA-256 and project/branch/worktree/run scope, and refuses private facts belonging to another run or worktree.
- PostgreSQL writers/corrections/lifecycle transitions acquire sorted project+subject advisory transaction locks before selecting evidence; first initialization is serialized even without a row.
- Modified for this iteration: canonical and bundled `storage/{contract,domain,file-store,sqlite-store,postgres-store,visibility,conformance}.ts`; canonical and bundled `scripts/{subject-lifecycle,file-store.test,postgres-store.test}.ts`; `docs/context-artifacts.md`; iteration artifact and existing draft/notes. Other pre-existing work was not modified.
- Verification: focused file/SQLite/PostgreSQL/conformance/lifecycle suite passed 117 tests with no skips. Mutation runs produced 17 expected failures for immutable body/baseline/correction/receipt/pre-BEGIN evidence regressions, then 10 expected failures for stale lifecycle/discovery guards. All mutants were restored.
- Direct smoke: real repo-files/external-files roots, on-disk SQLite, and disposable PostgreSQL retained published bytes, isolated inherited corrections, refused stale lifecycle writes, resolved published close/private reopen, and refused wrong-run receipts.
- Canonical/bundled storage directories and changed lifecycle/test files compare byte-identical.

### Abandoned approaches

- Separate lifecycle rows: cannot carry the same versioned published-baseline authority as artifacts; replaced with canonical index revisions.
- Mutable pointer body loading and pointer-only published candidates: leak drafts or discard the retained baseline; replaced with exact immutable selection.
- One large text transition reducer: required complexity gate rejected it; split by legal intent without changing refusal rules or weakening the gate. Named page-item types also prevent the complexity parser from conflating unrelated methods.

Supervisor owns independent `/b-review`, save, phase/loop state, and commit.

Final durable v2 guardrails verdict: pass. Required unit/global-ratchet/complexity gates passed; coverage 90% versus 84% baseline; no new complexity violations. Lint and functional gates disabled/skipped; patch advisory and reported null by the runner. No baseline or enforcement edits. Iteration artifact is completed; phase and loop state remain supervisor-owned.

## Phase 3 re-review iteration

- Assignment: `iterate-phase-3-domain-semantics-rereview.md`, the two retained ranked findings only. Supervisor-provided SQL recall was reused as untrusted reference evidence. The stale `current-session.json` names another subject and was intentionally unchanged; no historical Markdown memory was rewritten.
- Receipt duties use the existing persisted list with explicit status-dependent semantics: attempted lists requirements, complete attests successfully executed duties. Every attempted duty must be attested before completion, including no-fact saves. Attempted rewrites cannot replace the required set. SQL attempted loaders now decode stored duty data instead of inheriting submitted completion data.
- Discovery reads the full authorized branch-overlay/published view for lifecycle authority, then applies subject/kind/name filters. This preserves canonical and legacy completed-subject/link exclusion despite result filters.
- Modified: canonical and bundled `storage/{contract,domain,postgres-store,sqlite-store,conformance}.ts`, `docs/context-artifacts.md`, this note, the active re-review iteration artifact, and the existing draft commit. No caller cutover, migration, publication design, phase status, or loop state changes.
- Focused regressions: five files, 127 tests passed, no skips. New cases cover row/no-fact missing duties, unchanged attempted receipts, required-set rewrite refusal, successful caller metadata work, filtered canonical backlog, filtered published legacy index, and filtered links to completed subjects.
- Mutation evidence: removing the attempt-duty completion guard and restoring filtered-only lifecycle lookup caused 15 expected failures across both file adapters, on-disk/in-memory SQLite, and PostgreSQL. Both mutants restored.
- Direct API smoke: all four real backends refused incomplete row/no-fact metadata, retained attempted receipts, accepted completion after metadata writes/readback, and excluded filtered legacy backlog/index/link targets. Temporary roots and on-disk SQLite were cleaned; PostgreSQL uses this assignment's isolated disposable container.
- Strict storage-only TypeScript check passed. Canonical/bundled storage parity passed. The first full guardrails run passed unit/coverage but identified `assertReceiptIdentity` complexity 11; extracting the required-set guard preserved behavior without weakening the contract.
- Independent phase re-review, save, commit, and loop state remain supervisor-owned.
- Final re-review-iteration durable guardrails: pass; required unit/global-ratchet/complexity pass, coverage 90.1% versus 84% baseline, no new complexity violations. Lint/functional disabled/skipped; advisory patch reported pass with null coverage. Contract/baseline unchanged. Active re-review artifact completed 2026-10-12.
