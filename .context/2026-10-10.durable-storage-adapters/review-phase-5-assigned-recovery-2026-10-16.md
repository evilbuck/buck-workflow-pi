---
status: active
date: 2026-10-16
subject: 2026-10-10.durable-storage-adapters
topics: [code-review, storage-consumers, crash-recovery]
review_verdict: request-changes
addresses: phase-5-remaining-consumers.md
related: [iterate-phase-5-recovery-boundaries-2026-10-16.md]
---

# Plan Path Review: Phase 5 — Remaining Durable Consumers

## Verdict

**Needs work — three High in-plan defects.** Ordinary selected-store consumer paths are substantially repaired, and the unchanged deterministic contract passes. Interrupted correction/metadata saves still cannot replay the same attempt; ranking's production writer still acknowledges non-durable writes, uses process cwd rather than the requested checkout, and classifies execution audits as knowledge. Phase 5's completed status is not sufficient evidence to accept these paths.

## Plan Source

- File: `.context/2026-10-10.durable-storage-adapters/phase-5-remaining-consumers.md`.
- Goal: migrate all remaining Buck-owned durable consumers through the selected storage service without moving host-owned data or leaking unmerged knowledge.
- Parent: `plan-durable-storage-adapters.md`, implementation step 5, design sections 2/5, material risks 3/5. Followed its research link and decision-closure protocol.
- Baseline: source-state review through HEAD `f235435bb16ffe09a6938cb5dadf10abd3da8b44` plus the pre-existing staged/unstaged repairs. `db31575` precedes the Phase 5 consumer series. This long-lived branch's complete branch diff is not treated as the exact phase diff.
- Prior memory shortlist was reference evidence only; no SQL tool was called. The exact current phase/parent contract controls scope.

## Evidence Sources

- Initial Git status: extensive pre-existing staged consumer/source/test/docs changes, additional unstaged phase/iteration edits, and untracked `.context` runtime/fixture artifacts. None was staged or edited by this review.
- Recent consumer commits: `f235435` receipt-run binding; `5a31384` trusted consumer scope; `b76b30f` and `2f3a7a8` partial consumer migration checkpoints. Their messages/statuses are not acceptance proof.
- Current implementation inspected: shared `consumers.ts` and trusted context/store binding; both save pipelines/preflight/apply; loop persistence/scan/phase/ranking/activity/terminal callers; review state/pass/report/command persistence; hook storage; attribution authority/event drains; importer source/cursor eligibility; plan bridge; auto-fix and pinned PR evidence; plan source/page factory; presentation retention instructions and helper.
- Affected families verified: all ten phase `files:` groups, plus census-mandated shared storage, auto-fix/PR evidence and presentation writers. Source citations below and in the iteration artifact identify the remaining broken paths.
- Fresh deterministic check: `npm run guardrails:check`, exit 0, structured verdict below.
- Fresh focused regressions with disposable PostgreSQL enabled: `npx vitest run` for `extensions/buck-loop/__tests__/{loop-storage,sql-save-adapters}.test.ts`, `extensions/token-attribution/__tests__/db.test.ts`, `skills/b-memory-import/scripts/import-context-memory.storage.test.ts`, `extensions/turn-memory/__tests__/hook-store.test.ts`, and `skills/_shared/scripts/plan-source.test.ts`: **6 files / 123 tests passed**, exit 0.
- Actual production-API smokes: all four adapters, including disposable pgvector/PostgreSQL 18, no fake stored rows. Runtime fault injection is confined to the named persistence boundary. No live model was called. All throwaway drivers, fixture roots and the disposable DB container were removed.

## Completion Matrix

