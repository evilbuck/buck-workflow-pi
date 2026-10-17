---
status: completed
date: 2026-09-30
updated: 2026-09-30
subject: 2026-09-30.buck-loop-unphased-closeout
topics: [review, iteration, unphased-closeout]
informs: []
addresses: plan-buck-loop-unphased-closeout.md
completed: 2026-09-30
from_review: b-review
---

# Iteration: Unphased buck-loop closeout

**Current repair: the re-review's ordinary blocked-work regression is fixed and verified.** Historical findings and review verdicts below are retained as evidence. The latest repair and fresh verification are recorded in **Cause-scoped Recovery Repair — 2026-09-30**. Independent supervisor review and save remain pending; this repair does not choose a loop state or change plan acceptance/lifecycle.

## Source

- Reviewed after: assigned `/b-review` of the current implementation tree.
- Plan: `plan-buck-loop-unphased-closeout.md`.
- Baseline: `00466ca263eb2a656766d58c7354a1303d07d4b8`; staged implementation versus HEAD, plus direct current-state inspection. Historical SQL recall was supplied by the supervisor; no SQL memory call was made.
- Verdict: **Needs work**. All findings below are in-plan defects; no out-of-plan discoveries are recorded here.

## Critical Issues

### 1. Eligible resume restarts build or returns done without closing the subject

- **Files**: `extensions/buck-loop/loop.ts:274-290,311-324,381-384`.
- **Problem**: The required eligible closeout repair is absent. A blocked projection with all boxes `[x]` still goes through `USER_CONFIRMED` to resolving/building. A false-done projection with all boxes `[x]` syncs plan status and exits through `haltIfTerminal` without calling the lifecycle authority. No lifecycle closeout invocation was added to the supervisor.
- **Current smoke evidence**: Isolated real git repositories, committed implementation, clean worktree, and history containing saving → committing. `handleLoop({ command: "resume" })` with an initially active, fully checked plan:
  - projection `blocked`: `runStepCalls=["b-build","b-build"]`, final state blocked at the injected failed-work boundary, canonical subject state active.
  - projection `done`: `runStepCalls=[]`, final state done, plan status completed, canonical subject state active.
- **Proposed fix**: Before generic blocked-resume confirmation and terminal exit, handle this closeout case: sync the eligible unphased plan, invoke the canonical `close-verified` authority, preserve refusal blockers, and only persist/return done with committing history and the required clean-tree evidence. Never start nested work for this repair. Do not add a projection field or state. Add the named no-`runStep` regression for both projection states and lifecycle refusal.

### 2. False-done downgrade reports historical success instead of open acceptance lines

- **Files**: `extensions/buck-loop/persist.ts:163-167,220-230`; `extensions/buck-loop/loop.ts:381-384`.
- **Problem**: Reconciliation changes state to blocked but preserves the done history unchanged. The terminal reason therefore still says `unphased plan completed its single cycle`; the operator gets no unchecked line. A still-blocked rescan also need not refresh the acceptance details.
- **Current smoke evidence**: `done` + active plan + `- [ ] Observed acceptance` returns `{state:"blocked",reason:"unphased plan completed its single cycle"}`, with no nested work. A no-list active plan has the same misleading reason.
- **Proposed fix**: Record the closeout blocker as current transition/reason evidence, using the same reason formatter as automatic and choice gates. Include each unchecked acceptance line and `unphased plan remains open`. Refresh that reason on still-ineligible resume instead of copying a stale success. Add the false-done persist/resume regression and assert meaningful blocker content.

### 3. Uppercase `[X]` bypasses the eligibility and lifecycle gates

- **Files**: `extensions/buck-loop/scan.ts:185-195`; `skills/_shared/scripts/subject-lifecycle.ts:177-184`; bundled lifecycle copy; `extensions/buck-loop/phase-completion.ts:90-97`.
- **Problem**: Scan and lifecycle only recognize whitespace-filled boxes as open. The status writer recognizes `[X]` and refuses to regard it as checked, but the other two readers allow it. This violates implementation step 1's explicit lowercase-only `[x]` rule and the single-parser requirement.
- **Current smoke evidence**: A completed unphased plan containing `- [X] Observed acceptance` scans as `closeEligible:true, openAcceptanceLines:[]`; `close-verified` succeeds and changes an active canonical subject to completed.
- **Proposed fix**: Extract and reuse the body-list parser in the loop's scanner and status sync; ensure lifecycle uses the identical lowercase-only acceptance semantics. A recognized box other than `[x]`, including `[X]`, must remain a blocker. Preserve bundled parity. Add boundary tests for `[ ]`, `[x]`, `[X]`, missing/empty sections, and stopping at the next level-two heading.

