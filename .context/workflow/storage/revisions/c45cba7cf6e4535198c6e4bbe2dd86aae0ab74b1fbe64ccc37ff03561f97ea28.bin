---
status: completed
date: 2026-10-12
subject: 2026-10-10.durable-storage-adapters
topics: [code-review, storage-adapters, rereview]
review_verdict: pass-with-warnings
addresses: phase-2-four-adapters.md
---

# Plan Path Review: Phase 2 — Four Storage Adapters (re-review)

## Plan Source
- File: `.context/2026-10-10.durable-storage-adapters/phase-2-four-adapters.md`
- Goal: four real adapters with identical storage/visibility behavior, immutable revisions, atomic generation/recovery, and binary payloads.
- User goal: choose durable storage per project and keep unmerged work invisible on unrelated branches. This phase is the backend layer only.
- Baseline: `065b776` plus the working tree after the completed iteration in `iterate-phase-2-four-adapters.md`. Phase checkboxes and `status: completed` were not treated as proof.
- Scope: Phase 2 only. A-4 and the phase's material recovery claim were checked. Publication, consumer cutover, and living docs stay in later phases.

## Evidence Sources
- Prior review `review-phase-2-four-adapters-2026-10-12.md` found R1–R4. This pass re-checked those repairs in current source and tests.
- Working-tree implementation: `skills/_shared/storage/{file-store,sqlite-store,postgres-store,adapter-utils,conformance,config}.ts`; `skills/_shared/scripts/{file-store,sqlite-store,postgres-store}.test.ts`; `extensions/sql-memory/{sql-gate,migrations}.ts`; `migrations/002_durable_storage.sql`; `migrations/003_artifact_branches.sql`; matching bundled copies.
- `diff -rq` of canonical storage, file tests, SQLite tests, and PostgreSQL tests against `plugins/buck-workflow/skills/_shared/`: exit 0.
- `migrations/001_initial_schema.sql` is unchanged. No `MAX(seq)+1` in `migrations/`, `extensions/sql-memory/`, or `skills/_shared/storage/`.
- `.context/workflow/current-session.json` has no active goal. Explicit phase path took precedence.
- SQL memory was not queried. Supplied recall was reference only.

## Completion Matrix

| Deliverable | Status | Current-state evidence |
|---|---|---|
| 1. Repo-files layout, immutable revisions, direct-edit reconciliation, atomic generation | ✅ complete | `file-store.ts:50,224-229,303-317,415-425`. Focused file tests passed, including overlapping disjoint writes, stale overlap, unsafe-batch refusal, interrupted `manifest.next` recovery, and direct-edit reconciliation before read and seal. |
| 2. External root, branch/worktree/run namespaces, same generation atomicity | ✅ complete | `file-store.ts:488-494` and `config.ts` use `${XDG_CONFIG_HOME:-~/.config}`. External conformance and the worktree/hashed-segment test passed. Generation path is the same file store. |
| 3. SQLite, lazy driver, SQL/FKs/transactions/busy policy/backup; A-4 | ✅ complete | `sqlite-store.ts:4-7,38-52,78-94`. On-disk reopen, `VACUUM INTO` snapshot, and lock-contention tests passed. `npm run test:sqlite-runtime` passed on Node v26.8.1 and Bun v26.3.0. Phase 1 remains the record for OMP, Node 22, and Node 18 refusal. File and PostgreSQL stores do not import `node:sqlite`. |
| 4. PostgreSQL transactions, additive checksummed schema, memory import mapping | ✅ complete | `postgres-store.ts:43-64,152-168,209-223`. Live database applied `001`, `002`, and `003` and has `artifact_branches` plus the other named groups. Branch incarnation/lineage test, memory id/category/rank/`supersededBy` import test, and pre-commit rollback test passed. Bootstrap checksum assertion passed. |
| 5. Shared conformance on four real backends, binary/hash revisions, stale rejection, generation recovery | ✅ complete | Focused run with `BUCK_WORKFLOW_TEST_DATABASE_URL` against disposable PostgreSQL 18 + pgvector: 4 files, 58 tests passed, no PostgreSQL skip. |
| 6. No stubs, no visibility divergence, no fake score parity | ✅ complete within phase scope | All four backends run the same conformance cases through real reads/writes. Search is the same term count on every backend. `reconcile()` is empty on every adapter; Phase 6 owns publication. |
| Blocking assumption A-4 | ✅ complete | Parent ledger: validated, non-blocking. Lazy load retained. Current Node/Bun smoke passed. No new OMP/Node 22/Node 18 run claimed. |
| Material recovery claim | ✅ complete | Interrupted-generation test restores the prior pointer and projection. Stale file, SQLite, and PostgreSQL writers leave the prior revision current and do not insert the rejected revision. Post-pointer projection failure is the accepted forward-recovery path and its test passed. |

## Review Axes

