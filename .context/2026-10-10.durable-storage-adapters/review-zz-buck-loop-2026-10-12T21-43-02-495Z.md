---
status: completed
date: 2026-10-12
subject: 2026-10-10.durable-storage-adapters
topics: [review, storage, lifecycle, receipts, branch-isolation]
addresses: phase-3-domain-semantics.md
review_verdict: request-changes
---

# Plan Path Review: Phase 3 — Domain Semantics

## Verdict
**Needs work.** The previous seven defects have current resolution evidence. Three remaining in-plan defects were exercised on all four backends: metadata duties can be dropped when completing a receipt; discovery result filters expose completed subjects' backlog; malformed subjects remain selectable. Required guardrails pass, but do not cover these boundaries.

## Plan Source
- Phase: `.context/2026-10-10.durable-storage-adapters/phase-3-domain-semantics.md`.
- Parent: `plan-durable-storage-adapters.md`, step 3; research: `research-durable-storage-adapters.md`.
- Goal: storage-neutral lifecycle, branch-scoped correction/idempotency, truthful save attempts/receipts, overlay-based discovery and visibility-before-body/ranking/page.
- Baseline: HEAD `849ef5a63791a4ca3e2a131067481b862f16c179`. Review covers combined staged/unstaged current source plus the untracked additive migration, not the branch's earlier phases. Checked phase fields are not proof.
- Explicit boundaries: old filesystem/SQL/loop callers may remain until Phases 4/5; publication/reconciliation proof belongs to Phase 6. Those unfinished phases are not findings here.

## Evidence Sources
- Initial Git status: pre-existing staged implementation, docs, prior iteration/review/draft/notes; unstaged phase/overview/context-helper/recall/adapter-utils changes; untracked migration and supervisor review/ranking files. None was modified or staged by this assignment.
- Relevant recent commits: HEAD `849ef5a` four adapters; `065b776` contract/identity boundary. Current phase work is uncommitted.
- Source groups inspected: canonical `storage/{contract,domain,visibility,adapter-utils,file-store,sqlite-store,postgres-store,conformance}.ts`; `scripts/{subject-lifecycle,context-helpers}.ts`; file/PostgreSQL/shared conformance regressions; migration `004_domain_semantics.sql`; recall/subject-resolution protocols; `docs/context-artifacts.md`.
- Affected-file evidence: lifecycle authority refactored to shared text operations; context helper adds completed-subject filtering; storage module adds domain semantics. `plan-acceptance.ts` and production `extensions/buck-loop/` remain unchanged, consistent with the explicit later caller-cutover boundary.
- Prior iteration: `iterate-phase-3-domain-semantics.md`, completed; source/readback/test evidence was checked independently.
- Workflow `current-session.json` is a stale different-subject pointer and contains no active goal. Explicit phase input governs scope; no goal-mode budget/objective check applies.
- Historical memory index has Phase 1 closeout; supplied supervisor recall includes Phase 2 closeout. New Phase 3 save remains supervisor-owned; no SQL memory call was made.

## Completion Matrix

