---
status: completed
date: 2026-10-15
domains: [storage, testing]
topics: [durable-storage-adapters, buck-loop, async-helpers, R1, R3, R7]
related: [research-repair-loop-read.md, iterate-phase-5-current-state-2026-10-15.md]
---
# Phase 5 scoped async helper integration

## Scope and contract
- Own only `extensions/buck-loop/phase-completion.ts`, `extensions/buck-loop/ambiguity.ts` and their tests. `loop.ts` caller fixes allowed only if existing await signatures require them.
- Existing `loop.ts` callers already await `syncCheckedPhasesAt`, `unfinishedIterateReport` and `closeSingleUnfinishedIterate`; no caller change was needed or made.
- Read retained documents from the selected adapter; never use absent/stale checkout exports as authority. Conditional writes use the exact retained revision and preserve artifact links. Await durable readback before success.
- Keep first-commit trusted identity continuity and standalone save projection await with their existing owners. No shared-source, stage, commit, loop-state, iterate-artifact status, timeout or gate changes.
- Supplied SQL recall reused; no queries.

## Implemented paths
- `extensions/buck-loop/phase-completion.ts`: `syncCheckedPhasesAt()` is async. One retained-document snapshot selects the plan/subject and direct phase/overview paths. Trusted `resolveConsumerContext()` / `withBoundStore()` bind revision reads and writes to the actual checkout. Completion transforms use retained bytes, reject intervening document changes, and batch conditional writes using each original `expectedRevision` and `links`. `commitConsumerBatch()` and its revision/receipt readback finish before returning written phase/plan paths. No filesystem discovery or local-body fallback remains in this helper; no subject lifecycle index is modified.
- `extensions/buck-loop/ambiguity.ts`: `unfinishedIterateReport()` awaits unfinished discovery and every status read. `closeSingleUnfinishedIterate()` awaits discovery, reads the sole candidate from the bound store, checks its retained active frontmatter, preserves body/links, and conditionally closes its exact retained revision. Awaited revision/receipt persistence precedes success; malformed/non-unique targets return false and storage failures propagate.
- `extensions/buck-loop/__tests__/phase-completion.test.ts`: await synchronization and scans.
- `extensions/buck-loop/__tests__/phase-completion-unit.test.ts`: await overview/status synchronization.
- `extensions/buck-loop/__tests__/ambiguity.test.ts`: use real isolated repository subject paths for selected-store discovery; await helpers; replace export-permission failure assumptions with a real selected-store failure.
- `extensions/buck-loop/__tests__/loop-helpers-storage.test.ts`: new four-adapter regressions for absent exports, checked phases and multi-row overview updates, unphased completion, direct-subject boundaries, idempotence, retained iterate reporting/closeout, links, exact original-revision conflicts, delayed persistence, and persistence errors. Non-repo adapter cases additionally reject stale/unretained checkout bodies; repo-files editable ingestion remains adapter-owned, not a helper fallback.

## Verification evidence

### Focused helper suites
Command:
```sh
BUCK_WORKFLOW_TEST_DATABASE_URL=postgres://postgres:loop-helpers@127.0.0.1:32778/loop_helpers node node_modules/vitest/vitest.mjs run extensions/buck-loop/__tests__/phase-completion.test.ts extensions/buck-loop/__tests__/phase-completion-unit.test.ts extensions/buck-loop/__tests__/ambiguity.test.ts extensions/buck-loop/__tests__/loop-helpers-storage.test.ts --reporter=json --outputFile=/tmp/buck-loop-helpers-results.json
```
- Final fresh run: **85 passed, 0 failed, 0 skipped**, exit **0**.
- Breakdown: `ambiguity.test.ts` 23, `phase-completion.test.ts` 8, `phase-completion-unit.test.ts` 15, `loop-helpers-storage.test.ts` 39.
- All four actual adapters exercised: repo-files, external-files, SQLite, PostgreSQL 18 with pgvector. PostgreSQL was a disposable local `pgvector/pgvector:pg18` container, not a skipped backend.

### Loop caller integration
Command:
```sh
node node_modules/vitest/vitest.mjs run extensions/buck-loop/__tests__/loop.test.ts -t 'writes status from checked criteria|marks a phase completed when every acceptance box|closes the artifact after a completed phase|does not close after a failed iterate session|closes after an ok retry|two iterate artifacts are unfinished' --reporter=json --outputFile=/tmp/buck-loop-helper-callers.json
```
- **6 passed, 0 failed**, 115 unrelated tests filtered, exit **0**.
- Actual caller paths cover checked-criteria status synchronization before review, pre-checked completion, successful iterate closeout, refusal after a failed child, successful retry, and refusal to choose between two unfinished iterates.
- `loop.ts` was not edited.

### Mutation proof for R3
- Temporarily changed both helpers' explicit original `expectedRevision` to `undefined`.
- The real-store race fixture writes a concurrent authoritative edit **before** `commitConsumerBatch()` can re-read the current row. This distinguishes the original revision from a freshly selected revision.
- `loop-helpers-storage.test.ts -t 'rejects a concurrent'`: **0 passed, 8 failed**, exit **1**, exactly phase + iterate for every adapter. All failed because the mutation acknowledged/overwrote instead of rejecting.
- Restored both exact-revision writes immediately. Final complete 85-test run above is after restoration.

### Real fresh-process runtime smoke
- Executed `HELPER_SMOKE_PG_URL=postgres://postgres:loop-helpers@127.0.0.1:32778/loop_helpers bun /tmp/buck-loop-helpers-runtime-smoke.ts`, exit **0**.
- For each adapter: created an isolated real Git checkout/config; retained a plan, checked phase, overview, active iterate and separate checked unphased plan with links; deleted the entire checkout `.context`; launched a fresh Bun child importing production helpers.
- Each child asserted absent exports, reported the retained active iterate, completed the retained phase/overview and unphased plan, closed the retained iterate, read canonical bytes/dates/links back from the adapter, and checked idempotence.
- Every adapter emitted:
  - `repo-files`: `restarted:true,exportsAbsent:true,phase:completed,overview:completed,unphased:completed,iterate:completed,linksPreserved:true`
  - `external-files`: identical successful fields.
  - `sqlite`: identical successful fields.
  - `postgres`: identical successful fields.
- Throwaway runtime script removed and disposable PostgreSQL fixture stopped after verification.

### Diagnostics and scope
- Fresh TypeScript LSP diagnostics: no issues in both changed source files and all four changed/new test files.
- No shared files, standalone-save files, staging, commits, loop-state files, phase/iterate artifact statuses, timeouts, or gates changed by this slice.
- No full guardrails run: explicitly deferred to the integration owner while other files are being edited. These results prove the scoped helper integration, not whole-Phase-5 completion.
