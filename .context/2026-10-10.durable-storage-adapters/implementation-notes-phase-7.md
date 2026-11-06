---
status: completed
date: 2026-10-16
updated: 2026-10-16
subject: 2026-10-10.durable-storage-adapters
domains: [storage, testing, docs]
topics: [data-cutover, crash-recovery, legacy-quarantine, migration]
related: [phase-7-data-cutover.md, iterate-phase-7-data-cutover-review.md, plan-phase-7-iteration.md]
priority: high
---
# Phase 7 iteration evidence

## Decisions

- Replaced all uncalled helper predicates with a versioned migration inventory and real operator dispatch. A full project snapshot retains immutable history, exact payload hashes/bytes/links, pointers, correction idempotency/ancestry, receipt duties, lifecycle, checkpoint/publication authority, attachments, and legacy import provenance.
- Export reads the retained immutable generation or a read-only SQL snapshot. Source discovery/reconciliation/projection and SQL schema migration are not part of source opening. Unretained editable files are deliberately outside a retained snapshot.
- Import stages privately and atomically retains cursor plus staged bytes; one final adapter transaction/generation publishes the inventory. Destination must be empty for that project, or an exact replay. No overwrite, merge, source deletion, or dual-write fallback.
- Known old `memory-import` mappings are not exact original branch/publication evidence: migration retains original revision/pointer metadata privately and removes ordinary pointers. New original legacy JSON similarly keeps categories/ranks/successor links and all original fields in quarantine. Native Hindsight publication cannot discover those rows.
- Backend switching is an explicit **offline maintenance** operation. All writers across sibling worktrees must remain stopped; CLI requires `quiesced: true`. Config and both inventories are checked before atomic config replacement. Consumer bindings are explicitly migrated; journal resume completes an interrupted rebind. Dead process locks are reclaimed only with ESRCH proof; unknown/live owners fail closed.
- Rollback first fsyncs/verifies a full destination rescue, preserving post-switch correction ancestry and every retained revision, then restores the unchanged source/config and consumer bindings. Both stores remain intact. Rescue imports through the same route into an empty destination.
- Repo-files imports project only the operator-bound branch; immutable multi-branch state is retained without projecting another branch's draft into this checkout.
- Credentials are not migration connection metadata: config uses env references; stdout reports counts/digests/inventories only. Exact artifact/legacy bytes remain sensitive private files, not redacted payloads. Docs exclude journals, exports, quarantine, rescue, DB/WAL/SHM, and identity/manifest state from Git/dotfile management.

## Verification observed

- `npx vitest run skills/_shared/scripts/storage-cutover.test.ts`: **9 passed**. Includes file→SQLite→file historical/current revision checks, binary-safe hash/link retention, correction replay, receipt duties, full bidirectional metadata diff, cursor restart/replay, config interruption/rollback, original legacy metadata/ranks, old mapped-legacy quarantine, branch selection, and repo projection isolation.
- Mutation check: premature `installSnapshot(attempt.snapshot)` before staged-batch completion makes the hidden-staging regression fail at ordinary retrieval (expected `[]`, received the revision). Mutation removed.
- Real temporary-process Bun smoke exercised **doctor/export/import/import-legacy/quarantine/dry-run/cutover/resume/rollback**. A worker exited 23 after a durable staged batch; SIGKILL after destination commit resumed without duplicate/skipped rows; SIGKILL after config rename resumed through the real CLI and reclaimed the dead operator lock. Matching consumer contexts reopened after switch and rollback. Post-switch revision `after` and correction predecessor `before` recovered into external-files; source remained `before`.
- Real PostgreSQL smoke used session-local TEMP tables built from additive schemas, never the migration runner or shared schema writes. Full rescue round-trip digest matched; legacy rank data survived; quarantine was absent from ordinary retrieval. Connection came from existing operator configuration but was never emitted or adopted as selection. No shared rows/schemas were written.
- Synthetic credential strings in SQL URL env, original JSON password metadata, YAML text, and URL metadata stayed absent from actual CLI stdout. Private legacy snapshots retained the original data exactly rather than corrupting payloads by regex redaction.
- Final `npm run guardrails:check`: **pass**, durable v2. Required unit/global-ratchet/complexity gates pass; coverage **88%** vs **84%** baseline; 29 retained hotspots vs baseline 30; no new/hard violations. Lint/functional skipped (disabled by existing contract); patch advisory. No thresholds/baselines were changed.
- Optional isolated TypeScript probe: the new empty-table inference issue is corrected; the lazy pool now declares its actual owned `end()` disposal method. With explicit Node types, `npx tsc --ignoreConfig --noEmit --skipLibCheck --module nodenext --target esnext --types node --allowImportingTsExtensions skills/_shared/storage/migration.ts skills/_shared/storage/cutover.ts skills/_shared/scripts/storage-migration-cli.ts` reports only the existing missing declaration package for `pg` (`TS7016`, `db.ts:1`). No TypeScript pass is claimed; no dependencies or check contracts were changed to suppress it.
- All **7 exact shell fences** from the six new how-tos were extracted, path placeholders substituted into an isolated checkout, syntax-checked with `bash -n`, and live-run with exit 0 and JSON output. Packaging smoke verified **12 canonical/bundle byte-equal surfaces** and **22 present shipped dependencies** through the installer's read-only inventory API; the installer itself was not run.
- Caller census over hooks/extensions/importer confirms legacy `SQL_MEMORY_URL` survives as a receipt-mode gate and redaction/test string, not a turn-memory/importer backend selector. Current-view transfer exports have no remaining callers and are removed. Explicit schema administration and required save receipts remain intact.

## Modified implementation

Canonical `skills/_shared/storage/{migration,cutover,contract,db,file-store,sqlite-store,postgres-store,sqlite-capability}.ts`; `skills/_shared/scripts/{workflow-state,workflow-state-cli,storage-migration-cli,storage-cutover.test}.ts`; `skills/_shared/workflow-state-access.md`; corresponding existing plugin bundle surfaces; `skills/b-memory-import/SKILL.md`; `scripts/install.mjs` shipped-file inventory; `docs/sql-memory.md`; six storage-migration how-tos and their index; Phase 7/iteration/plan/draft artifacts.

The importer skill is not present in this repository's plugin bundle, so no new second skill bundle was invented. Historical `.context/memory` files and the stale Phase 4 session-memory pointer remain untouched. This nested assignment uses subject evidence rather than running `/b-save`; the supervisor owns review, save, commit, lifecycle, and loop transitions. Pre-existing overview/review/ranking changes are not this assignment's staging scope.

## Closeout

Iteration artifact is completed with completion date 2026-10-16. This note and
`draft-commit.md` are the nested assignment's durable record; the supervisor still
owns independent re-review/save/commit. Temporary smoke scaffolding and fixture
directories were removed after the observed runs.

Assignment-owned implementation/docs/evidence/draft files were staged successfully.
Artifact hunks were staged selectively: the pre-existing phase `status`/
`completed_at` edits and Jev-failure annotations remain unstaged, as do the
untouched overview and untracked review/ranking artifacts. Existing unrelated
index entries were neither reset nor restaged. No commit or loop-state transition
was performed.