### Spec / acceptance-contract axis
- Prior R1–R4 are fixed in the working tree and covered by passing behavior tests.
- R1: `#queue` serializes same-instance operations; internal `#mutateLocked` does not re-enter the queue. Overlapping 100+1 writes both read back.
- R2: identities and editable destinations are validated before manifest rename. Unsafe batches leave current and historical lookups unchanged. A post-rename projection failure reports the committed generation and the next read restores that exact revision.
- R3: `containsDestructiveMigration` admits only the positive table grammar. `review_erase()`, arbitrary checks, and `DEFAULT 1 + 2` are refused before a transaction opens. Real `002` and `003` applied.
- R4: `003_artifact_branches.sql` stores project-scoped branch id, incarnation, ref, tips, and same-project parent lineage. Cross-project parent insert is refused by the live foreign key.
- Spec axis worst finding: **none**. Axis input: **Pass**.

### Standards axis — sequential fallback pass
No background sub-agent tool was available. Second pass only, seeded with the TypeScript async/race guide, the universal quality guide's TOCTOU and broad-operation rules, and the diff-scoped smells Duplicate Code, Primitive Obsession, and Long Method. Not a full-catalog audit.
- The previous async lock bypass and permissive migration grammar are gone. File lock acquisition uses `open(..., "wx")` plus `EEXIST` handling. Multi-step file and SQL mutations run inside the queue or a transaction.
- Dialect-specific SQL and required bundle mirrors are not duplicate-code defects. String revision ids are the Phase 1 contract, not a new primitive-obsession defect.
- Observation, not a defect: list/search load a project's current rows and then apply `visible()` in process (`sqlite-store.ts:61-65`, `postgres-store.ts:26-30`). Returned sets match the shared limit test. Filter-before-model remains later-phase scope.
- Standards axis worst finding: **none**. Axis input: **Pass**.
- Cross-axis ranking: **none**.

## Verification Status
- Goal achieved: **yes** for this phase's backend contract.
- User goal: **partially met**. Backend choice and current-branch filtering exist. Ordinary user workflows, publication, and cutover remain later phases.
- Scope adhered: **yes**. Config default, migrations, and bundle mirrors belong to this phase. No unrelated implementation change was made by this review.
- Out-of-scope changes by reviewer: the review report only.

## Guardrails Verdict
- Contract: **durable**, version **2**, runner **1.0.0**.
- Status: **pass**.
- Gates: `unit_test_gate=pass`, `functional_test_gate=skipped`, `lint_gate=skipped`, `patch_gate=advisory`, `global_ratchet=pass`, `complexity_gate=pass`.
- Coverage: **88.1%**, baseline **84%**. Patch coverage null/advisory. Complexity baseline 30, no new or hard-ceiling violations.
- Functional and lint gates are disabled by the existing contract. Reported, not changed. Baseline was not rewritten.

## User Goal Analysis
- Goal: users choose where durable state lives, resume across sessions and worktrees, and keep unmerged work out of unrelated branches.
- Met in this phase: four real backends, immutable text/binary revisions, current-branch filtering, and tested correction isolation.
- Partial: final configuration, caller cutover, and publication workflows are later phases, not missing Phase 2 work.
- Missing from this phase: none.
- Verdict: **met for the assigned backend scope; inherited user goal remains partial until later phases**.

## Documentation Impact
- No Phase 2 documentation impact. Phase 2 excludes living docs. Adapter recovery and schema documentation belong to Phase 8.
- Recommended: none before `/b-save`.

## How-to Impact
- No new user-facing action. No how-to impact.
- Recommended: none.

## Issue Classification
- In-plan issues: **none**. R1–R4 from the prior review are closed by current-state evidence.
- Out-of-plan issues: **none**. In-process visibility filtering and empty `reconcile()` remain scheduled later work, not new scope.

## Closeout warning
The reviewed implementation is the working tree, not the git index. `git show :skills/_shared/storage/file-store.ts` has no `#queue`, projection journal, or committed-generation recovery. `plugins/buck-workflow/skills/_shared/storage/postgres-store.ts` and its test are untracked, though byte-identical to canonical copies on disk. A commit of the current index alone would drop the reviewed repairs. `/b-commit` must stage the working-tree phase paths and the matching plugin copies. This review did not stage those pre-existing files.

## Completion Audit
1. Objective: four real adapters, recoverable revisions, and the named PostgreSQL schema groups.
2. Evidence: each criterion maps to current source and a fresh run, not checkboxes.
3. Current state: source read; focused suite passed on temp file roots, on-disk SQLite, and disposable PostgreSQL; guardrails passed.
4. Claim scope matches what ran. No UI or caller-workflow claim.
5. No acceptance criterion left uncertain. Node 18, Node 22, and OMP were not rerun; Phase 1 evidence still covers them.
6. Both axes finished. Review was not truncated.

## Verdict
**Pass with warnings** — no in-plan implementation defect. The warning is commit staging only.

## Recommended Next Step
`/b-save` → `/b-commit`, staging the working-tree phase files and matching plugin copies rather than the stale index blobs. No `/b-iterate`. No `/b-docs` or `/b-howto` before save. No next loop state was selected.
