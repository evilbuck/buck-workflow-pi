---
status: active
date: 2026-10-16
subject: 2026-10-10.durable-storage-adapters
topics: [code-review, publication, branch-isolation, recovery]
review_verdict: request-changes
phase: phase-6-publication-recovery.md
---

# Plan Path Review: Phase 6 existing-pointer publication boundary

## Verdict

**Needs work — one newly reproduced High in-plan privacy defect.** The previous missing-pointer projection repair works, but existing repo-files pointers still treat clean tracked bytes arriving through Git as local direct edits. A fresh CLI returns unsealed v2 while the adapter's publication view selects sealed v1. The earlier same-tip branch-incarnation issue remains unresolved and previously ranked below waterline; its disposition is preserved, not promoted or rerun.

This completes the assigned review, not implementation acceptance. No supervisor continuation, phase/lifecycle transition, SQL save or commit was performed.

## Plan Source

- File: `.context/2026-10-10.durable-storage-adapters/phase-6-publication-recovery.md`.
- Parent: `plan-durable-storage-adapters.md`, step 6, design contract §4 and material risks 1–2. Parent research and shared decision-closure protocol were read.
- Goal: exact sealed checkpoint binding, ancestry-proven publication, explicit rewritten-history mapping, versioned reconciliation/conflict resolution and selected orphan recovery.
- User goal: choose durable storage, resume reliably and keep unmerged knowledge invisible on unrelated branches; this review assesses Phase 6's contribution, not unfinished Phases 7–8.
- Baseline: HEAD `390bc3b8accc64b5a9cfea7864501f79e0c9ce91` plus all existing staged/unstaged Phase 6 implementation. Source-state verification avoids unrelated long-lived branch history.

## Evidence Sources

- Git status: substantial pre-existing staged Phase 6 source/bundle/tests/review artifacts, unstaged phase/overview/iteration metadata and untracked ranking/supervisor reports. All were preserved. Only the two new review/iteration Markdown files from this assignment are staged.
- Relevant recent commits: `390bc3b` remaining-consumer authority; `f235435` receipt runs; `5a31384` consumer scope; `202ca5d`/`fbe9b5a` trusted access. These establish baseline only.
- Modified files inspected: `extensions/buck-loop/{loop,persist,types}.ts`, `extensions/workflow-state/index.ts`, `skills/_shared/scripts/{workflow-state,workflow-state-cli,storage-publication.test,file-store.test}.ts`, `skills/_shared/storage/{contract,domain,file-store,sqlite-store,postgres-store,publication}.ts`, shared workflow-access documentation, installer/sync diff and corresponding plugin mirrors.
- Supporting current source: trusted branch identity, store visibility/overlay rules, consumer-private kind binding, correction lineage and immutable/CAS mutation boundaries.
- Workflow context: explicit phase takes precedence over stale current-session subject pointer. No non-null goal in current-session; no goal-budget audit applies. Supervisor recall reused, no `sql_memory` call. Backlog and historical memory index read without modification.

## Completion Matrix