| Deliverable / phase criterion | Status | Direct current-state evidence |
|---|---|---|
| 1. Both save pipelines use same-adapter batches/attempt receipts | Partial | `extensions/b-save-improved/index.ts:689-737` invokes shared facts/apply/completion; `sql-save.ts:76-90,109-129,225-246` enforces exact evidence/receipt completion; `save-apply.ts:715-759` seals metadata on that store. Ordinary complete save readback passed on every adapter. Missing: same-attempt replay after committed correction or metadata without its attempt evidence; R12/R13 reproduced on every adapter. |
| 2. Loop/review/hook/attribution/import persistence through service, run-private after merge | Partial | `persist.ts:107-160`, `scan.ts:87-109`, review `run-state.ts:117-198,240-315`, hook `turn-memory.ts:96-117`, attribution `db.ts:94-152`, importer `import-context-memory.ts:545-573,751-851`. Checkpoint/review bytes recovered after exports removed on all four adapters; focused worktree/cursor/dedupe/hook scenarios pass. Missing: ranking's default writer is neither awaited nor bound to its explicit cwd and retains its audit as `capture` with no worktree/run; R14. Publication itself remains Phase 6. |
| 3. Retained packages/attachments adapter-backed, binary intact | Complete | `consumers.ts:201-241`; b-present Step 6b and b-blueprint retention step. Production `retainPresentationPackage` followed by exact readback of bytes `[0,255,128,13,10]` passed on all four adapters. Export directories remain deliverables, not authority. |
| 4. Plan-site reader uses existing seam, fake SQL stub removed, no redesign | Complete for this phase's reader scope | `docs/plans/src/lib/plans/sql.ts:13-59` reads selected-store visible Markdown; `index.ts:1-6` and all three page entrypoints use the factory. Actual default `SqlPlanSource.getDocument` loaded adapter-only `plan-proof.md` on every adapter. Focused `plan-source.test.ts:20-54` verifies linked review/iterate/brainstorm/nested knowledge and excludes private execution, binary and other-branch records. No rendered UI claim; rendered-site integration remains Phase 8. |
| 5. Host session/stats/LTM ownership unchanged; no unmerged LTM mirror | Complete within Phase 5 | Hook keeps existing host journal/consumed events and stores Buck memory/dedupe through the service (`turn-memory.ts:148-174`); attribution's optional SQLite projection creates/modifies only `buck_token_attribution` (`db.ts:64-87,155-169`). Import eligibility checks exact trusted published revision IDs before building payloads (`import-context-memory.ts:497-517,758-765`). The HTTP receiver regression withholds drafts; publication proof is explicitly supplied as a Phase 6 test seam, not claimed implemented. Standalone save's prior LTM-withholding repair remains in place. |
| 6. Original persistence census fully reconciled | Partial | `persistence-inventory.md:73-111` maps original ownership families, including auto-fix, pinned PR evidence, blueprint packages and excluded host/config/user source. Most concrete migrations are present. Its ranking/audit and consumer durability claims at rows 80/91 are contradicted by R14; save-recovery claims are incomplete under R12/R13. No ownership reclassification is accepted as a substitute. |
| Focused state-kind and two-worktree verification | Complete for exercised scenarios | Fresh 123-test run includes all four adapter loop/save/attribution/import matrices and real Git worktree pointer isolation (`loop-storage.test.ts:92-112`). Additional all-adapter production smokes recovered exact checkpoint/pass bytes without exports and binary package content. |
| Required deterministic contract | Complete | Fresh durable v2 runner returns pass: required unit/global-ratchet/complexity pass; coverage 87.9 versus unchanged 84 baseline. |
| Recovery under partial save persistence | Partial | Faults correctly prevent completion; they do not yet permit same-attempt recovery. Both reproduced save interruptions remain unverified rather than being falsely marked complete. Fix proposals: R12/R13. |
| Blocking assumptions | Complete for this scope | No unresolved blocking assumption is assigned to Phase 5. Parent A-1–A-5 are validated; A-4 runtime validation was assigned to Phase 1, not reopened here. |
| Deferred assumptions / later-phase boundaries | Intentional scope boundary | Git publication/rewrite/orphan recovery belongs to Phase 6; historical cutover/rollback to Phase 7; complete OMP/install/rendered-site matrix to Phase 8. None is used to excuse ordinary same-checkout Phase 5 persistence/replay. |
| Material rollback/fallback safety | Partial | Risk 5's stale-write refusal and fail-closed completion are present, but the promised recorded-attempt resume does not work across R12/R13. Risk 3's execution-vs-knowledge boundary is broken for R14's ranking audit. No unsafe fallback, arbitrary historical correction or softened CAS is an acceptable repair. |