### 4. Status sync is neither target-safe nor idempotent

- **File**: `extensions/buck-loop/phase-completion.ts:54-69,86-106`.
- **Problem**: `basename(abs).startsWith("plan-")` is not evidence that the plan is unphased. It also ignores eligible unphased plans when invoked with the supported subject-folder input. The writer always rewrites an already completed plan and moves `completed_at` on later invocations, unlike `markPhaseCompleted`.
- **Current smoke evidence**:
  - Subject-folder sync with one active, fully checked unphased plan returns `[]` and leaves status active.
  - Explicit plan sync with a pending owned phase writes the parent plan to completed while scan still says `phased-incomplete`.
  - Two syncs of an already completed, fully checked plan both report a write; the second moves `completed_at` to `2026-10-01`.
- **Proposed fix**: Resolve the selected plan using existing ownership/path conventions; apply the new status write only to an unphased selected plan, including subject-folder input. Preserve phased behavior. Return unchanged when status is already completed and preserve its completion date. Add targeted consumer-visible regressions for subject-folder start, phased-plan preservation, and stable completion metadata.

### 5. Planned unphased build instructions were not implemented

- **File**: `skills/b-build/SKILL.md:264-298`.
- **Problem**: The skill still only describes checking discrete-phase boxes. It has no instruction to check the unphased plan's `## Acceptance criteria` entries with direct verification evidence. Implementation step 6 and the in-scope build-skill change are missing; this is not merely optional documentation impact.
- **Proposed fix**: Add the accepted unphased completion instruction using the phase evidence rule. Never invent evidence, check unverified boxes, or write subject lifecycle fields. Keep the bundled skill aligned with the canonical source under repository packaging conventions.

### 6. Required verification fails and planned regressions are missing

- **Files**: `extensions/buck-loop/__tests__/scan.test.ts:139,147,171,210,582`; `extensions/buck-loop/__tests__/loop.test.ts`; `extensions/buck-loop/__tests__/persist.test.ts`; `extensions/buck-loop/__tests__/machine.test.ts:230-247`; `extensions/buck-loop/persist.ts:148-184`; `skills/_shared/scripts/subject-lifecycle.ts:162-194`.
- **Problem**: The focused four suites pass but omit the required unphased loop/persist regressions and choice-advance test. Full guardrails fails: unit tests and coverage command exit 1; the global ratchet cannot verify coverage; required complexity rejects `reconcile` at 12 and `collectPlanBlockers` at 26 (also above the hard ceiling). The separate scan run isolates five failures caused by exact equality with the obsolete `{kind:"unphased"}` object shape.
- **Proposed fix**: Remove incidental exact-object-shape assertions rather than re-pin added internal fields; retain or replace those tests with consumer-visible plan selection, ownership, and eligibility assertions. Add the planned actual resume, choice-advance, persist, and lifecycle boundaries. Extract focused blocker/reconciliation helpers to satisfy existing complexity gates, without weakening thresholds, ignoring files, or changing baselines. Run all affected suites, then the unchanged deterministic contract. Do not claim this criterion complete until the required gates pass.

## Warnings

- No deferred blocking assumption was declared. The plan's A-2 material-risk mitigation remains incomplete for the repaired eligible resume (issue 1); A-3 canonical completed retry is supported by existing passing lifecycle tests and `closeSubject`'s early return. A-1 records historical behavior that this plan intentionally strengthens.
- The rollback source remains available as tracked HEAD versions of the changed files; no rollback was executed. Do not revert only one machine rule independently of the matching gate.
- Documentation impact is non-blocking and separate from these defects: after correctness repair, document unphased closeout evidence and the special resume hold in `docs/buck-workflow.md`.
- How-to impact is non-blocking: `docs/howto/recover-buck-loop.md` lacks the acceptance-evidence repair sequence and the expected no-build closeout result. Recommend `/b-docs` first; it can follow `/b-howto`.

