---
status: active
date: 2026-10-12
subject: 2026-10-10.durable-storage-adapters
topics: [review, storage-adapters, native-access, confinement, project-binding]
review_verdict: request-changes
phase: phase-4-native-access.md
baseline: db3157532de611c1ce2d990c0d18e4fb984ee313
iteration: iterate-phase-4-native-access-boundary.md
---

# Plan Path Review: Phase 4 native access — boundary re-review

## Plan Source
- File: `.context/2026-10-10.durable-storage-adapters/phase-4-native-access.md`.
- Goal: typed native/portable artifact access, stage-appropriate trusted scope, token-based bridge/picker/recall/save, synchronized release bundle.
- Baseline: Phase 3 `db31575`; review current staged and unstaged implementation against that baseline, not completion checkboxes.
- Current criteria 4–5 explicitly defer remaining consumer/skill-path migration and full legacy deletion to Phase 5. Publication/recovery is Phase 6; data migration is Phase 7; whole-workflow proof is Phase 8. Those boundaries were respected.
- Parent plan, linked research, assumptions ledger, material risks and decision-closure protocol were read. No architectural decision was reopened.

## Evidence Sources
- Initial git status: 109 pre-existing staged changed paths, two unstaged phase/overview edits, many unrelated untracked `.context` artifacts. None was staged or modified by this assignment.
- Relevant commits: `db31575` domain semantics, `849ef5a` four adapters, `065b776` contract/config/identity.
- Modified implementation inspected: workflow-state service/CLI/native tool; confined filesystem and command tools; child construction; bridge; interactive subject-artifact picker; recall/save; installer and portable bundle.
- Phase file roots verified: `skills/_shared/scripts/workflow-state.ts`, companion CLI, `extensions/workflow-state/`, `extensions/index.ts`, `plugins/buck-workflow/skills/`. Related bridge/picker/recall/save and shipping changes are parent-plan scope.
- Supervisor recall treated as reference evidence; no `sql_memory` call. Historical memory index and stale workflow projection inspected; projection names another subject and contains no active goal. Explicit phase assignment takes precedence.

## Completion Matrix

