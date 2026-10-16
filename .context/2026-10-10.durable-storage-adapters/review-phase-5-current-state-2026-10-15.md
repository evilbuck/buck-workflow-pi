---
status: active
date: 2026-10-15
subject: 2026-10-10.durable-storage-adapters
topics: [code-review, storage-consumers, phase-5]
review_verdict: request-changes
related: [phase-5-remaining-consumers.md, iterate-phase-5-current-state-2026-10-15.md]
---

# Plan Path Review: Phase 5 remaining durable consumers

## Plan Source
- File: `phase-5-remaining-consumers.md` (explicit assignment; no subject picker).
- Goal: migrate all remaining Buck-owned durable consumers to the selected storage service, preserving private scope and host ownership.
- Baseline: `db31575..f235435` plus current source. The interval also contains earlier Phase-4 boundary repairs; source-state acceptance, not a blanket review of every historical file, defines this review.
- Current phase says completed with six checked criteria. Those metadata assertions do not override the source and runtime findings below.
- The phase's operator closeout explicitly leaves cross-worktree recovery to Phase 6 and full workflow proof to Phase 8. This review does not require those later deliverables. Ordinary same-checkout selected-store reads/resume, trustworthy save completion and no private LTM handoff remain Phase-5 requirements.

## Evidence Sources
- Initial Git status: one pre-existing tracked change to this phase, many pre-existing untracked `.context` artifacts, empty staged diff. All preserved; no implementation files edited during review.
- Relevant commits: `2f3a7a8`, `b76b30f` consumer migration; `5a31384` configured-scope retention; `f235435` receipt-run binding.
- Source groups examined: shared consumers and trusted context/receipt handling; both save entrypoints; loop projection, review and phase writes; review iteration state/pass/report boundaries; turn-memory hook; attribution database/runtime; importer source/filter/manifest; presentation CLI; plan-site source/types/factory; original persistence census and auto-fix/pinned PR evidence.
- Prior review/iteration and implementation notes used as historical context only. Current source and fresh smoke output determine the findings. No SQL-memory query was made; supervisor-supplied recall was sufficient.
- Followed the parent's `research:` link: `research-durable-storage-adapters.md:32-46` explicitly requires selected-store importer inputs/cursors and optional, non-authoritative materialization. This supports R1 without reopening the settled storage design.
- `.context/memory/index.md` has no Phase-5 closeout entry. The current-session projection is stale and has no active goal field; the explicit phase controls this review. No goal-budget claim is made.

## Completion Matrix

