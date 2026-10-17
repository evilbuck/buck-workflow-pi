---
status: active
date: 2026-10-16
subject: 2026-10-10.durable-storage-adapters
topics: [code-review, publication, checkpoint-binding, branch-isolation, recovery]
review_verdict: request-changes
phase: phase-6-publication-recovery.md
---

# Plan Path Review: Phase 6 publication-boundary re-review

## Verdict

**Needs work — two High in-plan privacy defects.** The prior iteration delivered real runtime sealing/binding, persisted integration views, exact rewrite mappings, artifact conflict resolution and selected recovery. However, repo-files projection import bypasses the sealed revision set, and same-tip branch recreation inherits an observed orphan's private identity. Completed phase checkboxes do not establish these two acceptance guarantees.

This is a complete review with separate acceptance and sequential standards passes, not a claim that Phase 6 implementation is complete. No next loop state was selected.

## Plan Source

- File: `.context/2026-10-10.durable-storage-adapters/phase-6-publication-recovery.md`.
- Parent: `plan-durable-storage-adapters.md`, implementation step 6, design contract §4, material risks 1–2; parent research and decision-closure protocol followed.
- Goal: exact sealed checkpoint binding, ancestry-proven publication, explicit rewritten-history mapping, integration reconciliation/conflict resolution and orphan recovery.
- User goal: choose durable storage, resume reliably, and keep unmerged knowledge invisible on unrelated branches. This review assesses only Phase 6's contribution; Phases 7–8 are not acceptance prerequisites here.
- Baseline: HEAD `390bc3b8accc64b5a9cfea7864501f79e0c9ce91` plus the initial staged and unstaged implementation. Current source is authoritative; earlier phase status and historical review findings are not current proof.

## Evidence Sources

- Initial Git status: 39 pre-existing changed/untracked paths, including 36 staged paths; pre-existing phase/overview edits, review artifacts and Jev annotations were preserved without restaging. Only this review's two new Markdown artifacts are staged by this assignment.
- Relevant recent commits: `390bc3b` (remaining consumer authority), `f235435` (receipt-run binding), `5a31384` (trusted consumer scope), `202ca5d`/`fbe9b5a` (access confinement). They establish the review baseline, not Phase 6 completion.
- Modified implementation verified: `extensions/buck-loop/{loop,persist,types}.ts`, `extensions/workflow-state/index.ts`, canonical `skills/_shared/scripts/{workflow-state,workflow-state-cli,storage-publication.test,file-store.test}.ts`, `skills/_shared/storage/{contract,domain,file-store,sqlite-store,postgres-store,publication}.ts`, shared access contract, installer/sync changes and corresponding plugin copies.
- Phase affected paths inspected: production commit hooks, selected-store/native/CLI operations, all adapter checkpoint implementations, real Git/store fixtures, private consumer kinds, visibility overlay and branch identity binding.
- Context: explicit phase/parent/research, prior iteration and implementation notes, backlog, memory index and supervisor-supplied recall. No `sql_memory` call. `.context/workflow/current-session.json` has no non-null goal; no goal-mode budget audit applies.

## Completion Matrix

