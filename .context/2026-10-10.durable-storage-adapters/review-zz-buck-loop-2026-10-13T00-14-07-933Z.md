---
status: active
date: 2026-10-12
subject: 2026-10-10.durable-storage-adapters
topics: [review, storage-adapters, native-access, permissions, receipts]
review_verdict: request-changes
phase: phase-4-native-access.md
baseline: db3157532de611c1ce2d990c0d18e4fb984ee313
iteration: iterate-phase-4-native-access-rereview.md
---

# Plan Path Review: Phase 4 native access re-review

## Plan Source
- File: `.context/2026-10-10.durable-storage-adapters/phase-4-native-access.md`.
- Goal: typed native/portable artifact operations, stage-appropriate trusted scope, usable tokens, bounded OMP bridge/picker/recall/save cutover, synchronized runnable release bundle.
- Baseline: Phase 3 commit `db31575`; current staged, unstaged and untracked Phase 4 implementation inspected directly.
- Accepted boundary: current criteria 4–5 defer remaining canonical-skill durable-path consumers and full legacy removal to Phase 5. Publication/reconciliation is Phase 6, existing-data cutover Phase 7, full workflow proof Phase 8. None is demanded here.
- Parent decision ledger, risks and linked `research-durable-storage-adapters.md` followed. Completion checkboxes and `status: completed` are not proof.

## Evidence Sources
- Initial status: substantial pre-existing staged and unstaged Phase 4 implementation, prior review/iteration records, and many unrelated untracked `.context` artifacts. These were not authored or staged by this review.
- Relevant commits: `db31575` domain semantics, `849ef5a` four adapters, `065b776` contract/config/identity.
- Current sources: workflow-state service/CLI/native tool and execution boundary; child session construction; bridge; interactive subject-artifact discovery; supervisor recall/save; shared access/recall/skill instructions; portable pool/migrations; installer and curated bundle.
- Expected phase files verified: `skills/_shared/scripts/workflow-state.ts`, companion CLI, `extensions/workflow-state/`, `extensions/index.ts`, `plugins/buck-workflow/skills/`. Related bridge/recall/save and packaging changes are named by the parent.
- Supervisor recall reused only as untrusted reference evidence. No `sql_memory` call.
- Existing workflow projection names another subject and has no active goal. Explicit assigned phase takes precedence. Historical memory index was read but not modified; configured supervisor save owns the eventual SQL record.

## Completion Matrix

