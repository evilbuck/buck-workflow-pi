---
status: completed
date: 2026-10-12
subject: 2026-10-10.durable-storage-adapters
topics: [code-review, storage-adapters, concurrency, migrations]
review_verdict: request-changes
addresses: phase-2-four-adapters.md
---

# Plan Path Review: Phase 2 — Four Storage Adapters

## Plan Source
- File: `.context/2026-10-10.durable-storage-adapters/phase-2-four-adapters.md`.
- Goal: implement repository files, external files, SQLite, and PostgreSQL with the settled persistence/visibility contract, immutable revisions, atomic generation/recovery, and binary payloads.
- User goal: choose durable storage per project and keep unmerged work invisible on unrelated branches. This phase is the backend layer, not final consumer cutover.
- Baseline: `065b776` (Phase 1 contract/identity commit) plus the complete working-tree implementation, including both staged and unstaged changes. Phase completion fields/checkmarks were not treated as proof.
- Scope: Phase 2 only. Parent plan step 2, relevant A-4 evidence, and recovery/migration risks inspected. Domain semantics, publication ancestry, caller cutover, migration orchestration, and final documentation/packaging remain later phases.

## Evidence Sources
- Entry Git status: 26 changed/untracked paths, with mixed staged/unstaged implementation. Existing `.context/memory` and parent-plan/phase metadata changes were not reviewer-authored.
- Relevant commit: `065b776 feat(storage): add adapter contract and identity boundary`; no separate Phase 2 commit yet.
- Modified implementation groups inspected: `skills/_shared/storage/{file-store,sqlite-store,postgres-store,adapter-utils,conformance,config}.ts`; `skills/_shared/scripts/{file-store,sqlite-store,postgres-store}.test.ts`; `extensions/sql-memory/{sql-gate,migrations.test}.ts`; `migrations/002_durable_storage.sql`; corresponding physical bundled storage copies.
- Plan affected groups verified: `skills/_shared/storage/`, `extensions/sql-memory/`, `migrations/`.
- `diff -rq skills/_shared/storage plugins/buck-workflow/skills/_shared/storage`: exit 0, no output.
- Existing workflow session file refers to an unrelated older subject and has no active `goal` field. Explicit phase path took precedence; no goal-mode-only budget check applies.
- Historical memory index records Phase 1, not this review/Phase 2 closeout. SQL recall was supplied by the supervisor and was not queried again. Save remains supervisor-owned.

## Completion Matrix

| Deliverable | Status | Current-state evidence / missing piece |
|---|---|---|
| 1. Repository layout, immutable revisions, direct-edit reconciliation, Git-portable bodies | 🔄 partial | `file-store.ts:59-95,214-234,434-437` and focused file tests prove exact revisions/native bodies/direct edits. Atomic generation refusal and overlapping-operation safety fail (R1, R2). |
| 2. External root, branch/worktree/run namespaces, same generation atomicity | 🔄 partial | `file-store.ts:263-269,440-453`; real external-root conformance and worktree projection test pass. Shared file-store commit/locking failures remain (R1, R2). |
| 3. SQLite, lazy confined driver, SQL/FKs/transactions/busy policy/consistent backup; A-4 gate | ✅ complete | `sqlite-store.ts:9-53,78-95`; 7 on-disk SQLite tests pass, including lock contention, reopen, and backup snapshot. Fresh `npm run test:sqlite-runtime` passes under Node v26.8.1 and Bun's node-compatible v26.3.0. Phase 1 recorded actual OMP/Node 22/unsupported Node 18 evidence at `phase-1-contract-config-identity.md:64-73`; no new OMP/Node 22/Node 18 run claimed. Type-only SQLite import and `loadSQLiteModule` preserve lazy loading. |
| 4. PostgreSQL transaction discipline, additive checksummed schema groups, preserved memory metadata | 🔄 partial | `postgres-store.ts:43-87,152-175`, real PostgreSQL tests, and original-bootstrap checksum test pass. Branch-record schema group absent (R4); broadened migration policy admits computed defaults without acknowledgment (R3). |
| 5. Full shared conformance on all four real backends, exact binary/hash revisions, stale rejection, atomic generation/recovery | 🔄 partial | Fresh 47/47 focused tests pass with actual PostgreSQL enabled, temp repo/external roots and disk SQLite. Additional runtime smokes expose same-instance concurrency and rejected-but-committed generation failures not covered by those tests (R1, R2). Passing suite therefore does not prove this criterion. |
| 6. No adapter stubs/backend-specific visibility divergence/fake score parity | ✅ complete within phase scope | All four backends exercise real read/write/list/correct/transition via shared conformance. File/SQLite/PG search use deterministic term matching, not purported PostgreSQL full-text score equivalence. `reconcile()` contains no publication implementation on any adapter; Phase 2 explicitly excludes publication ancestry and Phase 6 owns it, so this is not a missing Phase 2 publication implementation. |
| Blocking assumption A-4 | ✅ complete | Parent ledger records validated/nonblocking; Phase 1 runtime evidence remains present, lazy loading retained, current Node/Bun transaction probes pass. |
| Material recovery claim: prior committed snapshot survives failed/interrupted generation | 🔄 partial | Existing stale-batch/interrupted-generation fixtures pass, but unsafe projection failure commits a new historical revision (R2), and lock bypass permits concurrent temporary-file/pointer races (R1). The broad rollback claim is unsupported for these exercised paths. |
| Deterministic verification | ✅ complete | Durable guardrails v2 status pass; required unit, global ratchet, complexity gates pass. Does not override behavioral failures above. |

