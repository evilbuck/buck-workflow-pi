---
status: active
date: 2026-10-15
subject: 2026-10-10.durable-storage-adapters
topics: [code-review, storage-consumers, phase-5]
review_verdict: request-changes
related: [phase-5-remaining-consumers.md, iterate-phase-5-current-state-2026-10-15.md, review-phase-5-current-state-2026-10-15.md]
---

# Plan Path Review: Phase 5 remaining durable consumers — assigned recheck

## Plan Source
- Exact file: `.context/2026-10-10.durable-storage-adapters/phase-5-remaining-consumers.md`.
- Goal: migrate every remaining Buck-owned durable consumer onto the selected service, preserve run privacy and leave host-owned data untouched.
- User goal: choose project storage, resume reliably, and keep unmerged work invisible to unrelated branches.
- Baseline: `db31575..f235435` consumer implementation, plus the staged standalone-save privacy repair. The interval includes Phase-4 boundary work and a large historical `.context` copy; current Phase-5 source-state acceptance, not every historical changed file, defines this review.
- Followed parent `plan:` and its `research:` link. There is no linked spec. Phase 5 is the explicit subject; stale session metadata does not select another one.
- Phase-6 publication/orphan/rebinding work, Phase-7 historical cutover and Phase-8 final OMP/all-adapter/rendered-site proof are not newly required here. Ordinary selected-service reads, same-checkout restart, safe writes and truthful save completion are already Phase-5 obligations. The operator note defers cross-worktree recovery, not these paths.

## Evidence Sources
- Initial Git status: existing staged standalone-save code/test/skill repair and session artifacts; existing unstaged phase/final-iteration edits; many pre-existing untracked generated `.context` files. Preserved all of them.
- Relevant commits: `2f3a7a8` and `b76b30f` consumer migration, `5a31384` trusted-scope retention, `f235435` attempt-run binding.
- Code inspected: shared consumer batches/configured queue/classifier; save preflight/apply and extension; loop projection/resume/scan/save/review writer; hook/capture; attribution database/event callers; import source/filter/cursor; immutable review state/pass/commands/final-report and terminal callers; real plan-site loader/types; retained presentation helper/CLI; original census and auto-fix/pinned-review writers.
- Affected groups verified: `extensions/buck-loop/`, `extensions/b-save-improved/`, `skills/b-save-improved/scripts/`, `extensions/turn-memory/`, `hooks/post/turn-memory.ts`, `extensions/token-attribution/`, `extensions/code-review-iteration/`, `skills/b-memory-import/`, `docs/plans/src/lib/plans/`, shared consumers and presentation retention. `extensions/plan-artifact.ts` belongs to the prior native boundary port; no claim of re-approving Phase 4.
- Supervisor-supplied memory used only as historical reference. No `sql_memory` call. `.context/memory/index.md:1` records only the privacy repair and explicitly leaves other Phase-5 findings open. No Phase-5 accepted closeout is established.
- Session projection has no active `goal`; no budget or native goal-mode completion claim.

## Completion Matrix

