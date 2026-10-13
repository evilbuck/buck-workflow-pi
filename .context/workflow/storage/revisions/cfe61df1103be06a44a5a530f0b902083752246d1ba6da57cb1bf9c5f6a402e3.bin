---
status: completed
date: 2026-10-12
subject: 2026-10-10.durable-storage-adapters
topics: [review, storage, lifecycle, receipts, concurrency]
addresses: phase-3-domain-semantics.md
review_verdict: request-changes
---

# Plan Path Review: Phase 3 — Domain Semantics

## Verdict

**Needs work.** The receipt initialization race is resolved in current runtime evidence. One retained in-plan discovery defect remains: malformed lifecycle provenance is discarded, so malformed subjects remain selectable. This was previously ranked below waterline; that disposition is not implementation evidence or an override of the phase's preserved authority contract. No newly discovered defect or new ranking is asserted.

## Plan Source
- File: `.context/2026-10-10.durable-storage-adapters/phase-3-domain-semantics.md`.
- Goal: storage-neutral lifecycle/discovery, branch-scoped corrections, truthful attempt-bound receipts, visibility-before-retrieval, and copy-on-write branch views.
- Parent: `plan-durable-storage-adapters.md`, step 3; followed its `research-durable-storage-adapters.md` link.
- Baseline: HEAD `849ef5a63791a4ca3e2a131067481b862f16c179`; combined staged/unstaged source plus untracked `migrations/004_domain_semantics.sql`. Source-state verification, not completed status/checkmarks, governs.
- Scope: this phase only. Legacy caller paths may remain until Phases 4/5; native tools/CLI, production cutover, Git publication/reconciliation, and existing-data migration are not certified here.
- Subject: explicit phase input resolves `2026-10-10.durable-storage-adapters`; stale workflow session pointer does not override it.

## Evidence Sources
- Initial Git status: pre-existing staged implementation/tests/docs/reviews/iterations/draft, unstaged phase/overview/helper/recall/adapter-utils changes, untracked migration and supervisor ranking/review records. None belongs to this reviewer.
- Relevant commits: `849ef5a` four durable adapters; `065b776` contract/config/identity boundary. Phase 3 source remains uncommitted.
- Modified groups inspected: canonical storage contract/domain/visibility/adapter-utils/file/SQLite/PostgreSQL/conformance, lifecycle and context helpers, shared/PostgreSQL tests, additive migration, recall protocol and context-artifact docs. Canonical/plugin parity exercised.
- Phase affected-file mapping: lifecycle uses the shared text authority; context/discovery uses store-backed domain seams. The unchanged `plan-acceptance.ts` text parser remains reused by lifecycle. Existing buck-loop readers/writers and broader skill protocol cutover are explicitly later-phase work, not missing implementation in this review.
- Prior iterations/reviews: sequential duty binding and completed-filter discovery repairs remain present. Latest receipt-race iteration resolution was checked against actual source/API behavior, not its completed field.
- Supplied memory was used only as untrusted historical reference. No SQL memory call or historical Markdown-memory write made.
- `.context/workflow/current-session.json` names an unrelated old subject and contains no active goal; no goal-mode budget/objective check applies.
- Historical memory ledger was read; no Phase 3 save receipt is certified by this review. Save/commit remain supervisor-owned.

## Completion Matrix

