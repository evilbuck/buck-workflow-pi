---
status: active
date: 2026-10-12
subject: 2026-10-10.durable-storage-adapters
topics: [review, storage, domain-semantics, branch-isolation]
review_verdict: request-changes
phase: phase-3-domain-semantics.md
iteration: iterate-phase-3-domain-semantics.md
---

# Plan Path Review: Phase 3 domain semantics

## Plan Source
- File: `.context/2026-10-10.durable-storage-adapters/phase-3-domain-semantics.md`.
- Parent: `plan-durable-storage-adapters.md`, step 3.
- Goal: storage-neutral lifecycle, scoped corrections, truthful attempts/receipts, branch-overlay discovery and visibility-before-ranking/page.
- User goal: choose durable per-project storage and keep unmerged work invisible to other branches.
- Baseline: HEAD `849ef5a63791a4ca3e2a131067481b862f16c179` (Phase 2 adapters). Reviewed combined staged/unstaged current state and untracked domain/migration files. Phase checkbox/completed fields were not used as proof.

## Evidence Sources
- Initial Git status: mixed staged/unstaged implementation and context edits; untracked `migrations/004_domain_semantics.sql` and canonical/bundled `domain.ts`. These pre-existing changes were not modified or staged by this assignment.
- Recent commits: `849ef5a` four adapters; `065b776` contract/config/identity.
- Modified files: canonical/bundled storage contract, visibility, adapter-utils, file/SQLite/PostgreSQL adapters, conformance; subject-lifecycle/context-helpers; PostgreSQL/storage-conformance fixtures; recall protocol; Phase 3/overview/implementation notes/draft commit. New domain module and migration 004.
- Affected-file verification: extracted text close verification in `subject-lifecycle.ts:132-230`, completed-ID helper in `context-helpers.ts:415-420`, shared domain policy and adapter operations inspected. `plan-acceptance.ts` remains the reused unphased closeout authority. Buck-loop/filesystem caller cutover intentionally remains in Phases 4/5, as this phase's risk note permits; no missing-caller-cutover defect is assigned here.
- Supervisor-provided memory used only as reference; no SQL memory call.
- Workflow current-session metadata points at an unrelated older subject and has no active goal. Explicit phase input wins; no goal-mode-specific audit is applicable.

## Completion Matrix

