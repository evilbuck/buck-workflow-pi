---
status: completed
date: 2026-10-15
updated: 2026-10-15
subject: 2026-10-10.durable-storage-adapters
topics: [review, iteration, storage-consumers]
informs: []
addresses: phase-5-remaining-consumers.md
completed: 2026-10-15
from_review: b-review
related: [review-phase-5-assigned-recheck-2026-10-15.md, review-phase-5-current-state-2026-10-15.md]
---

# Iteration: Phase 5 assigned recheck

## Source
- Reviewed after `/b-iterate`; exact contract: `phase-5-remaining-consumers.md`, parent step 5.
- Baseline: consumer changes through `f235435`, plus the staged standalone-save privacy repair. Current source, not historical checkboxes, controls the findings.
- Preserve prior finding IDs R1–R10 for traceability. R4's unsafe scribe-fact LTM payload is addressed in the staged repair: actual production payload construction withheld the supplied private text for Hindsight, mnemopi and local backends. No published-revision handoff is claimed or required before Phase 6 supplies publication proof; withholding is the parent's safe fallback.
- The remaining findings below complete the existing migration; none introduces Phase 6 publication/orphan recovery or Phase 7 historical cutover requirements. Full OMP/all-backend/site-surface integration remains Phase 8.

## Critical Issues

### 1. [High] R1: Make ordinary consumer reads and same-checkout resume adapter-authoritative
- **File**: `extensions/buck-loop/persist.ts:124-173,180-195`; `extensions/buck-loop/scan.ts:92-105,127-133,190-205`; `extensions/code-review-iteration/run-state.ts:129-173,252-258`; `skills/b-save-improved/scripts/save-preflight.ts:123-174`; `skills/b-memory-import/scripts/import-context-memory.ts:582-600,784-798,939-956`; `extensions/token-attribution/db.ts:180-212`.
- **Problem**: checkpoint retention allocates an unrelated fresh run while the SQLite reader uses the workspace run; other selected adapters are not read here. `resume()` still requires local JSON and a local subject. Review state/commands, importer source/cursor, save discovery and attribution reports/dedupe remain local authorities rather than optional exports.
- **Fresh evidence**: actual `writeProjection()` plus queue drain, followed by an exact-byte checkpoint retain/readback under returned run `run-f2b90096-7956-4ee2-81ba-8eb165feff92`. Workspace run was `run-8e489ccd-ad9e-4a70-b68e-6eac68fbeb0b`. After removing the local bookmark, `readProjection()` returned null and production `resume()` returned `idle` although the adapter checkpoint was readable by its exact key. The extra retain provides an observable run ID; it does not repair the production reader or claim enumeration of every stored checkpoint.
- **Adapter-only discovery evidence**: native write/list read back plan revision `0f8b88cf-ea27-4ef7-85e1-bd05c809888c` without any local `.context`. Actual preflight CLI exited 3 with `{"error":"no .context directory"}`; actual loop `scan()` returned `kind:missing` for that existing adapter plan.
- **Proposed fix**: bind and recover consumer session/run references through the selected service; port actual read/list/scan/preflight/import/dedupe callers to that authority. Local files/tables may be scoped exports, never outage/missing-row fallback. Preserve artifact-over-bookmark and published-only importer semantics.
- **Verification**: same-checkout restart with exports absent on each adapter; exact state/pass/cursor/dedupe readback, no file fallback on service failure, independent worktree pointers.


- **Jev failure**: Jev failed: missing, unreadable, or oversized file extensions/buck-loop/persist.ts:124-173,180-195`; `extensions/buck-loop/scan.ts:92-105,127-133,190-205`; `extensions/code-review-iteration/run-state.ts:129-173,252-258`; `skills/b-save-improved/scripts/save-preflight.ts:123-174`; `skills/b-memory-import/scripts/import-context-memory.ts:582-600,784-798,939-956`; `extensions/token-attribution/db.ts:180-212`.. Re-review this finding with Jev.

### 2. [High] R2: Bind actual checkout and selected destination before queued retention
- **File**: `skills/_shared/storage/consumers.ts:122-155`; `extensions/buck-loop/loop.ts:1531-1534`; `extensions/code-review-iteration/run-state.ts:123-126,209-213`; `extensions/token-attribution/db.ts:139-143`; `skills/b-memory-import/scripts/import-context-memory.ts:597-600`.
- **Problem**: callers supply `worktreeId` as a checkout/path, but the helper ignores it and uses `cwd ?? process.cwd()`. The trusted helper is correct only when the real checkout is supplied. Queue execution also re-resolves selection, with no pinned consumer-session destination.
- **Fresh evidence**: real Git worktrees on distinct branches, process cwd left, legacy production call shape `worktreeId:right` and no cwd: readback was `retainedInLeft:true, retainedInRight:false`.
- **Proposed fix**: carry the actual consumer checkout and trusted bound destination/run through these callers; refuse destination changes during the run. Reuse the existing context-binding contract. Remove the misleading unused `worktreeId` option after callsites migrate.
- **Verification**: target B from process A, delayed queue execution and mid-run config change cannot redirect the bound write. Read back exact run/worktree/project scope.


- **Jev failure**: Jev failed: missing, unreadable, or oversized file skills/_shared/storage/consumers.ts:122-155`; `extensions/buck-loop/loop.ts:1531-1534`; `extensions/code-review-iteration/run-state.ts:123-126,209-213`; `extensions/token-attribution/db.ts:139-143`; `skills/b-memory-import/scripts/import-context-memory.ts:597-600`.. Re-review this finding with Jev.