## Completion Matrix

| Plan step / acceptance | Status | Current evidence or missing piece |
|---|---|---|
| Step 1: body parser and eligibility | partial | Scan reads plan status and body at `scan.ts:185-195`, but there is no reusable `unphasedCloseEligible` helper and `[X]` bypasses eligibility. |
| Step 2: checked-list status sync | partial | `phase-completion.ts:86-106` writes only when a recognized list is non-empty and lowercase checked; target resolution and idempotence fail smoke scenarios. |
| Step 3: lifecycle blocker and bundled copy | partial | Open-space box refusal passes; canonical/bundled files compare byte-identical. Uppercase box bypass remains. |
| Step 4 / AC1: automatic and choice gates | complete at machine seam | `machine.ts:239-249,402-414` requires eligibility on both done rules and blocks ineligible snapshots. Automatic regression passes; choice regression is missing under step 7. The incorrect scanned eligibility is step 1's defect. |
| Step 5 / AC2: hold open-box resumes without work | partial overall; open-box hold complete | Real resume returns blocked and zero `runStep` calls for both done and blocked projections, but the current reason omits unchecked lines. |
| Step 5 / AC3: eligible no-build verified closeout | missing | Blocked projection executes two builds; done projection leaves canonical subject active. Fix in issue 1. |
| Step 6: unphased skill instruction | missing | Only phase instructions present at `skills/b-build/SKILL.md:264-298`. Fix in issue 5. |
| Step 7 / AC7: focused and deterministic verification | missing | Focused tests pass but required guardrails fails; planned loop/persist/choice regressions absent. Fix in issue 6. |
| AC4: active status refuses, completed status with open `[ ]` refuses, missing list adds no box blocker | complete for named cases | Lifecycle status check `subject-lifecycle.ts:174-176`; passing open-box refusal and status-only tests at `subject-lifecycle.test.ts:89-113`. `[X]` strengthening remains incomplete under step 1. |
| AC5: already canonical completed retry no-ops | complete | Passing lifecycle legal-lifecycle test at `subject-lifecycle.test.ts:35-55`; early return at `subject-lifecycle.ts:355`. |
| AC6: supervisor never changes box characters | complete | Status writer replaces frontmatter only (`phase-completion.ts:99-105`); smoke open-plan status unchanged, checked-plan status synchronized. |
| Blocking assumptions | complete: none declared | All A-1/A-2/A-3 entries have `blocking:false`; current safety defects are tracked above. |
| Material recovery claims | partial | Tracked baseline permits reversion, but eligible-resume mitigation is absent; choice and no-list regression coverage incomplete. |

## Independent Review Axes

- **Spec axis worst finding**: issue 1 — required eligible resume either starts build or returns done without verified subject closeout. Verdict input: Needs work.
- **Standards axis worst finding**: required complexity fails at `collectPlanBlockers` (26), including hard ceiling violation; `reconcile` also fails (12). Duplicate parsing has already diverged on `[X]`; status sync unconditionally rewrites completion metadata. Verdict input: Needs work for these in-plan changed paths.
- **Execution**: explicitly scoped sequential standards fallback; this session exposes no task/sub-agent dispatch tool. Seeds: `code-review-universal/reference/typescript.md`, `reference/code-quality-universal.md`, and only `code-smells/docs/duplicate-code.md` and `docs/long-method.md`. Reviewed the changed TypeScript seams for reuse, state invariants, async errors, no-op updates, complexity, and semantic test coverage.
- Cross-axis ranking: none. Spec and standards findings are not merged into a single ranking.

## Verification Evidence

