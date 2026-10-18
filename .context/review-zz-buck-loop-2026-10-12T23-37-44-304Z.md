---
status: active
date: 2026-10-12
subject: 2026-10-10.durable-storage-adapters
topics: [review, storage-adapters, native-access]
review_verdict: request-changes
phase: phase-4-native-access.md
baseline: db3157532de611c1ce2d990c0d18e4fb984ee313
iteration: iterate-phase-4-native-access-review.md
---

# Plan Path Review: Phase 4 native access

## Plan Source
- File: `.context/2026-10-10.durable-storage-adapters/phase-4-native-access.md`.
- Goal: expose typed native/CLI access with trusted scope, usable artifact references, migrated OMP bridge/picker/recall/save, and a runnable synchronized release bundle.
- Baseline: Phase 3 commit `db3157532de611c1ce2d990c0d18e4fb984ee313`; current staged, unstaged, and untracked implementation inspected directly. No completion claim derives from the phase's checked boxes.
- Scope boundary: current criteria 4–5 explicitly defer full legacy removal and the remaining canonical-skill durable-path sweep to Phase 5. Those deferred consumers are not blockers in this review. Phase 6 publication reconciliation is not required here; resolving a reference already visible under a trusted published set is required.

## Evidence Sources
- Initial Git status: 63 modified tracked paths in the unstaged diff; two pre-existing staged new workflow-state scripts also had unstaged modifications. Native tool/tests, shared access guide, bundled scripts/tests, implementation notes, and many unrelated/legacy flattened `.context` artifacts were already untracked. This assignment did not stage that pre-existing work.
- Recent implementation commits: `db31575` domain semantics, `849ef5a` four adapters, `065b776` contract/config/identity.
- Sources reviewed: shared workflow-state service/CLI/tests; native tool/schema/tests; plan bridge; interactive artifact selection; supervisor recall/save; restricted child session construction; installer shipping rules/tests; curated bundle manifest/parity tests; existing adapter visibility/lifecycle/receipt seams.
- Expected scope paths verified: `skills/_shared/scripts/workflow-state.ts`, added companion CLI, `extensions/workflow-state/`, `extensions/index.ts`, curated `plugins/buck-workflow/skills/`. Related migrated runtime consumers and shared protocols are named by the parent plan.
- Supervisor-provided memory used as reference only. No `sql_memory` call was made.
- Runtime evidence: actual Bun CLI subprocesses in isolated Git repositories, real external-file and SQLite stores, actual plan-mode turn-end handler, native tool execution and event normalization, concurrent trusted identity resolution, real recall → correction scenario, bundled CLI launch, targeted tests, deterministic guardrails.

## Completion Matrix