### 3. [High] R3: Preserve conditional revision, links and canonical logical identity
- **File**: `skills/_shared/storage/consumers.ts:21-29,92-102,169-181`; `skills/b-save-improved/scripts/save-apply.ts:595-619`; `extensions/buck-loop/loop.ts:1531-1533`.
- **Problem**: `ConsumerWrite` cannot carry `expectedRevision`; revision construction clears links unless supplied. Save seals stale local bodies unconditionally. Review writes prefix the subject into an already subject-scoped logical name. Basename-only index classification aliases nested indexes onto the lifecycle index.
- **Fresh evidence**: real SQLite canonical body with a spec link was overwritten by a consumer's `stale projection body`; readback links were `[]`. Production classification returned exactly the same subject-index key for `<subject>/index.md` and `<subject>/notes/index.md`.
- **File-adapter evidence**: actual repo-files and external-files stores also accepted the stale consumer update and dropped the spec link (`currentBody:stale projection,links:[]` on each). Reuse conditional revisions across the shared consumer path; this is not a SQLite-specific fix.
- **Proposed fix**: use the existing conditional artifact contract and preserve typed links; reconcile moves/deletions with scoped correction/tombstone semantics. Normalize all callers to subject-relative names. Only the exact subject-root `index.md` is lifecycle metadata.
- **Verification**: native create → consumer update preserves one token/logical identity and links; stale writes refuse; moved sources are not still live; nested index cannot overwrite root lifecycle content.


- **Jev failure**: Jev failed: missing, unreadable, or oversized file skills/_shared/storage/consumers.ts:21-29,92-102,169-181`; `skills/b-save-improved/scripts/save-apply.ts:595-619`; `extensions/buck-loop/loop.ts:1531-1533`.. Re-review this finding with Jev.

### 5. [High] R5: Give successive hook windows distinct attempt-bound receipt runs
- **File**: `hooks/post/turn-memory.ts:94-111`; `skills/_shared/storage/consumers.ts:53-67`; `skills/_shared/storage/domain.ts:117-139`.
- **Problem**: default hook directly reuses workspace `context.runId` for differing window attempts. The new CLI/native attempt allocator does not wrap this direct batch call. A later window commits bytes before receipt identity refusal, then capture swallows failure after its consumed marker.
- **Fresh evidence**: actual SQLite consumer batch calls using the default hook's workspace-run/different-window-attempt shape: second call threw `receipt attempt or scope mismatch, or already complete`; second memory body existed, while the receipt still named `window-1`. This is real persistence evidence, not a live hook/model/session claim.
- **Proposed fix**: allocate and recover one attempt-bound receipt run per window through the existing trusted binding. Preserve consumed-window policy and host ownership; do not bypass receipt identity checks or add an unrelated retry policy.
- **Verification**: multiple default-hook windows in one workspace plus replay; exact memory/dedupe/receipt readback and defined consumed behavior under persistence failure.


- **Jev failure**: Jev failed: missing, unreadable, or oversized file hooks/post/turn-memory.ts:94-111`; `skills/_shared/storage/consumers.ts:53-67`; `skills/_shared/storage/domain.ts:117-139`.. Re-review this finding with Jev.

