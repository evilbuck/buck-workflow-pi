---
status: completed
date: 2026-10-12
subject: 2026-10-10.durable-storage-adapters
topics: [review, storage, receipts, lifecycle, concurrency]
addresses: phase-3-domain-semantics.md
review_verdict: request-changes
---

# Plan Path Review: Phase 3 — Domain Semantics

## Verdict
**Needs work.** Sequential attempt-duty immutability and filtered completed-subject discovery are fixed. PostgreSQL concurrent first receipt writers still bypass the requirement binding: both succeed with conflicting duty sets, the later declaration replaces the earlier one, and completion succeeds with the reduced obligations. Required guardrails pass but do not cover this race.

## Plan Source
- Phase: `.context/2026-10-10.durable-storage-adapters/phase-3-domain-semantics.md`.
- Parent: `plan-durable-storage-adapters.md`, step 3; research: `research-durable-storage-adapters.md`.
- Goal: backend-neutral lifecycle/discovery, scoped corrections, truthful save attempts/receipts, visibility before body/ranking/page, and copy-on-write branch views.
- Baseline: HEAD `849ef5a63791a4ca3e2a131067481b862f16c179`; combined staged and unstaged implementation plus untracked `migrations/004_domain_semantics.sql`. Source state, not the completed phase status, governs this review.
- Scope boundary: retained legacy callers are explicitly allowed until Phases 4/5. Native/CLI cutover and publication/reconciliation are not required here.

## Evidence Sources
- Initial Git status: pre-existing staged implementation/docs/notes/reviews/iterations/draft; unstaged phase/overview/context-helper/recall/adapter-utils changes; untracked migration and supervisor ranking/review files. Left unchanged and unstaged by this assignment.
- Recent commits: `849ef5a` four adapters; `065b776` contract/config/identity. Phase 3 implementation remains uncommitted.
- Modified source groups inspected: canonical storage contract/domain/visibility/adapter-utils/file/SQLite/PostgreSQL/conformance; lifecycle and context helpers; shared and PostgreSQL behavioral tests; additive migration; recall protocol and living context-artifact docs. Bundle parity exercised.
- Affected-file evidence: lifecycle reuses one text authority; context helper supports completed exclusion; domain provides discovery/lookup/receipt/correction seams. `plan-acceptance.ts` remains the reused text parser; production buck-loop/skill caller replacement is deliberately later.
- Previous iteration evidence: `iterate-phase-3-domain-semantics-rereview.md`, current sources, 127 fresh focused tests, and independent direct API calls. Status fields are not proof.
- `current-session.json` names a stale different subject and has no active goal. Explicit phase input governs; no goal-mode objective/budget check applies.
- Historical memory index records Phase 1; supplied supervisor recall was reused only as reference. No SQL memory call or historical-memory write was made. Phase 3 save is supervisor-owned.

## Completion Matrix

| Deliverable / criterion | Status | Current-state evidence |
|---|---|---|
| 1. Lifecycle inspection/transitions storage-neutral, conditional, evidence-based, malformed-refusing | complete | `domain.ts:67–88`, `subject-lifecycle.ts:234–254,320–359`; adapters persist versioned indexes under locks/transactions. Fresh tests cover stale writes, malformed provenance and close refusal; direct API initialize/activate/close and missing-evidence refusal passed on all four adapters. Discovery provenance warning below is unchanged. |
| 2. Branch-scoped correction/idempotency, no global supersession | complete | `domain.ts:21–24,59–64,90–96`; adapter correction reducers preserve immutable predecessor history and write only owner-branch pointers. Fresh inherited correction/tombstone/replay conformance and direct API correction/replay leave branch B's exact baseline unchanged. |
| 3. Attempt/run/project/branch/revision binding, meaningful no-fact, metadata duties before completion and same-scope readback | partial | `domain.ts:98–140,178–201` and SQL duty loaders now reject sequential missing-duty/rewrite requests; direct row/no-fact metadata write/readback scenarios pass. Missing: PostgreSQL serialization of the first attempted receipt before its requirement set is read (R1). |
| 4. Overlay/baseline links/backlog/index discovery; completed excluded | complete | `domain.ts:147–169` resolves lifecycle independently of result filters. Fresh canonical/legacy/kind/name/source-filter regressions pass; direct filtered closed-backlog API scenario passes on all adapters. Malformed provenance is a retained separate warning, not claimed fixed. |
| 5. Visibility before body loading/ranking/LIMIT/pagination | complete within phase | File metadata selection `file-store.ts:211–225`, PostgreSQL `postgres-store.ts:24–36,142–158`, SQLite `sqlite-store.ts:40–50,162–179`, overlay `visibility.ts:11–32`. Direct high-rank private candidate matching three terms cannot displace two visible one-term matches across limit-1 pages on any backend. |
| 6. Copy-on-write: private revision does not overwrite published baseline | complete | Published history remains selectable independently of pointers; exact-revision body loading and inherited correction cases pass. Direct API retained published bytes after private v2 advance and after branch-A correction, on all four backends. |
| Step 1. Shared lifecycle/context/acceptance/resolution seams | complete within phase | One shared text authority and store-backed discovery; unchanged acceptance parser reused. Existing caller paths intentionally retained; caller/protocol cutover remains Phases 4/5. |
| Step 2. Scoped memory correction/tombstone/history | complete | Shared conformance and direct correction/replay evidence above; immutable predecessor readback retained. |
| Step 3. Save attempt/complete receipt semantics | partial | Sequential refusal/readback works; R1 permits concurrent requirement replacement and false metadata closeout. |
| Step 4. Scoped knowledge read surface | complete within phase | `lookupKnowledge` (`domain.ts:171–176`) delegates only to scoped list/search. Legacy unrestricted model-facing SQL remains clearly labeled pending Phase 4, not an asserted privacy-safe fallback. |
| Step 5. COW branch views with explicit publication inputs | complete | Exact supplied published revisions plus current overlay; actual Git publication authority remains Phase 6. |
| Blocking assumptions assigned here | complete | Parent A-1/A-2/A-3/A-5 validated decisions; A-4 actual-runtime validation belongs to completed Phase 1. No unresolved blocking assumption assigned to Phase 3. |
| Material risk 3: visibility bypass | complete within phase | Scope-before-body and private ranking/page/immutable baseline proofs pass. Later caller cutover is not certified here. |
| Material risk 5: partial/concurrent writes or false save completion | partial | Stale write rollback/history availability and lifecycle writer locks pass; R1 bypasses recorded receipt requirements for concurrent first writers. |
| Deterministic verification | complete | Fresh durable v2 runner passes on supported disposable PostgreSQL 18 with pgvector. This does not certify the uncovered receipt race. |