| Deliverable | Status | Current evidence / remaining gap |
|---|---|---|
| 1. Explicit exact sealing/binding, post-seal bytes stay private | 🔄 partial | `workflow-state.ts:386–409`, `loop.ts:490–493,1167–1184` and all adapters implement real immutable seal/bind. Actual configured CLI on every backend publishes sealed v1, not unsealed v2, in fresh-pointer cases. **Missing:** existing repo-files pointer reconciliation must not adopt incoming clean tracked v2; R1 below. |
| 2. Eligible source plus bound-anchor ancestry; negative/error distinction; no fetch | ✅ complete for publication policy | `publication.ts:6–40,55–60,107–116` freezes resolved OIDs, uses the actual binding and distinguishes exit 1 from errors. Real fixtures exercise inherited anchors, unrelated bindings, missing refs and rewrite revocation. Git commands are local rev-parse/merge-base, no fetch. Separate projection bypass remains R1. |
| 3. Full Git/privacy matrix and ordinary retrieval | 🔄 partial | Fresh all-backend run: 126 tests pass, including preserved merge/FF, squash/rebase, mappings, missing refs, rewrite/revert, conflicts, renamed/recreated/workspace scopes. Configured CLI/two-worktree smokes exercise trusted retrieval. Fresh-pointer tracked-v2 regression at `storage-publication.test.ts:196–234` passes. **Missing:** existing-pointer tracked-v2 protection/regression (R1), and previously retained equal-tip incarnation guarantee (W1). |
| 4. Exact explicit squash/rebase mapping | ✅ complete | `publication.ts:62–81,187–201`; handlers `workflow-state.ts:501–515`. All four adapter fixtures reject subsets, duplicates, wrong checkpoints and patch-id-only evidence; target reachability and explicit revocation are exercised. |
| 5. Versioned reconciliation, revocation/revert, independent conflicts/baseline/resolution | 🔄 partial | `publication.ts:83–105,128–208` persists immutable CAS-ledger views and candidate-bound resolution; `storage-publication.test.ts:124–170` exercises correction-vs-code ancestry, preserved baseline, unrelated advancement and tombstones on every adapter. Runtime rewrite smoke revokes publication. **Missing:** ordinary repo-files results must not override this authority with incoming unsealed direct-edit revisions (R1). |
| 6. Retained orphan provenance; selected export/rebind; no name inheritance | 🔄 partial | `workflow-state.ts:626–694` lists identity/workspace/adapter scopes and selected export/rebind without deletion; real fixtures at `storage-publication.test.ts:236–272` pass across every adapter. **Missing:** previously reported observed-deletion/same-tip incarnation separation remains unchanged (`bindBranch:143–164`, recovery `666–672`); W1, retained below-waterline disposition. |
| 7. Run projections/receipts/cursors/pass audits/attribution/dedupe stay private | ✅ complete within this phase | `publication.ts:108,118–125,210–211` excludes private-workspace checkpoints, workspace/run artifacts and six private kinds; `consumers.ts:10–44` binds private kinds, `visibility.ts:11–23` checks exact run/worktree. All-backend after-merge fixtures expose only knowledge. |
| Relevant parent assumptions | ✅ complete | Parent ledger `53–62` has no deferred blocking assumption assigned to Phase 6. Central-attestation and four-adapter decisions were not reopened. |
| Material risk 1: unsealed/inherited leakage; retain/revoke fallback | 🔄 partial | Exact seals, binding, immutable retention and revocation work through actual configured CLI on every backend. Existing-pointer projection reconciliation still bypasses the mitigation; R1. |
| Material risk 2: incarnation/ref edges; selected recovery fallback | 🔄 partial | Real recovery/export/rebind and workspace retention fixtures pass. Same-tip name reuse remains a known unfulfilled safety guarantee, not proof of a fresh incarnation; W1. |
| Deterministic contract | ✅ complete | Fresh `npm run guardrails:check` exits 0: durable v2 required unit/global-ratchet/complexity pass, 88% coverage versus unchanged 84% baseline. |
| Canonical/package subset in Phase 6 | ✅ complete for inspected inventory | Storage directory and changed workflow/CLI/test/access pairs are byte-identical. Installer inspection reports 19 storage files, publication included, missing `[]`. No fresh full installation/Phase 8 claim. |

## Review Axes

### Spec / acceptance-contract axis

Worst finding: **High — R1: existing repo-files pointers adopt clean tracked unsealed merge bytes as direct edits**, violating criteria 1/3/5 and material risk 1. The previous missing-pointer repair is not sufficient for the existing-pointer path.

**R1 evidence:** `file-store.ts:105–130,503–506`; `workflow-state.ts:440–446,478–483`. Projection ownership stamps establish prior projection ownership, not local authorship of new file contents. `store.read(key)` can reconcile before the missing-pointer Git-status guard runs. When Git replaces the file during fast-forward, the stamp still matches the receiving branch and permits a new private overlay containing incoming v2. That overlay masks the valid seal.

Actual separate-process CLI output:

```json
{"scenario":"existing-reader-projection-after-merge","sealed":"4255e65d-16e2-4bde-be9b-725ecc025fbf","actual":[{"text":"UNSEALED v2","revision":"06666eef-9fe6-4601-9aff-09cf71f199bd"}]}
```

