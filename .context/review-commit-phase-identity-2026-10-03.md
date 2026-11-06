---
status: completed
date: 2026-10-03
subject: 2026-10-03.buck-loop-commit-phase-identity
topics: [review, commit-checkpoint, restart-recovery]
addresses: plan-commit-phase-identity.md
review_verdict: needs-work
implementation_checkout: /tmp/buck-loop-commit-phase-identity
iteration: iterate-commit-phase-identity.md
---

# Plan Path Review: Preserve Buck-loop commit phase identity

## Verdict

**Needs work.** Marker-backed recovery drifts to the next phase and writes an invalid projection; interrupted committing can throw; an advanced dirty HEAD can launch another commit child. Required guardrails also fail. The review is complete; the implementation is not accepted. No supervisor state was selected.

## Plan Source

- File: `.context/2026-10-03.buck-loop-commit-phase-identity/plan-commit-phase-identity.md`.
- Goal: keep unfinished commit identity/baseline authoritative until a real verified commit, then advance exactly once.
- User goal: operators can retry/restart failed phase commits without premature next-phase work, duplicate commits, or unrelated changes.
- Baseline: `b184c34ae00a686ac7410321b226951e24f6c30e`; staged repair in `/tmp/buck-loop-commit-phase-identity`, branch `fix/buck-loop-commit-phase-identity`.
- Research followed: `research-commit-phase-identity.md`. No spec link; no phases. Decision-closure protocol applied to the ledger/material recovery claims.

## Evidence Sources

- Assignment checkout is `chore/cleanup-skills` at the same baseline, with pre-existing staged cleanup and unstaged SQL-save/other work. None was adopted, changed, or staged by this review.
- Repair checkout: 12 pre-existing staged files, no unstaged diff at discovery; 209 insertions/76 deletions. Reviewed source state and staged patch, not unrelated branch history.
- Changed files: `extensions/buck-loop/{types,loop,persist,scan,machine}.ts`; `extensions/buck-loop/__tests__/{persist,scan,machine}.test.ts`; `docs/CHANGELOG.md`; `docs/buck-workflow.md`; `docs/howto/{recover-buck-loop,resume-buck-loop-after-repair}.md`.
- Planned `extensions/buck-loop/__tests__/loop.test.ts` is unchanged. All other named affected files were inspected in the repair checkout. The plan's `files:` scope was not widened.
- Recent relevant baseline commits: `b184c34` SQL save subject directive, `aa48bda` stacked activity cards. Neither commit proves this repair.
- Fresh focused suites, authoritative guardrails, complete test command attempt, and a disposable Bun public-supervisor smoke with real Git/scanner/machine/persistence. Controlled workers only at the external-model seam; no mocked Git outcome.
- No SQL-memory call; supplied supervisor recall used as reference only. Historical memory index has no entry proving this repair. Current-session metadata has no active goal and belongs to different work; explicit plan scope takes precedence.

## Completion Matrix

Statuses below reflect current source/runtime evidence, not open plan checkboxes. Missing rows have fix proposals in the iteration artifact (I-1 through I-8).

