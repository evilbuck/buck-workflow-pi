---
status: completed
phase: 2
order: 2
plan: plan-durable-storage-adapters.md
phases_overview: plan-durable-storage-adapters-phases.md
difficulty: hard
model_hint: strongest reasoning model available
buck_hint: /b-build-hard
goal: "Implement all four storage adapters (repo-files, external-files, sqlite, postgres) with identical storage/visibility behavior, immutable revisions, and binary payload support."
files:
  - skills/_shared/storage/
  - extensions/sql-memory/
  - migrations/
from_plan_steps: [2]
depends_on: [1]
dependency_type: HARD
acceptance_criteria:
  - "[x] repo-files adapter: keeps existing .context body layout and Git portability; immutable sealed revisions + manifest pointers; direct file edits reconciled into new private revisions before retrieval/sealing."
  - "[x] external-files adapter: root defaults to ~/.config/buck-workflow/{escaped-or-hashed-project}/.context/; branch/run namespacing so worktrees cannot overwrite each other; same generation atomicity as repo-files."
  - "[x] SQLite adapter: confined node:sqlite, parameterized SQL, transactions, FKs, busy/concurrency policy, consistent backup/export snapshot; HARD-gated on Phase 1 A-4 pass; unsupported runtime errors clearly; driver not eagerly imported by other adapters."
  - "[x] PostgreSQL adapter: pg pool/transaction discipline, additive checksummed migrations (no changed prior checksums, no MAX(seq)+1), schema for revisions/pointers/branches/checkpoints/publications/runs/receipts/attachments/import provenance; existing memory IDs/categories/ranks/correction history preserved via import mapping."
  - "[x] All adapters pass the full Phase 1 conformance suite against real file roots, on-disk SQLite, and a disposable PostgreSQL instance — including binary payloads, exact revisions/hashes, stale-write rejection, and atomic generation/recovery of interrupted commits."
  - "[x] No adapter stubs or backend-specific visibility divergence; no fake full-text score parity claims."
completed_at: 2026-10-12
completed_by: null
sql_memory_ids:
  - 01a130f6-89ba-70a4-9b09-c181378c4836
---

# Phase 2: Four Storage Adapters

## User Goal
Technical chore — backend layer; the inherited parent goal is: users can choose durable storage per project and keep unmerged work invisible on other branches.

## Context
Parent User Goal: choose where durable state lives, resume reliably, branch-private unmerged work. Builds directly on the Phase 1 contract/config/identity and conformance fixtures. Plan step 2. The SQLite slice is HARD-blocked on A-4 from Phase 1: do not ship or claim SQLite support without the recorded runtime validation.

## Implementation Details
1. Implement both file adapters with native editable bodies plus immutable sealed revisions and manifest pointers; generation = staged immutable records + one atomic visibility pointer under scoped locking; recover interrupted generations; reject stale writes. File path is a projection, never authority.
2. SQLite adapter: node:sqlite, dialect-specific parameterized SQL, normal indexed source/revision columns (no jsonb emulation), transactions, busy policy, backup snapshot. Capability check at startup with clear refusal on unsupported runtimes.
3. PostgreSQL adapter: additive checksummed migrations only; new schema groups per plan §3; reuse pg pool/transaction patterns from `extensions/sql-memory/`.
4. Both DB adapters run the same conformance suite with real transactions and concurrency (two writers, crash-before/after-commit cases).
5. Binary payloads stored as bytes end-to-end on all four backends.

## Risks
- Visibility semantics drifting per backend — mitigated by the shared conformance suite being the acceptance bar, not per-adapter tests.
- Migration checksum discipline: never alter an existing applied migration; additive only.

## Verification
- Conformance suite green on: temp repo root, temp external root, on-disk SQLite, disposable PostgreSQL.
- Concurrency/crash fixtures: concurrent stale edits; interrupted generation recovery; SQLite lock contention; PG transaction rollback.
- `npm run guardrails:check` passes.

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Run `/b-build-hard` for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this phase), do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
## Current Execution Checkpoint

- Phase 1 A-4 remained validated. SQLite stays lazy-loaded through `loadSQLiteModule`; file and PostgreSQL stores do not import `node:sqlite`.
- File generation commits by staging content-addressed blobs and atomically renaming `manifest.next` onto `manifest.json`. A dead lock is stolen. Interrupted staging is discarded. Direct edits reconcile on read and before seal. Repo-file projections stay on the logical `.context` path; the last projected branch owns that shared file, and other branches read committed blobs.
- External roots default to `${XDG_CONFIG_HOME:-~/.config}/buck-workflow/{safe-or-sha256-project}/.context` and namespace branch/worktree/run paths.
- SQLite uses parameterized SQL, foreign keys, WAL, `busy_timeout`, and `VACUUM INTO` snapshots. PostgreSQL reuses the pg pool and additive checksummed migrations. Memory import keeps the original id as the revision id and stores category, ranks, and `supersededBy` in import provenance. No `MAX(seq)+1`.
- Acceptance wrap-up (`jev-1.13.0`): criterion_1 0.78, criterion_2 0.91, criterion_3 0.80, criterion_4 0.71, criterion_5 0.93, criterion_6 0.86. All are noul >= 0.7, so the boxes stay checked. Phase `status` remains `in-progress` for the loop to stamp `completed`.
- Verification: file/sqlite/postgres/conformance/migration tests passed; vitest 1857 passed, 8 skipped; `npm run guardrails:check` status pass, unit gate pass, complexity gate pass, coverage 88.9 >= baseline 84, patch gate advisory.

## Decision Closure

**Selected course:** finish the four adapters on the settled contract. File commit is one manifest rename. SQLite backup uses platform `VACUUM INTO`. External project segments are safe tokens or sha256. Memory ids are preserved by import mapping, not a new id allocator.

**Evidence:** Phase 1 A-4; focused adapter tests; disposable PostgreSQL 18 with pgvector; guardrails pass.

**Assumptions:** A-4 validated, not blocking. The disposable test database is not a product dependency.

**Material risks:** a repo-files direct edit is reconciled only for the branch that owns the shared editable path; another branch's committed blob is unchanged. Rollback is the previous manifest pointer, proven by the interrupted-generation and stale-write tests.

**Excluded scope:** publication ancestry, consumer cutover, and living docs. Those remain Phases 3–8.

**Next action:** `/b-review` this phase, then `/b-save` and `/b-commit`.