1. `npx vitest run extensions/buck-loop/__tests__/machine.test.ts extensions/buck-loop/__tests__/persist.test.ts extensions/buck-loop/__tests__/loop.test.ts skills/_shared/scripts/subject-lifecycle.test.ts`: **4 files passed; 170 tests passed; 3 skipped**, exit 0.
2. `npm run guardrails:check`: **fail**, durable contract v2, exit 1. Gates: `unit_test_gate=fail`, `functional_test_gate=skipped`, `lint_gate=skipped`, `patch_gate=advisory`, `global_ratchet=fail`, `complexity_gate=fail`. Coverage current null, baseline 84; coverage command exit 1. Required complexity violations: `reconcile=12`, `collectPlanBlockers=26` (hard ceiling too). Disabled functional/lint gates were not run; advisory patch gate is not a blocker.
3. `npx vitest run extensions/buck-loop/__tests__/scan.test.ts`: **54 passed, 5 failed**, exit 1; failures are the exact-object-shape assertions listed in issue 6.
4. Disposable Bun smoke imported actual `handleLoop`, scan, persistence, status sync, and lifecycle implementation and exercised the scenarios in issues 1–4 in isolated real git repos. Only nested work/model boundaries were injected to count and stop unexpected work; no live agent, SQL, or judgment call was used. Temporary script and repositories removed after evidence collection. TUI rendering was not exercised; this review proves supervisor behavior, not a launched OMP UI.
5. `cmp skills/_shared/scripts/subject-lifecycle.ts plugins/buck-workflow/skills/_shared/scripts/subject-lifecycle.ts`: exit 0.
6. Workflow `current-session.json` has no active goal field and points at a different historical subject. The explicit assigned plan governs this review. Historical memory index has no save for this implementation; this review does not write reusable memory.

## Completion Audit

Objective: gate both unphased commit paths, hold incomplete resumes with named acceptance blockers, synchronize only already-verified boxes, and repair eligible historical closeout without new work. Deliverables are mapped above to current source and executed checks. Actual supervisor calls expose failures, not uncertainty. Verification scope covers core runtime and lifecycle, not UI. Required deterministic verification failed, so goal/user goal are **partially met**, never complete. Scope exceptions: status sync can mutate a phased plan's parent despite the unphased-only contract. No unrelated TUI-notice subject or acceptance boxes were changed by this review.

## Recommended Workflow

Report these in-plan defects to the supervisor; recommended skill route is `/b-iterate`, then `/b-review` against the same plan. This is a recommendation, not a loop-state decision. After a passing review, sync flagged living docs/how-to, then record durable state via `/b-save` and commit through the normal checkpoint. Do not mark this iterate artifact completed until the repairs are verified, review passes, and `/b-save` records durable state.

## Repair Closeout — 2026-09-30

The findings and original matrix above are historical review evidence. All six repair groups are implemented and verified below. `status: completed` records this iteration's repair work only; the supervisor still owns independent `/b-review`, `/b-save`, and the next loop state. This nested assignment did not change the live projection, subject lifecycle, plan status, or acceptance boxes.

| Finding | Resolution | Current evidence |
|---|---|---|
| 1. Eligible resume | Before generic confirmation/terminal exit, eligible unphased done/closeout-blocked projections invoke the lifecycle authority. Done requires committing history and a clean tree before status synchronization. Refusal stays blocked, without nested work. | `loop.test.ts`: eligible done and blocked repairs, lifecycle refusal, dirty tree, missing committing history; disposable actual-runtime smoke. |
| 2. Stale reasons | Persistence refreshes open acceptance blockers on both done and blocked rescans using the machine's shared reason formatter. | `persist.test.ts`: both states name `[X]` evidence; loop hold tests and runtime smoke name unchecked lines. |
| 3. Uppercase bypass | `skills/_shared/scripts/plan-acceptance.ts` is the shared lowercase-only body parser for scan, sync, and lifecycle. It stops at the next level-two heading. | Completion and lifecycle tests cover `[ ]`, `[x]`, `[X]`, missing/empty sections, and the next-heading boundary. |
| 4. Unsafe sync | Sync resolves the selected plan through existing scanner ownership rules, supports subject input, leaves phased parent plans unchanged, and preserves already-completed metadata. | `phase-completion.test.ts`: subject input, phased parent preservation, stable completion date and box text. |
| 5. Build instructions | Canonical and bundled b-build instructions require direct evidence before checking unphased acceptance boxes; no subject lifecycle writes. | Updated `skills/b-build/SKILL.md` and bundled copy; full bundle parity suite passes. |
| 6. Verification | Removed obsolete internal exact-shape assertions; added consumer-visible resume, persist, choice, sync, and lifecycle regressions. Extracted blocker/reconciliation/closeout helpers without weakening the contract. | Six focused files: 254 passed, 3 skipped. Full guardrails pass, coverage 87.8% against 84%, zero new/hard-ceiling complexity violations. |