| Deliverable | Status | Current-state evidence / missing piece |
|---|---|---|
| Criterion 1: both save pipelines, same-adapter batches and attempt receipts | Partial | `sql-save.ts:145-167,314-394` writes/finishes selected-store receipts, and `save-apply.ts:595-621` seals metadata. Standalone extension calls only local completion while metadata gets an unrelated run (R6). Preflight still requires physical `.context` and enumerates local subject files (`save-preflight.ts:123-145,171-174`; R1). One authoritative save/read/completed-attempt path is missing. |
| Criterion 2: loop resume/scan/checkpoint/activity, review state/pass, hook, attribution/dedupe/import cursor through service | Partial | Actual SQLite checkpoint persists, but reader uses workspace run rather than retained run and `resume()` requires local JSON (`persist.ts:124-173`). Review/import/attribution readers still use files/tables; final-report/attribution durability is not awaited. Hook attempts reuse one run. See R1/R2/R5/R7. |
| Criterion 3: retained presentation/attachment bytes | Complete for exercised retention path | Actual documented CLI with explicit `--cwd` returned `ok:true, files:2`; readback matched binary `[0,255,42]` and its exact adapter receipt/revisions. `consumers.ts:205-246` batches package bytes and refuses symlinks. This is SQLite retention proof, not all-backend workflow proof or a browser claim. |
| Criterion 4: plan-site existing reader seam; SQL stub removed; no redesign | Partial | Configured default loader works for plan/index/research and excludes another branch. However its kind whitelist drops ordinary visible review/iterate documents previously listed by the recursive Markdown reader; actual configured smoke returned null for a stored visible review (R10). Astro/browser integration remains Phase 8 criterion 3, not an extra Phase-5 blocker. |
| Criterion 5: host-owned storage untouched; no LTM mirroring of unmerged knowledge | Missing privacy requirement | Buck attribution code still does not write host `messages` rows; no host-store migration was introduced. However standalone save builds a `retain` handoff from unmerged scribe facts (`index.ts:548-580,803-818`). Actual payload-builder smoke included `Unmerged private decision` in a command to call `retain`. |
| Criterion 6: Phase-1 census fully reconciled | Partial | Reconciliation table exists, but auto-fix durable run/stage/failure evidence and generated pinned PR evidence are relabeled transient/user-owned without demonstrated exclusion (`inventory:97,104`; `auto-fix.ts:159-185,413-445,598-607`; `pr-context.ts:360-362`). |
| Step 1: save + loop migration; machine semantics unchanged | Partial | Selected-store fact/receipt and retain paths exist; consumer-authoritative resume and complete standalone receipts remain missing. No new machine routing demanded. |
| Step 2: hook, plan bridge, attribution | Partial | Plan bridge was migrated in Phase 4. Hook writes memory/dedupe through service, but successive windows collide on receipt run; attribution still trusts old local dedupe/report authority. |
| Step 3: immutable review artifacts and state | Partial | Review/fixer/pass/commands are retained and main pass writes awaited (`loop.ts:326-327,732-738`). Load/list/command reads remain file-only; final report and initial state still schedule without awaiting. |
| Step 4: importer + retained packages; published-only LTM | Partial | Package CLI works and importer filters exact published revision hashes (`import-context-memory.ts:564-579,789-798`). Import manifest remains local authority; standalone save LTM route remains unfiltered. |
| Step 5: real plan-site adapter reader | Partial | Real default configured loader succeeds for selected kinds, but does not preserve the prior visible Markdown document/link contract (R10). |
| Blocking assumptions | Complete for this phase's ledger obligations | Parent A-1/A-2/A-3/A-5 are documented validated decisions; A-4 runtime validation belongs to Phase 1. No unresolved blocking assumption is assigned to Phase 5. This does not erase consumer defects. |
| Material risk 3: visibility before model/LTM exposure | Missing mitigation on standalone save | Importer's publication guard is present, but standalone save emits private facts into unscoped harness-LTM instructions (R4). Withhold the operation rather than substituting unrestricted recall. |
| Material risk 5: partial/stale writes, receipt and recovery authority | Partial | Shared queue now preserves failures and receipt readback exists. Actual stale consumer update overwrote newer canonical body and erased links; same-checkout checkpoint recovery failed after export removal. R1/R3/R6/R7 remain. |
| Deferred risks / fallback claims | Intentionally unchanged outside phase | Parent checkpoint promotion/revocation/rebinding matrix belongs to Phase 6; source-snapshot cutover/rollback belongs to Phase 7; configuration/dotfile recovery documentation to Phase 8. No claim that those unimplemented recovery routes were verified here. No automatic adapter fallback is accepted for Phase-5 consumers. |
| Required deterministic verification | Missing | Two authoritative runs exited 1 with unit and coverage-ratchet gates failing. The repeat ran without concurrent focused suites and still failed. Required gates cannot be replaced by passing focused suites. |

## Review Axes

### Spec / acceptance-contract axis
- Worst finding: **High — unmerged knowledge is still placed into the standalone save's host-LTM handoff** (R4), violating criterion 5 and parent material risk 3.
- Other independent in-plan failures: selected-store resume/read authority (R1), caller scope/destination binding (R2), unconditional stale writes/link loss/logical-key mismatch (R3), hook attempt collision (R5), incomplete standalone durable receipts (R6), unawaited terminal retention (R7), census ownership gap (R8), failed required deterministic verification (R9), and lost visible site documents (R10).
- Fix proposals and reproducible acceptance paths: `iterate-phase-5-current-state-2026-10-15.md`. Findings are not inferred solely from old reports.

### Standards axis — separate sequential fallback pass
- No `task` or other sub-agent dispatch tool is available. Standards reviewed separately after acceptance-source inspection, using the portable fallback rather than claiming parallel/context-isolated review.
- Seeds: TypeScript guide (especially Promise handling), universal quality and review-best-practices guides; diff-scoped smells: duplicate code and primitive obsession only. No whole-catalog audit or stylistic threshold gate.
- Worst finding: **High — async durability is advertised by APIs/tests but dropped at production completion boundaries** (`run-state.ts:106-126`, `report.ts:157-169`, `loop.ts:556-600`, attribution `db.ts:138-145`). The shared queue's rejection retention does not help a caller that never drains/awaits it. R7 is independently relevant to both axes, not two separately counted defects.
- Additional standards evidence: unused legacy `worktreeId` input creates a misleading scope contract (R2); competing subject-relative versus prefixed logical-name construction causes real identity drift (R3). Reuse existing trusted reference/conditional-write conventions rather than adding another identity format.
- No independent cosmetic or speculative-refactor blocker was added.
- Cross-axis ranking: none. Each axis retains its own worst finding; no merged severity ladder.

