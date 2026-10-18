---
status: completed
date: 2026-10-15
topics: [storage-consumers, buck-loop, iteration]
related: [iterate-phase-5-current-state-2026-10-15.md]
---
# Assigned loop read/persistence repair

Scope: R1 ordinary buck-loop persistence, authoritative scan/resume and all four adapters; R2 real checkout/destination binding. No staging, commit, loop-state mutation or iteration-status change. Supplied SQL recall reused; no SQL query.

## Implemented in owned files
- `extensions/buck-loop/persist.ts`: awaited selected-store checkpoint write/read in trusted workspace run; local JSON is export only. Missing retained row is absent, corrupt retained bytes block, store errors propagate. Resume does not require local bookmark or subject. One authoritative document snapshot drives reconciliation and preserves completed projected phase/commit checkpoint identity.
- `extensions/buck-loop/scan.ts`: async selected-service list for every backend; parse retained plan/phase/review/iterate text, including phase ownership/dependencies/acceptance and work postconditions. `scanDocuments()` permits resume to use the same selected snapshot. No SQLite-specific reader or filesystem outage/missing-row union.
- `extensions/buck-loop/loop.ts`: await bookmark/scan/status/persistence chains, actual `cwd` on review retention, selected-store review snapshots, rank source, difficulty and declared commit-file reads. Retain review before local export.
- `extensions/buck-loop/index.ts`: await saved status while recording supervisor failures.
- Tests migrated: `__tests__/persist.test.ts`, `scan.test.ts`, `loop.test.ts`, `wire-status.integration.test.ts`. Raw planted bookmark fixtures now retain canonical bytes instead of relying on exports. Deleted two source-text/import assertions (not behavioral tests); behavioral guards/timeouts untouched.
- New `extensions/buck-loop/__tests__/loop-storage.test.ts`: four-backend exports-absent read/resume, exact bookmark, artifact precedence, worktree isolation, delayed queue/config pinning and real store outages. Includes newly exposed first-commit binding regression (see required shared fix below).

## Original integration handoff (resolved below)
1. **`skills/_shared/scripts/workflow-state.ts` first-commit scope continuity:** `resolveTrustedContext()` uses private workspace `branchId` for unborn HEAD, then a new named branch ID after first commit while keeping `runId`. A retained checkpoint becomes invisible in the SAME checkout. Fresh `loop-storage.test.ts -t 'first commit'` fails on **all four adapters** (`readProjection()` returns null). Preserve/recover the trusted consumer-session branch binding across initial commit; do not add disk fallback or invent a caller branch. Existing loop fixtures that commit after retaining expose the same failure. Broken HEAD also selects a different private scope and incorrectly hides the retained checkpoint (`loop.test.ts` broken-HEAD recovery case); fail closed on invalid Git identity.
2. **`extensions/buck-loop/phase-completion.ts:57-58`:** `scan()` is now `Promise<ScanResult>`. Migrate `syncCheckedPhasesAt()` to async + adapter-authoritative document/revision writes, await retention, and migrate its tests. Loop callers already await it. Current synchronous call silently sees undefined planPath, so status-from-checked-criteria tests fail. This file is outside my ownership.
3. **`extensions/buck-loop/ambiguity.ts:65-82`:** `unfinishedIterates()` / `readStatus()` now return promises. Migrate `unfinishedIterateReport()` and `closeSingleUnfinishedIterate()` plus tests to await the selected-store APIs and use retained bytes/revision for closeout. Loop callers already await both. Current map/length logic still treats a promise as an array.
4. **Standalone save owner:** `extensions/b-save-improved/index.ts` must await `readProjection(ctx.cwd)` (previously line 706). No save/SQL-save files edited by this slice.
5. Repo-files subject-relative projection path defect was observed initially (extra `.context/plan-demo.md` dirt). Shared owner has since changed `file-store.ts` path construction to `#editableRelative`; latest focused scan run no longer reports that clean-commit failure. No file-store edit made here.

## Verification evidence
- Four-backend focused authority suite, before adding first-commit regression: **20 passed, 0 failed** with PostgreSQL 18 + pgvector; repo-files, external-files, SQLite and PostgreSQL all exercised, no backend skipped.
- Fresh-process runtime smoke: `env LOOP_SMOKE_PG_URL=postgres://postgres:loop-test@127.0.0.1:32777/loop_test bun /tmp/buck-loop-read-runtime-smoke.ts`, exit 0. For EACH adapter: retained plan + completed first phase + pending second phase + checkpoint, deleted entire checkout `.context`, launched a fresh Bun child process. Production `readProjection`, `resume`, `scan`, `handleLoop(status)` recovered `loopCount:6`, `saveAttemptId:restart-attempt`, frozen first phase, next second phase and `status:reviewing`. All four emitted `restarted:true,exportsAbsent:true`.
- Mutation proof: temporarily restored the old local-export existence prerequisite in `readProjection`; all four exports-absent tests failed with null bookmark, exit 1. Mutation removed immediately before subsequent verification.
- `wire-status.integration.test.ts` + `wire.test.ts`: **18 passed, 0 failed**, exit 0.
- `loop.test.ts -t prepareCommitCheckpoint`: **6 passed, 0 failed**, 115 unrelated cases filtered, exit 0.
- Broad `loop.test.ts` run (before remaining raw bookmark fixture migration): **87 passed, 29 failed, 5 skipped**, exit 1, 104.40s. Full JSON retained temporarily at `/tmp/buck-loop-focused-results.json`; failures include shared first-commit/private-scope loss, phase-completion/ambiguity async integration, and raw-local fixture authority assumptions. Raw-local fixtures have since been migrated; a new coherent full run is required after shared fixes. No timeout/gate changes.
- Final coherent focused run: **120 passed, 4 failed, 0 skipped**, exit 1. `persist.test.ts` 21/21, `scan.test.ts` 61/61, `wire-status.integration.test.ts` 3/3, `wire.test.ts` 15/15; `loop-storage.test.ts` 20 passed plus the four first-commit shared-binding failures. All four configured adapters exercised. No assertion, timeout or gate weakened.
- New first-commit regression fresh run: **0 passed, 4 failed**, 20 filtered, exit 1; one failure per backend. This is a real shared-context prerequisite, not suppressed/rebaselined.
- Fresh-process runtime smoke repeated after final source edits: all four adapters again emitted `restarted:true,exportsAbsent:true,loopCount:6,status:reviewing`, exit 0 (2.81s). Runtime script was throwaway and removed; disposable PostgreSQL fixtures stopped after verification. The exact exercised sequence and outputs are recorded above.

All integration handoffs above are resolved: private first-commit scope continuity and malformed-HEAD refusal; adapter-authoritative async lifecycle/iterate helpers; awaited standalone projection reads; canonical subject-relative projections. Fresh integrated loop/native/consumer matrix: 172 passed across four files. The final unchanged durable-v2 guardrails contract passed (89.2% coverage, baseline 84%; required unit/ratchet/complexity pass). See research-repair-shared-review.md for exact fresh-process smoke evidence and scope limits.