| Deliverable / criterion | Status | Direct current-state evidence |
|---|---|---|
| 1. Storage-neutral lifecycle inspection/transitions, conditional writes, evidence-before-close and malformed refusal | ✅ complete | `domain.ts:67–88`; `subject-lifecycle.ts:234–254,320–359`; adapter locks/transactions. Fresh direct API initialize/activate/close, open-evidence refusal, stale transition refusal, and malformed-transition refusal passed on all four backends. Focused lifecycle/conformance tests passed. |
| 2. Branch-local correction/idempotency; no global supersession | ✅ complete | `domain.ts:21–24,59–64,90–96`; scoped adapter correction implementations. Direct inherited correction/replay/tombstone left another branch's exact published body intact on every backend; shared regressions passed. |
| 3. Attempt identity/revision binding, meaningful no-fact, required metadata before completion, same-scope readback | ✅ complete | `domain.ts:98–140,178–201`; PostgreSQL `postgres-store.ts:107–142` locks project/run before any attempted-state read. Direct row/no-fact missing-duty/identity refusal and verified metadata-write completion passed on all four backends. Twelve forced real PostgreSQL first-writer races rejected every conflicting contender and retained obligations; 24 late writers rejected after completion. Both permanent receipt race regressions passed. |
| 4. Overlay/baseline discovery with lifecycle authority | 🔄 partial | `domain.ts:147–169`; completed and published legacy subjects/target links remain excluded independently of result filters; fresh shared tests and direct filtered closed-backlog smoke pass. Missing: retain malformed provenance and exclude malformed subjects/backlog/links during ordinary discovery (R1 below). |
| 5. Visibility before body loading/ranking/LIMIT/pagination on every backend | ✅ complete within phase | File `file-store.ts:138–145,211–227`; PostgreSQL `postgres-store.ts:24–36,145–160`; SQLite `sqlite-store.ts:40–50,162–179`; common overlay `visibility.ts:11–32`. Direct three-term private candidate could not displace published/current visible one-term matches through limit-1 pages on any backend. SQL metadata selection precedes exact-body loading; file reads reconcile only scope-eligible current bodies before ranking. |
| 6. Copy-on-write branch views; private revisions do not overwrite baseline | ✅ complete | Overlay and immutable selected revision loading retain published v1 after owner advances to private v2. Fresh independent API retention and correction/tombstone checks passed on every backend; selected-revision concurrency regressions passed. |
| Implementation step 1: lifecycle/context/acceptance/resolution semantics | 🔄 partial | Shared text authority and unchanged acceptance parser are reused; conditional lifecycle behavior is verified. Missing: preserved malformed refusal in ordinary store-backed discovery (R1); not a request to move later callers early. |
| Implementation step 2: scoped correction, idempotency/history | ✅ complete | Shared reducers and scoped adapter state retain immutable predecessor bytes and deterministic replay; direct API and conformance evidence above. |
| Implementation step 3: save attempts/receipts/readback | ✅ complete | Scope/duty validation and transactional locking verified, including absent-row initialization and completing-receipt contention. No backend fallback or false success on tested mismatches. |
| Implementation step 4: scoped knowledge resolver | ✅ complete within phase | `lookupKnowledge` (`domain.ts:171–176`) exposes list/search only; all four adapter negative visibility/page checks passed. Legacy raw SQL is explicitly not this resolver; normal caller removal remains Phase 4. |
| Implementation step 5: COW with explicit publication input | ✅ complete | Exact supplied published revisions retain immutable bytes independently of the owner's current pointer. Real Git publication eligibility is Phase 6, not claimed here. |
| Blocking assumptions assigned here | ✅ complete | Parent ledger A-1/A-2/A-3/A-5 records validated decisions. A-4 runtime validation is assigned to completed Phase 1, not reopened. No deferred/blocking assumption is assigned to this phase. |
| Material risk 3: visibility bypass / retaining stored state while caller is disabled | ✅ complete within phase | Current-branch/published filtering and negative pagination/body checks pass. Legacy callers remain intentionally uncutover; their privacy is not newly certified or used as a fallback. The domain seam can remain disconnected while a leaking caller is repaired; native/tool activation belongs to Phase 4. |
| Material risk 5: partial/concurrent writes, scoped supersession, previous snapshot recovery | ✅ complete | Fresh stale-batch rollback and real PostgreSQL precommit connection-loss tests retain the previous pointer/body. Direct branch correction retention and receipt races passed; mismatches leave attempted receipts unchanged. No automatic backend fallback introduced. |
| Deterministic verification | ✅ complete | Fresh durable v2 guardrails pass, 90.1% coverage versus 84% baseline; no new complexity/hard-ceiling violation. Passing gates do not negate R1. |

## Review Axes

### Spec / acceptance-contract axis
- Worst finding: **R1 — malformed lifecycle provenance is discarded in ordinary discovery**, retained in-plan authority defect.
- PostgreSQL receipt-race finding is resolved by current source plus independent runtime evidence, not merely iteration status.
- Axis verdict: **Needs work** for the preserved discovery contract. No new acceptance violation substantiated.