| Deliverable / step | Status | Direct current-state evidence and missing piece |
|---|---|---|
| Criterion 1: typed native/CLI operations and artifact references | partial | Native writes return real tokens; external-files and SQLite actual CLI write/read round-trips succeeded. CLI correction/transition are denied, receipt read has no trusted run identity, and token-only read requires redundant subject. Listed published token reads return null. Findings 4–5. |
| Criterion 2: stage permissions and same trusted scope | partial | Native project-scope/inspect denial tests passed. Shell CLI inspect returned another branch's private body despite native denial; project override selected identity but opened the machine-default store; eight concurrent resolutions returned eight IDs for one branch. Findings 1–3. |
| Criterion 3: portable fallback, no SQL construction/mirror/unrestricted normal read | partial | Shared access/recall protocols prohibit SQL. External-file smoke had no `.context` mirror; SQLite executable returned exact body. Project-specific external selection created a repo body; bundled fallback does not load. Findings 1, 4, 7. |
| Criterion 4: bounded raw-SQL save cutover and no sql_memory in children | complete | `extensions/buck-loop/sql-save.ts:148-176,285-298` uses `executeWorkflowState` write/correct; `run-step.ts:438-447` installs only workflow_state as the custom durable tool; `extensions/sql-memory/index.ts:409-412` no longer registers the model-facing SQL tool. Save-store targeted tests passed. Full legacy removal remains Phase 5 scope. |
| Criterion 5: OMP plan bridge/picker and supervisor recall/save references | partial | `interactive-model-switch.ts:102-115` discovers/list artifacts through the store and forwards returned tokens. Actual bridge callback persisted a plan but emitted a token its parser rejects. Actual supervisor recall ID failed correction. Findings 6, 8. No claim that the remaining skill-path sweep is complete. |
| Criterion 6: bundle/installer synchronization and ranking/receipt semantics | partial | Targeted bundle parity and installer tests passed within the 125-test run; installer enumerates 14 storage files. Shipped bundle CLI exits 1 on missing extension imports. Recall drops revision/token identity; native failures normalize as success. Findings 7–9. Byte parity is not runtime closure. |
| Implementation detail 1: trusted service binding | partial | Same logical service is reused; project-selection and identity-race defects break binding. Repo-files opener places machine-manifest authority under the repo. Findings 1–2, 10. |
| Implementation detail 2: CLI inspect/recover with evidence | partial | Actual inspect records evidence and returns the named scope; restricted child can acquire that scope through bash. Finding 3. General orphan/history-rewrite recovery remains Phase 6 scope. |
| Implementation detail 3: declared bridge/picker/reference cutover | partial | Picker uses returned tokens; bridge invents an incompatible grammar. Finding 6. Current criteria assign remaining canonical durable-path consumers to Phase 5. |
| Implementation detail 4: remove obsolete model-facing SQL registration | complete for current boundary | No SQL tool registration in wire; children receive workflow_state. Remaining exports/administrative consumer cutover intentionally outside this phase's revised boundary. |
| Implementation detail 5: bundle/shipping integration | partial | Copied files are byte-identical, but imported runtime dependencies are absent from the skills-only bundle. Finding 7. |
| Blocking assumptions assigned to Phase 4 | complete | No unresolved assumption is assigned to Phase 4. Parent A-1–A-5 are recorded validated; A-4 runtime capability belongs to Phase 1. This review does not reopen those decisions. |
| Material risk 3: prevent scope bypass before bodies enter models | missing | Actual restricted CLI inspect returned private body. Fix proposal is finding 3 in the iteration artifact; native-only negative tests do not validate the shell fallback boundary. |
| Material risk 5: scoped persistence, receipts, concurrency | partial | Domain receipt tests pass with injected identities. Actual named-branch CLI receipt access fails; concurrent trusted identity registrations are lost; recalled correction identifiers are incompatible. Findings 2, 4, 8. No new fallback is permitted. |
| Central manifest decision / material risk 6 | missing | `workflow-state.ts:202-206` stores manifest/revision authority under `.context/workflow/storage`; current execution created a 4.5 MB manifest there. Parent central-manifest decision remains unchanged. Fix proposal: finding 10. |
| Verification: deterministic check contract | complete on second run, warning retained | Latest `npm run guardrails:check` returned durable v2 pass, 88.8% coverage against 84 baseline. First run failed a changed recall test; isolated test and rerun passed. This is not a claim of deterministic first-run stability. |
| Verification: all three non-repo adapters on actual access surfaces | partial / PostgreSQL not-verifiable | Real external-files and SQLite CLI exercised. No disposable `BUCK_WORKFLOW_TEST_DATABASE_URL` configured; PostgreSQL access-surface workflow not executed. Required existing backend tests were not replaced with mocks. |

## Review Axes

### Spec / acceptance-contract axis
- Worst finding: **restricted children can read another branch's private bodies through the CLI** (`run-step.ts:139-158`; `workflow-state-cli.ts:68`). This violates criterion 2 and the explicit negative verification requirement.
- Other in-plan findings: wrong configured backend (1), identity lost updates (2), unusable CLI/receipt operations (4), unreadable published refs (5), invalid bridge token (6), non-runnable bundle (7), unusable recalled correction identity (8), repo-local private manifests contrary to the central policy (10).
- Verdict input: Needs work independently of the standards pass and green guardrails.