### 6. [High] R6: Complete one authoritative standalone save attempt across facts and metadata
- **File**: `extensions/b-save-improved/index.ts:700-747`; `extensions/buck-loop/sql-save.ts:82-87,145-167,314-394`; `skills/b-save-improved/scripts/save-apply.ts:610-621`.
- **Problem**: facts produce an attempted adapter receipt; metadata sealing allocates another run; standalone success calls only `completeSaveAttempt()`, which sets a local JSON flag. It never invokes the durable completion path used by loop verification. File-mode seal also leaves only attempted evidence.
- **Fresh evidence**: actual configured SQLite `prepareSaveAttempt → saveSqlFacts([]) → completeSaveAttempt`, then native `read-receipt`: local `completed:true`, durable `status:attempted`, duties `save-metadata,probe`.
- **Proposed fix**: carry one persisted attempt through facts/metadata in both entrypoints; complete and read back that exact receipt only after its required duties succeed. Do not manufacture missing duty evidence from a local completion flag.
- **Verification**: rows/no-fact saves through both entrypoints produce matching complete receipt/revisions/duties. Fault each fact/metadata/receipt boundary; incomplete metadata cannot authorize success.


- **Jev failure**: Jev failed: missing, unreadable, or oversized file extensions/b-save-improved/index.ts:700-747`; `extensions/buck-loop/sql-save.ts:82-87,145-167,314-394`; `skills/b-save-improved/scripts/save-apply.ts:610-621`.. Re-review this finding with Jev.

### 7. [High] R7: Await terminal durability and make failed attribution retention repairable
- **File**: `extensions/code-review-iteration/run-state.ts:106-126`; `extensions/code-review-iteration/report.ts:157-169`; `extensions/code-review-iteration/loop.ts:556-600,614-621`; `extensions/token-attribution/db.ts:123-145,215-217`; `extensions/token-attribution/index.ts:318-347`.
- **Problem**: `createRun()` drops the `saveState()` promise; `writeFinalReport()` returns a local path while retention is pending, so terminal clean handling may commit/return success before persistence. Attribution acknowledges a local insert, never awaits/drains production retention, then dedupes retries before they can repair missing retained evidence.
- **Fresh evidence**: with intentionally invalid selected-store config, actual `writeFinalReport()` returned a string path and created the local report; only a separate explicit drain observed the config failure. Actual attribution insert returned true; drain failed. Retrying the same record returned false; a second drain succeeded even though config remained invalid. Local total still counted 6 tokens: no retry retention was scheduled.
- **Proposed fix**: migrate callers to await creation/final-report/terminal persistence; explicitly observe failures at suitable attribution event/shutdown boundaries without breaking host responses. Retry must repair unretained local rows rather than treating the old dedupe marker as durable success. Keep queue failure preservation.
- **Verification**: clean-report retention fault cannot report durable success; failed attribution retry restores exact retained row; shutdown observes pending writes/failures.


- **Jev failure**: Jev failed: missing, unreadable, or oversized file extensions/code-review-iteration/run-state.ts:106-126`; `extensions/code-review-iteration/report.ts:157-169`; `extensions/code-review-iteration/loop.ts:556-600,614-621`; `extensions/token-attribution/db.ts:123-145,215-217`; `extensions/token-attribution/index.ts:318-347`.. Re-review this finding with Jev.

### 8. [Medium] R8: Reconcile retained census items with evidenced ownership
- **File**: `persistence-inventory.md:42,53,97,104`; `skills/b-auto-fix/scripts/auto-fix.ts:159-185,413-445,598-607`; `skills/code-review/scripts/pr-context.ts:338-362`.
- **Problem**: original census requires retained auto-fix runs/stages/failure logs and pinned PR evidence; reconciliation relabels them transient/user-owned without showing a changed owner or disposable lifetime. Current writers still create persistent Buck-owned records.
- **Proposed fix**: migrate owned retained evidence through existing run-private storage, or prove an individual item's excluded authority/disposable projection with concrete writer/reader/lifetime evidence. Do not redefine accepted ownership to close the table.
- **Verification**: every original census row has migrated read/write behavior or a substantiated exclusion; retained run and pinned input bytes/scope survive restart.