| Deliverable / step | Status | Direct current-state evidence / missing piece |
|---|---|---|
| Criterion 1: typed native/CLI operations and artifact references | complete | Actual native write → CLI token-only read → native correction → CLI exact readback → lifecycle initialize/activate passed on all four adapters. Service `workflow-state.ts:310-364`; CLI `workflow-state-cli.ts:54-74`. |
| Criterion 2: stage permissions and same trusted scope | missing | Literal project overrides, read-role writes and restricted inspect are denied. However actual child file tools can write outside the checkout through a dangling symlink and change Git origin to rebind the next native call to another project. Findings 1–2 below. |
| Criterion 3: portable fallback, no SQL construction/mirror/unscoped ordinary knowledge access | partial | Native/CLI/bundle access works; non-repo selections create no `.context`; shared instructions prohibit SQL. Trusted project confinement is bypassable through child-writable Git metadata, so ordinary retrieval isolation is not achieved. |
| Criterion 4: bounded supervisor SQL-write removal; no sql_memory in children | complete for accepted boundary | `sql-save.ts:148-176,285-298` writes/corrects through executeWorkflowState. `run-step.ts:153-169,450-459` delivers new custom tools, no sql_memory. Legacy wire at `sql-memory/index.ts:409-412` does not register the old tool. Focused save/child regressions pass. Full removal remains Phase 5. |
| Criterion 5: bounded bridge/picker/recall/save token cutover | complete for accepted boundary | Bridge appends returned token `plan-artifact.ts:255-261`; interactive subject artifacts come from discover/list `interactive-model-switch.ts:102-115`; recall preserves revision/token/ref `project-memory.ts:67-79`; save correction uses predecessor revision `sql-save.ts:167-175`. Focused bridge/recall tests pass. Remaining consumer sweep is not demanded here. |
| Criterion 6: bundle/installer sync, ranking, receipt/readback semantics | complete | Canonical shared runtime and migration byte parity exits 0; copied bundle CLI reads native-created token without an extensions directory. Isolated installer runVerify exits 0 with 17 shipped files and one linked-here Codex surface. Search/rank and save-store tests pass; actual repeated receipt attempts work across four adapters. |
| Detail 1: typed operations and trusted binding | partial | Trusted origin/config snapshot and serialized registry RMW are implemented `workflow-state.ts:172-186`; scopes are rejected recursively `:73-82`. Child tool omits a pinned context and resolves it on every call `extensions/workflow-state/index.ts:65-70`, permitting finding 2. |
| Detail 2: portable CLI and explicit inspection evidence | complete at this surface | Operator-only admin routing `workflow-state-cli.ts:28-37,68-71`; inspect/recover retain evidence `workflow-state.ts:425-437`. Native restricted inspect denial observed. Full orphan recovery remains Phase 6. |
| Detail 3: bounded artifact reference cutover | complete | Actual native-created tokens read through canonical and copied-bundle CLI; published-token/overlay/private-token tests pass. |
| Detail 4: obsolete model-facing SQL path | complete for accepted boundary | Supervisor raw-SQL writes removed and legacy tool registration removed. Transitional save mode and later consumers remain Phase 5 scope. |
| Detail 5: installer, extension registration and bundle | complete | Shipping verification and command-mirror tests pass; canonical storage, CLI/service and SQL migrations are byte-identical to bundle copies. |
| Blocking assumptions assigned to this phase | complete | Parent A-1–A-5 validated; no unresolved blocking assumption assigned here. A-4 runtime validation belongs to Phase 1. |
| Material risk 3: visibility enforced before bodies enter model context | missing | Current bound project A initially receives null for project B's fact. A delivered host write changes `.git/config`; next workflow_state read returns `PRIVATE PROJECT B`. The negative scope test does not protect this route. |
| Material risk 5: scoped attempts/readback/receipt concurrency | complete for repaired receipt binding | Actual CLI/native boundaries complete two distinct attempts with distinct runs; switching branch returns null receipt; returning resumes the prior branch's latest attempt. Focused CLI/concurrent-registry/same-scope receipt tests pass. No whole supervisor-resume claim. |
| Central-manifest placement / phase-relevant risk 6 | complete at this surface | Repo-files opens immutable authority outside checkout `workflow-state.ts:185,227-233`; focused machine-authority regression passes. Dangling symlink still undermines the child write boundary; finding 1. Broader dotfile/migration checks remain later scope. |
| Deterministic verification | complete | Fresh durable v2 guardrails pass: unit/global-ratchet/complexity pass; coverage 88.9% against 84%; no new/hard-ceiling complexity violations. |
| Surface verification | complete with limits | Actual native ToolDefinition.execute, actual CLI subprocesses, copied bundle CLI, delivered restrictedChildTools, Bubblewrap denial and isolated installer run. No live model-backed child or entire parent workflow claimed. |

## Review Axes

### Spec / acceptance-contract axis
- Worst finding: **child can rebind the supposedly trusted project and retrieve another project's private body** (finding 2). Criterion 2 and material risk 3 are contradicted by direct execution.
- Additional in-plan defect: dangling-symlink host writes escape confinement (finding 1).
- Verdict input: Needs work independently of passing deterministic checks.

### Standards axis — explicitly scoped sequential fallback
- No background sub-agent dispatch tool exists. A separate sequential pass used code-review-universal TypeScript and universal-quality guides (input narrowing, async lifetimes, TOCTOU, overbroad operations), security-review trust-boundary guidance, and only code-smells duplicate-code/dead-code/long-method references.
- Worst finding: **filesystem authorization treats a dangling symlink as an absent path** (finding 1). `existsSync` follows the link and returns false; authorization then approves its checkout parent, while the SDK later follows the original link in writeFile. Direct output confirms an outside write, without a race.
- Standards also corroborate finding 2: shell-only read-only Git metadata does not constrain host filesystem tools, and per-call identity resolution trusts configuration the same child can mutate.
- No independent style-only blocker. Curated byte-identical bundle copies are an explicit release contract, not accidental duplicate runtime logic. Later-phase legacy removal was not converted into a new blocker.
- Cross-axis ranking: none. Worst finding and verdict input reported separately per axis; two unique in-plan findings.

## Findings