### Standards axis — explicitly scoped sequential fallback
- A task/sub-agent tool was not available. A second standards pass used `code-review-universal` TypeScript and universal-quality guides, plus only applicable duplicate-code/dead-code definitions from `code-smells`. No full catalog audit or cross-axis reranking was performed.
- Worst finding: **native execution failures are swallowed into successful result envelopes** (`extensions/workflow-state/index.ts:65-74`). Actual denial normalized to `ok:true`; the save-stage event observer only handles `!ok`. Finding 9, in-plan against the new tool/error boundary.
- Standards evidence also corroborates the read-modify-write race (finding 2) and release module-resolution failure (finding 7). Those are the same defects, not additional issue counts.
- No independent style-only blocker. The old sql-memory registration no-op is intentionally within the phase's accepted transitional boundary, not a request to preempt Phase 5.
- Cross-axis ranking: none. Each axis retains its own worst finding/verdict input.

## Verification Status
- Goal achieved: partial.
- User goal: partially met within this phase; choosing storage per project and keeping unmerged work invisible are contradicted by actual opener/shell behavior. Parent end-to-end completion is not claimed for this phase.
- Scope adhered: current accepted Phase 4 boundaries were used; remaining Phase 5/6/7/8 work was not requested or performed.
- Out-of-scope changes: none authored by this review. Pre-existing implementation and unrelated `.context` changes left untouched.
- No active goal field in `.context/workflow/current-session.json`; its old unrelated subject pointer does not override the explicit assigned phase.

### Commands and observed outcomes

1. `npx vitest run skills/_shared/scripts/workflow-state.test.ts extensions/workflow-state/index.test.ts extensions/plan-artifact.test.ts extensions/index.test.ts extensions/buck-loop/__tests__/sql-save-store.test.ts scripts/codex-plugin.test.ts scripts/install.test.mjs` — **7 files, 125 tests passed**.
2. First `npm run guardrails:check` — **fail**: required unit gate exit 1; `project-memory.test.ts` test `returns the full shortlist when no score clears the threshold`; 1912 tests passed, 1 failed, 30 skipped in Vitest output. Coverage 88.8%, complexity pass. Truncated runner diagnostics did not expose the assertion details, so the cause is not asserted.
3. `npx vitest run extensions/buck-loop/__tests__/project-memory.test.ts` — **13 tests passed** in isolation.
4. Second `npm run guardrails:check` after coherent-state check — **pass**, all required gates passed. The first failure is retained as a stability warning, not erased or attributed without proof.
5. Isolated real executable smoke — external CLI exact-body round-trip, exit 0; no repo `.context` mirror under global external selection. Project override write exited 0 but created `.context/review-override.md` under machine repo default. `correct` and `transition` exited 1 for the write role; `read-receipt` exited 1 for missing run identity; token-only read exited 1 requiring subject.
6. Trusted-visible-view smoke — list returned `published.md`; read using its returned token produced `null`. Eight simultaneous resolutions on a fresh identity file produced **8 distinct IDs**, not one.
7. Actual OMP bridge callback — plan persisted; marker target `workflow-artifact:2026-10-12.bridge/plan/plan-bridge.md`; parser threw `Invalid workflow artifact token`.
8. Restricted scope smoke — custom tool inspect denied; same child-accessible shell CLI inspect exited 0 and returned `PRIVATE OTHER BRANCH BODY`. Denial event normalized to `{"kind":"toolEnd","tool":"workflow_state","ok":true}`.
9. SQLite actual CLI — write/read exit 0; exact body matched.
10. `bun plugins/buck-workflow/skills/_shared/scripts/workflow-state-cli.ts list` — exit 1 before executing list: missing `../../../extensions/sql-memory/db.js`.
11. Actual recall → correction smoke — stored revision `716607b7-08f4-4985-8e82-beb240b6aada`, recalled ID `memory/fact.md`; correction rejected with `SQL correction target is not in this project`.
12. Disposable PostgreSQL fixture check — `BUCK_WORKFLOW_TEST_DATABASE_URL` absent. No all-backend CLI/OMP claim made.