## Review Axes

### Spec / acceptance-contract axis
- **Worst finding: R1**, PostgreSQL receipt initialization race bypasses immutable attempt-bound requirements and permits completion after dropping backlog work. In-plan, criterion 3 and parent material risk 5.
- Verdict: **Needs work**.

### Standards axis — separate sequential fallback
No sub-agent dispatch tool was available. A separately scoped standards pass followed the contract inspection, seeded with `code-review-universal/reference/typescript.md`, `reference/code-quality-universal.md`, and the diff-relevant Duplicate Code, Primitive Obsession and Long Method definitions. Not a whole-catalog smells audit.
- Checked shared-authority reuse, type/async boundaries, SQL parameterization, lock order/absent-row behavior, transaction rollback, immutable selected-body reads, duty-set invariants and consumer-visible regressions.
- **Worst finding: R1**, independently identified as a check-then-upsert race: `FOR UPDATE` cannot lock an absent row; the subsequent conflict update does not repeat validation.
- No additional standards-only blocking finding substantiated. Dialect-specific adapters and bundled copies are intentional; shared domain policy avoids duplicate lifecycle conventions.
- Verdict: **Needs work**.
- Cross-axis ranking: **none**. No merged severity list and no new native-judgment ranking was performed.

## In-plan Finding R1: Concurrent receipt creation can drop required duties
**Location:** `skills/_shared/storage/postgres-store.ts:117–135`, bundled copy.

Two real transactions with identical project/run/attempt/branch/worktree identity, but metadata duties `[probe, backlog]` and `[probe]`, both read the absent row in `#lockedAttempt`. Both pass validation and fulfill. The later conflict update writes `[probe]`. A subsequent no-fact completion succeeds with `[probe]`, without executing the previously declared backlog duty.

Direct smoke output on isolated PostgreSQL 18:
- First writers: `outcomes:[fulfilled,fulfilled]`.
- Persisted attempt: `metadataDuties:[probe]`.
- Subsequent receipt: `status:complete`, `metadataDuties:[probe]`.

The barrier only pauses after real absent-row SELECTs; no query results or persistence were mocked. **Fix:** acquire a stable project/run advisory transaction lock before the read, including initialization; or insert-if-absent and reload locked state before validation. Keep requirements immutable, preserve matching identities/revisions, synchronize bundle, and add real concurrent-first-writer regression. Full proposal: `iterate-phase-3-receipt-initialization-race.md`.

## Retained Lower-Priority Warning
Previous malformed-subject discovery finding remains in current source: `domain.ts:151–161` retains effective state but discards `provenance`; transitions still refuse malformed state. The prior supervisor ranking (`ranking-2026-10-12T21-43-03-353Z.md:15–19`) placed this finding below waterline. The previous iteration deliberately retained only two higher findings. This review does not claim malformed discovery was fixed, re-rank it, or re-add it to the required race iteration. No duplicate runtime reproduction was run for that already-reported behavior.