- **Jev failure**: Jev failed: missing, unreadable, or oversized file persistence-inventory.md:42,53,97,104`; `skills/b-auto-fix/scripts/auto-fix.ts:159-185,413-445,598-607`; `skills/code-review/scripts/pr-context.ts:338-362`.. Re-review this finding with Jev.

### 10. [Medium] R10: Preserve visible subject Markdown through the existing reader seam
- **File**: `docs/plans/src/lib/plans/sql.ts:23-25,51-60`.
- **Problem**: the real loader replaces the stub but whitelists only plan/phase/spec/research/subject-index. Existing review/iterate/brainstorm/nested knowledge links disappear despite being visible in storage. Baseline `db31575` filesystem reader recursively collected all Markdown.
- **Fresh evidence**: stored plan/review/iterate fixtures through the real configured SQLite service. Actual default `SqlPlanSource` returned `plan-demo.md,plan-stale.md`; lookup of `review-demo` returned null, and iterate was absent.
- **Proposed fix**: preserve eligible visible knowledge Markdown using existing artifact kinds and logical references; exclude private execution records/binaries. No filesystem union, raw SQL reader or UI redesign.
- **Verification**: configured list/get for linked plan/review/iterate/brainstorm/nested Markdown, preserving branch/publication visibility. Actual rendered-site integration remains Phase 8.


- **Jev failure**: Jev failed: missing, unreadable, or oversized file docs/plans/src/lib/plans/sql.ts:23-25,51-60`.. Re-review this finding with Jev.

### 9. [High] R9: Restore required deterministic verification
- **File**: unchanged `guardrails.json`; `extensions/code-review-iteration/__tests__/loop.test.ts:593` and configured-store pass-retention coverage in `extensions/code-review-iteration/__tests__/run-state.test.ts`.
- **Problem**: fresh authoritative `npm run guardrails:check` exited 1 after 816.39 seconds. `unit_test_gate=fail`, `global_ratchet=fail`, `coverage command failed (exit 1)`; functional/lint skipped, patch advisory, complexity pass. Coverage is null, baseline remains 84. The truncated unit tail names a 5000ms resume-rebase-conflict timeout and configured-store pass-retention failure; it does not establish every failing test or a common root cause.
- **Proposed fix**: resolve actual consumer/test-isolation and awaited persistence failures, then rerun the unchanged durable v2 contract. Do not widen timeouts, weaken enforcement/baselines, or remove behavioral tests to silence the gate.
- **Verification**: all required contract gates pass on the corrected tree. Preserve/report skipped and advisory states; do not substitute isolated smoke success for the full contract.


- **Jev failure**: Jev failed: missing, unreadable, or oversized file unchanged `guardrails.json`; `extensions/code-review-iteration/__tests__/loop.test.ts:593` and configured-store pass-retention coverage in `extensions/code-review-iteration/__tests__/run-state.test.ts`.. Re-review this finding with Jev.

## Recommended Workflow

Return this exact in-plan iteration to the supervisor for `/b-iterate`, then re-review the same Phase 5. Do not choose or mutate loop state. Keep documentation/how-to impact non-blocking and separate; after acceptance, conditional docs/how-to → save → commit.

## Resolution (2026-10-15)

| Finding | Verified resolution |
|---|---|
| R1 | Selected-store scan/resume, review/pass/command reads, preflight, importer source/cursor and attribution authority; four-adapter missing-export/outage proofs. |
| R2 | Actual checkout required; queued destination/run bound before execution; destination changes refuse; real sibling-worktree scope tests. |
| R3 | Conditional revisions, preserved links, canonical subject-relative names/root index, scoped move/delete tombstones, and normalized plan bridge. |
| R4 | Pre-existing standalone LTM-withholding repair preserved and exercised; canonical/bundled save guidance also withholds publication-unproven facts. |
| R5 | Distinct completed window-attempt receipts and replay readback; actual storage-failure smoke preserves consumed-window policy. |
| R6 | One durable facts/metadata attempt and exact complete receipt across both save entrypoints; local completion flags cannot authorize success. |
| R7 | Awaited run/report durability before clean terminal state; repairable attribution retention and observed shutdown failures. |
| R8 | Retained auto-fix and pinned PR evidence, exact raw bytes/offline restore, and concrete census ownership/lifetime reconciliation. |
| R9 | Unchanged durable v2 contract passes: required unit, coverage ratchet and complexity gates; no timeout/enforcement/baseline weakening. |
| R10 | Visible knowledge Markdown preserved through the existing reader; private execution records/binaries excluded; no rendered-site claim. |

Verification: full guardrails pass, coverage 89.2% against unchanged 84% baseline. Lint/functional disabled; patch advisory returned pass without a percentage. Exact matrix/runtime evidence: research-repair-shared-review.md, research-repair-save-attempt.md, research-repair-loop-read.md, research-repair-loop-helpers.md, research-repair-attribution.md, research-repair-importer.md, research-repair-census.md.
Handoff: supervisor re-reviews the same Phase 5. No loop-state choice, save or commit was performed.