## Verification Status
- Goal achieved: partial.
- User goal: partially met — selected adapter writes/package retention/default plan reader work in exercised SQLite scenarios; ordinary resume reliability and private-knowledge isolation are not met.
- Scope adhered: reviewed Phase 5 only. Earlier Phase-4 fixes and later publication/migration workflows are not reopened. No implementation, phase-status, subject-lifecycle or loop-state changes were made.
- Out-of-scope changes: none authored by this assignment. Broad historical `.context` copies and existing changes were not staged.

## Guardrails Verdict
- Contract: durable, version 2 (`guardrails.json`).
- Status: **fail**, exit 1 on both measurements, including the repeat without concurrent focused suites.
- Gates: `unit_test_gate=fail`, `functional_test_gate=skipped`, `lint_gate=skipped`, `patch_gate=advisory`, `global_ratchet=fail`, `complexity_gate=pass`.
- Coverage: command exited 1, current/patch percentages unavailable; baseline remains 84, no baseline rewrite. Complexity: 30 retained baseline hotspots, no new or hard-ceiling violations.
- First unit tail names 5000ms review-loop timeouts in clean-first-pass and fix/re-review workflows. Repeat tail names a resume-rebase-conflict timeout (`loop.test.ts:593`) and failure of configured-store pass retention (`run-state.test.ts`). The captured tails do not establish all individual causes; no aggregate passing-test count or coverage percentage is inferred from them.
- This is not a docs-only gate skip: the implementation under review includes code.

## Fresh Executed Evidence
1. Authoritative `npm run guardrails:check`: **failed twice**, exit 1 after 510.26 seconds and 816.86 seconds. Both emitted the same required failing gates above. The repeat had no concurrent focused test suites dispatched by this review; small isolated API smokes used separate temporary stores. No gate/baseline/timeout was changed.
2. `npx vitest run skills/_shared/scripts/consumer-persist.test.ts skills/_shared/scripts/workflow-state.test.ts extensions/buck-loop/__tests__/sql-save-store.test.ts extensions/buck-loop/__tests__/sql-save-guards.test.ts skills/b-save-improved/scripts/save-apply.test.ts skills/b-present/scripts/retain-package.test.ts extensions/turn-memory/__tests__/hook.test.ts extensions/code-review-iteration/__tests__/run-state.test.ts`: **8 files / 89 tests passed**, exit 0. Child stderr printed `receipt attempt or scope mismatch, or already complete`; `workflow-state.test.ts:224-226` deliberately retries a completed receipt and asserts this rejection. The diagnostic is consistent with that explicit negative test, not evidence of an unidentified suite failure.
3. `bun test skills/b-memory-import/scripts/import-context-memory.test.ts`: **25 passed, 0 failed**, 65 assertions.
4. Isolated production-API smoke, actual SQLite: stored checkpoint run differed from workspace run; after local bookmark removal storage still had one checkpoint, `readProjection:null`, `resumeState:idle`.
5. Isolated actual SQLite stale-update smoke: canonical newer body with spec link was overwritten by consumer `stale projection body`; readback links became empty.
6. Actual `bun skills/b-present/scripts/retain-package.ts <temp-package> --cwd <temp-checkout>`: **ok**, two retained files; exact binary readback `[0,255,42]`; matching persisted receipt and two revision IDs.
7. Actual configured default `SqlPlanSource` (not injected loader): adapter-only subject status/documents/slug succeeded; another branch's plan was excluded. No Astro or browser result.
8. Actual standalone save `buildRetainInstruction` returned a command to call `retain` with the supplied unmerged private fact. No host-LTM request was sent.
9. Actual standalone save no-fact receipt flow (`prepareSaveAttempt` -> `saveSqlFacts` -> `completeSaveAttempt`) on isolated configured SQLite: local completion was true; native `read-receipt` returned `status: attempted`, with duties `save-metadata, probe`. No full OMP command/UI claim.
10. Canonical/bundle parity: `cmp` for `consumers.ts` and `workflow-state.ts`, plus recursive `diff -rq` of `skills/b-present` against its shipped mirror: exit 0, no differences. No fresh-install claim.
11. Reader regression smoke: store-visible documents were `iterate-demo.md`, `plan-demo.md`, `review-demo.md`; the actual configured reader returned only `plan-demo.md`, and review lookup returned null. Baseline `db31575` filesystem reader recursively collected all subject `.md` files. This proves a read-contract regression without claiming a rendered-site test.
12. Real two-worktree scope smoke: same project, distinct branches/worktrees. Explicit `cwd:right` read back only in right; the legacy production-call shape `worktreeId:right` with omitted cwd read back only in left (`left:true, right:false`). This exercises actual scope binding, not complete concurrent workflow restart.
13. Nested-key classification smoke: `.context/2026-10-15.demo/index.md` and `.context/2026-10-15.demo/notes/index.md` both returned exactly `{kind:subject-index, subjectId:2026-10-15.demo, logicalName:index.md}`. The classifier aliases distinct source files onto the lifecycle index (R3).
- Smoke fixtures used temporary checkout/config/identity/database/package roots; fixture data and all five temporary scripts were removed.
- No real PostgreSQL consumer scenario, all-four-adapter workflow, production OMP hook capture, real two-worktree consumer restart, fresh install or rendered-site result is claimed. Later-phase final proof does not substitute for the concrete Phase-5 defects above.