### Standards axis — separate sequential fallback
No background/sub-agent dispatch tool was available. A separately scoped standards pass followed acceptance inspection and runtime evidence. Seeds: `code-review-universal/reference/typescript.md`, `reference/code-quality-universal.md`, and only the Duplicate Code, Primitive Obsession and Long Method definitions from `code-smells`. This was not a whole-catalog audit.
- Checked: shared authority reuse, typed lifecycle boundaries, SQL parameterization, async failures, transaction rollback, absent-row/lock ordering, immutable selected-body loads, correction scope/hash checks, duty-set semantics, and behavioral regression quality.
- Worst finding: **R1**, losing an existing provenance/refusal field at the discovery boundary. The existing filesystem helper fails closed for malformed provenance; the new reducer discards that same field. No new standards-only defect substantiated.
- Receipt lock now precedes both absent-row initialization and updates, and remains held through validation, upserts, readback and commit. Real-query scheduling tests assert consumer-visible rejection and durable state, not copied/mock results.
- SQL dialect duplication and physical plugin mirrors are intentional. Lifecycle/receipt/correction policy stays shared; no alternate authority or additional dependency was introduced.
- Axis verdict: **Needs work**, retained R1 only.
- Cross-axis ranking: **none**. No merged ranked list, severity arithmetic, or native-judgment call performed.

## In-plan Finding R1: Malformed subjects remain selectable
- **File:** `skills/_shared/storage/domain.ts:151–161` and bundled copy.
- `inspectStoredLifecycle()` returns `provenance` (`domain.ts:67–72`), but discovery retains only `effectiveState`. An active malformed index enters returned subjects; associated reusable backlog/links are not excluded.
- The existing authority seam refuses malformed selection (`context-helpers.ts:409–412`; shared subject-resolution protocol). Phase 3 step 1 ports these semantics; this is not a new architectural requirement or later production-caller cutover.
- Earlier four-backend runtime observation: `review-phase-3-domain-semantics-rereview-2026-10-12.md:84–89,107–112`. Current source remains unchanged on that path. Known observation was not rerun merely to reconfirm it; this run independently verified malformed-transition refusal, which remains correct.
- Prior supervisor ranking: Medium/below waterline, `ranking-2026-10-12T21-43-03-353Z.md:15–19`. This report preserves that provenance without re-ranking or choosing supervisor routing. No explicit phase-contract override is recorded; a known in-plan defect cannot be presented as fixed or complete.
- Proposed fix: retain full lifecycle inspection from the same visible snapshot; filter malformed subjects and their reusable entries/target links, preserving explicit recovery and valid index-less backlog. Add shared four-backend regression with malformed and valid controls.
- Artifact: `iterate-phase-3-malformed-discovery.md` contains the bounded proposal. No source fix was made by the reviewer.

## Verification Status
- Goal achieved: **partial**, due solely to retained malformed-discovery authority gap.
- User goal: **partially met within this phase** — branch-private baseline/COW/retrieval and truthful receipt closeout work; discovery still loses a refusal signal.
- Scope adhered: **yes**. No source, phase/lifecycle, backlog, workflow, ranking, or draft-commit mutation by this assignment.
- Out-of-scope changes introduced: **none**. Later caller/tool/publication/migration work is not prematurely required or claimed complete.

## Guardrails Verdict
- Contract: **durable**, version **2**, runner **1.0.0**; status **pass**.
- Gates: `unit_test_gate=pass`, `functional_test_gate=skipped`, `lint_gate=skipped`, `patch_gate=pass`, `global_ratchet=pass`, `complexity_gate=pass`.
- Enforcement: unit/global-ratchet/complexity required; patch advisory; functional/lint disabled.
- Coverage: **90.1%**, baseline **84%**, target **90%**.
- Patch: runner reports pass with **null** percentage. No measured patch coverage percentage claimed.
- Complexity: **30** existing baseline hotspots, no new violations, no hard-ceiling violations. No baseline/enforcement edit or proposed ratchet update applied.