## Review Axes

### Spec / acceptance-contract axis

- **Worst finding: R13 (High)** — metadata artifacts commit before their recoverable attempt evidence; an outage in between prevents reapplying the original captured snapshot. This directly contradicts reliable save/resume and Phase 5 criterion 1.
- **R12 (High)** — correction commit followed by a later write outage loses same-attempt replay because predecessor lookup is limited to current heads.
- **R14 (High)** also violates criteria 2/6: production ranking may acknowledge unretained evidence, target the wrong checkout, and turn run evidence into knowledge.
- Verdict input: Needs work.

### Standards axis — separate sequential fallback pass

No `task`/sub-agent dispatch tool was available. After the acceptance inspection, a separately scoped sequential standards pass used the TypeScript and universal-quality guides from `code-review-universal`, plus only the Duplicate Code, Dead Code and Primitive Obsession references from `code-smells`. It checked async ownership/error propagation, scoped identity reuse, conditional writes, dead compatibility paths and duplicated classification logic; it did not reassess the chosen adapter architecture.

- **Worst finding: R14 (High)** — `RankDependencies.writeFile` is typed to return void (`ranking.ts:143-147`), while the production writer starts asynchronous authoritative persistence without returning it (`190-198`). The two try/catch blocks (`243-252`) cannot observe those rejections. This violates the TypeScript async error-handling contract and creates observable success before durability. Use a promise-aware awaited seam; reuse the passed checkout and an explicit run-private audit key.
- This is the same actionable issue R14, not a fourth issue. No independent cosmetic/style blocker is raised.
- Verdict input: Needs work.

**Cross-axis ranking: none.** Findings remain grouped by axis; a standards finding does not replace the spec-axis save-recovery defects.

## Reproduction Evidence

### R12: interrupted correction replay

For each adapter, production APIs completed an initial save containing `old durable fact`. A second attempt corrected that revision, then tried to insert `later fact`. A store write fault was injected only for `later fact`; the correction remained durably visible. Restoring writes and retrying the exact attempt produced:

- repo-files: `retainedCorrection: corrected durable fact`; replay `SQL correction target is not in this project/subject`.
- external-files: identical retained body and replay failure.
- SQLite: identical retained body and replay failure.
- PostgreSQL 18: identical retained body and replay failure; attempt `6d00f4e3-8bcd-4e22-b724-b95f5bde6224`.

The correction idempotency key exists at the storage layer, but current-head resolution fails before the idempotent operation is called. This is not a claim that the stored correction was lost; the recorded save attempt cannot recover/finish it.

### R13: committed metadata without evidence

For each adapter, the real preflight CLI captured source revisions. Shared save facts succeeded. `runApply` was faulted only on the attempt-state write that first contained metadata evidence, after the actual metadata batch committed:

- First apply: exit/report code 1, `injected metadata-evidence outage`.
- Plan readback already contains the fact reference; canonical subject index already exists.
- Storage repaired; identical original payload/snapshot replay: code 1, `stale revision rejected: .context/2026-10-16.boundary-proof/index.md`.
- Exact complete save verification: `unverified` on repo-files, external-files, SQLite and PostgreSQL.

The original snapshot fails against this attempt's own committed revision. Refreshing it would hide, not validate, the missing replay mechanism.

### R14: ranking's production writer

`rankIssues` used its actual default writer and existing conservative missing-source path; no judge call or replacement writer was needed:

1. Malformed selected-store config: returns `ranked`, exports the iterate rewrite, then explicit retain drain throws `AggregateError: One or more configured artifact retains failed`.
2. Valid SQLite: retained ranking audit is `kind:capture`, `worktreeId:null`, `runId:null`; it is ordinary knowledge rather than private audit evidence.
3. `options.cwd` names sibling target B while process cwd is A: returns `ranked`, drain succeeds, but B's selected-store subject has zero records. The explicit checkout argument was not honored.

## Verification Status

