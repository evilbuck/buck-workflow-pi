---
status: active
date: 2026-10-16
subject: 2026-10-10.durable-storage-adapters
topics: [code-review, publication, checkpoint-binding, recovery]
review_verdict: request-changes
phase: phase-6-publication-recovery.md
---

# Plan Path Review: Phase 6 Publication, Reconciliation & Recovery

## Verdict

**Needs work.** The review is complete on both axes; Phase 6 implementation is not complete. Exact-seal validation and local ancestry helpers exist, but save/checkpoint orchestration, durable publication/reconciliation and selected orphan recovery are not integrated. Five disposable real-Git/store scenarios reproduce concrete defects. Completed phase markers are contradicted by current source and `implementation-notes-phase-6.md:20-22`.

## Plan Source

- File: `.context/2026-10-10.durable-storage-adapters/phase-6-publication-recovery.md`.
- Parent: `plan-durable-storage-adapters.md`, implementation step 6, design contract §4, material risks 1–2.
- Goal: exact sealed checkpoint binding, ancestry-proven publication, explicit rewritten-history mapping, versioned reconciliation/conflict resolution and explicit orphan recovery.
- User goal: choose durable storage, resume reliably, and keep unmerged work invisible on unrelated branches. This review covers only Phase 6's contribution; it does not require Phases 7–8 to be complete.
- Baseline: HEAD `390bc3b8accc64b5a9cfea7864501f79e0c9ce91` plus staged and unstaged working-tree content. No long-lived branch diff was treated as Phase 6's implementation.

## Evidence Sources

- Initial git status: 17 pre-existing changed paths, including 16 staged paths and unstaged edits to the phase/overview. These were left untouched and were not restaged by this review.
- Recent commits: `390bc3b` (remaining consumer authority), `f235435` (receipt runs), `5a31384` (trusted consumer scope), `202ca5d` and `fbe9b5a` (access boundary), `db31575`/`849ef5a`/`065b776` (earlier storage phases). None proves Phase 6 acceptance.
- Modified source reviewed: canonical/bundled `storage/{publication,file-store,sqlite-store,postgres-store}.ts`, canonical/bundled `scripts/{file-store,storage-publication}.test.ts`, and `scripts/sync-storage-bundle.mjs`.
- Phase affected paths verified: `skills/_shared/storage/` policy/adapters and `extensions/buck-loop/loop.ts` checkpoint flow. No Phase 6 orchestration change exists under `extensions/buck-loop/`.
- Context: phase, parent plan, research, implementation notes, phase overview, backlog, historical memory ledger. Supervisor-provided recall treated only as reference; no `sql_memory` call.
- `.context/workflow/current-session.json` has no active `goal`; no goal-mode budget check applies.

## Completion Matrix

| Deliverable | Status | Current-state evidence and missing portion |
|---|---|---|
| 1. Explicit exact immutable sealing/binding in save/checkpoint flow; post-seal drafts excluded | Partial | `publication.ts:54-71` verifies project/branch/hash membership; adapter seals persist caller-selected members (`file-store.ts:255-270`, SQLite `262-270`, PostgreSQL `214-222`). No production seal/bind caller exists. `loop.ts:483-509` records only target/base HEAD. Missing actual save/commit integration and failed-bind recovery proof; iteration issue 1. |
| 2. Eligible source plus local ancestry; distinguish exit 1/errors; no fetch | Partial | `publication.ts:11-52` has local-only strict-exit ancestry checks and inherited-anchor rejection. The reconciliation helper ignores the bound commit (`130-132`); adapters do not reconcile. Missing durable proof-bound promotion; issues 1–2. |
| 3. Complete Git fixture matrix and negative privacy behavior | Partial | Seven tests at `storage-publication.test.ts:22-117` exercise helper subsets; existing `workflow-state.test.ts:260-305` separately covers rewritten/unborn identity isolation. Missing the required seal→bind→merge→default-retrieve/recover branch/worktree/Git matrix. Exact missing scenarios and fix are in iteration issue 6. |
| 4. Squash/rebase explicit exact mapping | Partial | Patch-id-only rejection exists (`publication.ts:99-106`), but mappings have no source checkpoint identity and subset hashes publish the full seal (`133-139`). Actual smoke reproduced unattested member publication. Missing exact durable selected mapping and real squash/rebase fixtures; issue 3. |
| 5. Versioned integration view, revocation, revert behavior, logical conflicts and resolution | Missing | All adapter `reconcile()` implementations are no-ops; trusted contexts initialize an empty publication set. The pure helper groups by immutable revision ID, not logical artifact (`141-151`), and lacks a resolution operation. Actual store smoke exposes no merged revision; a second real Git/file-store scenario seals two revisions of one logical artifact on independent branches, merges both branches, and incorrectly returns both as published. Missing durable view/revocation and per-artifact conflict resolution; issues 1 and 4. |
| 6. Explicit orphan listing with provenance and selected rebind/export; no name inheritance | Partial | `recoverableOrphans` is non-destructive but misses absent live named refs (`168-180`), reproduced as `[]`. Existing `recoverScopes` (`workflow-state.ts:560-564`) lists other named identity records only, not workspace orphan checkpoints or selected recovery operations. Missing recovery/rebind/export and incarnation matrix; issues 5–6. |
| 7. Run projections/receipts/import cursors/audits/attribution/dedupe stay private | Partial | `consumers.ts:10-40` binds six private kinds to worktree/run; `visibility.ts:14-21` denies cross-scope access even for published IDs. Fresh runtime smoke passed for all six kinds; importer cursor uses audit and attribution aliases use attribution. End-to-end after-merge integration is not verifiable until issue 1 is implemented; issue 6 must exercise it. |
| Parent assumptions assigned to Phase 6 | Complete | No unresolved blocking assumption is assigned here. A-4 is Phase 1's recorded runtime gate, not a Phase 6 blocker; parent ledger `53-62`. Settled choices were not reopened. |
| Material risk 1: inherited anchor leakage and revoke/retain fallback | Partial | Inherited anchor helper refusal passes; exact source binding is broken and durable revocation has no implementation. Fallback cannot be established from `revokedAnchors()` alone; issues 1–2, 6. |
| Material risk 2: branch/ref errors and explicit recovery/rebinding fallback | Partial | Missing-ref ancestry returns error and helpers do not delete revisions. Named deleted refs are omitted and selected rebinding is absent; issue 5. Full validation path remains issue 6. |
| Required deterministic verification | Missing | Durable-v2 `npm run guardrails:check` exits 1: new `reconcilePublishedView` complexity 11 exceeds maximum 10. Unit and global coverage ratchet pass. Iteration issue 7 proposes refactoring without weakening the contract. |