| Deliverable / step | Status | Direct current-state evidence / missing piece |
|---|---|---|
| Criterion 1: typed native/CLI operations and artifact references | partial | Actual native writes, CLI token-only reads, corrections, lifecycle initialize/activate and one complete receipt passed on all four adapters. A later independent CLI save cannot obtain a distinct trusted run and is rejected; finding 2. Service: `workflow-state.ts:307-374`; CLI: `workflow-state-cli.ts:54-74`. |
| Criterion 2: stage permissions and same trusted scope | partial | Native inspect/project-scope denials and Bubblewrap private-path denial pass. Ordinary child host file tools still return external private bodies; receipt reads return another branch's receipt. Findings 1–2. `run-step.ts:139-159,435-448`; `workflow-state.ts:156-182,332`. |
| Criterion 3: portable fallback, no SQL construction/mirror/unrestricted normal knowledge read | partial | Canonical and copied bundle CLI run; actual external/SQLite/PostgreSQL writes create no subject `.context` mirror; instructions prohibit SQL. The normal child's host read bypasses artifact visibility for file storage, finding 1. `workflow-state-access.md:7-25`; native/CLI smoke below. |
| Criterion 4: bounded supervisor raw-SQL write removal and no sql_memory in children | complete for accepted boundary | `sql-save.ts:148-176,285-298` writes/corrects via executeWorkflowState; `run-step.ts:440-448` registers workflow_state/workflow_exec, not sql_memory; `sql-memory/index.ts:409-412` removes registration. Focused save-store/child tests pass. Full legacy deletion remains Phase 5. |
| Criterion 5: bridge/picker/recall/save token access | complete for accepted boundary | Bridge retains returned token at `plan-artifact.ts:257-261`; interactive discovery returns adapter tokens at `interactive-model-switch.ts:102-115`; recall preserves revision/token/ref at `project-memory.ts:67-79`; corrections consume revision IDs at `sql-save.ts:167-175`. Actual callback/recall regressions pass. Remaining skill-path sweep intentionally deferred. |
| Criterion 6: release/installer synchronization, ranking and receipt semantics | partial | Bundle parity and copied CLI execution pass; isolated installer verify returns 0 with all 17 required storage files. Rank metadata and single-attempt receipt tests pass. Cross-branch/repeated-attempt receipt behavior fails, finding 2. |
| Detail 1: trusted binding over shared store | partial | One resolved origin/config snapshot carries the project override to the opener, and identity RMW is serialized (`workflow-state.ts:117-132,169-183,224-250`). Actual override works for all selected adapters; concurrent-registration regression passes. Run binding still aliases independent attempts/branches. |
| Detail 2: explicit operator inspect/recover with evidence | partial | Native child denies inspect; operator CLI is separately authorized (`workflow-state-cli.ts:28-37,68-71`); actual isolation regression passes. File tools bypass the intended restricted boundary. General orphan recovery remains Phase 6. |
| Detail 3: bounded reference cutover | complete | Bridge marker readback and published-token/overlay/private-token tests pass; actual token-only CLI reads pass. No claim that every deferred durable consumer has migrated. |
| Detail 4: obsolete ordinary SQL registration removed | complete for accepted boundary | No registerTool in legacy wire; new native tool wired. Administrative migration remains explicit CLI. |
| Detail 5: bundle and installer shipping | complete | Portable dependencies live under shared storage; canonical/bundle/migration byte parity command exits 0; copied bundle CLI has no extensions directory and reads native-created artifact; isolated Codex runVerify exits 0. |
| Blocking assumptions assigned to this phase | complete | Parent A-1–A-5 are validated; no deferred blocking assumption is assigned here. A-4 runtime validation belongs to Phase 1. Settled backend/publication decisions not reopened. |
| Material risk 3: no visibility bypass before bodies enter model context | missing | Actual host SDK read returns an other-branch private file while native inspect and isolated cat deny it. Fix proposal in iteration finding 1. |
| Material risk 5: scoped attempts, readback, receipts and concurrency | partial | Serialized concurrent identities and one-attempt readback pass. Current CLI run identity remains workspace-global, exposing the wrong branch receipt and blocking attempt 2. Fix proposal in iteration finding 2. |
| Central manifest decision / relevant material risk 6 | complete for this binding | Actual repo-files native write leaves editable bodies under `.context` but no `.context/workflow/storage`; `workflow-state.ts:182,224-230` selects machine authority outside Git. Existing generated legacy files were not deleted. Broader dotfile/migration checks remain later scope. |
| Deterministic check contract | complete | Fresh durable v2 guardrails pass; required unit/global-ratchet/complexity gates pass, 88.8% coverage versus 84%. |
| Specific access surfaces exercised | complete with stated limits | Native tool execute and actual CLI subprocesses run against real repo/external roots, on-disk SQLite and disposable PostgreSQL 18 + pgvector. No live model-backed OMP child, full parent workflow, networked nested checks or Phase 6 publication claim. |

## Review Axes

### Spec / acceptance-contract axis
- Worst finding: **restricted child host file tools bypass branch visibility**, finding 1 (`extensions/buck-loop/run-step.ts:139-148,435-448`). A shell-only sandbox does not enforce criterion 2 or parent material risk 3 for the other delivered tools.
- Additional in-plan defect: run/receipt binding, finding 2. The actual CLI fails a second save attempt and returns a receipt from another branch.
- Verdict input: Needs work independently of green tests.