## User Goal Analysis
- Goal: users can choose durable storage per project, resume reliably across sessions/worktrees, and keep unmerged work out of unrelated branches' ordinary retrieval.
- Met: one configured store seam, exact retained package bytes, default adapter plan reader and importer publication gate in the exercised paths.
- Partial: consumer writers reach selected storage, but readers and production terminal boundaries still rely on old authority.
- Missing: reliable adapter-only same-checkout resume, complete standalone attempt evidence, stale-write/link preservation, and published-only standalone LTM handoff.
- Verdict: partially met. Full publication/cutover/final proof remains deliberately outside Phase 5, not counted as missing implementation here.

## Documentation Impact
- Architecture/data flow: retained copy versus authoritative service remains materially different; do not document mirrors as completed cutover. Update consumer authority and receipt semantics after correction.
- Convention: all retained writers must bind actual checkout/context and await the operation's durability boundary.
- Recommended: `/b-docs` before save after correctness repairs; documentation impact itself is non-blocking and not an extra iteration defect.

## How-to Impact
- Changed user-facing actions: retaining a generated package on selected storage and selecting `BUCK_WORKFLOW_ROOT` for the plan-site reader need task-oriented setup/readback guidance when the implementation is accepted.
- Recommended: `/b-docs` first if both are needed; it can follow `/b-howto`. This is non-blocking and separate from actual site verification.

## Issue Classification
- In-plan: **10** current defects/verification failures, R1–R10 in the iteration artifact. Scope: existing consumer migration, authority, privacy, receipts, inventory, preserved reader behavior and required deterministic verification.
- Out-of-plan: none added. Existing later-phase publication/recovery/migration/final integration obligations remain where planned. Phase 8 criterion 3 explicitly owns the changed plan-site surface smoke; missing Astro/browser evidence is a deferred verification warning, not an additional Phase-5 iterate defect.
- Superseded observations: obsolete hook-pool API is removed; real presentation CLI now works; configured helper scope and retained-error queue are repaired. Those historical findings are not reported as still broken.

## Completion Audit
1. Concrete deliverables: all six Phase-5 criteria, with the five implementation steps mapped above.
2. Every deliverable mapped to current paths, lines and/or executed output.
3. Current source inspected; the authoritative unchanged contract returned failing verdicts on both runs. Required verification is missing, independently of the demonstrated consumer defects.
4. Claim scope matches execution: CLI and SQLite API/read-source exercised; no browser/PostgreSQL/all-adapter claim.
5. Uncertainty remains partial/not-verifiable for the rendered site and unexercised backend workflows; checked phase metadata does not turn uncertainty into success.
6. This review delivers concrete findings, proposals and evidence rather than a partial checkpoint. Supervisor owns subsequent execution/loop routing.

## Verdict
**Needs work** — driven by in-plan defects, independently of documentation impact or future phases. A green aggregate test gate would not repair the demonstrated authority/privacy failures.

## Recommended Next Step
Return the iteration artifact to the supervisor for Phase-5 `/b-iterate`, then re-review the same exact phase. Do not choose or mutate the supervisor's next loop state. After accepted corrections: conditional docs/how-to, save, then commit. This assignment stages only its new review/iteration artifacts; pre-existing phase edits and unrelated/generated files remain untouched by staging.