- Goal achieved: partial. Selected-adapter ordinary paths work; save interruption recovery and ranking authority remain broken.
- User goal: partially met within the phase — configurable persistence, ordinary same-checkout resume and worktree isolation are evidenced; reliable same-attempt saves are not complete.
- Scope adhered: this review covers Phase 5 consumer migration only. No execution-policy or UI redesign was requested or applied. Census-required extra consumer paths are within the parent's accepted scope.
- Out-of-scope changes by this assignment: none. No implementation, phase status, subject lifecycle or loop-routing state was changed.
- UI limit: only the source seam was exercised; no browser/Astro-rendered-site or full live OMP/model/installation claim.

## Guardrails Verdict

- Contract: durable; version 2; runner 1.0.0; exit 0; status pass.
- Gates: `unit_test_gate=pass`, `functional_test_gate=skipped`, `lint_gate=skipped`, `patch_gate=advisory`, `global_ratchet=pass`, `complexity_gate=pass`.
- Coverage: 87.9%; unchanged baseline 84%; target 90%. Patch coverage percentage null, threshold 90 — not a measured patch-coverage pass.
- Complexity: 29 remaining hotspots against baseline inventory 30; no new violations or hard-ceiling violations.
- Runner proposed a coverage-baseline raise and complexity-inventory shrink. Neither proposal was applied. Enforcement, timeouts and behavioral tests were unchanged.
- PostgreSQL was enabled separately for the focused 123-test run and actual smokes. The earlier full runner used its normal environment; do not describe it as a PostgreSQL-enabled full run.

## User Goal Analysis

- Goal: users can choose durable storage per project, resume reliably and keep unmerged work invisible on other branches.
- Met within Phase 5: actual service-backed ordinary checkpoint/review/package/reader/save paths on all four adapters; focused branch/worktree/cursor/privacy tests.
- Partial: interrupted saves cannot recover the same recorded attempt; ranking can report success without correct-scope durability and stores its execution audit as knowledge.
- Missing Phase 5 behavior: R12/R13/R14 repairs and regression proof.
- Verdict: partially met. Later phases are not acceptance blockers for this phase, and phase status/checkboxes do not override observed defects.

## Documentation Impact

- Architecture/constraint deviation: `docs/context-artifacts.md:60-66` and `docs/CHANGELOG.md:15-20` describe checkout-bound queued consumer persistence. R14 is an implementation exception to that documented contract; repair code rather than weakening the contract.
- Activity how-to wording is stale: `docs/howto/watch-buck-loop-activity.md:12` says activity is not retained across fresh starts, while `activity-log.ts:174-183` now retains it in the selected adapter. Distinguish the truncatable export from retained revisions.
- Recommended: `/b-docs` after correctness repairs, before `/b-save`; documentation impact does not add an iteration defect or change the correctness verdict.

## How-to Impact

- New retained-evidence CLI actions lack a dedicated how-to in `docs/howto`: auto-fix artifact read/restore and pinned PR evidence list/offline restore. Existing review/prune/token-use how-tos were updated.
- Recommended: `/b-docs` first, following `/b-howto` for these actions. Non-blocking; no documentation-only item is written into the iteration artifact.

## Issue Classification

- In-plan implementation defects: R12, R13, R14; all are recorded with fixes/verification in `iterate-phase-5-recovery-boundaries-2026-10-16.md`.
- Out-of-plan scope discoveries: none.
- Documentation/how-to impact: non-blocking, separately routed as above.

## Completion Audit

1. Concrete objective: all six Phase 5 consumer acceptance criteria, not completion of all eight parent phases.
2. Each criterion maps to source/runtime evidence in the matrix.
3. Current implementation and authoritative unchanged guardrails were inspected/executed; completed fields were not trusted as proof.
4. Claims match exercised scope: production APIs, actual preflight CLI, four real storage backends and reader seam; no rendered-UI/live-model claim.
5. Uncertainty and failing recovery are retained as partial; the passing suite does not erase the reproduced defects.
6. Both review axes completed. No active goal field was present in the discovered current-session projection; no goal budget/routing action was taken.

## Recommended Next Step

Return to the supervisor for `/b-iterate` on the new artifact, then re-review the same Phase 5. After acceptance: conditional `/b-docs`/`b-howto` → `/b-save` → `/b-commit`. Existing memory does not record this review; save ownership remains with that later checkpoint. No next loop state is selected here.