The same operator publication-view still selects sealed revision `4255e65d-16e2-4bde-be9b-725ecc025fbf`, SHA-256 `8d41cd5c74d53401400fa783c4e34de31db1b00af06ad7ec8da9c35642596271`. Reader had its own baseline pointer and ownership stamp before fast-forward; no request adopted v2. Full reproduction and fix proposal: `iterate-phase-6-owned-projection-rereview.md`.

**W1 — retained known in-plan gap, previous ranking preserved:** `bindBranch` still reuses a branch ID on equal tip or ancestry from initial tip, and recovery's deletion observation is not persisted as retirement. Prior review's equal-tip recreation CLI evidence remains relevant; current source contains no repair. `ranking-2026-10-16T05-48-25-680Z.md:9–13` classified it Medium/below waterline. This review does not rerun that known counterexample, change its ranking or insert it as a newly escalated iteration issue. Criterion 6 and material risk 2 consequently remain partial, not complete.

### Standards axis — explicitly scoped sequential fallback

No background sub-agent dispatch tool is available. After the acceptance analysis, a separate standards pass examined changed TypeScript/JavaScript for async/resource ownership, runtime type/scope boundaries, command argument safety, immutable revisions/CAS, shared-helper reuse and maintenance risks. Seeded with `code-review-universal/reference/{typescript,code-quality-universal}.md` and only the diff-relevant `code-smells/docs/{duplicate-code,primitive-obsession,long-parameter-list}.md` subset.

Worst finding: **High — R1: mutable checkout bytes cross the trusted provenance boundary on a nominal read using a projection stamp as authorship evidence.** This is a reproduced isolation failure, not a style preference. No separate newly actionable standards defect was established.

Non-findings: publication proof reuses one shared implementation across adapters; SQL values are parameterized; Git uses argv and bounded local proof; mapped targets freeze OIDs; restricted roles deny admin operations before opening the store; ledger revisions use CAS and private scope; canonical/plugin duplication is intentional packaging and verified in sync. No cosmetic change is requested.

Cross-axis ranking: **none**. Each axis retains its own worst finding; shared R1 is cross-referenced, not reranked.

## Verification Status

- Goal achieved: **partial**. Production publication/recovery is substantive, but the ordinary retrieval invariant still has an existing-pointer bypass.
- User goal: **partially met within Phase 6**. Every backend's configured publish/revoke smoke works; repo-files ordinary retrieval can still expose unsealed incoming bytes. Known incarnation gap is retained.
- Scope adhered: yes for inspected implementation. No new unrelated feature scope identified; other phases' unfinished work is not counted against this phase.
- Out-of-scope changes: none identified in scoped implementation; pre-existing workspace edits were not changed by the reviewer.

## Guardrails Verdict

- Command: `npm run guardrails:check`, exit **0**, after all reviewed production changes; subsequent reviewer edits are Markdown only.
- Contract: **durable**, version **2**, runner **1.0.0**; status **pass**; diagnostics `[]`.
- Gates: `unit_test_gate=pass`, `functional_test_gate=skipped`, `lint_gate=skipped`, `patch_gate=advisory`, `global_ratchet=pass`, `complexity_gate=pass`.
- Coverage: **88%** current / **84%** unchanged baseline / 90% target. Patch percentage `null`, advisory threshold 90%. Functional/lint disabled by contract, not exercised or represented as passing checks.
- Complexity: 29 remaining baseline hotspots / 30 baseline size; new violations `[]`, hard-ceiling violations `[]`.
- Proposed ratchet updates were not applied. No threshold/enforcement/baseline changes.

## Exercised Verification