| Deliverable / criterion | Status | Current-state evidence |
|---|---|---|
| 1. Storage-neutral lifecycle, conditional writes, evidence verification and malformed refusal | 🔄 partial | `domain.ts:67–88` shares text authority; adapters persist canonical index revisions; `subject-lifecycle.ts:320–359` enforces legal intents/refusal. Existing lifecycle and all-backend initialization/stale-close/reopen cases pass. Missing: discovery discards malformed provenance and returns it as selectable (R3). |
| 2. Branch-scoped corrections and idempotency; no global supersession | ✅ complete | `domain.ts:21–24,59–64,90–96`; adapter corrections conditionally create only branch-local overlays. Shared inherited correction/tombstone/replay cases (`conformance.ts:231–247`) pass. Direct smoke preserves branch B's exact predecessor while branch A sees its correction. |
| 3. Attempt identity/revision binding, no-fact saves, metadata completion and same-scope readback | 🔄 partial | `domain.ts:98–114,164–181` checks scope/hash/revision set and readback/probe; wrong-run/tree, revision mismatch and no-fact conformance pass. Missing: an enforceable attempt-bound metadata-closeout requirement; dropping all duties except readback still produces `complete` (R1). |
| 4. Links/backlog/index discovery uses overlay+baseline; completed subjects excluded | 🔄 partial | `domain.ts:139–154`; published-close/private-reopen regression (`conformance.ts:249–270`) and direct smoke pass without result filters. Missing: lifecycle evidence independent of result filters (R2), and malformed exclusion (R3). |
| 5. Ordinary knowledge visibility precedes bodies/ranking/LIMIT/pagination on every adapter | ✅ complete | Metadata visibility and overlay: file `file-store.ts:211–224`, PostgreSQL `postgres-store.ts:24–36,147–161`, SQLite `sqlite-store.ts:40–50,163–178`; `visibility.ts:11–32`. Exact selected revision/concurrent pointer case and file direct-edit isolation pass. Additional direct smoke hides a private three-term match before two visible one-term limit-1 pages on all four backends. Legacy model-facing SQL remains intentionally uncut until Phase 4. |
| 6. COW branch drafts never overwrite published baseline | ✅ complete | Exact history candidates remain independent of current pointers; inherited correction/tombstone and retained v1/private v2 cases pass (`conformance.ts:55–78,215–247`). Direct API smoke retrieves unchanged published bytes after the owner privately advances. |
| Step 1: lifecycle/context/acceptance/resolution seams | 🔄 partial | Shared lifecycle text authority exists; old callers intentionally preserved. Discovery authority loss remains R2/R3; no Phase 4/5 cutover demanded. |
| Step 2: memory correction/tombstone overlays/history | ✅ complete | Branch-local stored correction records and immutable predecessors; inherited/replay/tombstone cases pass on every backend. |
| Step 3: save batch/attempt/complete receipt semantics | 🔄 partial | Atomic adapter writes, scope/hash readback and attempted→complete identity refusal pass. R1 leaves metadata closeout unenforced. |
| Step 4: one storage knowledge read surface and filtered lookup | ✅ complete | `lookupKnowledge` routes only to scoped list/search (`domain.ts:157–162`); no raw knowledge SQL surface was added. High-rank pagination and exact-body tests/smoke pass. |
| Step 5: COW view and explicit published revision inputs | ✅ complete | Published IDs are explicit trusted inputs; branch pointers never mutate the supplied baseline revision. Actual publication proof is expressly Phase 6. |
| Blocking assumptions assigned to Phase 3 | ✅ complete | Parent A-1/A-2/A-3/A-5 are settled decisions; A-4 runtime validation belongs to completed Phase 1. No deferred blocking assumption is assigned here. |
| Material risk: visibility bypass | ✅ complete within this phase | Direct high-rank pagination, immutable-body selection and private direct-edit regressions pass. Legacy callers remain available for Phase 4/5 replacement, not a claimed branch-aware fallback. |
| Material risk: partial/stale writes or false save completion | 🔄 partial | Stale-batch rollback and old snapshot availability pass; lifecycle PostgreSQL race refusal and absent-index serialization pass. R1 still permits false metadata-closeout success. |
| Required deterministic verification | ✅ complete | Fresh durable v2 guardrails pass; unit, global-ratchet and complexity required gates pass. Focused real-database suite: 117 passing tests, no skips. This does not erase reproduced contract defects. |

## Review Axes

### Spec / acceptance-contract axis
- **Worst finding:** R1 — receipt completion can drop recorded metadata duties, violating acceptance criterion 3's persistence-versus-closeout boundary.
- Other findings: R2 — filtered discovery exposes a closed backlog revision; R3 — malformed subject remains selectable.
- Axis verdict: **Needs work**.

### Standards axis — explicitly scoped sequential fallback
No sub-agent dispatch tool was available; a separate sequential standards pass followed the contract pass. Seeds: `code-review-universal/reference/typescript.md` and `reference/code-quality-universal.md`, plus the diff-relevant code-smells definitions for Duplicate Code, Primitive Obsession and Long Method. This was not a whole-catalog smells audit.