| Deliverable | Status | Direct evidence / named missing part |
|---|---|---|
| Criterion 1: both save pipelines, same-adapter batches and complete attempt receipts | Partial | `consumers.ts:47-72` and `save-apply.ts:595-621` retain batches/receipts. Actual standalone no-fact sequence ended with local `completed:true` and native receipt `status:attempted`. Metadata uses another run; preflight rejects an adapter-only plan. R1/R6. |
| Criterion 2: loop/read/resume/checkpoint/activity, review records, hook, attribution/dedupe/import cursor | Partial | Retains exist, but `persist.ts:124-173`, `run-state.ts:129-173,252-258`, importer `582-600,784-798`, attribution `180-212` still depend on old authority. Real adapter-only resume returned `idle`; hook-shaped second window failed after its body committed. R1/R2/R5/R7. |
| Criterion 3: retained presentation/attachment package, exact binary bytes | Complete for exercised retention path | Actual `bun skills/b-present/scripts/retain-package.ts <temp-package> --cwd <temp-checkout>` returned `ok:true,files:2`; binary readback exactly `[0,255,42]`, revision `87fbceeb-1e07-413e-b691-421b89892642`, matching receipt/run/revision set. `consumers.ts:205-246`. Full workflow/backend integration remains Phase 8. |
| Criterion 4: real adapter-backed plan reader through existing seam, no UI redesign | Partial | Stub is replaced by `SqlPlanSource` with configured loading (`sql.ts:11-26`). Default configured read omitted stored review/iterate documents and returned null for review lookup; baseline recursive Markdown reader included them. R10. |
| Criterion 5: host state untouched, no unmerged LTM mirroring | Complete for reviewed paths | Staged `index.ts:548-560,783-798` withholds unproven facts. Actual builder output omitted supplied private text and retain/learn instructions for all three backend labels. Importer's exact publication/hash filter remains (`import-context-memory.ts:564-579,789-798`); attribution only writes its owned table. No host LTM request was sent. Former R4 is not re-reported as open. |
| Criterion 6: census fully reconciled with real ownership/cutover | Partial | Reconciliation exists (`inventory:69-110`), but rows 97/104 exclude retained Buck-generated auto-fix and pinned-review records without ownership/lifetime proof. Actual writers remain `auto-fix.ts:159-185,413-445,598-607`, `pr-context.ts:338-362`. R8. |
| Step 1: save and loop consumers; machine semantics preserved | Partial | Save/retain service exists; ordinary adapter-only scan/preflight/resume and one authoritative complete save attempt are missing. `scan.ts:92-105,127-133`; actual preflight exit 3 on a natively readable adapter plan. No new machine-routing redesign requested. |
| Step 2: hook, plan bridge and attribution | Partial | Hook uses selected store, but direct batch receipt identity collides across windows. Attribution still reports/dedupes local rows and can acknowledge failed retention. Prior bridge port is unchanged, not a replacement for these missing paths. |
| Step 3: retained immutable review artifacts/state/report | Partial | Pass retains and local immutable refusals exist (`run-state.ts:204-247`); loads are local, run creation drops its Promise, final-report retention is not awaited. Actual report returned a path despite selected-store failure. R1/R7. |
| Step 4: import cursor/source, retained packages, published-only LTM | Partial | Package bytes and fail-closed LTM handoff work in exercised paths. Importer's manifest/source still require files (`582-600,784-798,939-956`), so eligible adapter-only inputs cannot be the authority. R1. |
| Step 5: preserved plan-site read contract | Partial | Configured service works for plans; visible linked review/iterate/other Markdown is missing. R10; browser/actual-site smoke stays in Phase 8. |
| Blocking assumptions | Complete for Phase-5 obligations | Parent A-1/A-2/A-3/A-5 are settled user/data decisions; A-4 runtime validation is assigned to Phase 1 and is not reopened. No unresolved blocking assumption is assigned to this phase. |
| Material risk 3: disable leakage before exposure | Complete for repaired standalone handoff | The parent's safe fallback is disabling the leaking operation without project-wide recall. Builder now emits no unproven facts; importer already filters publication-proven exact hashes. No claim of implemented Phase-6 publication. |
| Material risk 5: stale/partial writes, receipt/completion authority | Partial | Real stale consumer write overwrote newer canonical bytes and erased a typed spec link. Real standalone receipt remained attempted after local success; repeated hook attempt partially committed. R3/R5/R6/R7. |
| Deferred safety/recovery claims | Intentionally outside this phase | Exact checkpoint promotion/revocation/rebinding matrix remains Phase 6; source-snapshot cutover/rollback is Phase 7; configuration/dotfile recovery docs and final per-adapter integration are Phase 8. No backend fallback is accepted or claimed verified. |
| Deterministic verification | Missing | Fresh unchanged durable v2 `npm run guardrails:check` exited 1: required unit and global-ratchet gates fail. Coverage command failed with no current percentage. R9. |