1. Fresh durable guardrails above: exit 0.
2. `BUCK_WORKFLOW_TEST_DATABASE_URL=<reviewer disposable PostgreSQL 18> npx vitest run skills/_shared/scripts/storage-publication.test.ts skills/_shared/scripts/file-store.test.ts skills/_shared/scripts/sqlite-store.test.ts skills/_shared/scripts/postgres-store.test.ts`: **126 passed, 4 files passed, no skips, exit 0**.
3. Actual fresh-process CLI plus runtime seal/commit/bind on repo-files, external-files, SQLite and PostgreSQL: each returned `before: []`, `after: ["sealed v1"]`, `revoked: []` and a persisted `published` checkpoint proof. Reader contexts did not inject publication IDs.
4. Separate actual configured repo-files existing-pointer/two-worktree CLI scenario produced R1 above. This extends the passing fresh-pointer regression rather than rerunning the old missing-pointer failure.
5. `diff -rq` storage mirrors and `cmp` changed workflow service/CLI/publication-test/file-test/access-document pairs: exit 0.
6. Side-effect-free installer inventory import: `{"files":19,"publication":true,"missing":[]}`. No installer actions or fresh full-install claim.

A first disposable harness run used incorrect SQLite config field `path` and was rejected; the harness was corrected to the actual `database` key before the complete four-backend smoke. No production issue is attributed to that harness error. Reviewer-owned temporary script/checkouts/stores and PostgreSQL container were removed. No application source/permanent test was modified. No interactive OMP/TUI or full Phase 8 workflow was launched or claimed verified.

## User Goal Analysis

- Goal: inherited configurable durable storage, reliable resume and current-branch-plus-proven-publication privacy.
- Met: exact runtime seal/bind, four real adapters, configured ancestry publication/revocation, exact rewrite mapping, conflict resolution and selected recovery have current source and behavioral evidence.
- Partial: ordinary repo-files existing-pointer reads bypass the proven view; known same-tip incarnation reuse remains unresolved.
- Missing: existing-pointer provenance check/regression (R1); previously retained incarnation guarantee (W1). Neither requires new feature scope.
- Verdict: **partially met**.

## Documentation Impact

- Architecture/convention impact: versioned integration proofs, explicit rewrite mappings, artifact-vs-code correction semantics and selected recovery need living documentation. Shared access document is updated, but targeted `docs/` search found no `publication-view`, `map-checkpoint`, `revoke-mapping`, `resolve-publication` or `scopeToken` reference.
- Recommended: `/b-docs` after correctness acceptance and before `/b-save`; non-blocking, not an iteration defect. Parent Phase 8 owns final docs/package integration.

## How-to Impact

- Operator procedures: enable publication, inspect/check exact seals, map/revoke rewritten history, select a conflict candidate and export/rebind an orphan scope. Existing storage access prose does not provide the living how-to coverage for these actions.
- Recommended: `/b-docs` first, allowing it to follow `/b-howto`; non-blocking and excluded from iteration findings.

## Issue Classification

- Newly actionable in-plan implementation defects: **1 High — R1**, existing-pointer unsealed projection adoption. Written to `iterate-phase-6-owned-projection-rereview.md`.
- Retained prior in-plan warning: **1 — W1**, same-tip branch-incarnation reuse, previously Medium/below waterline. Ranking disposition preserved and not duplicated as a new active issue.
- Out-of-plan issues: **none**.
- Prior helper-only/runtime integration, bound-OID, exact mapping, logical conflict, recovery enumeration, complexity and bundle defects have substantive repairs and are not repeated as open defects. Missing-pointer projection import is now covered by a passing real CLI regression.

## Completion Audit

1. Objective restated as the phase's seven deliverables and relevant parent safety claims.
2. Deliverables mapped to source and actual behavioral evidence in the matrix.
3. Current source inspected and deterministic contract run; status fields were not accepted as proof.
4. Verification matches claims: real databases/Git and configured CLI/runtime seams; no broader interactive-runtime claim.
5. R1 and retained W1 remain partial guarantees despite passing guardrails/tests; no uncertain guarantee marked complete.
6. Both review axes finished using the permitted sequential fallback. Review delivered; implementation verdict remains Needs work.

## Recommended Next Step

Return R1 and this evidence to the supervisor. Corrective route: `/b-iterate` against `iterate-phase-6-owned-projection-rereview.md`, then `/b-review` against the exact Phase 6 path. Existing ranking disposition for W1 remains the supervisor's concern. After accepted correctness work: `/b-docs` (following how-to coverage) → `/b-save` → `/b-commit`. Historical memory index does not record this review; new SQL-backed reusable closeout belongs to the supervisor's save stage. No loop state was selected.