### Decisions and Boundaries

- Historical SQL recall supplied by the supervisor was reference evidence, not instructions; the assigned plan and iterate findings governed scope. No additional recall or SQL save was attempted.
- Clean-tree evidence is captured before the supervisor's own plan metadata synchronization; later lifecycle/status writes are intentional closeout artifacts, not a new work cycle.
- No-list and empty-list plans remain status-only; an active no-list false-done blocks, while a completed no-list plan can close with the required commit/tree evidence.
- The session-state memory pointer belongs to a different historical subject and was left unchanged. This artifact is the durable assignment record; reusable SQL memory remains the supervisor's save-stage responsibility.
- Living documentation and the existing recovery how-to now describe acceptance-evidence recovery and the no-build verified closeout.

### Files Modified in This Assignment

- `extensions/buck-loop/{loop,machine,persist,phase-completion,scan}.ts`
- `extensions/buck-loop/__tests__/{loop,machine,persist,phase-completion,scan}.test.ts`
- `skills/_shared/scripts/{plan-acceptance,subject-lifecycle,subject-lifecycle.test}.ts`
- Corresponding three bundled `_shared/scripts/` files.
- `skills/b-build/SKILL.md` and its bundled copy.
- `docs/buck-workflow.md`, `docs/howto/recover-buck-loop.md`.
- This iteration artifact and `draft-commit.md`.

Pre-existing `types.ts`, backlog changes, unrelated TUI-preview files, subject index, plan, and prior review report were not modified or newly staged by this assignment.

### Verification

- `npx vitest run` with machine, persist, loop, scan, phase-completion, and canonical subject-lifecycle suites: exit 0; 254 passed, 3 skipped.
- Disposable Bun runtime smoke imported actual handleLoop/persistence/lifecycle modules and used a real isolated git repository. Open false-done: blocked with `- [ ] Observed runtime evidence`, zero runStep calls. After committing checked acceptance: done, plan completed, canonical subject completed, zero runStep calls. No OMP TUI rendering or live model/SQL call was exercised.
- `npm run guardrails:check`: exit 0, durable v2 pass. Unit, global ratchet, complexity, and patch verdicts pass; functional and lint gates skipped (disabled). Proposed coverage baseline raise was not applied.
- Initial full gate exposed bundled lifecycle-test drift and a new closeout-helper complexity of 12; both were repaired. Contract thresholds/baselines were not changed.

### Supervisor Handoff

Run `/b-review` against the same assigned plan to validate the iteration, then `/b-save` to finalize the durable session record, then `/b-commit`. This is a handoff recommendation, not a loop-state decision.

## Re-review — 2026-09-30

### Critical Issues

#### 1. Ordinary blocked unphased work is converted into an unrecoverable closeout hold

- **Classification / severity**: in-plan regression, high. These are the plan's changed persistence/resume seams, not a new adjacent requirement.
- **Files**: `extensions/buck-loop/persist.ts:177-182`, `extensions/buck-loop/loop.ts:349-358`.
- **Problem**: `reconcileCloseout` applies the unphased eligibility hold to every `blocked` projection, regardless of its original cause or whether committing ever occurred. `confirmBlockedResume` independently refuses every ineligible unphased snapshot. An interrupted build on an active plan necessarily lacks completed acceptance evidence; after its environment is repaired, ordinary resume now replaces its original blocker with `unphased plan remains open` and never runs the build needed to satisfy acceptance. A later resume sees that replacement reason as a closeout block. The safety rule was specified for false `done` and blocks **for the closeout reason**, not all unfinished unphased work.
- **Current runtime evidence**: disposable, clean real git repository; active plan with `- [ ] Implementation not yet verified`; projection `state: blocked`, history only `building → blocked`, original reason `nested build interrupted; environment repaired`, no committing history. Actual `resume()` replaces that reason. Actual `handleLoop({ command: "resume" })` returns `blocked / unphased plan remains open; unchecked acceptance: - [ ] Implementation not yet verified`, leaves the subject active, and records zero `runStep` calls.
- **Why this is a regression**: the unchanged machine has `user-confirmed → resolving` (`machine.ts:615-619`) and `resolving-unphased → building` (`machine.ts:567-571`). The new broad eligibility guards suppress that existing recovery even though this was not a terminal closeout attempt. Plan step 5 explicitly limits the blocked hold to projections blocked for the unphased-closeout reason.
- **Proposed fix**: share a closeout-repair classification derived from the existing projection state/history. Apply reconciliation and the no-`USER_CONFIRMED` hold only to historical `done` or an actual unphased-closeout block. Preserve the original reason and existing normal resume path for unrelated build/review/save/work failures. Do not add a state/projection field, infer success from child prose, or weaken either committing eligibility gate.
- **Regression required**: resume a clean, active, open-acceptance unphased projection blocked during building, with no committing history and a repaired external cause. Assert it reaches the intended existing build/work boundary instead of becoming a closeout hold; also cover a status-only active plan. Retain the open closeout-block/false-done no-`runStep` tests and eligible verified-closeout tests. These opposite cases must not share an unconditional unphased guard.