- Checked: shared authority reuse, typed lifecycle intents, correction scope/hash checks, immutable selected body reads, SQL parameterization, locks/transactions and rollback, async rejection paths, duty-set semantics and behavioral-test boundaries.
- **Worst finding:** the same R1 boundary, independently visible as an unenforced invariant/stringly duty contract (`contract.ts:75–85`, `domain.ts:106–114,173–181`); merely including a submitted `readback`/`probe` string does not establish metadata closeout. The adapter attempt loaders lose duty information needed to compare it.
- No additional standards-only defect was substantiated. SQL dialect differences and canonical/plugin copies are intentional, not abstraction/duplication findings. Shared reducers avoid a second lifecycle convention.
- Axis verdict: **Needs work** on R1. Scope and remediation remain the same accepted phase.

Cross-axis ranking: **none**. Findings are not combined into one ranked list.

## In-plan Findings

### R1. Metadata duties can be dropped when completing a receipt
**Location:** `skills/_shared/storage/domain.ts:106–114,164–181`; attempted loaders at `postgres-store.ts:127–136`, `sqlite-store.ts:225–235`; contract at `contract.ts:75–85`.

Direct smoke wrote a same-scope attempt listing `readback`, `backlog`, `phase-status`, `draft-commit`, then completed it with only `readback` and no corresponding metadata artifacts. Every real adapter stored `status: complete`, `metadataDuties: [readback]`. The API has no distinct required/completed duty set and validation never compares metadata obligations. Same-scope fact persistence works, but it is not metadata-closeout proof.

**Fix:** persist the applicable requirements with the attempt and verify their completion before writing complete, preserving them in adapter attempt loaders. Cover missing-duty refusal and actual successful metadata closeout, including no-fact. See the iteration artifact for details.

### R2. Discovery filters erase completed-subject authority
**Location:** `skills/_shared/storage/domain.ts:139–154`.

A published closed canonical index, completed plan and backlog are excluded under the unfiltered query. Adding `kind: backlog` returns that closed backlog revision on every backend because the lifecycle index was filtered out before inspection. Result scope must not determine whether authority exists; linked target subjects also require inspection independently of the selected subject/kind/name filter.

**Fix:** resolve visible lifecycle authority independently of result filters, then exclude closed subjects/links before returning filtered results. Preserve the same branch/publication context.

### R3. Malformed subjects remain selectable
**Location:** `skills/_shared/storage/domain.ts:67–72,144–153`.

Every real adapter returned a subject index with active status and unsupported lifecycle schema 2 through discovery. Activating that exact index rejected malformed provenance, so transition authority works but discovery discarded its refusal signal. This contradicts preserved subject-resolution refusal at `skills/_shared/subject-resolution.md:22–27`.

**Fix:** retain inspection/provenance in discovery and fail closed on malformed subjects and related reusable entries; keep explicit inspect/recovery access.

## Verification Status
- Goal achieved: **partial**, within Phase 3 only.
- User goal: **partially met** — branch visibility, retained baseline and correction isolation work; reliable/truthful closeout and authority-based discovery remain incomplete. Backend selection/native caller workflows are later phases, not claimed here.
- Scope adhered: **yes**. No implementation changes made by reviewer; no unrelated defect or architecture redesign requested.
- Out-of-scope changes: **none attributed to this assignment**. Pre-existing implementation/status/workflow artifacts were left untouched.
- Source parity: canonical/bundled storage directories, lifecycle/context-helper scripts and recall protocol are byte-identical.

## Guardrails Verdict
- Contract: **durable**; version **2**; runner **1.0.0**.
- Status: **pass**.
- Gates: `unit_test_gate=pass`, `functional_test_gate=skipped`, `lint_gate=skipped`, `patch_gate=pass`, `global_ratchet=pass`, `complexity_gate=pass`.
- Enforcement: unit/global-ratchet/complexity required; patch advisory; functional/lint disabled.
- Coverage: **90%**, baseline **84%**; patch **null** despite reported pass. No measured patch-coverage percentage is claimed.
- Complexity: 30 baseline hotspots remain; no new or hard-ceiling violations.
- No contract/enforcement/baseline edits were made. The runner's proposed ratchet raise was not applied.