### Standards axis — explicitly scoped sequential fallback
- No sub-agent dispatch tool is available; a second explicitly scoped source pass used TypeScript/universal-quality/error-handling guides from code-review-universal and the applicable duplicate-code/dead-code/long-method references from code-smells. No full catalog scan.
- Worst finding: **run identity aliases workspace identity**, finding 2 (`workflow-state.ts:156-182,332`). The binding collapses distinct lifecycle entities; correctly immutable domain receipts then become unusable for future attempts, and the reader omits a scope check. Actual repeated-save and branch-switch outputs corroborate this finding.
- Standards also corroborate finding 1: authorization is not complete when one executor is isolated but other delivered tools operate in the host process.
- Prior error-shaped success is repaired: native tool now throws sanitized execution errors (`extensions/workflow-state/index.ts:65-74`); real persistence-conflict regression passes. Portable dependency closure and registry serialization also pass current tests/smokes.
- No independent style-only blocker. Curated byte-identical copies are an explicit packaging contract, not accidental duplicate runtime logic. Intentionally transitional legacy exports remain within the accepted later-phase boundary.
- Cross-axis ranking: none. Two unique defects; worst finding and verdict input retained per axis, not merged into a ranked list.

## Verification Status
- Goal achieved: partial.
- User goal: partially met at this phase's access layer. Backend choice and token/native/CLI operations work; the privacy boundary and resumable independent receipt identity are contradicted by current behavior.
- Scope adhered: accepted Phase 4 boundary; later consumers/publication/cutover not expanded into this assignment.
- Out-of-scope changes authored: none. Only this report and its iteration artifact are retained.
- The previous ten-issue iteration is completed, but the shell-boundary fix is incomplete across host tools, and the receipt repair covers only one attempt. Its status does not override current evidence.

### Commands and observed outcomes
1. `npm run guardrails:check` — durable v2 **pass**, unit exit 0; 88.8% coverage versus 84%; no new or hard-ceiling complexity violations.
2. `npx vitest run skills/_shared/scripts/workflow-state.test.ts extensions/workflow-state/index.test.ts extensions/workflow-state/execution.test.ts extensions/plan-artifact.test.ts extensions/buck-loop/__tests__/project-memory.test.ts extensions/buck-loop/__tests__/run-step.test.ts extensions/buck-loop/__tests__/sql-save-store.test.ts scripts/install.test.mjs scripts/codex-plugin.test.ts` — **9 files, 164 tests passed**. npm emitted the existing unparseable install-scripts-entry warning; test exit 0.
3. `diff -rq skills/_shared/storage plugins/buck-workflow/skills/_shared/storage` plus `diff -q` for workflow-state.ts and workflow-state-cli.ts, and `diff -rq migrations plugins/buck-workflow/migrations` — exit 0, no differences.
4. Throwaway `bun /tmp/buck-phase4-rereview-20261012.ts` — final exit 0. For each of repo-files/external-files/SQLite/PostgreSQL: native memory write → actual CLI token-only read → correction → exact readback → lifecycle initialize/activate → attempted/complete receipt → native readback. Assertions verify exact bodies, active lifecycle and complete receipt. Non-repo selections assert no subject `.context` materialization. This script ran on isolated fixture data and was removed afterward.
5. Same smoke copied the curated bundle into a temporary root, linked installed runtime dependencies, verified no extensions directory, and read a native-created token via the copied CLI. No independent clean dependency installation is claimed.
6. Same smoke invoked exported `runVerify` with an isolated temporary Codex home. Output: **17 storage files ok**, **1 linked-here**, **every managed surface resolves to this checkout**; return 0. Operator harness links were not altered.
7. Actual boundary reproduction: native inspect denied; the installed SDK's createReadTool(cwd) returned the private fixture body at an absolute path outside the checkout; actual Bubblewrap cat of that same path denied. Observed flags: `nativeInspectDenied: true`, `returnedPrivateBody: true`, `fileOutsideCheckout: true`.
8. Actual CLI receipt reproduction: second attempted receipt rejects with `receipt attempt or scope mismatch, or already complete`; after branch switch, same runId returns a complete receipt from the original branch. Current branch `branch-59702567-4239-464c-8d80-ac6f9a089026`, returned branch `branch-5859b5df-5d8f-47f3-914a-291c0cbc1f64`.
9. PostgreSQL fixture setup: plain PostgreSQL 17 lacked vector; pgvector/pgvector:pg17 lacked uuidv7(); the cached pgvector/pgvector:pg18 fixture satisfies the existing migration prerequisites and the full final surface smoke passed. All containers created for this review were stopped, and temporary roots removed. No production database or existing store was touched.