| Deliverable | Status | Direct evidence and missing piece |
|---|---|---|
| AC1: storage-neutral lifecycle, conditional transitions, refusal/close authority | Partial | Text close parser reused; malformed index/unfinished plan refusal passes conformance (`conformance.ts:133-147`). All four smokes accepted stale initial `fromRevision` and reasonless reopen. Store inspection omits index/legacy effective-state authority. PostgreSQL closes despite a concurrently reopened plan. Issues 3, 7. |
| AC2: scoped correction/idempotency; B retains predecessor | Partial | Existing local A correction/replay/tombstone and B exact history pass (`conformance.ts:116-131`). First correction of a published inherited predecessor fails on all four stores. Issue 5. |
| AC3: matching attempt identities, complete metadata/readback, meaningful no-fact | Partial | Branch mismatch/revision-set/missing-readback rejection and no-fact probe-label completion pass (`conformance.ts:80-114`). Actual receipts completed with another run/worktree's private revision. Issue 6. No-fact path accepts a caller-supplied `probe` duty; live probe execution by migrated callers is not claimed in this phase. |
| AC4: overlay/published links/backlog/index discovery; completed exclusion | Partial | Same-branch closed backlog/link exclusion passes (`conformance.ts:170-193`); all four stores expose a closed main subject index to branch B through published artifacts. Published baseline also disappears after a newer unpublished revision. Issues 2, 4. |
| AC5: visibility before bodies/ranking/LIMIT/page | Partial | Private candidate pagination fixture passes (`conformance.ts:152-168`); selected bodies are then loaded through mutable current pointers. Both file stores leak direct edits and PostgreSQL leaks a concurrent unpublished revision. Issue 1. |
| AC6: COW branch overlays preserve baseline | Partial | Distinct A/main revision overlay passes (`conformance.ts:55-74`). Updating the baseline owner's current pointer from published v1 to private v2 removes v1 from another branch's view on every backend. Issue 2. |
| Implementation 1: port shared authority/discovery policy | Partial | Pure text close seam and domain discovery exist. Legal lifecycle transitions/inspection remain a separate, weaker policy; published lifecycle view not implemented. Issues 3, 4, 7. |
| Implementation 2: branch-local revisions/tombstones/history | Partial | Local corrections, replay/conflict refusal and immutable history exist. Inherited predecessor COW missing. Issue 5. |
| Implementation 3: same-adapter attempts/receipts/readback | Partial | Transactional receipt writes exist and tested identity failures refuse. Same run/worktree artifact readback is missing. Issue 6. |
| Implementation 4: visibility resolver/read surface | Partial | `domain.ts:117-122` delegates only to list/search; metadata scope precedes selection. Exact selected body/baseline resolution is unsafe. Issues 1, 2. |
| Implementation 5: COW views; publication remains Phase 6 | Partial | Branch pointers and supplied publication revision IDs exist. Read contract loses immutable baseline and cannot correct inherited revision. Issues 2, 5; no Phase 6 publication implementation required here. |
| Deterministic verification | Complete | Fresh durable v2 runner pass; focused 88/88 tests with PostgreSQL enabled. These checks do not establish the untested failing criteria above. |
| Phase behavioral verification | Partial | Four real-backend API smokes exercise changed surface and reproduce six failing boundaries; PostgreSQL race scenario adds stale-evidence close. Missing: corrected passing behavior and regressions. |
| Blocking assumptions | Complete | No unresolved blocking parent ledger assumption assigned here. A-4 runtime support was assigned/verified in Phase 1. Caller-cutover boundary evidenced by phase risk note and parent steps 4/5. |
| Deferred assumptions | Complete | No deferred assumption assigned to Phase 3; later cutover/publication validation paths remain in their named phases, not recast as this phase's defects. |
| Parent risk 3: visibility leak; disable leaking caller, no broad recall fallback | Partial | Store metadata filtering is present, but body loading leaks private bytes. Lookup route can be withheld while fixes land; legacy caller removal remains Phase 4. Issue 1 invalidates safety claim for this phase's read path. |
| Parent risk 5: stale writes, false completion, global supersession | Partial | Stale multi-write rollback and local correction isolation pass. Receipt cross-run readback and lifecycle evidence concurrency remain unsafe. Issues 5–7. |
| Other material recovery claims | Complete for this scope | Exact immutable predecessor bytes remain directly readable in conformance; file tombstone projections skipped (`file-store.ts:394-400`). Merge evidence revocation, orphan rebinding and migration rollback validations belong to Phases 6/7 and are intentionally not reviewed as implemented here. |

## Review Axes

### Spec / acceptance-contract axis
**Worst finding: private body leakage through selected-page mutable reads (issue 1).** Both file adapters returned private direct-edit bytes to branch B even though only old published v1 was allowed. All six acceptance criteria retain named gaps; verdict input: **Needs work**.

Other in-plan findings on this axis:
- Issue 2: published v1 disappears once its owner advances to private v2 (all four).
- Issue 3: initial lifecycle CAS/state authority and reopen refusal are not preserved (all four).
- Issue 4: published completed subjects remain discoverable on other branches (all four).
- Issue 5: first correction of an inherited baseline is impossible (all four).
- Issue 6: receipt readback accepts another run/worktree's revision (all four).

### Standards axis — separate sequential fallback pass
No task/sub-agent dispatch tool was available. Second pass seeded with `code-review-universal/reference/typescript.md`, `reference/code-quality-universal.md` (reuse, stringly typed state, redundant state, TOCTOU), and only `code-smells/docs/duplicate-code.md` and `speculative-generality.md`. Required future-phase framework methods were not flagged as dead code; canonical/plugin byte duplication is intentional packaging.

**Worst finding: PostgreSQL evidence-check/write TOCTOU (issue 7), `postgres-store.ts:88-100`.** Evidence loads/verification precede BEGIN. Scheduling a real committed plan edit at that boundary results in `state: completed` alongside a current active plan with an unchecked acceptance criterion. Current-state guardrails do not cover this race. Verdict input: **Needs work**.

The mutable selected-page read is independently also a TOCTOU risk; a separate PostgreSQL write at the metadata/body boundary returned revision `private` with `UNPUBLISHED private bytes` to a published-only branch-B query. Recorded as issue 1, not duplicated as another iteration item.

Cross-axis ranking: none. Findings remain grouped by axis; neither axis masks the other.

## Verification Status
- Goal achieved: partial.
- User goal: partially met; backing semantics exist on every adapter but branch-private retrieval and reliable authority/readback are not yet enforced on the exercised boundaries.
- Scope adhered: yes, using phase's explicit delayed caller-cutover allowance.
- Out-of-scope changes: none identified within reviewed Phase 3 edits. Pre-existing worktree changes preserved.
- Bundle parity: `diff -rq skills/_shared/storage plugins/buck-workflow/skills/_shared/storage` and `cmp` for lifecycle/context-helper copies returned exit 0.