## Exercised Verification
1. `BUCK_WORKFLOW_TEST_DATABASE_URL=<disposable database> npm run guardrails:check` — exit 0, verdict above.
2. Same database environment, `npx vitest run skills/_shared/scripts/{file-store,sqlite-store,postgres-store,storage-conformance,subject-lifecycle}.test.ts` — **5 files, 117 tests passed, no skips**. Includes previous seven regressions, real PostgreSQL pre-BEGIN evidence change refusal, and concurrent initial lifecycle writers.
3. `npx tsc --ignoreConfig --noEmit --strict --target ESNext --module NodeNext --moduleResolution NodeNext --skipLibCheck --types node skills/_shared/storage/*.ts` — **exit 0**, scoped storage-library check only.
4. Separate disposable Bun API smoke against repo-files and external-files temporary roots, SQLite on disk and isolated PostgreSQL — asserted published v1/private v2 retention, inherited correction/replay isolation, stale lifecycle/reasonless-reopen refusal, published close/private reopen and wrong-run receipt refusal. Observed R1/R2/R3 on all four adapters.
5. Additional smoke query used `secret hidden terms`: invisible private candidate matches all three terms; visible alpha/beta candidates each match one. Limit-1 first/second pages returned the two visible revisions on all four adapters.
6. `diff -rq` storage directories and `cmp` lifecycle/context-helper/recall mirrors — **exit 0**.

No source mutations or permanent tests were added by review. Tests plus actual API calls cover this phase's changed surface; no live OMP/CLI/native-tool end-to-end claim is made, because caller cutover belongs to later phases.

## User Goal Analysis
- Phase goal: semantics layer supporting user-selected durable state, reliable resume and branch-private unmerged work.
- Met: retained exact published bodies, branch-local COW/corrections/tombstones, visibility-before-ranking/page, legal conditional lifecycle transitions and scoped receipt fact readback.
- Partial: authoritative filtered discovery and truthful metadata-closeout completion.
- Missing: R1/R2/R3 fixes and their regression coverage. Native caller cutover/publication remain deliberately outside this phase.
- Verdict: **partially met**.

## Documentation Impact
- Existing `docs/context-artifacts.md:47–62` documents the new domain boundary and claims preserved malformed rules and successful metadata duties. These claims need reconciliation after R1/R3 fixes; receipt-contract changes must be reflected there.
- Non-blocking documentation recommendation: `/b-docs` after implementation defects are resolved and before `/b-save`, if the fix changes the contract/conventions. Documentation is not an iteration item or independent correctness blocker.

## How-to Impact
No new user-facing CLI/tool/action is delivered by this phase. No how-to impact; native/portable access is Phase 4.

## Issue Classification
- In-plan: **R1, R2, R3** → `iterate-phase-3-domain-semantics-rereview.md`, `/b-iterate`.
- Out-of-plan: **none**. No new follow-up subject required.

## Completion Audit
1. Objective restated as the six phase criteria above.
2. Every deliverable mapped to current source plus exercised runtime/test evidence.
3. Actual state inspected; fresh durable deterministic runner executed.
4. Verification scope matches the domain API claim; all four real adapters exercised. No later native/CLI/publication claim made.
5. Reproduced defects remain partial despite checked phase fields and green guardrails.
6. Both axes completed; review is not truncated. The completed review does not certify completed implementation.

## Recommended Next Step
Recommend `/b-iterate` for R1/R2/R3, then re-review the same phase. The supervisor alone owns phase/loop state and the later docs/save/commit sequence. This assignment changes no lifecycle/phase/loop state and does not commit.

## Assignment Ownership
Only this report and `iterate-phase-3-domain-semantics-rereview.md` were created for the assignment and are the only paths staged by it. All pre-existing staged/unstaged/untracked work remains untouched. Temporary smoke code/data and the dedicated database container are removed after verification.
