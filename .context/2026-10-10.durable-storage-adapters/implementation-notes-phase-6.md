---
date: 2026-10-16
domains: [storage, testing]
topics: [publication, checkpoint-sealing, git-ancestry, correction-lineage, recovery]
related: [phase-6-publication-recovery.md, plan-durable-storage-adapters.md, iterate-phase-6-publication-recovery-review.md, plan-phase-6-iteration.md]
priority: high
status: completed
subject: 2026-10-10.durable-storage-adapters
artifacts: [skills/_shared/storage/publication.ts, skills/_shared/storage/contract.ts, skills/_shared/storage/domain.ts, skills/_shared/storage/file-store.ts, skills/_shared/storage/sqlite-store.ts, skills/_shared/storage/postgres-store.ts, skills/_shared/scripts/workflow-state.ts, skills/_shared/scripts/workflow-state-cli.ts, skills/_shared/scripts/storage-publication.test.ts, extensions/workflow-state/index.ts, extensions/buck-loop/loop.ts, extensions/buck-loop/types.ts, extensions/buck-loop/persist.ts, extensions/buck-loop/__tests__/loop.test.ts, skills/_shared/workflow-state-access.md, scripts/sync-storage-bundle.mjs, scripts/install.mjs]
---

# Phase 6 publication/recovery repair

## Decisions and implementation

- Retain adapter checkpoint persistence. Add selected-project checkpoint enumeration, immutable-member lookup, current snapshots including tombstones, retained scopes and correction ancestry. Corresponding `plugins/buck-workflow/skills/_shared/` implementation, script, test and access-documentation mirrors are synchronized.
- Persist publication views, proof history, exact checkpoint rewrite mappings and candidate-set-bound conflict resolutions through existing immutable revisions and compare-and-swap. Reuse file atomic generations and SQL transactions, without a parallel mutation framework or machine-files fallback.
- Runtime-private ledger uses fixed internal branch/workspace/run identifiers. Normal contexts cannot select this scope. Run/workspace artifacts and private kinds never participate in publication. Boundary non-finding: the file adapter's run-scoped projection is under its machine-private manifest root, not the checkout.
- Detached/unborn workspace checkpoint IDs remain ineligible even when their source commits become integrated. Selected recovery into a named branch is required. Native operator parameters expose typed selection/mapping fields without widening restricted roles.
- Loop commit preparation seals the exact branch snapshot and persists its ID before commit execution. Verified advancement binds the resolved resulting OID. Bind failure retains the seal; repeating the identical verified binding is idempotent.
- Publication-disabled commit preparation returns before identity registration or adapter opening. Configured publication still rechecks its trusted context. Binding requires a descendant of the sealed source; proof uses the bound OID, not creation HEAD. Seal baseline and runtime source resolve to OIDs. No network fetch.
- Configured ordinary workflow access reconciles against the local integration ref before retrieval. No integration ref means no automatic publication. Rewritten/missing/unprovable evidence removes visibility; code revert preserves reachable knowledge.
- Rewrite mappings select one checkpoint and its full exact revision/hash set, freeze a reachable target, and require explicit non-patch-id evidence. Subsets, duplicates and cross-checkpoint mappings fail closed; explicit revocation is available.
- Conflicts group by project/subject/kind/logical name and retain the last reachable unambiguous baseline while unrelated artifacts advance. Resolution binds the exact candidate set. Cross-branch supersession requires actual artifact correction ancestry: merging code does not resolve independent knowledge edits. Same-branch sealed successors can advance by proven checkpoint order.
- Correction metadata retains immutable tombstone result IDs in existing columns; deletion and its replay still return null. Legacy null-result metadata contributes no invented ancestry. No migration or second lineage journal.
- Operator publication-view exposes manifests and proofs. Recovery combines identity provenance and selected-adapter scopes, including deleted and workspace-private branches. Explicit scopeToken export/rebind retains original revisions, carries provenance and refuses destination collisions.
- Restore plan-source.test.ts to bundle sync. Add publication.ts to installer shipped-storage verification; the inspection finds 19 files and no missing modules.

## Exercised verification