## Review Axes

### Spec / acceptance-contract axis
- **Worst finding: High — standalone success does not complete its authoritative durable save attempt (R6)**. Local `completed:true` coexists with native `status:attempted`; facts and metadata are separate runs (`index.ts:700-747`, `save-apply.ts:610-621`). A store copy and local success flag do not satisfy same-attempt completion.
- Independent in-plan findings: R1 selected-service read/resume authority; R2 actual checkout/destination binding; R3 stale writes/link loss/logical-key alias; R5 hook attempt collision; R7 unawaited durability and failed-retain retry; R8 census exclusions; R10 lost visible site documents.
- Former R4 is addressed by withholding unproven LTM payloads. Do not restore unsafe scribe-fact forwarding in order to implement a future published path.
- Each open issue has exact files, current evidence, fix and verification proposal in the refreshed `iterate-phase-5-current-state-2026-10-15.md`. Reused the one active Phase-5 iteration rather than introducing a second unfinished artifact.

### Standards axis — separate sequential fallback pass
- No sub-agent dispatch tool is available. Completed a separate standards pass after acceptance inspection, using the prescribed portable fallback; no parallel/context-isolation claim.
- Seeds: `code-review-universal` TypeScript async/Promise rules, universal quality (reuse, abstraction leakage, stale/duplicated state, TOCTOU) and review-best-practices guides. Diff-scoped `code-smells` subset: duplicate code and primitive obsession only. No full-catalog audit or style-threshold gate.
- **Worst finding: High — production terminal/event APIs drop durability Promises and acknowledge local state instead (R7)**. `createRun()` ignores `saveState()`; `writeFinalReport()` returns synchronously; clean handling may commit that path; attribution acknowledges insert and dedupes the failed-retain retry without a production drain. Real fault smokes demonstrated both local acknowledgments despite failed selected-store retention.
- Existing reusable conventions: native `WorkflowRequest.write.expectedRevision` (`workflow-state.ts:32,390-399`), `ArtifactKey`, and trusted context binding. The consumer API loses those protections rather than reusing them; fresh nested-index and wrong-worktree smokes show actual consequences (R2/R3), not merely naming preferences.
- No standalone cosmetic/style/refactor blocker. R7 appears on both axes because it independently violates both contracts, not because it counts twice.
- **Cross-axis ranking: none.** Findings remain grouped by axis, each with its own worst finding.

## Verification Status
- Goal achieved: partial.
- User goal: partially met. Selected-store writes/package retention and safe LTM withholding are real; ordinary adapter-only resume/discovery and trustworthy completion are not.
- Scope adhered: Phase 5 only. No implementation, phase checkbox/status, lifecycle, machine or loop-state changes authored by this assignment.
- Out-of-scope changes: none authored. Initial staged/unstaged work and generated untracked files preserved.

## Guardrails Verdict
- Contract: durable, version 2 (`guardrails.json`).
- Status: **fail**, exit 1; fresh current-tree run completed in 816.39 seconds.
- Gates: `unit_test_gate=fail`, `functional_test_gate=skipped`, `lint_gate=skipped`, `patch_gate=advisory`, `global_ratchet=fail`, `complexity_gate=pass`.
- Diagnostic: `coverage command failed (exit 1)`; current/patch coverage null, baseline 84 unchanged. No coverage percentage or numeric regression is inferred.
- Complexity: 30 existing baseline hotspots, no new/hard-ceiling violations. No baseline/gate/timeout changes.
- Runner's truncated unit tail names the 5000ms resume-rebase-conflict timeout at `extensions/code-review-iteration/__tests__/loop.test.ts:593` and configured-store pass-retention failure in `run-state.test.ts`. The tail does not establish all failures or their root causes; no aggregate test-pass count is claimed.
- No concurrent focused suites were dispatched. The isolated smokes used separate temporary stores/config/identity. This reproduces the prior required-verification failure on the staged repair without treating earlier run output as current proof.
- The implementation under review includes source code; this is not a docs-only skip.