## Review Axes

### Spec / acceptance-contract axis
- **Worst finding: R1 [P1, in-plan] — asynchronous operations on one file-store instance bypass its lock.** `file-store.ts:378-381` interprets any positive lock depth as recursion without caller ownership. A live 100-record batch overlapped with an independent one-record batch: the first fulfilled; the second rejected on `.projections.tmp` rename; the second artifact was absent. This violates both file adapters' concurrency/atomic-generation acceptance. Fix: serialize same-instance operations and make internal lock ownership explicit.
- **R2 [P1, in-plan] — a refused projection has already advanced the manifest.** `file-store.ts:284-289` commits before `#projectIds` validates/writes paths. Runtime `writeBatch` for `../escape.md` rejected, but exact read returned the submitted revision. Fix: preflight paths/identities and make post-pointer projection recovery explicit.
- **R4 [P2, in-plan] — required PostgreSQL branch records missing.** `002_durable_storage.sql:1-76` has branch-ID columns but no branch identity/incarnation/ref/lineage table. Database table inventory confirms the absence. Fix: add the named schema group through an additive numbered migration.
- Axis input: **Needs work**.

### Standards axis — separate sequential fallback pass
No background sub-agent tool was available. This was a distinct second pass, seeded with the TypeScript async/error/module guide and universal quality guide (TOCTOU, broad operations, reuse), plus only Duplicate Code, Primitive Obsession, and Long Method definitions. No full-catalog audit or independent-agent result is claimed.
- **Worst finding: R3 [P1, in-plan] — migration allowlist changed from positive grammar to permissive token denial.** `sql-gate.ts:341-368` admits arbitrary function calls in default expressions. In a disposable PostgreSQL database, the gate accepted `CREATE TABLE IF NOT EXISTS review_expression (id int DEFAULT review_erase());` without acknowledgment. The pre-existing function deletes victim rows; insertion using the default emptied that table. The migration need not contain a denied DELETE/function-definition token. Existing code explicitly requires computed/unparsed forms to be acknowledged. Fix: a narrow positive grammar for required literal defaults/FKs/composite keys/checks; unknown functions stay acknowledgment-gated.
- **R1** independently violates the standards pass's async mutation/TOCTOU requirements; same issue ID, not a fifth issue.
- Purposeful dialect-specific SQL and physical package mirrors were not flagged as duplicate-code defects. No unsupported structural/style smell was elevated into a correctness issue.
- Axis input: **Needs work**.
- Cross-axis ranking: **none**. Worst finding reported independently per axis.

## Exercised Behavioral Evidence

Commands:
- `npm run guardrails:check` — exit 0.
- `env BUCK_WORKFLOW_TEST_DATABASE_URL=postgres://postgres:review-only@127.0.0.1:56439/storage_review npx vitest run skills/_shared/scripts/file-store.test.ts skills/_shared/scripts/sqlite-store.test.ts skills/_shared/scripts/postgres-store.test.ts extensions/sql-memory/migrations.test.ts` — **4 files, 47 tests passed**, no PostgreSQL skip.
- `npm run test:sqlite-runtime` — Node/Bun transactional smokes passed.
- Two temporary scripts exercised actual adapter implementations under Bun with actual disk files/SQLite/pg. Scripts and private Docker database are disposable verification resources, not permanent tests.

Relevant runtime output (random revision IDs omitted where identity is irrelevant):
```text
overlapping same-instance writes:
  first = fulfilled (100 artifacts)
  second = rejected: ENOENT renaming .projections.tmp to projections.json
  first artifact stored; second artifact absent
failed unsafe projection commits pointer:
  writeBatch error = unsafe editable artifact path
  exactRevision = e41c3f19-ebf6-4449-bac1-8fcf6a2a03ac
migration gate admits arbitrary default function:
  destructive = false
  victimRows = []
PostgreSQL artifact tables:
  attachments, checkpoints, import_provenance, lifecycle,
  pointers, publications, revisions, runs (no branches)
```