## Guardrails Verdict
- Contract: durable; version: 2; runner: 1.0.0.
- Status: **pass**.
- Gates: `unit_test_gate=pass`, `functional_test_gate=skipped`, `lint_gate=skipped`, `patch_gate=advisory`, `global_ratchet=pass`, `complexity_gate=pass`.
- Coverage: 88.8%, baseline 84%, target 90%; patch null/advisory.
- Complexity: 30 existing hotspots, baseline 30, no new/hard-ceiling violations.
- Enforcement unchanged. No proposed baseline/ratchet update applied.

## User Goal Analysis
- Goal: choose durable storage per project, resume reliably, keep unmerged work invisible outside its branch.
- Met within this phase: project override, logical/token addressing, native/portable operations, bridge marker readback, revision-based recall/correction, private machine manifest placement and self-contained bundle imports.
- Partial: enforceable child storage isolation and trusted receipt/resume identity.
- Missing: confinement for all child file tools; distinct validated runs for later attempts; same-scope receipt read enforcement.
- Verdict: partially met. Parent end-to-end completion remains outside this phase review.

## Documentation Impact
- New shared/native storage access, machine registry/manifest location and stage-role/isolated-execution contracts need living conventions/architecture documentation.
- Existing shared access guide and docs/buck-loop.md describe the intended shell boundary, but do not establish a safe whole-child filesystem boundary. Document the repaired contract after review passes.
- Phase 5 owns the remaining canonical-skill durable-path sweep and legacy consumer wording; do not turn that declared boundary into an iteration blocker here.
- Non-blocking recommendation: `/b-docs` after defects are repaired, before `/b-save`.

## How-to Impact
- New portable CLI/token operations, explicit administration and nested execution prerequisites need task-oriented how-tos; the shared access reference is not that procedure.
- Recommend `/b-docs` first, following `/b-howto` where needed. Do not publish the observed bypass/single-use receipt behavior as a supported workflow.

## Issue Classification
- In-plan: **2 distinct implementation defects**, both with proposed fixes and behavioral verification in `iterate-phase-4-native-access-rereview.md`.
- Out-of-plan: none raised. Declared later-phase work remains deferred, not newly invented scope.
- Limits: no live model-backed OMP child verification; copied bundle used installed dependencies; current required guardrails pass but do not cover these failing scenarios.

## Completion Audit
1. Objective restated as six access-layer deliverables; accepted later-phase boundaries preserved.
2. Every deliverable mapped to current source, focused tests or actual tool/CLI output in the matrix.
3. Implementation inspected directly; fresh deterministic contract returned pass.
4. Native/CLI/shell claims exercised on their actual executable surfaces. File bypass reproduced with the installed SDK tool, not a mocked echo. No live child-model or full workflow overclaim.
5. Contradicted privacy/receipt behavior marked partial/missing, not complete despite checked criteria.
6. Both review axes and actionable artifacts are complete. This is a completed review with an unaccepted implementation, not a partial checkpoint. No loop state or lifecycle changed.

## Verdict
**Needs work** — two in-plan defects remain despite passing required guardrails and repaired happy-path access across all four backends.

## Recommended Next Step
Supervisor-owned routing: `/b-iterate` using `iterate-phase-4-native-access-rereview.md`, then `/b-review` against the same phase. Documentation/how-to sync and supervisor save/commit follow only after acceptance. This assignment reports evidence and stages its own two artifacts; it does not choose the next loop state.