## Fresh Executed Evidence

All four throwaway Bun programs invoked real production APIs on isolated temporary config/identity/databases/checkouts/file roots. Git worktrees were real, with separate branches. No mocked store, remote service, production LTM call or host stats write.

1. **Private handoff** — `buildRetainInstruction` for Hindsight, mnemopi and local labels: supplied `Unmerged private decision` never entered output; no `Call the retain tool`/`Call the learn tool`; explicit no-publication-proof skip.
2. **Same-checkout resume** — actual `writeProjection()` and drain, plus returned-run retain/readback of identical bookmark bytes. Stored run `run-f2b90096-7956-4ee2-81ba-8eb165feff92` differed from workspace run `run-8e489ccd-ad9e-4a70-b68e-6eac68fbeb0b`; removing the local bookmark yielded `readProjection:null,resumeState:idle`. This proves an unreachable retained checkpoint, not all-backend restart success.
3. **Stale write and links** — actual SQLite canonical newer plan with spec link; consumer write replaced it with `stale projection body` and `links:[]`. Separate real repo-files/external-files smokes also overwrote newer linked content with `stale projection` and empty links; resulting revisions were `276e6d32-714c-47dc-b8ed-c588418398aa` and `b7d7828e-9a08-4d32-9413-59877a76666b`. This shared-consumer defect is demonstrated on three adapters, not inferred from SQLite alone.
4. **Hook-shaped repeated attempts** — direct production batch with the default hook's workspace-run/window-attempt shape: second call threw `receipt attempt or scope mismatch, or already complete`; second body was committed, receipt still named `window-1`. No live hook/Jev/model execution is claimed.
5. **Configured site loader** — stored plan/review/iterate fixtures; actual non-injected `SqlPlanSource` returned `plan-demo.md,plan-stale.md`, review lookup null, iterate absent. `git show db31575:docs/plans/src/lib/plans/filesystem.ts` confirmed baseline recursive all-Markdown discovery. No rendered browser result.
6. **Index identity** — exact production classifier output for root and nested indexes was identical: `{kind:subject-index,subjectId:2026-10-15.review-fixture,logicalName:index.md}`.
7. **Standalone receipt** — actual `prepareSaveAttempt → saveSqlFacts([]) → completeSaveAttempt → executeWorkflowState(read-receipt)` on configured SQLite: local completed true; authoritative receipt attempted, duties `save-metadata,probe`, exact attempt `6b24f9ff-79da-4b97-9885-d84a714b3d78`.
8. **Two-worktree binding** — process cwd left, target right passed in legacy `worktreeId` field without cwd; actual retained readback `left:true,right:false`. This is a scope failure, not proof of concurrent production resume.
9. **Actual presentation CLI** — exit 0, `ok:true,files:2,runId:run-36e8c4fd-1459-4328-9b33-6880eaaab0f1`; binary `[0,255,42]`; revision `87fbceeb-1e07-413e-b691-421b89892642`; exact receipt revision set read back.
10. **Final-report fault** — invalid selected config: `writeFinalReport()` returned a string path and local report before retention failed. Only explicit test-side `flushConfiguredRetains()` observed failure; production clean caller has no corresponding await/drain at that report boundary.
11. **Attribution failed-retain retry** — actual temp ledger insert acknowledged true; explicit drain failed. Same record retry returned false; second drain had no failure although config stayed invalid, proving no repaired retention was scheduled; local total still counted six tokens.
12. **Adapter-only preflight/scan** — native plan write/list read exact revision `0f8b88cf-ea27-4ef7-85e1-bd05c809888c` without `.context`. Actual preflight CLI exited 3 with `{"error":"no .context directory"}`. Actual loop scan returned `kind:missing` for the stored plan.
13. **Executable iteration handoff** — actual production `parseIterateArtifacts()` parsed the refreshed active artifact into nine issues (`critical:1,2,3,5,6,7,8,10,9`), each with File/Problem/Proposed fix. Reused the existing active artifact and numeric headings so review handoff does not introduce duplicate-active or unparseable-issue failures. Throwaway parser check exited 0 and was removed.