### Plan Source

- File: `plan-buck-loop-unphased-closeout.md`.
- User goal: operators get verified unphased closeout or a resume naming open acceptance, not terminal false `done`.
- Goal: gate both unphased commit-to-done routes and repair historical false-done without another build.
- Baseline: staged implementation versus HEAD `00466ca263eb2a656766d58c7354a1303d07d4b8`, plus current-source inspection. Recent relevant history: `00466ca` TUI-notice work; `f08359f` earlier checkpoint handoff fix. No unrelated branch-range inference.
- Explicit assigned subject takes precedence over the stale `current-session.json` pointer. No active goal field exists there. Supervisor-supplied SQL recall was used only as reference; no SQL call was made.

### Evidence Sources

- Initial git status: pre-existing staged implementation and prior iterate/draft artifacts; unstaged backlog entry; untracked plan/index/prior review/backlog item and unrelated TUI-preview subject. None was newly staged by this re-review.
- Reviewed loop modules `phase-completion`, `machine`, `persist`, `loop`, `scan`, `types`; six canonical focused suites; shared acceptance parser; lifecycle source/tests and bundled counterparts; canonical/bundled b-build instructions; workflow narrative and recovery how-to.
- All named affected paths have implementation/test changes. Additional shared parser, completion tests, scan/type changes, bundled tests/build instruction, and living docs support the same accepted scope.
- Only this iteration artifact was modified by this assignment. Disposable smoke script and repositories were removed; no source/test fixes were made.

### Completion Matrix

| Plan step / deliverable | Status | Direct current-state evidence |
|---|---|---|
| 1. Shared body parser, lowercase eligibility, section boundary | complete | `skills/_shared/scripts/plan-acceptance.ts:1-16`; completion and lifecycle tests cover `[ ]`, `[x]`, `[X]`, absent/empty sections, next level-two heading. |
| 2. Sync only non-empty fully checked unphased list | complete | `phase-completion.ts:56-102`; passing subject-input, phased-parent preservation, stable metadata, open/empty list tests. Actual eligible smoke synchronizes status while preserving box text. |
| 3. Lifecycle blockers and bundled source | complete | `subject-lifecycle.ts:183-199`; actual lifecycle CLI refuses active + checked and completed + open/uppercase boxes; four canonical/bundle comparisons exit 0. |
| 4 / AC1. Automatic and choice gates | complete | `machine.ts:239-250,403-418`; passing eligible/ineligible automatic and choice-advance regressions. |
| 5. Resume reconciliation restricted to closeout | partial | Named closeout fixtures pass, but unrelated blocked building is incorrectly held. Missing: cause-scoped guards preserving normal unfinished-work recovery; fix above. |
| AC2. Ineligible closeout blocked/false-done resume does not run work and names lines | complete for named closeout cases | Runtime smoke for both projections returns blocked with `- [ ] Observed acceptance`, zero `runStep` calls; persist tests refresh uppercase/open blockers. |
| AC3. Checked acceptance + committed clean history repairs without work | complete | Runtime smoke for done and blocked writes plan completed, completes canonical subject, persists done, zero `runStep` calls; loop suite also covers refusal, dirty tree, missing history. |
| AC4. Status/body evidence, missing list | complete | Actual lifecycle CLI exits 2 with named status/open-box blockers; no-list active smoke blocks, completed no-list smoke closes. Existing status-only lifecycle test passes. |
| AC5. Canonical completed retry no-ops | complete | Actual smoke reopens a body box after canonical completion and `close-verified` still returns `ok:true, changed:false`; existing legal-lifecycle retry test passes. |
| AC6. Supervisor does not check boxes | complete | `phase-completion.ts:88-102` replaces frontmatter only; completion tests preserve body text, actual open smoke leaves `[ ]` untouched. |
| 6. Unphased build evidence instruction | complete | `skills/b-build/SKILL.md:300-302` requires direct verification, leaves unverified boxes open, prohibits subject lifecycle writes; bundled skill compares equal. |
| 7 / AC7. Focused tests and deterministic contract | complete for current suites | Six focused files: 254 passed, 3 skipped; durable v2 guardrails passes. New opposite-case recovery regression is missing under step 5. |
| Blocking assumptions | complete: none declared | A-1/A-2/A-3 all `blocking:false`; new evidence confirms strengthened lifecycle and preserved canonical retry. |
| Deferred assumptions | none | No deferred ledger entries. |
| Material rollback/fallback | available, not executed | `git cat-file -e HEAD:<path>` exits 0 for loop, machine, persist, lifecycle. Risk-table status-only and canonical retry recovery are exercised; no rollback was performed. |