## Exercised Verification
1. `BUCK_WORKFLOW_TEST_DATABASE_URL=<isolated PostgreSQL 18 with pgvector> npm run guardrails:check` — exit 0, emitted verdict above.
2. Same database, after guardrails completed: `npx vitest run skills/_shared/scripts/{file-store,sqlite-store,postgres-store,storage-conformance,subject-lifecycle}.test.ts` — **5 files, 129 tests passed, no skips**. Includes both receipt concurrency regressions.
3. `npx tsc --ignoreConfig --noEmit --strict --target ESNext --module NodeNext --moduleResolution NodeNext --skipLibCheck --types node skills/_shared/storage/*.ts` — exit 0, storage-library only; no whole-repository typecheck claim.
4. Independent throwaway Bun API scenario against temporary repo/external roots, on-disk SQLite and a separate PostgreSQL smoke database. All four backend summaries emitted `result: pass`, **three visible limit-1 pages** and **two completed row/no-fact receipts** each. Exercised published v1/private v2 retention, inherited branch correction/replay/tombstone, private high-score negative pagination, lifecycle initialize/activate/evidence/stale/malformed refusal, filtered closed-backlog exclusion, missing-duty/identity refusal, unchanged attempts and completion after actual metadata write/readback.
5. Additional independent real-query scheduling scenario: **12 forced PostgreSQL first-writer races**, **0 accepted conflicting contenders**, **24 late writers rejected**, winning duties retained, missing-duty completion refused, complete state retained. No database rows or persistence responses mocked.
6. `diff -rq` canonical/bundled storage; `cmp` lifecycle/context-helper/recall and PostgreSQL test mirrors — exit 0.

Review added no permanent tests or source edits. This phase exposes domain APIs; those actual APIs were exercised, not only tests. No live OMP/CLI/browser end-to-end claim because those surfaces are later phases. Temporary smoke code/data and the reviewer-owned disposable PostgreSQL container were removed after verification.

## User Goal Analysis
- Goal: users choose durable storage, resume reliably, and keep unmerged work out of unrelated branches' ordinary retrieval.
- Met within this phase: branch-private retrieval/COW, scoped correction/history, conditional lifecycle transitions, attempted-duty binding, same-scope persistence/readback and concurrent receipt authority.
- Partial: discovery authority still drops malformed provenance.
- Missing within this phase: malformed-selection refusal and its shared regression; proposal is in the iteration artifact.
- Not judged here: native/config-bound workflow integration and Git publication/migration remain assigned to later phases.
- Verdict: **partially met**.

## Documentation Impact
- Shared module boundaries, receipt-duty attestation, project/run advisory locking and filter-independent completed discovery are already documented in `docs/context-artifacts.md:22–77`.
- No additional convention/decision/domain-language change required if R1 restores the existing authority contract. No documentation correctness issue added to the iteration artifact.
- Recommended: no additional `/b-docs` task from this review; existing implementation documentation closeout remains supervisor-owned.

## How-to Impact
No new user-facing action in this semantics phase. Native tool/CLI is Phase 4. No how-to impact; no `/b-howto` recommendation.

## Issue Classification
- In-plan unresolved: **one retained finding, R1**, ordinary malformed discovery → recommended `/b-iterate` proposal above. Previously below-waterline disposition is retained; reviewer does not override supervisor ranking/routing.
- In-plan resolved: latest PostgreSQL receipt initialization race and prior sequential duty/completed-filter defects are supported by fresh evidence.
- Out-of-plan discoveries: **none**.

## Completion Audit
1. Objective restated as six concrete phase deliverables plus relevant parent assumptions/risks.
2. Every deliverable mapped to source ranges and runtime evidence in the matrix.
3. Current code read; durable deterministic check contract executed fresh.
4. Actual domain APIs exercised on every required backend; later caller/publication behavior not claimed.
5. Remaining authority defect stays partial despite completed phase fields and passing checks.
6. Both review axes completed; no truncated review or partial checkpoint substituted for this deliverable.

## Recommended Next Step
Recommend addressing retained R1 through `/b-iterate`, then independent `/b-review` against this exact phase. This is a recommendation, not a loop-state selection. Supervisor owns ranking/routing, phase state, documentation closeout, save and commit. No commit made.

## Assignment Ownership
Only this report and `iterate-phase-3-malformed-discovery.md` were created for this assignment and are staged by their exact paths. Pre-existing staged/unstaged/untracked implementation and workflow records were not staged, modified or committed by this reviewer.