- With BUCK_WORKFLOW_TEST_DATABASE_URL set to the disposable PostgreSQL 18 fixture, `npx vitest run skills/_shared/scripts/storage-publication.test.ts skills/_shared/scripts/file-store.test.ts skills/_shared/scripts/sqlite-store.test.ts skills/_shared/scripts/postgres-store.test.ts`: 125 tests passed across all four adapters, including real Git publication, correction-graph conflicts and cross-branch idempotent deletion.
- Earlier focused publication/native/persist run: 57 passed; focused publication/workflow/loop/persist run: 176 passed; final loop regression: 121 passed. `npm run test:bun`: 70 passed. `npm run test:sqlite-runtime`: Node and Bun transaction smokes passed.
- Git fixtures cover FF/preserved merge; sealed v1 with private v2; inherited/base anchors; immutable binding and unrelated-binding refusal; squash/rebase with negative visibility before exact mapping; partial/duplicate/patch-id-only mapping refusal; mapping revocation; force-rewrite and missing-ref revocation; code revert; logical-artifact baseline/conflicts/resolution; project isolation; rename/delete/recreate; detached/unborn retention; selected export/rebind.
- Mutation checks: removing positive publication proof and allowing subset mappings caused 13 expected failures; skipping tombstones resurrected knowledge in 3 tests; removing workspace eligibility leaked detached knowledge in 3 tests. The first workspace mutation exposed an inactive integration-ref fixture; configuring that ref made the test detect the leak. All production guards restored.
- Correction-graph regression failed before repair on repo-files, external-files and SQLite: merging left code into right incorrectly selected right's independent artifact instead of preserving the baseline/conflict. It passes after repair.
- Actual configured runtime conflict smoke on all four adapters used fresh worktrees and native write/correct, runtime seal/commit/bind, ordinary retrieval, operator view and explicit resolution. Despite proven left-code ancestry of right, every adapter printed `conflicts: 2`, `before: ["baseline"]`, `after: ["right candidate"]`. Throwaway script removed.
- Actual standalone CLI publication smoke on all four adapters printed before merge [], merged ["sealed-v1"], revoked [], with persisted published proof. Unsealed v2 never appeared. Publication-disabled PostgreSQL smoke with credentials unset returned seal:null without identity registration or storage access. Throwaway scripts removed.
- Canonical/bundled storage and publication/workflow/CLI/plan-source/access-documentation pairs compare byte-identical. Installer shipped-storage inspection: `{files:19,publication:true,missing:[]}`.
- Final `node skills/b-guardrails-check/scripts/check.mjs` run, invoked by a temporary lossless wrapper: durable v2 required unit, global ratchet and complexity gates passed; coverage 89.4% versus 84% baseline, no new/hard complexity violations. Lint and functional tests remain disabled; patch is advisory with no measured patch percentage. Exact final verdict: guardrails-verdict.json. No baseline or enforcement changes; wrapper removed.

## Diagnostics and abandoned approaches

- Initial helper-only implementation lacked production seal/bind, persisted views and ordinary-retrieval integration; replaced, not retained as a second API. Synthetic same-revision/different-hash conflict tests were replaced with actual immutable revisions on independent Git branches.
- Initial full-unit diagnostic isolated a four-phase difficulty-routing fixture exceeding its five-second deadline. The new publication-disabled path unnecessarily opened storage/resolved identity; a config preflight removed that work, and the same scenario passed in 2.90 seconds.
- The full coverage report had 47 failures in the loop suite, beginning with the same four-phase fixture; most were five-second timeouts. Only this real four-phase integration scenario now has a 30-second test budget. All assertions, coverage requirements, guardrail thresholds and ignores remain unchanged. Full durable guardrails subsequently passed twice. Oversized diagnostic reports were removed.

## Ownership and staging

The initial index already contained Phase 6 build/review work. This assignment staged only its modified/new implementation paths and exact owned metadata hunks. Pre-existing Jev annotations and phase status/completed_at edits remain unstaged; unrelated staged work was preserved.

The phase files: allowlist covers actual runtime, bundle, installer and sync paths. Its obsolete helper-only evidence section now records actual consumer behavior and verification; status, acceptance and lifecycle fields were not changed by this assignment. The iteration artifact's status/completed fields and appended repair evidence were staged without its pre-existing Jev annotations.

Phase/overview/lifecycle/loop decisions remain the supervisor's. Historical Markdown session memory stays read-only. No SQL save or commit. Draft commit: draft-commit.md.

## Publication-boundary rereview iteration (2026-10-16)

- Assigned artifact: iterate-phase-6-publication-boundary-rereview.md. Its current ranked contents contain one blocking issue: inherited tracked projections becoming unauthorized branch overlays. The separate same-tip branch-recreation finding is not in the assigned ranked artifact.
- With integration publication configured, missing branch pointers import only files with observable local index/worktree changes or new untracked bytes. Clean tracked inherited/merged bytes do not authorize an overlay; failed Git status observation refuses import. Existing branch-owned direct-edit reconciliation is unchanged. Explicit workflow writes and selected recovery remain deliberate adoption paths. Publication-disabled legacy projection behavior is unchanged.
- Files modified in this iteration: canonical and bundled workflow-state.ts, storage-publication.test.ts and workflow-state-access.md; this note, draft-commit.md, the assigned iterate artifact, and plan-phase-6-projection-boundary.md. No phase/lifecycle/loop state, backlog, historical memory, SQL store or commit changed.
- Retained regression invokes actual CLI in separate fresh processes against two real worktrees, seals tracked plan/index v1, commits unsealed plan/index v2, merges, checks list/search/read/discovery/lifecycle expose v1, and checks new local drafts plus direct edits.
- Focused runtime/store tests: 89 passed in storage-publication.test.ts, file-store.test.ts and workflow-state.test.ts. PostgreSQL-specific fixtures were not enabled in this run.
- Separate disposable standalone smoke output: `{"scenario":"tracked-postseal-edit","list":["sealed v1"],"searchUnsealed":[],"freshRead":"sealed v1"}`. Temporary script/checkouts/stores removed.
- All three changed canonical/bundle pairs compare byte-identical. Contract thresholds and enforcement unchanged. Supervisor retains review/save/commit and loop routing ownership.
- Portable Bun workflow consumers: `npm run test:bun` passed 70 tests (0 failures). Only assignment-owned metadata hunks were staged for the iterate artifact; the pre-existing ranked issue removal remains untouched in the index.
- Fresh `npm run guardrails:check` exited 0 with durable v2 status pass: required unit/global-ratchet/complexity pass; coverage 88% versus unchanged 84% baseline; no new/hard complexity violations. Functional/lint disabled, patch advisory/unmeasured. Proposed ratchet updates were not applied.
- `npm run test:sqlite-runtime`: SQLite transaction smoke passed under Node and Bun. All assignment files staged successfully; no commit or supervisor state transition performed.