### Review Axes

- **Spec axis worst finding**: high — step 5's closeout-only hold now captures ordinary interrupted unphased work. Verdict input: Needs work.
- **Standards axis worst finding**: high — cause-insensitive state reconciliation overwrites actionable failure evidence and regresses recovery; the new tests lack the negative-control unfinished-work case. Same demonstrated defect, independently evaluated under state-transition/error-preservation and semantic-testing standards.
- Standards execution: separate explicitly scoped sequential fallback after the acceptance pass; no task/sub-agent dispatch tool was available. Seeds: `code-review-universal/reference/typescript.md`, `reference/code-quality-universal.md`; only `code-smells/docs/duplicate-code.md` and `docs/long-method.md`. Checked reuse, narrowing, error paths, persistent-state updates, parser consistency, no-op sync, module imports, and transition tests. Shared parser and current bounded helpers have no additional actionable duplication/long-method finding; required complexity passes.
- Cross-axis ranking: none. No merged severity list.

### Verification Status

- Goal / user goal: **partially met**. Required closeout flows work, but ordinary unfinished unphased resume is regressed.
- Scope adhered: **no** — eligibility hold extends beyond false-done/closeout-block recovery. No unrelated source or historical TUI-notice repair was performed by this review.
- Fresh focused command: `npx vitest run` on machine, persist, loop, scan, phase-completion, canonical subject-lifecycle: exit 0; **6 files passed, 254 tests passed, 3 skipped**. Vitest is the existing suite convention; the plan's `bun test` spelling was not used.
- Disposable Bun smoke: actual `handleLoop`, persistence, lifecycle modules in isolated real git repositories. Actual lifecycle CLI invoked through `bun .../subject-lifecycle.ts close-verified --subject <fixture> --json`. Only nested work/choice/repair boundaries were injected; no model, SQL, or live OMP TUI was exercised. This proves supervisor and lifecycle behavior, not UI rendering.
- Bundle checks: acceptance parser, lifecycle source/tests, b-build skill all byte-identical; exit 0.

### Guardrails Verdict

- Contract: **durable**, version **2**, runner 1.0.0; `npm run guardrails:check`, exit **0**, status **pass**.
- Gates: `unit_test_gate=pass`, `functional_test_gate=skipped`, `lint_gate=skipped`, `patch_gate=pass`, `global_ratchet=pass`, `complexity_gate=pass`.
- Coverage: **87.8%**, baseline **84%**. Patch percentage is **null** in runner output; no numeric patch-coverage claim. Zero new/hard-ceiling complexity violations. Functional/lint disabled by the existing contract. Proposed baseline raise not applied.
- Passing checks do not override the reproduced recovery defect.

### User Goal Analysis

- Goal: “Operators running `/buck-loop` on an unphased plan get either a verified subject closeout or a resume that names the open acceptance boxes. They do not get a terminal `done` that leaves the plan and subject open and then exits immediately on `--resume`.”
- Met: closeout blockers, checked status sync, lifecycle refusal, eligible no-build repair, status-only fallback.
- Partial: resume safety is correctly strict for closeout but incorrectly prevents ordinary unfinished work from continuing.
- Missing: scoped classification and opposite-case recovery regression described above.
- Verdict: **partially met**.

