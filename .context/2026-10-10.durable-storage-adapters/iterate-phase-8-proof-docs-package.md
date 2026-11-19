---
status: active
date: 2026-10-16
updated: 2026-10-16
subject: 2026-10-10.durable-storage-adapters
topics: [review, iteration, end-to-end-proof]
informs: []
addresses: phase-8-proof-docs-package.md
completed: null
from_review: b-review
---

# Iteration: Phase 8 end-to-end proof, docs, and packaging

## Source

- Reviewed after: `/b-build`
- Phase: `phase-8-proof-docs-package.md`
- Plan: `plan-durable-storage-adapters.md`, step 8
- Review: `review-phase-8-proof-docs-package-2026-10-16.md`
- Baseline: `08f488880cd2f97b121373151f79f259ab3dbf65`

## Critical Issues

### 1. Exercise a real OMP workflow on each adapter

- **File**: `.context/2026-10-10.durable-storage-adapters/phase-8-proof-docs-package.md`
- **Problem**: Criterion 1 is unchecked in HEAD and falsely checked in the working tree. No transcript shows brainstorm/research/plan → phase → build/review/iterate → save/checkpoint → restart/resume on repo-files, external-files, SQLite, and PostgreSQL. The local readback note names three revision IDs and one sha256. It is not an OMP session, does not show restart/resume, and does not cover presentation attachment, retained pass audit, hook memory, or attribution/import cursor. `pg_isready` found no server on `/run/postgresql:5432`. `omp/18.11.1` is installed.
- **Proposed fix**: Revert `status: completed`, the five checked criteria, `completed_at`, and the phases-overview Phase 8 row until evidence exists. Run the workflow on each adapter, including a disposable PostgreSQL. After restart/resume, read back the same artifact IDs/revisions and a completed attempt receipt. Attach the transcripts. Do not infer this from earlier phase tests or from a store write that never entered OMP.

### 2. Re-check the parent acceptance list against live behavior

- **File**: `.context/2026-10-10.durable-storage-adapters/plan-durable-storage-adapters.md`
- **Problem**: Criterion 2 requires the parent acceptance items at lines 181–195 to be re-checked and updated with evidence. Every item is still `[ ]`. Implementation notes say the re-walk was not done.
- **Proposed fix**: For each parent item, record the current command output or file:line that shows the behavior, then check only the items that evidence supports. Leave an item unchecked if the live check fails or cannot be run. Do not copy prior phase checkboxes forward.

### 3. Stop the plan site from advertising a filesystem or future SQL-memory source

- **File**: `docs/plans/src/pages/index.astro`
- **Problem**: The changed surface reads the configured adapter. This review's `createPlanSource()` smoke returned `kind: "sql"` and loaded this subject. The page still prints `source: filesystem (.context/)` (`index.astro:13`). `docs/plans/src/layouts/Base.astro:90` says filesystem today and SQL when a plan-document table lands. `docs/plans/package.json:5` still describes filesystem and SQL memory as interchangeable. That is the removed second-source story. No Astro build was run; these strings are what a build would emit.
- **Proposed fix**: Name the configured workflow adapter in those three places. Do not add a filesystem union or raw SQL reader. Smoke `createPlanSource()` again and, if `docs/plans` dependencies are already installed, run the site build far enough to confirm the old sentences are gone.

## Warnings

### 1. Host install verify exits 1 because of a pre-existing split root

- **File**: `scripts/install.mjs`
- **Problem**: `node scripts/install.mjs --verify` found all 22 shipped storage files, then exited 1. Harness links resolve to `buck-workflow-pi` and `~/.pi/agent`, not this worktree. That is the installer's split-root detector on this host, already recorded by the installer closeout. It is not a missing storage file.
- **Suggested approach**: Do not relink or overwrite the operator's home directories. If a green install command is still required, run it against an isolated tree and record that exit code. Canonical/bundle storage parity is already clean (`diff -rq` exit 0).

## Recommended Workflow

Start with `/b-iterate` — it will pick up this file automatically.
Then re-run `/b-review` against `phase-8-proof-docs-package.md`.
Inside an OMP execution session, `/b-iterate` completes this artifact before it returns; the supervisor then re-reviews. Do not leave the file `active` waiting for review or save.
Do not mark the phase completed, save, or commit until the three critical issues have current evidence.