| Plan deliverable | Status | Evidence / missing piece |
|---|---|---|
| User goal / goal | partial | Initial runtime checkpoint vocabulary exists, but observed restart corruption and two commit children violate safe retry/restart. I-1/I-2/I-3. |
| Scope / affected files | partial | Runtime and four docs updated within exact scope; planned public supervisor regression file unchanged. No unrelated scope adoption. I-7. |
| Step 1: public failure regressions | missing | No new `loop.test.ts` diff or non-null checkpoint test in the planned suites. Required two-phase refusal/child-failure/no-commit regressions absent. I-7. |
| Step 2: persist checkpoint before effects | partial | `loop.ts:400-412`, `types.ts:159-171`, `persist.ts:287-319` add/persist marker. Unborn/probe and canonical ownership evidence insufficient; not every commit entry goes through this preparation. I-4/I-5. |
| Step 3: pin and deterministically prove commit | partial | `scan.ts:478` requires `commitVerified`; `loop.ts:1222-1245` freezes failed live scans. Advanced dirty HEAD still authorizes another child and resumed reconciliation unpins target. I-1/I-3. |
| Step 4: explicit recovery transitions | partial | `machine.ts:334-348` adds manual commit edge, `328-331` confirms advance; public interrupted-committing resume throws and blocked-marker resume corrupts identity. Legacy markerless committing still has phase-confirmation shortcut. I-1/I-2/I-5. |
| Step 5: behavioral proof and operator contracts | partial | Four docs updated; `recoveryFor` unchanged and contradicts intended marker-backed guidance. Required fresh-process/rollback matrix absent. I-6/I-7. |
| Step 6: coherent checks/checkpoint | missing | Required guardrails fail; `npm test` timed out with failures; no accepted repair closeout or coherent fix commit. I-8. Review does not perform save/commit. |
| AC-1: refusal/retry/block immutable identity | partial | Initial committing persistence/freeze visible in source; required public refusal/index preservation regression absent. Restart demonstrably drifts. I-1/I-7. |
| AC-2: failed/lying child cannot advance | partial | Confirmed-only machine routing and scanner proof requirement exercised by existing/new machine/scan tests; unchanged-HEAD public retry regression absent. I-7. |
| AC-3: normal one-commit-per-phase / final done | partial | Existing supervisor suite passed as part of 340 focused passing tests. New owned-change/order/duplicate-commit matrix absent; dirty failure smoke creates two commits. I-3/I-7. |
| AC-4: restart before commit retains Phase 1 | missing | Public blocked-marker fixture reconciles to Phase 2 and becomes unreadable; committing-state fixture throws before work. I-1/I-2. |
| AC-5: crash-completed commit idempotently advances | partial | `verifiedCommit`/resume proof paths exist; pinning and interrupted-state defects prevent accepting them. Required after-commit/before-projection fresh-process scenario absent. I-1/I-2/I-7. |
| AC-6: unsafe Git/identity evidence holds | missing | Real advanced-dirty-HEAD smoke produced two commit children/two commits after one baseline. Marker/ownership/error handling also incomplete. I-3/I-4/I-5. |
| AC-7: literal legacy Phase-2 hold/manual guidance | partial | Public legacy Phase-2 fixture remained blocked with zero children, but status did not distinguish missing identity and retains old fresh-start advice; other markerless interrupted shapes unsafe. I-5/I-6. |
| AC-8: no model lift; ordinary recovery/counters/safety | partial | Machine tests deny ambiguous commit advance; protected/staging source unchanged. Non-blocked resume regresses; validated disjoint recovery matrix not added. I-2/I-7. |
| AC-9: file and SQL identity / stale receipts / unphased | not-verifiable | File-mode smoke exercised. `SQL_MEMORY_TEST_URL` absent; three existing SQL supervisor cases skipped, and new receipt-bound identity matrix absent. Existing unphased tests do not prove new checkpoint SQL equivalence. I-7. |
| AC-10: tests/gates/smoke/docs/no production mutation | missing | Focused suite and guardrails fail; complete test command timed out. Runtime guidance differs from docs. No production projection, receipt, cleanup-phase status, or pre-existing index/worktree modified by review. I-6/I-7/I-8. |
| Blocking assumptions | complete | Ledger records no blocking deferred assumption. This does not waive AC-9. |
| A-1 / A-2 / A-3 | partial | Incident research/current code establish need for retained identity and baseline; legacy drift hold observed, but broader fail-closed claims still incomplete. I-1/I-5. |
| A-4 deferred, non-blocking | not-verifiable | Retain Step 6 disposable PostgreSQL + `SQL_MEMORY_TEST_URL` validation path. Missing disposable test endpoint; configured general SQL URL is not a safe test target. Warning, not a reclassification as a blocking assumption. |
| Material fallback: stop/manual commit/start next | partial | Legacy fixture's no-worker hold exists; runtime guidance is not marker-specific. Required manual completion/fresh next-phase rehearsal absent. I-6/I-7. |
| Material rollback: downgrade with pending marker | not-verifiable | No disposable pending-checkpoint downgrade/manual-resolution rehearsal evidence. I-7. |