## Verification Status
- Goal achieved: **partial**, due to R1; no Phase 4/5/6 completion claim.
- User goal: **partially met** — branch-private COW/retrieval works; truthful concurrent receipt closeout remains incomplete.
- Scope adhered: **yes**; no implementation, lifecycle/phase state, or unrelated artifacts changed.
- Out-of-scope changes introduced by this assignment: **none**.

## Guardrails Verdict
- Contract: **durable**, version **2**, runner **1.0.0**; status **pass**.
- Gates: `unit_test_gate=pass`, `functional_test_gate=skipped`, `lint_gate=skipped`, `patch_gate=pass`, `global_ratchet=pass`, `complexity_gate=pass`.
- Enforcement: unit/global-ratchet/complexity required; patch advisory; functional/lint disabled.
- Coverage **90.1%**, baseline **84%**. Patch reported pass with **null** coverage; no measured patch percentage claimed.
- Complexity: **30** baseline hotspots; no new or hard-ceiling violations. No contract/baseline changes; proposed ratchet raise not applied.
- Initial disposable PostgreSQL 17 environments lacked pgvector or built-in `uuidv7()`, causing migration/check failures. Corrected the fixture to the previously documented `pgvector/pgvector:pg18`; fresh runner passed. No schema bypass or compatibility shim used.

## Exercised Verification
1. `BUCK_WORKFLOW_TEST_DATABASE_URL=<isolated PostgreSQL 18 with pgvector> npm run guardrails:check` — exit 0, verdict above.
2. Same environment: `npx vitest run skills/_shared/scripts/{file-store,sqlite-store,postgres-store,storage-conformance,subject-lifecycle}.test.ts` — **5 files, 127 passed, no skips**.
3. `npx tsc --ignoreConfig --noEmit --strict --target ESNext --module NodeNext --moduleResolution NodeNext --skipLibCheck --types node skills/_shared/storage/*.ts` — exit 0; storage-library only, not whole-repository typecheck.
4. Independent throwaway Bun API smoke: repo-files/external-files temp roots, SQLite on disk, disposable PostgreSQL 18. Asserted published body retention, branch correction/replay, private high-score negative pagination, lifecycle close/refusal, filtered closed backlog exclusion, row/no-fact missing-duty/identity refusal, unchanged attempts, completion after metadata writes/readback. All four backend scenarios passed. Additional real PostgreSQL concurrency scenario exposed R1.
5. `diff -rq` canonical/bundled storage; `cmp` lifecycle/context-helper/recall mirrors — exit 0.

Review added no permanent tests or source mutations. Temporary smoke code/data and isolated database containers are removed after verification. Actual domain APIs, not tests alone, cover the changed surface; no live OMP/native-tool/CLI end-to-end claim because caller cutover belongs to later phases.

## User Goal Analysis
- Inherited goal: users choose durable storage, resume reliably, and keep unmerged work out of unrelated branch retrieval.
- Met within phase: exact scoped retrieval, COW baseline retention, branch-local correction/history, lifecycle conditional writes and sequential save/readback rules.
- Partial: truthful save metadata closeout under concurrent receipt creation.
- Missing: receipt initialization serialization/regression proof (R1).
- Verdict: **partially met**.

## Documentation Impact
Existing `docs/context-artifacts.md:47–73` covers the realized domain boundary, duty attestations and filter-independent lifecycle discovery. No additional domain-language/architecture/how-to change required by the race fix if it preserves this contract; update docs only if remediation changes the contract. The implementation's existing documentation closeout remains supervisor-owned and non-blocking.

## How-to Impact
No new user-facing action delivered here; native tool/CLI is Phase 4. No how-to impact.

## Issue Classification
- In-plan required iteration: **R1** → `/b-iterate` using `iterate-phase-3-receipt-initialization-race.md`.
- Retained in-plan warning: malformed discovery, previously ranked below waterline; not newly required iteration scope.
- Out-of-plan discoveries: **none**.

## Completion Audit
1. Concrete deliverables: six phase criteria and relevant parent assumptions/material risks.
2. Every deliverable mapped to current file ranges and runtime evidence in the matrix.
3. Current implementation read; fresh durable deterministic contract run.
4. Domain claim exercised through real API calls on all four adapters; no later caller/publication claim.
5. Concurrency defect remains partial despite completed phase fields and passing tests.
6. Both axes completed, no truncated review. Review completion is not implementation acceptance.

## Recommended Next Step
Recommend `/b-iterate` for R1, then independent review against the same phase. Supervisor owns ranking, phase/loop state and subsequent docs/save/commit; this assignment selects no next loop state and makes no commit.

## Assignment Ownership
Only this report and `iterate-phase-3-receipt-initialization-race.md` were created for this assignment and staged. No pre-existing staged/unstaged/untracked implementation or workflow artifact was staged or modified.