### Executed scenarios
1. `npm run guardrails:check` with a dedicated real PostgreSQL test database: exit 0, structured verdict below.
2. `npx vitest run skills/_shared/scripts/{file-store,sqlite-store,postgres-store,storage-conformance,subject-lifecycle}.test.ts`: 5 files, **88 tests passed**, no skips. Actual command listed the five paths separately.
3. Throwaway `bun` direct API script against actual repo/external file roots, SQLite disk database, disposable PostgreSQL. Per backend: published v1 before draft `[v1]`; after private v2 `[]`; inherited correction `stale correction rejected`; stale initial close `ACCEPTED`; reasonless reopen `ACCEPTED`; published closed discovery `[index1]`; foreign-run receipt `ACCEPTED`. File-only direct edit query returned `PRIVATE direct edit` with a new unpublished revision ID.
4. Second throwaway `bun` concurrency script: real PostgreSQL writer committed open plan before closer BEGIN, leaving completed lifecycle + open plan; real pointer advance between page metadata/body read exposed `UNPUBLISHED private bytes`. Scheduling seams changed timing only; persistence and evidence operations were real adapter/database operations.
5. Throwaway scripts/temp data and dedicated review container removed after evidence capture; no implementation edits.

## Guardrails Verdict
- Contract: durable; version 2; runner 1.0.0.
- Status: **pass**.
- Gates: unit_test_gate=pass, functional_test_gate=skipped, lint_gate=skipped, patch_gate=pass, global_ratchet=pass, complexity_gate=pass.
- Coverage: 89.9%, baseline 84%, target 90%. Patch is advisory, runner value `patch: null` with gate pass; not a measured 90% patch claim.
- Complexity: 30 existing hotspots, no new/hard-ceiling violations.
- Proposed baseline increase was not applied by this read-only review.

## User Goal Analysis
- Goal: users can choose durable per-project storage and keep unmerged work invisible across branches.
- Met: four adapter domain methods, local overlay/tombstone/idempotency behavior, text-based close evidence verification, bounded visible metadata search/page and basic receipt mismatch refusal.
- Partial: lifecycle/discovery authority, inherited COW correction, baseline retention and exact scoped receipt readback.
- Missing: privacy guarantee on file-edit/concurrent page-body loading; current evidence protected through PostgreSQL close mutation.
- Verdict: **partially met** for this phase; later-phase native/CLI/caller/publication work is intentionally not claimed.

## Documentation Impact
- New `domain.ts` module and adapter-backed lifecycle/receipt/discovery contracts require architecture/convention documentation once corrected. Existing physical-path/legacy SQL docs describe the still-active old callers, so this review does not demand premature deletion or announce completed cutover.
- Recommend `/b-docs` after correctness re-review, before `/b-save`; retain the accepted Phase 8 full docs/packaging scope.

## How-to Impact
- No new user-facing CLI/tool/action introduced in this phase. Native/CLI workflows remain Phase 4.
- Recommended: none now.

## Issue Classification
- In-plan issues: **7**, detailed with fixes/reproductions in `iterate-phase-3-domain-semantics.md`.
- Out-of-plan issues: none.
- Documentation impact is non-blocking and not included in iteration issues.

## Completion Audit
1. Concrete objective: deliver the six scoped lifecycle/correction/receipt/discovery/visibility/COW criteria, not later caller or publication cutover.
2. Evidence: matrix maps every criterion to current source and executed cases.
3. Actual state: inspected adapters/domain/authority, ran durable contract and real persistence operations.
4. Verification scope: store API is the changed surface; real files/SQLite/PostgreSQL exercised, no browser/CLI capability claimed.
5. Uncertainty: completed fields and prior Jev confidence cannot establish the broken boundaries; all affected criteria remain partial.
6. Review coverage: both axes performed; no omitted phase acceptance item or invented sub-agent result.

## Verdict
**Needs work** — seven in-plan defects; green required guardrails do not override directly reproduced privacy/authority/readback failures.

## Recommended Next Step
`/b-iterate` against the staged iteration artifact, then `/b-review` against the same phase. The supervisor owns phase/loop transitions; this review made no transition or implementation fix. After accepted re-review: `/b-docs` if impact remains → `/b-save` → `/b-commit`. Phase 3 save is not yet recorded in historical memory or a subject SQL receipt; it must wait for accepted work.