Verification boundaries:
- No CLI/tool/caller surface was added in this phase; adapter runtime smoke is the changed surface. No browser or final end-to-end OMP workflow claim.
- The initial direct Node strip-types smoke could not resolve the adapters' `.js` specifiers to `.ts` source; it did not exercise behavior. Bun then ran both smoke scripts successfully. This source-runner observation is not a Phase 2 defect; supported CLI/package access is later scope.
- Historical published-v1 lookup after private v2 returned an empty list on **all four** backends while exact v1 read remained available. This is a current source-state limitation, not a Phase 2 blocker: `phase-3-domain-semantics.md:23-25,42-43` explicitly assigns published-baseline copy-on-write lookup to Phase 3; publication proof remains Phase 6. Those later acceptance criteria must not be prematurely marked complete.
- SQLite file mode was 0644 inside a private temporary parent; that alone does not prove disclosure. No security defect is inferred from mode without reachable parent permissions.
- External delimiter-collision inputs were also exercised; trusted Phase 1 identity validation is the normal input boundary. No separate namespace issue is asserted from invalid identity inputs alone.

## Verification Status
- Goal achieved: **partial** — real four-backend implementations exist, but atomic generation/concurrency and PostgreSQL schema/migration safety are incomplete.
- User goal: **partially met at backend-layer scope**. Final configuration/caller/ordinary retrieval workflow intentionally belongs to later phases.
- Scope adhered: backend/config-default changes and mirrored copies are related to Phase 2. No unrelated implementation change identified; unrelated pre-existing metadata edits were excluded from reviewer staging.
- Out-of-scope changes by reviewer: none; review/iteration artifacts only.

## Guardrails Verdict
- Contract: **durable**, version **2**, runner **1.0.0**.
- Status: **pass**.
- Gates: `unit_test_gate=pass`, `functional_test_gate=skipped`, `lint_gate=skipped`, `patch_gate=advisory`, `global_ratchet=pass`, `complexity_gate=pass`.
- Coverage: **88%**, baseline **84%**; patch coverage null/advisory (threshold 90%). Complexity: 30 baseline hotspots, no new/hard-ceiling violations.
- Functional/lint disabled by existing contract; reported, not changed. No baseline/enforcement edits made.

## User Goal Analysis
- Goal: users choose where durable state lives, resume across sessions/worktrees, keep unmerged work out of unrelated branches.
- Met: four actual backends, immutable binary/text revisions, tested current-branch filtering and basic correction isolation.
- Partial: file-backed atomic generations and safe PostgreSQL migration/schema completeness (R1–R4).
- Missing from this phase: none beyond named defects; final user-facing cutover/publication/resume workflows remain explicitly later scope, not additional Phase 2 demands.
- Verdict: **partially met within the assigned backend scope**.

## Documentation Impact
- New adapter module boundaries, storage recovery semantics, and generated-state constraints will need living documentation. Parent Phase 8 already owns final docs/packaging; Phase 2 explicitly excludes living docs.
- Non-blocking recommendation: `/b-docs` when documenting accepted adapter semantics; do not put documentation work into this iteration or let it mask R1–R4.

## How-to Impact
- No new user-facing CLI/action in this phase. No immediate how-to impact. Configuration/backup/recovery procedures remain scheduled in later phases.

## Issue Classification
- In-plan implementation defects: **4** — R1 same-instance locking; R2 failed-generation pointer advancement; R3 migration acknowledgment bypass; R4 missing branch schema.
- Out-of-plan new scope discoveries: **none**. Already scheduled later-phase semantics are verification boundaries, not newly invented work.
- Iteration artifact: `iterate-phase-2-four-adapters.md` contains only R1–R4.

## Completion Audit
1. Objective: four real durable adapters with atomic/recoverable revision storage and named PostgreSQL schema groups.
2. Evidence: each criterion mapped above to source/current runs, not metadata or historical checkmarks.
3. Current state: source read; deterministic contract freshly passed; additional runtime failures observed.
4. Claim scope: actual adapters/files/databases exercised; no unrun UI/caller integration asserted.
5. Uncertainty: later-phase behavior explicitly excluded; atomicity/schema criteria remain partial rather than complete.
6. Review completed: both independent axes finished using sequential fallback. No truncated review or invented agent verdict.

## Verdict
**Needs work** — four in-plan defects. Passing guardrails/conformance does not override the reproduced failures or missing required schema group.

## Recommended Next Step
`/b-iterate` against `iterate-phase-2-four-adapters.md`, then re-review this exact phase. Supervisor owns loop routing, phase status, save, and commit. No next loop state was selected by the reviewer.