## Review Axes

### Spec / acceptance-contract axis

Worst finding: **an already-created commit with remaining dirt invokes a second commit child** (`loop.ts:803-811,1006-1026`, I-3). The smoke observed two commits after the same baseline; the resulting block is too late to protect the one-commit invariant.

Additional in-plan findings: marker-backed projection drift/corruption (I-1), illegal confirmation of committing state (I-2), weak baseline/ownership evidence (I-4), missing-marker shortcut (I-5), inaccurate runtime recovery guidance (I-6), missing public/SQL/crash/rollback matrix (I-7), failing required checks (I-8). See the iteration artifact for exact proposals.

### Standards axis — explicitly scoped sequential fallback

No task/sub-agent dispatch tool was available. After the acceptance pass, a separate sequential standards pass reviewed only the staged repair, seeded with `code-review-universal/reference/{typescript,code-quality-universal,code-review-best-practices}.md` and scoped `code-smells/docs/{temporary-field,duplicate-code,long-method}.md`.

Worst finding: **required complexity violation**. `drive` measures 17 and breaches the hard ceiling of 15. New >10 violations also affect `runNestedSkill` (12), `rescan` (12), `reconcile` (11), `normalizeProjection` (11), and `asCommitCheckpoint` (11). `drive` now combines orchestration with checkpoint creation/release in `loop.ts:383-435`; extract meaningful checkpoint responsibilities, not cosmetic one-line wrappers. I-8.

Additional standards evidence: `verifiedCommit` erases actionable Git failure categories into a boolean; nullable persisted identity lacks a complete state/ownership invariant (I-3/I-4). The nullable checkpoint itself is required durable state, not a reason to add a speculative class. No unrelated smell audit or general Git refactor was performed.

Cross-axis ranking: **none**. Each axis retains its own worst finding.

## Exercised Verification

1. **Focused command**: `npx vitest run extensions/buck-loop/__tests__/loop.test.ts extensions/buck-loop/__tests__/persist.test.ts extensions/buck-loop/__tests__/scan.test.ts extensions/buck-loop/__tests__/machine.test.ts`.
   - Exit 1; 1 file failed/3 passed; **12 failed, 340 passed, 3 skipped** (355 tests).
   - All 12 failures are persistence cases. Changed `projection()` fixture at `persist.test.ts:34-48` omitted required `loopCount`; serialized projections fail validation. Restore it, not the assertions.
2. **Authoritative contract**: `npm run guardrails:check`.
   - Exit 1; durable v2 **fail**. Unit failed, coverage command failed, complexity failed. Complete structured gate values below.
3. **Complete test command**: `npm test`.
   - Timed out after 300 seconds. Observed the same 12 persistence failures and SQL-save provenance failure; no final totals or Bun-leg result. This is not a passing suite or a claim that the suite completed.
4. **Disposable public-supervisor smoke**: `bun /tmp/buck-commit-identity-review-smoke.ts`, exit 0 for the investigation script (its scenarios deliberately record defects).
   - Blocked marker restart: reconciled `phasePath=.context/2026-09-18.demo/phase-2-p2.md`, retained `checkpoint.targetPath=.../phase-1-p1.md`, result blocked, zero children, `readableProjection=false` after public resume.
   - Interrupted committing with matching pending phase: `IllegalTransitionError: illegal transition committing -> committing (not-a-target)`.
   - Real commit followed by `.context/late.md` dirt and failed child: `commitChildren=2`, `commitCount=2`, both children targeted Phase 1; terminal ambiguous block retained original baseline.
   - Literal legacy blocked/Phase-2 shape without marker: blocked, zero children. Status still emitted old `Commit checkpoint interrupted ... run /b-commit. Then run /buck-loop .../phase-2-p2.md` guidance.
   - All fixture repositories and the throwaway smoke script removed. This was a fresh Bun process using the public command seam, not an OMP UI launch or the plan's full multi-process crash acceptance matrix.