| Deliverable | Status | Current evidence and remaining gap |
|---|---|---|
| 1. Explicit sealing freezes exact immutable members; bind successful checkpoint; v2 remains private | Partial | `workflow-state.ts:386–409`, `loop.ts:490–493,1167–1184`, adapter seal validation and binding are integrated. Configured CLI smoke on all four adapters publishes only sealed v1 in the non-inherited-projection case. **Missing:** repo-files ordinary discovery must not import tracked unsealed v2 as a local overlay; R1. |
| 2. Eligibility plus actual bound-OID ancestry, exit 1/error distinction, no fetch | Complete for the publication policy | `publication.ts:6–40,55–60,107–116,167–185` resolves OIDs, uses the bound commit, rejects inherited-at-seal anchors and separates negative ancestry from errors. All-backend Git fixtures and configured publication/rewrite smokes pass. Commands are local rev-parse/merge-base only; projection bypass is separately R1. |
| 3. Full Git/privacy fixture matrix, including post-seal edits and recycled refs | Partial | 125 publication/adapter tests pass on all four backends; FF/preserved merges, rewrite mappings, revocation, revert, missing refs, conflicts and detached/unborn scopes are exercised. **Missing:** tracked repo-files post-seal edit and same/descendant-tip recycled branch cases; both fail through actual trusted CLI access (R1/R2). The existing recreation test chooses an unrelated tip and does not cover equal-tip reuse. |
| 4. Squash/rebase remain private until exact verified mapping | Complete | `publication.ts:62–81,187–201`; `workflow-state.ts:497–509`. Real squash/rebase fixtures pass on all four adapters, refusing subset/duplicate/other-checkpoint/patch-id-only mappings and revoking unreachable or explicitly revoked mappings (`storage-publication.test.ts:101–122`). |
| 5. Versioned integration view, revocation, code revert, independent conflicts/baseline/resolution | Partial | Immutable CAS ledger and proof reconciliation exist (`publication.ts:83–105,128–208`). All-backend fixtures prove explicit resolution, candidate-set changes, cross-branch correction ancestry, tombstones, code-revert preservation and rewrite revocation (`storage-publication.test.ts:61–80,124–170`). **Missing:** ordinary repo-files results must honor that ledger instead of overlaying an unsealed imported body; R1. |
| 6. Non-destructive orphan discovery/provenance; selected export/rebind; no name inheritance | Partial | `workflow-state.ts:620–688` and real selected recovery fixtures now cover named/workspace/adapter scopes and explicit export/rebind. **Missing:** observed deletion must retire the old incarnation; same-tip recreation currently returns the identical branch ID and private body without selection (R2). |
| 7. Run projections/receipts/import cursors/pass audits/attribution/dedupe remain private | Complete within this phase | `publication.ts:108,118–125,210–211` excludes workspace scopes and private kinds; `consumers.ts:10–44` scopes six private kinds; visibility checks exact workspace/run (`visibility.ts:11–23`). After-merge fixtures retain only knowledge, not these six kinds, on all four backends. |
| Parent assumptions assigned to this phase | Complete | Parent ledger `53–62` assigns no unresolved blocking assumption to Phase 6. Settled storage/central-attestation choices were not reopened. No unrelated phase's incomplete work was treated as a defect here. |
| Material risk 1: inherited/unsealed leakage, retain/revoke recovery | Partial | Immutable seals, exact bound ancestry, rewrite revocation and retained v1 are exercised. Physical repo projection import still exposes unsealed v2; the mitigation does not cover every ordinary access path (R1). |
| Material risk 2: branch/ref identity, explicit recovery/rebind fallback | Partial | Deleted/workspace state is retained and selected recovery works. Recovery observes deletion but equal-tip recreation silently revives the old identity; the explicit-rebinding safety boundary is bypassed (R2). |
| Required deterministic contract | Complete | Fresh durable-v2 `npm run guardrails:check` exits 0: unit/global-ratchet/complexity pass; coverage 88% versus unchanged 84% baseline. Disabled/advisory gates are reported below, not treated as exercised checks. |
| Canonical/package delivery within Phase 6 | Complete for inspected surface | Storage directory and changed script/test/access-document mirrors are byte-identical. Installer inventory reports 19 storage files, publication module included, missing files `[]`. No fresh full installation or Phase 8 workflow claim is made. |

## Review Axes

### Spec / acceptance-contract axis

Worst finding: **High — R1, repo-files discovery exposes an unsealed projection instead of the sealed integration revision** (`workflow-state.ts:434–448,472–475`). R2 is independently High: an observed deleted branch is implicitly reactivated on same-tip recreation (`143–164,660–666`). Both violate explicit Phase 6 criteria and are in-plan.

### Standards axis — explicitly scoped sequential fallback

No background sub-agent dispatch tool is available. After acceptance analysis, a second pass assessed changed TypeScript/JavaScript for type/async correctness, runtime authorization, immutable storage/CAS boundaries, command argument safety, helper reuse and maintainability. Seeded with:

- `code-review-universal/reference/typescript.md`;
- `code-review-universal/reference/code-quality-universal.md`;
- only diff-relevant `code-smells/docs/{primitive-obsession,duplicate-code,long-parameter-list}.md`, not a full-catalog audit.

Worst finding: **High — R1, read/discovery path widens provenance/visibility authority by writing inherited projection bytes into a trusted local branch overlay.** The CLI reproduction proves an actual information-isolation failure, not a style preference. R2 independently violates identity continuity: commit equality does not attest a durable ref incarnation. These shared findings are cross-referenced, not reranked.

Non-findings: publication Git commands use argv without a shell and freeze commit OIDs; rewrite mappings identify the exact checkpoint/snapshot; restricted roles deny admin operations before store access; the integration ledger uses a runtime-private workspace/run key; expected-revision CAS protects ledger mutation; canonical bundle duplication is intentional packaging, with parity verified. No cosmetic-only concern is promoted into an implementation defect.

Cross-axis ranking: **none**. Each axis retains its own worst finding and verdict input.

## Verification Status

- Goal achieved: **partial**; end-to-end publication is implemented, but two ordinary-read privacy guarantees fail.
- User goal: **partially met within Phase 6**; four configured backends publish/revoke an exact seal, but repo projection import and incarnation reuse bypass isolation.
- Scope adhered: yes for inspected Phase 6 changes. No unrelated source changes were made by the reviewer.
- Out-of-scope changes: none identified in the scoped implementation diff; other phases and pre-existing workspace metadata were not reclassified or changed.

## Guardrails Verdict

- Contract: **durable**, version **2**, runner **1.0.0**.
- Status: **pass**, command exit **0**.
- Gates: `unit_test_gate=pass`, `functional_test_gate=skipped`, `lint_gate=skipped`, `patch_gate=advisory`, `global_ratchet=pass`, `complexity_gate=pass`.
- Coverage: **88%** current / **84%** baseline / 90% target. Patch percentage `null`, 90% advisory threshold. Functional and lint disabled by contract.
- Complexity: 29 remaining baseline hotspots, baseline size 30, no new or hard-ceiling violations.
- Diagnostics: `[]`. Proposed ratchet changes were not applied; contract/baseline/enforcement remain unchanged.