### 1. High: dangling symlink permits writes outside checkout
- Location: `extensions/workflow-state/confined-fs.ts:39-42,63-84`.
- Threat: local restricted child; tampering/elevation of privilege. Host write can create/overwrite a target outside its authorized checkout when a dangling link names that target.
- Actual scenario: fixture checkout contains `dangling` pointing at an absent file in fixture machine storage. Delivered b-review `write({path: "dangling", content: "outside write via dangling symlink"})` succeeds.
- Observed output: `{"tool":{"ok":true,"text":"Successfully wrote 34 bytes to dangling"},"outsideCreated":true,"outsideBody":"outside write via dangling symlink"}`.
- Cause: `deepestExisting` uses existsSync, skipping dangling links. Guard authorizes the parent but delegates the original path to SDK writeFile (`dist/core/tools/write.js:157-162`).
- Proposed fix and regressions are in `iterate-phase-4-native-access-boundary.md`. Authorization must recognize symlink entries and cover the eventual filesystem operation; do not merely add a prompt warning or weaken the boundary.

### 2. High: child-writable Git metadata rebinds native project scope
- Locations: `extensions/buck-loop/run-step.ts:153-169`; `extensions/workflow-state/confined-fs.ts:63-75`; `extensions/workflow-state/index.ts:65-70`; `skills/_shared/scripts/workflow-state.ts:172-186`.
- Threat: local restricted child; spoofing/tampering/information disclosure. The child can mutate the project/branch identity inputs used by its next native call.
- Actual scenario: register a fixture project-B private memory; change fixture origin to project A; native read returns null. Delivered b-review `write` rewrites `.git/config` back to project B; the same native tool next returns B's private body.
- Observed output: `.git/config` write succeeds, `gitConfigChanged: true`; project IDs change from `origin-e545c2ef1403bf526148639ea3172b5bc710e1aeef01e96624f88ab4f1ad5253` to `origin-2f8db86e737456605048171e2b8677e73182c3a91a6377517d9fb3b9f6a62fc8`; `returnedPrivateBody: "PRIVATE PROJECT B"`.
- Cause: checkout confinement permits `.git/config`; only workflow_exec makes Git metadata read-only. Child workflowStateTool receives cwd/role but no immutable supervisor-bound context and resolves origin again per call. Caller scope rejection protects JSON arguments, not these mutable inputs.
- Proposed fix: bind one validated context/store selection at trusted child creation; refuse identity/backend changes until explicit trusted rebind. Enforce stage-specific Git metadata protection across all child tools, including `.git` indirection and common-dir paths, not only command execution. Preserve an explicitly authorized commit checkpoint.

## Verification Status
- Goal achieved: partial.
- User goal: partially met at Phase 4 access layer. Backend choice, token/native/CLI access and repaired receipt runs work; enforceable restricted-child privacy does not.
- Scope adhered: current Phase 4 boundary; deferred phases not demanded.
- Out-of-scope changes authored: none. Only this report and its iteration artifact retained; no source, tests, phase, lifecycle or loop state changed.

### Commands and observed results
1. `npm run guardrails:check` — pass; durable v2, required unit/ratchet/complexity pass, 88.9% coverage against 84% baseline.
2. Focused `npx vitest run` for workflow-state service, native tool, execution, confined-fs, bridge, project-memory, run-step, sql-save-store, install and codex-plugin — **10 files / 167 tests passed**. Intentional completed-receipt retry prints its expected refusal; exit 0.
3. `npx vitest run scripts/commands-mirror.test.ts` — **1 file / 4 tests passed**.
4. `diff -rq skills/_shared/storage plugins/buck-workflow/skills/_shared/storage`, service/CLI `diff -q`, migrations `diff -rq` — exit 0; no differences.
5. Throwaway `bun /tmp/buck-phase4-current-review.mjs` — exit 0. For repo-files/external-files/SQLite/PostgreSQL: native write, actual CLI token read, native correction, exact CLI readback, lifecycle initialize/activate, two complete independent receipt runs, branch-switch receipt/token denial and original-branch resume. All non-repo selections asserted no `.context` materialization.
6. Same smoke used actual restrictedChildTools objects to prove direct outside read and existing-symlink read denial, checkout source read success and Bubblewrap outside cat denial, then reproduced findings 1–2. No user/private production data accessed; all bodies were fixture sentinels.
7. Copied curated bundle CLI read native-created external-file token, with no extensions directory. Installed runtime dependencies were linked, not freshly installed.
8. `bun /tmp/buck-phase4-installer-review.mjs` — isolated runVerify exit 0; all **17 shipped storage files ok**, **one Codex linked-here**, every managed surface resolves to this checkout. Operator harness links were not altered. This corrects the first smoke's missing bootstrap fixture, not product code.
9. PostgreSQL used a review-owned disposable `pgvector/pgvector:pg18` container. Container stopped; both throwaway scripts and all temporary roots removed.
- Initial smoke receipt fixture omitted the required readback duty and correctly failed. Fixture corrected to `metadataDuties: [readback]`; final four-backend run above passed. No production code changed to accommodate the fixture.