5. **Prerequisite check**: `SQL_MEMORY_TEST_URL_configured=false`, `SQL_MEMORY_URL_configured=true`; no credentials printed and no live store used.

## Guardrails Verdict

- Contract: **durable**, version **2**, runner **1.0.0**.
- Status: **fail**; code-bearing review, not docs-only.
- `unit_test_gate=fail` (required), `functional_test_gate=skipped` (disabled), `lint_gate=skipped` (disabled), `patch_gate=advisory`, `global_ratchet=fail` (required), `complexity_gate=fail` (required).
- Diagnostic: `coverage command failed (exit 1)`. Current/patch coverage null; baseline remains 84. This is missing measurement, not evidence of a quantified coverage regression.
- Complexity: six new violations; `drive=17` is a hard-ceiling violation. Baseline/enforcement unchanged; no ratchet rewrite applied.

## Verification Status / User Goal Analysis

- Goal achieved: **partial**; safe end-to-end retry/restart not achieved.
- Met: nullable persisted baseline vocabulary, live failed-commit phase freezing, explicit scanner proof flag, confirmed-only commit advance, manual recovery edge.
- Partial: durable target ownership, commit proof and idempotent restart.
- Missing: safe dirty/history/error holds, working interrupted-state recovery, truthful command guidance, required public/fresh-process/SQL/rollback proof, passing required gates.
- User goal verdict: **partially met**.
- Scope adhered: implementation changes remain within named files; planned public tests are missing, not out-of-scope additions. No out-of-scope implementation change identified.

## Documentation Impact

- Checkpoint ownership and Git proof are changed runtime conventions. Workflow/how-to/changelog prose was updated, but `recoveryFor` does not yet fulfill those descriptions (in-plan runtime defect I-6).
- Non-blocking recommendation: `/b-docs` after correctness iteration to sync realized behavior, before durable save. Documentation impact itself does not drive this verdict.

## How-to Impact

- Existing blocked-run and after-repair guides cover the intended actions; no missing standalone procedure identified. Revalidate their steps against corrected runtime; no separate `/b-howto` requirement.

## Issue Classification

- **In-plan issues:** I-1 through I-8, recorded only in `iterate-commit-phase-identity.md`.
- **Out-of-plan observation:** untouched `sql-save.test.ts` reports `keeps phase provenance stable on retry but rotates a new phase's source key` failing. Repair checkout's SQL-save source/test are unchanged; provenance of this failure is not established. Compare the chosen base independently; if confirmed adjacent work, use a separate `/b-plan` cycle, not receipt changes in this repair. This observation is not ranked against in-plan defects and has no iteration proposal here.
- SQL test endpoint absence remains A-4's warning and AC-9's verification gap; no database implementation or receipt-protocol scope was added.

## Completion Audit

1. Objective: retain unfinished target/baseline, prove one real commit, recover idempotently, preserve safety admission, give truthful guidance, exercise all ten criteria.
2. Evidence: mapped each criterion above to source, executed suites, or public smoke; missing rows name their required fix/proof.
3. Current state: staged runtime read directly; authoritative contract measured and failed.
4. Scope match: public CLI seam exercised with real temporary Git; no OMP UI or multi-process crash/SQL proof claimed.
5. Uncertainty: SQL, rollback, crash matrix and full-suite completion remain unverified; none marked complete.
6. Review not truncated: both axes and every acceptance/assumption/material-recovery category assessed. Failed implementation evidence yields Needs work, not completion.

## Recommended Next Step

For the supervisor: use the iteration artifact to repair only the accepted plan's defects, then re-review the exact same plan. Resolve required gate failures without weakening thresholds. After acceptance, sync living docs as needed and record durable state before the coherent fix commit. No next loop state is chosen or applied by this reviewer.