## Exercised Verification

1. `npm run guardrails:check` — exit 0, structured durable-v2 verdict above. It was run against the reviewed code; only review Markdown was written afterward.
2. With an isolated local PostgreSQL 18 + pgvector fixture supplied through `BUCK_WORKFLOW_TEST_DATABASE_URL`: `npx vitest run skills/_shared/scripts/storage-publication.test.ts skills/_shared/scripts/file-store.test.ts skills/_shared/scripts/sqlite-store.test.ts skills/_shared/scripts/postgres-store.test.ts` — **4 files passed, 125 tests passed, exit 0, no skips**.
3. Disposable Bun harness launching actual fresh-process workflow CLI and runtime seal/bind on repo-files, external-files, SQLite and PostgreSQL — each emitted `before: []`, `after: ["sealed v1"]`, `revoked: []`. No reader publication IDs were injected. A fresh Git worktree was used for each reader.
4. Same real CLI harness with tracked repo-files v1/v2 and an advanced configured integration ref — **R1 reproduced**: list returned unsealed revision `a2be43f8-4957-4318-a8b7-d0e48ffeb8ad` = `UNSEALED v2`, while publication-view selected sealed revision `7b517275-d413-4f71-a6a0-32662883812e`.
5. Same real CLI harness with a deleted external-files topic ref, recovery observation while absent, then recreation at the exact old OID — **R2 reproduced**: old and fresh IDs both `branch-2ba9060b-befb-4b31-b973-cd084263399f`, `deletionObserved: true`, ordinary list `["old incarnation private"]` without selected recovery/rebind.
6. `diff -rq` of canonical/plugin storage and `cmp` of changed workflow CLI/service/publication tests/file tests/access docs — exit 0, byte parity.
7. Importing installer `SHIPPED_STORAGE_FILES` without invoking installer actions — `{files:19, publication:true, missing:[]}`. This checks shipped inventory only, not a full install.

Temporary harness, isolated Git/store roots and reviewer-owned database container were removed. No application code or permanent test was modified. No real interactive OMP/TUI or full Phase 8 workflow was launched; those surfaces are not claimed verified by the CLI smoke.

## User Goal Analysis

- Goal: inherited parent goal is configurable durable storage, reliable resume and branch-private unmerged work; phase goal is its publication/recovery policy.
- Met: four real adapters retain exact seals and evidence; actual configured CLI retrieves v1 after valid integration and withholds it after proof revocation. Mappings/conflicts/recovery have substantive all-backend behavioral coverage.
- Partial: ordinary visibility remains inconsistent with the proven ledger in repo-files, and recovery does not enforce incarnation separation on same-tip recreation.
- Missing: protections and regression cases described in R1/R2; no additional feature scope is requested.
- Verdict: **partially met**.

## Documentation Impact

- Architecture/convention impact: persisted versioned integration views, exact mapping authority, artifact-vs-code ancestry conflict semantics and private recovery scope selection are newly implemented. The shared access contract is updated, but living `docs/` contains no `publication-view`, `map-checkpoint`, `revoke-mapping`, `resolve-publication` or `scopeToken` reference (targeted search returned no matches).
- Recommended: `/b-docs` after accepted correctness work and before `/b-save`; non-blocking, not an iteration defect. Parent Phase 8 also owns final end-to-end documentation/package closeout.

## How-to Impact

- Operator procedures need coverage: enable configured publication, inspect exact checkpoints, map/revoke rewritten history, resolve a candidate set and select/export/rebind an orphan scope. Existing `docs/howto/recover-buck-loop.md` addresses supervisor interruption, not storage-publication administration.
- Recommended: `/b-docs` first because both why/how are affected; let it follow `/b-howto`. Non-blocking and excluded from iteration defects.

## Issue Classification

- In-plan issues: **2 High** — R1 unsealed repo projection import; R2 deleted/recreated ref identity reuse. Details, observed output and concrete fixes are in `iterate-phase-6-publication-boundary-rereview.md`.
- Out-of-plan issues: **none**.
- Prior iteration's production integration, mapping/conflict, adapter-reconciliation, required-complexity and bundle-parity defects are not repeated as open findings; current evidence establishes their repairs, subject to R1/R2's remaining boundaries.

## Completion Audit

1. Objective restated as the seven phase deliverables and relevant parent safety claims.
2. Each mapped above to current source and exercised behavior, not status fields.
3. Current source inspected and authoritative deterministic contract run.
4. Configured CLI/runtime behavior exercised on all four real backends; no broader interactive-runtime claim.
5. Counterexamples remain partial/missing guarantees, never accepted because tests or checkboxes pass.
6. Review finished on both axes; implementation acceptance remains **Needs work**. No lifecycle/phase status was changed and no supervisor continuation choice was made.

## Recommended Next Step

Return these in-plan findings to the supervisor. Corrective route: `/b-iterate` against `iterate-phase-6-publication-boundary-rereview.md`, then fresh `/b-review` against the exact Phase 6 path. Documentation/save/commit follows accepted correctness work. The review records no SQL save, commit or next-loop-state decision.