The four smoke commands exited 0 because their assertions verify the displayed behavior, including the defects; they are not a claim that those consumer workflows passed acceptance. Fixture directories are removed by `finally`; throwaway program files are removed before handoff. No new permanent tests or implementation edits were made. Full PostgreSQL workflow, all-four-adapter integration, fresh install/bundle parity and rendered-site behavior are not claimed from these file/SQLite/CLI/API smokes.

## User Goal Analysis
- Goal: users choose project durable storage, resume reliably across sessions/worktrees, and keep unmerged work out of unrelated ordinary retrieval.
- Met in exercised paths: configured retention, exact binary package bytes, safe withholding of unproven standalone-save facts; importer publication guard preserved.
- Partial: writers reach the adapter, but several readers/completion boundaries still trust projections/local dedupe.
- Missing in Phase 5: ordinary service-authoritative scan/preflight/resume/import/report reads, correctly bound consumer sessions, conditional revision/link preservation and complete standalone receipt.
- Verdict: partially met. Later publication/cutover/final workflow proofs remain separate planned work, not invented extra Phase-5 blockers.

## Documentation Impact
- Architecture/convention: distinguish authoritative service reads from retained mirrors; pin actual checkout/store/run, preserve conditional references, await durability at completion boundaries.
- Staged skill now correctly withholds private LTM facts. Existing extension header/command description and skill responsibility mapping still describe a retain handoff; align explanatory text with the final accepted behavior.
- Update consumer authority and receipt semantics after correctness repairs, not by describing current mirrors as a completed cutover.
- Recommended: `/b-docs` before `/b-save`, after acceptance. Non-blocking; not an extra iteration issue.

## How-to Impact
- Retained package setup/readback and plan-site `BUCK_WORKFLOW_ROOT` selection have user-facing procedures but no demonstrated task-oriented how-to in this review.
- Recommended: `/b-docs` first when both impacts apply; it can follow `/b-howto`. Non-blocking, separate from the existing Phase-8 rendered-site proof.

## Issue Classification
- In-plan: **9 open findings** — 8 implementation defects R1/R2/R3/R5/R6/R7/R8/R10, plus current required-verification failure R9. Former R4 is addressed by the staged privacy repair.
- Out-of-plan: none added. Existing Phase-6/7/8 deliverables remain where planned.
- Iteration artifact: refreshed `iterate-phase-5-current-state-2026-10-15.md`; proposals address existing migration requirements only. Resolved R4 was removed from open issues, with its safe fallback and observed evidence retained in the Source section.

## Completion Audit
1. Concrete deliverables: all six phase criteria and five implementation steps, not the misleading completed metadata.
2. Each deliverable maps to current source ranges and/or fresh CLI/API/readback output in the matrix.
3. Current code inspected; fresh unchanged deterministic contract returned `fail`, with required unit and global-ratchet gates failing. Verification remains missing, not passed or waived.
4. Verification claims match exercised scope: real CLI, SQLite, Git-worktree and API scenarios; no browser/production-LTM/all-backend claim.
5. Missing authority, completion and safety mitigation remain partial despite checked phase boxes; future-phase proof is not substituted for current behavior.
6. Review returns actionable findings/proposals/evidence, not a partial phase checkpoint. Supervisor alone controls subsequent loop routing.

## Verdict
**Needs work** — independently demonstrated in-plan defects remain after the privacy repair. Documentation impact and future-phase obligations do not drive this verdict.

## Recommended Next Step
Return this report and exact iteration artifact to the supervisor for Phase-5 `/b-iterate`, then re-review this same phase. Do not select or mutate loop state. After accepted corrections: conditional docs/how-to → save → commit. Stage only this assignment's new report and refreshed active iteration; preserve other pre-existing staged entries and unrelated files.