## Guardrails Verdict
- Contract: durable; version 2; runner 1.0.0; status **pass**.
- Gates: `unit_test_gate=pass`, `functional_test_gate=skipped`, `lint_gate=skipped`, `patch_gate=advisory`, `global_ratchet=pass`, `complexity_gate=pass`.
- Coverage: 88.9%; baseline 84%; target 90%; patch null/advisory.
- Complexity: 30 existing hotspots, baseline 30, no new or hard-ceiling violations.
- No enforcement or baseline changes applied. Passing tests do not negate the independently reproduced boundary defects.

## User Goal Analysis
- Goal: choose durable storage per project, resume reliably, keep unmerged work outside unrelated branches' ordinary retrieval.
- Met in this slice: native/CLI/token addressing, four-backend access, corrected receipt identities, scoped token/receipt denial, portable bundle and shipping.
- Partial: restricted child scope enforcement.
- Missing: non-bypassable filesystem mutation confinement and supervisor-bound project identity unaffected by child-writable metadata.
- Verdict: partially met; whole-parent goal remains later-phase work.

## Documentation Impact
- Native access, central registry/manifest, roles and child isolation are new conventions/module boundaries.
- `docs/buck-loop.md:16-18` claims Git metadata is read-only outside commit; current host tools contradict that claim. Correct the implementation first, then document the enforceable whole-child boundary.
- Non-blocking recommendation: `/b-docs` before supervisor save after correctness acceptance. No documentation-only iteration finding.

## How-to Impact
- Portable CLI/token operations and Bubblewrap prerequisites need task-oriented procedures; current shared access guide is a reference, not a how-to.
- Documentation search found the boundary narrative, not a matching task-oriented guide. Recommend `/b-docs` first, following `/b-howto` where needed. Do not publish bypassable behavior as supported.

## Issue Classification
- In-plan: **two High implementation defects**, both against criterion 2/material risk 3; paired with concrete fixes and required regression scenarios in `iterate-phase-4-native-access-boundary.md`.
- Out-of-plan: none raised. Existing declared later-phase work remains deferred.
- Non-findings: caller-supplied literal project scope denied; restricted inspect denied; direct outside/existing-symlink reads denied; repeated receipt run bug repaired; private branch token/receipt denied in normal unchanged-context flow; no mirror under external/SQL adapters.

## Completion Audit
1. Objective restated as six current Phase 4 deliverables.
2. Deliverables mapped to current source/tests/live command output in matrix.
3. Source inspected and fresh authoritative contract run; pass recorded.
4. Native/CLI/file-tool/isolated-command/installer claims exercised on actual executable objects; no live model-child or whole-parent claim.
5. Contradicted privacy criteria remain missing/partial despite completed phase status and green checks.
6. Both axes completed; report and actionable in-plan iteration delivered. No supervisor state chosen or modified.

## Verdict
**Needs work** — two independently reproduced in-plan child-boundary defects. The earlier receipt and ordinary direct-path fixes work, but do not establish the claimed complete trusted boundary.

## Recommended Next Step
Supervisor-owned routing: `/b-iterate` using `iterate-phase-4-native-access-boundary.md`, then review this same phase. Documentation/how-to sync and supervisor save/commit follow acceptance. This assignment changes no loop or phase state and stages only its two authored artifacts.