## Review Axes

### Spec / acceptance-contract axis

Worst finding: **High — no end-to-end seal/bind/publication path** (iteration issue 1). Normal save/commit/merge does not publish any snapshot through the configured adapter. Additional High findings: bound commit ignored, subset rewritten-history mapping, logical conflict detection missing, orphan recovery incomplete, required fixture matrix missing. All are in-plan implementation defects; no architecture choice is being reopened.

### Standards axis — explicit sequential fallback

No sub-agent dispatch tool is available. This second pass was scoped independently to TypeScript/JavaScript correctness and quality, seeded by:

- `code-review-universal/reference/typescript.md` (types, immutable inputs, async correctness);
- `code-review-universal/reference/code-quality-universal.md` (reuse, stringly-typed identity, TOCTOU, broad operations);
- diff-relevant `code-smells/docs/{dead-code,primitive-obsession,speculative-generality}.md`, not the full catalog.

Worst finding: **High — a partial attestation widens authority to the whole snapshot** (`publication.ts:133-139`, iteration issue 3). The trust-boundary check uses subset membership and does not identify the selected source checkpoint. The runtime result confirms this is behavior, not a type/style preference.

Other standards findings: proof checks an ignored binding (issue 2); revision-ID-only identity cannot implement logical conflicts (issue 4); production-unreachable publication/recovery helpers do not fulfill the adapter operations (issue 1); required complexity fails on the new reconciler (issue 7); shipped tests are stale and sync inventory drops an unrelated entry (warning 1). No cosmetic/style-only issue was promoted into a blocker.

Cross-axis ranking: **none**. Each axis retains its own worst finding and verdict input; duplicated evidence is cross-referenced, not reranked.

## Exercised Verification

1. `npx vitest run skills/_shared/scripts/storage-publication.test.ts skills/_shared/scripts/file-store.test.ts skills/_shared/scripts/sqlite-store.test.ts skills/_shared/scripts/postgres-store.test.ts` — **75 passed, 24 skipped; 3 files passed, 1 skipped; exit 0**. PostgreSQL was skipped, not proven.
2. Disposable `bun` script with an isolated real Git repository and real `FileStorageStore` — **exit 0**, assertions confirmed all five observed defects:
   - one-member rewrite attestation against an unmerged two-member seal returned both `v1` and `private-v2` as published;
   - a merged `checkpoint.commit` with an unmerged `boundCommit` still returned `published`;
   - distinct revision IDs returned `published`, not conflict (the helper has no logical identity input);
   - a stored named ref absent from `live` returned no recoverable scope;
   - write → exact seal → bind merged source → adapter reconcile → other-branch list returned `[]`.
   The script and its temporary Git/store root were removed. No permanent test or source file was added by the review.
   A second disposable scenario strengthened the conflict reproduction: independent Git branches each stored, sealed and bound a different immutable revision of `p/s/plan/same-plan.md`; after a real Git merge, reconciliation returned `published` with both `left-revision` and `right-revision`. Expected: preserved independent candidates pending explicit resolution. This script and its isolated root were also removed.