Smoke scripts used isolated temporary roots and were removed after recording evidence. No application source or permanent test was changed by this review.

## Guardrails Verdict
- Contract: durable.
- Contract version: 2.
- Latest status: **pass**; initial fail retained above.
- Gates: `unit_test_gate=pass`, `functional_test_gate=skipped`, `lint_gate=skipped`, `patch_gate=advisory`, `global_ratchet=pass`, `complexity_gate=pass`.
- Coverage: 88.8%, baseline 84%, target 90%; patch result null/advisory.
- Enforcement unchanged: unit/ratchet/complexity required, patch advisory, lint/functional disabled.
- No proposed ratchet/baseline update was applied.

## User Goal Analysis
- Goal: users choose durable storage per project and keep unmerged work invisible on unrelated branches, through the access-surface layer delivered here.
- Met: new shared/native access exists; actual global external-file and SQLite operations work; raw-SQL save writes/model registration removed within the stated boundary; basic branch-scoped injected reads and native role denials work.
- Partial: per-project selection, concurrency/resume identity, restricted fallback access, usable references/corrections/receipts, and packaged portable execution.
- Missing: an enforceable CLI child boundary, correctly bound project/store selection, stable concurrent scope, working token/correction round-trips, and self-contained bundle runtime dependencies.
- Verdict: partially met.

## Documentation Impact
- New module boundary: native/portable artifact service, trusted runtime identity and stage-role binding, and release dependency closure need living architecture/convention documentation once fixes establish the actual contract.
- Existing bootstrap/global SQL policy and filesystem-centric skill instructions differ from the new surface, but the current accepted Phase 5 boundary owns remaining consumer cutover. This is non-blocking documentation impact, not an additional iteration item.
- Recommended: `/b-docs` after implementation defects are addressed and re-review passes, before `/b-save`.

## How-to Impact
- New user-facing CLI/reference workflows and operator inspect/recover/migrate actions have a short shared access reference, but no exercised task-oriented how-to was verified for them.
- Recommended: `/b-docs` first; it may follow `/b-howto`. Do not document the currently denied/bypassing paths as working procedures.

## Issue Classification
- In-plan issues: **10 distinct implementation defects**, detailed with evidence and proposed fixes in `iterate-phase-4-native-access-review.md`; route to `/b-iterate`.
- Out-of-plan issues: none raised. Deferred phase work is not newly discovered scope and does not expand this assignment.
- Warnings: one first-run guardrails failure not reproduced in isolation/rerun; PostgreSQL surface verification unavailable without a disposable fixture. Neither warning is silently counted as verified behavior.

## Completion Audit
1. Objective: usable native/CLI typed operations, scoped child permissions, token round-trips, bounded bridge/recall/save cutover, self-contained bundle.
2. Deliverables mapped to current source/tests/actual outputs in the matrix.
3. Current implementation read and deterministic contract executed twice; latest verdict pass.
4. CLI claims exercised through the actual executable; bridge through its actual callback; native tool through execute and actual event-normalizer contract. No live model-backed OMP child session or PostgreSQL workflow was claimed.
5. Contradicted behavior marked partial/missing; absent PostgreSQL fixture marked not-verifiable. Checked criteria/status did not override evidence.
6. Review covers the assigned phase and both review axes; report and actionable iteration artifact are complete. The implementation is not accepted and no next loop state is chosen here.

## Verdict
**Needs work** — ten in-plan defects remain despite the latest passing required guardrails. The checked phase status is not acceptance evidence.

## Recommended Next Step
Supervisor-owned routing: `/b-iterate` against this phase's iteration artifact, then `/b-review` on the same phase. After a passing re-review, documentation/how-to sync and save/commit follow the configured workflow. This assignment only delivers the review; it does not change phase/subject lifecycle or choose the supervisor's next state.
