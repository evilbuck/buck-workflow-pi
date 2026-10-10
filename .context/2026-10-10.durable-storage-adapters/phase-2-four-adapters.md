---
status: pending
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
  - "[ ] repo-files adapter: keeps existing .context body layout and Git portability; immutable sealed revisions + manifest pointers; direct file edits reconciled into new private revisions before retrieval/sealing."
  - "[ ] external-files adapter: root defaults to ~/.config/buck-workflow/{escaped-or-hashed-project}/.context/; branch/run namespacing so worktrees cannot overwrite each other; same generation atomicity as repo-files."
  - "[ ] SQLite adapter: confined node:sqlite, parameterized SQL, transactions, FKs, busy/concurrency policy, consistent backup/export snapshot; HARD-gated on Phase 1 A-4 pass; unsupported runtime errors clearly; driver not eagerly imported by other adapters."
  - "[ ] PostgreSQL adapter: pg pool/transaction discipline, additive checksummed migrations (no changed prior checksums, no MAX(seq)+1), schema for revisions/pointers/branches/checkpoints/publications/runs/receipts/attachments/import provenance; existing memory IDs/categories/ranks/correction history preserved via import mapping."
  - "[ ] All adapters pass the full Phase 1 conformance suite against real file roots, on-disk SQLite, and a disposable PostgreSQL instance — including binary payloads, exact revisions/hashes, stale-write rejection, and atomic generation/recovery of interrupted commits."
  - "[ ] No adapter stubs or backend-specific visibility divergence; no fake full-text score parity claims."
completed_at: null
completed_by: null
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
6. If the phase is incomplete, leave `status: in-progress` so the session resumes here next turn.