3. Direct `bun` runtime smoke of `consumerKey` plus `isRevisionVisible` — **6/6 private kinds denied cross-branch/worktree/run visibility even when their revision ID was in the published set; exit 0**.
4. `cmp` — publication implementation matches its plugin copy. Publication test parity **fails, exit 1 at line 6**: canonical seven cases versus bundled three. No sync command was run because review must not repair implementation.
5. `npx vitest run scripts/codex-plugin.test.ts` — **6 passed; exit 0**. That packaging suite does not establish publication-test byte parity; the direct comparison above fails.
6. `npm run guardrails:check` — **both runs exit 1, durable v2 fail**, including the required coherent-tree repeat: new `reconcilePublishedView` complexity 11. Both runs report unit gate pass and coverage 87.9% versus baseline 84%; the failure is reproducible without source changes.

## Verification Status

- Goal achieved: **partial**, not complete.
- User goal: **partially met**. Existing private scopes prevent ordinary cross-branch retrieval, but there is no working durable merged-publication path, and helper mapping/binding defects would leak unproven content if connected unchanged.
- Scope adhered: Phase 6 implementation is concentrated in its storage paths; the missing loop integration is in scope. Removing the pre-existing plan-source test sync entry is an unrelated change and should be reverted as part of warning 1.
- Out-of-scope changes: the sync inventory removal above; no new out-of-plan feature was requested.
- Source-state evidence overrides the phase/overview completion fields. This review changes neither lifecycle nor supervisor state.

## Guardrails Verdict

- Contract: durable.
- Contract version: 2.
- Status: **fail**, exit 1 on both initial and coherent-tree repeat runs.
- Gates: `unit_test_gate=pass`, `functional_test_gate=skipped`, `lint_gate=skipped`, `patch_gate=advisory`, `global_ratchet=pass`, `complexity_gate=fail`.
- Coverage: 87.9% current, 84% baseline, 90% target. Patch coverage unavailable/advisory. Lint and functional gates are disabled by the existing contract, not waived by review.
- Complexity: one new violation, `skills/_shared/storage/publication.ts::reconcilePublishedView`, cyclomatic 11; no hard-ceiling violation. Contract and baseline unchanged.

## User Goal Analysis

- Goal: users can choose durable storage per project, resume reliably, and keep unmerged work invisible on other branches.
- Met in this scope: exact immutable seal membership validation; local fail-closed ancestry primitives; existing run/worktree visibility enforcement.
- Partial: publication eligibility and rewritten-history checks exist as disconnected helpers with correctness defects.
- Missing: actual save/checkpoint snapshot binding, persisted proven integration view, durable revocation/resolution, selected orphan recovery, and required end-to-end Git/scope matrix.
- Verdict: **partially met** for Phase 6; no claim about completion of the full eight-phase plan.

## Documentation Impact

- Publication/binding/revocation/conflict and recovery conventions need living documentation after implementation is corrected. `docs/context-artifacts.md:77-91` names the API but explicitly leaves checkpoint proof separate; it does not document the new publication/recovery behavior. Current phase closeout prose overclaims behavior; implementation notes themselves acknowledge missing integration.
- Recommended: `/b-docs` before `/b-save`, after correctness work. Documentation impact does not drive this Needs work verdict.

## How-to Impact

- Explicit rewrite attestation, conflict resolution, and selected orphan recovery are user-facing actions requiring procedures once real operations exist. `docs/howto/recover-buck-loop.md:7-12` covers blocked-loop resume, not artifact-orphan recovery; scoped documentation search found no procedure for the new publication actions.
- Recommended: `/b-docs` first; it may follow `/b-howto`. Missing how-to prose is not an iteration blocker.

## Issue Classification

- In-plan: six High implementation/verification issues, one required complexity-gate defect, and one delivery warning, all recorded in `iterate-phase-6-publication-recovery-review.md`.
- Out-of-plan: none. The sync inventory edit is an out-of-scope implementation change, not newly requested feature scope.
- No operator input is missing; current gaps are implementable against the accepted contract.

## Completion Audit

1. Concrete deliverables: the phase's seven criteria and relevant two parent recovery risks, enumerated above.
2. Evidence mapping: current source ranges, focused command outputs and five real-Git/store reproductions, not status markers.
3. Actual state: read canonical implementation, adapter methods, runtime scope creation, loop checkpoint handling, shipped bundle and test fixtures; run deterministic contract.
4. Claim scope: real Git and file-store behavior exercised; pure privacy predicate smoke is explicitly narrower than after-merge integration. PostgreSQL and missing workflow scenarios are not claimed proven.
5. Uncertainty: unimplemented paths stay missing/partial, and skipped backend tests stay unverified.
6. Review scope completed; implementation acceptance remains Needs work. No phase/lifecycle transition or next supervisor state is selected.

## Recommended Next Step

Return these in-plan findings to the supervisor. The corrective route is `/b-iterate` (or `/b-build-hard` for substantial implementation), then fresh `/b-review` against this same phase. Do not close Phase 6 based on the seven helper tests or completed markers. Documentation/save/commit follows accepted implementation; this review does not perform those stages.