### Documentation Impact

- New convention/recovery contract is already reflected in `docs/buck-workflow.md:169`; no additional living-document gap found. Existing optional documentation finding is satisfied.
- Recommended: none for the current implementation; do not weaken the documented closeout hold to repair ordinary recovery.

### How-to Impact

- Existing `docs/howto/recover-buck-loop.md:6-11` now covers evidence marking, clean-tree/history requirements, and no-build closeout. No additional how-to gap found.
- Recommended: none.

### Issue Classification

- In-plan issues: **1**, ordinary blocked-work resume regression in changed persistence/loop seams → recommended `/b-iterate`.
- Out-of-plan issues: **none**.

### Completion Audit

1. Concrete deliverables: both commit gates, named open acceptance holds, status sync without checking boxes, lifecycle verification, no-work eligible historical repair, preserved existing recovery, tests/instructions/bundle parity.
2. Each deliverable maps to source and executed output in the matrix.
3. Current code inspected; fresh durable deterministic contract passes.
4. Verification exercises actual supervisor and lifecycle CLI; no UI or live-model claim.
5. Observed ordinary-recovery failure prevents full completion despite all existing focused tests passing.
6. Both axes and the requested scope are reviewed; no review truncation. Plan acceptance/status and subject lifecycle remain unchanged.

### Verdict / Recommended Workflow

**Needs work** — one in-plan regression; no out-of-plan blocker or required operator input.

Recommend `/b-iterate` for the cause-scoped hold and opposite-case test, then `/b-review` against the same plan. After a passing review, `/b-save` then `/b-commit`; no current reusable save receipt exists for this work. This is a review recommendation only: the supervisor owns the next loop state.

## Cause-scoped Recovery Repair — 2026-09-30

### Resolution

- Shared `isUnphasedCloseoutProjection` classifies historical `done` and blocked projections whose current transition reason begins `unphased plan`. Persistence reconciliation, eligible repair, and confirmation suppression use the same classifier.
- Ordinary blocked building with open acceptance or a status-only active plan preserves its original interruption history and resumes through the existing USER_CONFIRMED/build path.
- Actual closeout holds continue naming unchecked evidence and never invoke nested work. Both committing eligibility gates are unchanged.
- Added opposite-case persistence and supervisor regressions; corrected the existing blocked-closeout fixture to carry actual closeout history rather than unrelated building history.
- Documented the recovery distinction in `docs/buck-workflow.md`.

### Verification

- Six focused Vitest suites: **258 passed, 3 skipped**, exit 0.
- Disposable Bun smoke imported actual supervisor/persistence/lifecycle code in four isolated real git repositories. With and without an acceptance section: ordinary interruptions preserve their reason and reach `b-build` (then the injected failure exercises the existing one retry); closeout blockers make zero `runStep` calls and remain blocked with closeout evidence.
- Final `npm run guardrails:check`: **pass**, durable v2, exit 0; unit, global ratchet, patch and complexity pass. Coverage **87.8%**, baseline **84%**; zero new/hard-ceiling complexity violations. Lint and functional gates disabled/skipped. No baseline/contract changes.
- Initial verification found a no-change fixture commit and complexity 11 in reconciliation. The fixture now has distinct plan content; classification is an early return, removing the redundant state guard. Final checks above ran after those fixes.
- No OMP TUI, live model, SQL save, subject closeout, or loop-state decision performed. Temporary smoke script/repositories removed.

### Files Modified in This Repair

- `extensions/buck-loop/persist.ts`
- `extensions/buck-loop/loop.ts`
- `extensions/buck-loop/__tests__/persist.test.ts`
- `extensions/buck-loop/__tests__/loop.test.ts`
- `docs/buck-workflow.md`
- This iteration artifact and `draft-commit.md`.

Existing staged implementation remains intact; only these seven touched paths are staged by this repair. Unrelated backlog, TUI preview, plan/index, and review artifacts remain untouched. Supervisor-supplied recall was reused as reference; the stale session-memory pointer remains unchanged. This artifact supplies durable repair evidence; the supervisor owns independent `/b-review`, `/b-save`, and `/b-commit`.
