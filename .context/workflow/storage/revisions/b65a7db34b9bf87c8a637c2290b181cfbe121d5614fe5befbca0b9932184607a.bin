---
status: completed
date: 2026-10-12
subject: 2026-10-10.durable-storage-adapters
domains: [storage, testing, migrations]
topics: [file-locking, projection-recovery, additive-migrations, branch-incarnations, scoped-staging]
related: [phase-2-four-adapters.md, iterate-phase-2-four-adapters.md]
informs: [phase-2-four-adapters.md]
---

# Phase 2 iteration verification

## Applied repairs

- R1: file operations use an instance-local FIFO queue plus the existing cross-process lock. Public reads retain ownership through recovery/reconciliation; internal locked mutation helpers avoid recursive lock acquisition. Independent writes both persist; stale overlapping writes refuse exactly one revision without historical insertion.
- R2: validate artifact identities, links, namespaces, and editable destinations before manifest publication. An atomically installed `projection.pending` journal records generation and touched identities before the pointer rename. Post-pointer I/O failures explicitly report `generation N committed; editable projection pending recovery`; recovery projects that exact committed generation before interpreting user edits. Partial journal staging is discarded. Unsafe multi-revision batches leave current and historical lookups unchanged.
- R3: CREATE TABLE definitions use a positive grammar for built-in types, literal defaults/casts, the reviewed `now()` timestamp default, primary/unique/composite keys, references, and literal IN checks. Unknown functions/computed expressions remain exact-file acknowledgment gated. Existing migrations 001 and 002 were not edited.
- R4: new `003_artifact_branches.sql` persists project-scoped branch IDs, UUID incarnations, refs, initial/observed/integration tips and same-project parent lineage. Reused refs can retain distinct incarnations; cross-project parent references are refused. No publication policy was added.
- Canonical file adapter and changed file/PostgreSQL tests are byte-identical to their bundled copies. Migration README and changelog describe the repaired contract. Existing draft commit expanded; supervisor owns save/commit and phase/subject lifecycle.

## Fresh verification

- Required `vitest run`: 104 files passed; 1869 tests passed, 8 skipped. Disposable PostgreSQL 18 with pgvector enabled by BUCK_WORKFLOW_TEST_DATABASE_URL (loopback-only container); no PostgreSQL skip in the focused suite.
- Final focused run: file/SQLite/PostgreSQL adapters, migration policy, SQL gate, and Codex bundle tests: 6 files, 114 tests passed.
- Final `npm run guardrails:check`: status pass; unit/global-ratchet/complexity required gates pass; coverage 89 >= 84 baseline; no new/hard-ceiling complexity violations. Lint/functional disabled; patch advisory. Contract/baseline were not weakened or rewritten.
- Separate Bun runtime smoke: overlapping 100+1 writes both readable; unsafe batch preserves manifest byte-for-byte; actual post-commit projection I/O failure recovers the exact revision; real arbitrary-default migration refused with victim rows unchanged and no expression table created; branch schema present and repeated numbered migrations no-op. Throwaway script/container removed after verification.
- Focused strict library typecheck with TypeScript 6, --ignoreConfig, --types node, ESNext/NodeNext: exit 0. Wider test-inclusive typecheck exposes a pre-existing RepoFilesStorageStore constructor signature requiring unused `root` although callers supply contextRoot/manifestRoot; outside R1–R4, not changed and no test-inclusive typecheck pass claimed.

## Staging failure — operator/supervisor prerequisite

Entry already contained staged/unstaged build work in the same source/test paths. The indexed file adapter is an older implementation: it has no #lockDepth, #lock, #touched, #stageRevision, #publish, or projection-stamp machinery. These were present but unstaged before this assignment. Applying an isolated assignment-owned #lockDepth-to-queue hunk with `git apply --cached --check` fails; inspection of `git show :skills/_shared/storage/file-store.ts` confirms the prerequisite base is absent.

Whole-file staging would include pre-existing unstaged build changes, expressly forbidden by this assignment. The source fixes therefore remain in the working tree rather than staging another agent's work or manufacturing a divergent indexed implementation. Clean assignment-owned docs/new migration/draft/evidence and an isolated migration-policy regression hunk can be staged independently; existing index content is preserved. Full source staging needs the owner to stage the pre-existing Phase 2 build baseline, or explicit authorization to stage the complete affected files. This is a staging failure, not a remaining implementation defect or authority to select the next loop state.

## Files modified by this assignment

- skills/_shared/storage/file-store.ts and bundled copy
- skills/_shared/scripts/file-store.test.ts and bundled copy
- skills/_shared/scripts/postgres-store.test.ts and bundled copy
- extensions/sql-memory/sql-gate.ts
- extensions/sql-memory/migrations.test.ts (three refused computed-expression cases)
- migrations/003_artifact_branches.sql (new), migrations/README.md
- docs/CHANGELOG.md
- Subject iterate artifact, draft-commit.md, and this verification record

## Retained boundaries

No caller/domain/publication/cutover scope, new SQL memory body, stale workflow-session rewrite, baseline demotion, phase lifecycle edit, commit, or loop transition. Supplied SQL memory was reference evidence only; current phase/iteration files governed the repairs. Review the same phase after resolving staging; save and commit remain supervisor-owned.
