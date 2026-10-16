---
status: completed
date: 2026-10-15
subject: 2026-10-10.durable-storage-adapters
topics: [attribution, storage-consumers, r1, r2, r7]
informs: [iterate-phase-5-current-state-2026-10-15.md]
---

# Attribution repair: R1 / R2 / R7

Completed the attribution-specific assignment only. No shared files, other consumers, staging, commits, loop actions, or iterate-status changes. Preserved the preexisting attribution changes' duplicate-retention repair intent and event warning/drain behavior while replacing their local authority.

## Exact changed paths

- `extensions/token-attribution/db.ts`
- `extensions/token-attribution/report.ts`
- `extensions/token-attribution/index.ts`
- `extensions/token-attribution/__tests__/db.test.ts`
- `extensions/token-attribution/__tests__/report.test.ts`
- `extensions/token-attribution/__tests__/ingest.test.ts`
- `extensions/token-attribution/__tests__/wire.test.ts`
- `extensions/token-attribution/__tests__/fixtures.ts` (new isolated real-root/config fixtures)
- This evidence note.

## Implemented contracts

### R1: adapter-authoritative reads and dedupe

- `AttributionDatabase.insert()` / `insertReconciled()` now return `Promise<boolean>`. The selected service owns delivery existence and original row bytes. Every delivery, including a duplicate, awaits retained row/receipt readback; local dedupe cannot suppress repair.
- `records(cwd)` lists only the bound workspace/branch/run's private attribution artifacts. Removed local SQL aggregation/read paths. `buildTokenReport(ledger, cwd, projectKey, argument)` is async and aggregates one adapter snapshot; every production/test caller migrated. Exact branch precedence, literal case-insensitive project substring matching, cost-null semantics, and branch/model grouping remain.
- Canonical logical rows are `rows/<encodeURIComponent(sessionFile)>/<encodeURIComponent(entryKey)>.json`, avoiding same-entry-ID collisions across session files.
- Reconciliation writes canonical row plus durable `aliases/<encoded-session>/<encoded-fallback>.json` in one batch, then tombstones the predecessor using scoped correction. Aliases prevent a later ID-less replay from recreating the fallback and exclude an unremoved predecessor from totals if correction fails. Distinct real entry IDs sharing a fingerprint remain distinct.
- SQLite is opt-in through `new AttributionDatabase(projectionPath?)` / `TokenAttributionWireOptions.databasePath`. Only `buck_token_attribution` is written, after durable success. No default `~/.omp/stats.db` writer and no local-table outage/missing-row fallback. Host `attribution`, `messages`, and their indexes are untouched even when host `attribution` has every column of the former Buck schema. Historical SQL import remains outside this assignment.

### R2: actual checkout and pinned destination

- Every insert binds `record.worktreeRoot`; every report/read requires its actual `cwd`.
- `enqueue()` starts `resolveConsumerContext(cwd)` before waiting for prior ledger operations, and uses the returned trusted context with `withBoundStore`. No process-cwd substitution, selection re-resolution inside queued writes, or caller-supplied scope.
- Rows use workspace `context.runId`; individual attempted retention receipts use a separate run from `createRunId()`. Existing shared destination pinning persists across instance/process restart and refuses changed destination selection.

### R7: awaited retention, repair and fault observation

- Return values follow actual batch/receipt persistence plus exact row readback, not local insertion. A receipt failure after row commit rejects; replay rewrites/retains the same logical delivery and repairs its missing receipt without adding a counted row.
- Per-ledger serialized operations preserve failures until explicit `flush()` / `close()` observation. Awaited API failures do not become unhandled rejections.
- Nested scanning awaits reconciliation, preserves failed JSONL bytes for retry, and propagates persistence errors to event warning boundaries instead of swallowing them as unreadable-file errors.
- `message_end` / `agent_end` await insertion/scans and drains; host response handling converts errors to warnings. `session_shutdown` awaits both ledger close and the shared configured-retention drain using `Promise.allSettled`, so one failed drain cannot hide the other.

## Fresh verification

Final source batch verified after the last code/test edit. No whole-tree guardrail claim; the supervisor owns the coherent integrated-tree run while the other consumers remain under concurrent repair.

### Focused suites

Command:

```sh
BUCK_WORKFLOW_TEST_DATABASE_URL=postgres://buck:buck-local-test@127.0.0.1:32773/attribution \
  node_modules/.bin/vitest run extensions/token-attribution --reporter=dot
```

- Exit **0**; **5 test files passed, 37 tests passed, no skips**; duration **2.14s**.
- All four adapters exercised, including real PostgreSQL in disposable container `buck-attribution-r1r2r7-20261015` (`pgvector/pgvector:pg18`). The container and temporary fixture roots were removed after verification; the URL is only the recorded ephemeral local test endpoint, not a production credential or reusable service dependency.
- Coverage scenarios include poisoned/local-only projection rows, exports absent after restart, exact session/entry identity, fallback/canonical replay, correction failure repair, populated-projection config refusal, actual linked Git worktrees, process-A/checkout-B isolation, delayed queues, destination-change refusal, awaited receipts, duplicate repair, partial JSONL/cursor retry, live report, and pending-shutdown warnings.
- Fresh LSP diagnostics: **no issues in all 10 attribution TypeScript files**, including tests/fixtures.
- Log: `/tmp/attribution-r1r2r7-tests.log`.

### Test sensitivity

Temporarily removed alias suppression from `records()` and ran the canonical-reconciliation/tombstone-fault regression. It failed for the intended consumer-visible defect: actual entry keys `[fallback, canonical]`, expected `[canonical]` (exit 1). Restored the production filter before the final passing suite and smokes.

- Mutation log: `/tmp/attribution-r1r2r7-mutation.log`.

### Actual four-adapter production smoke

Executed production modules using `node --import tsx` child processes, not Vitest or mocked adapters. Each adapter performed initial insert, fallback-to-canonical reconciliation, separate-process restart with checkout `.context` removed and no SQLite export, duplicate replay/report/read, malformed-config read/write/drain refusal, configuration restoration, and another restart/replay. Every scoped artifact's project/run/worktree fields were compared to its trusted context.

Command: `node /tmp/attribution-r1r2r7-smoke.mjs` (throwaway script removed after success). Exit **0**. Log: `/tmp/attribution-r1r2r7-smoke.log`.

| Adapter | Insert / reconcile | Restart rows / tokens | Replay after repair | Workspace row run |
| --- | --- | --- | --- | --- |
| repo-files | true / false | 1 / 6 | false, 1 row | `run-142e7e97-5086-46b4-9328-7de5ac06b06a` |
| external-files | true / false | 1 / 6 | false, 1 row | `run-0cad813f-e7ad-4c39-a85a-944c070cdd5f` |
| sqlite | true / false | 1 / 6 | false, 1 row | `run-f3873cf0-06e9-4a9a-b8c6-fff4943b28a7` |
| postgres | true / false | 1 / 6 | false, 1 row | `run-ba01d363-cede-44ba-a8c9-9277d62e0cac` |

All four reported `exportAbsent:true`, `readFaultObserved:true`, `writeFaultObserved:true`, `drainFaultObserved:true`. Exact project/worktree IDs remain in the smoke log.

### Actual SQLite receipt-fault + event/shutdown smoke

Executed real `wire()` event handlers and real configured SQLite service. An isolated SQLite `BEFORE INSERT ON artifact_runs` trigger raised `real receipt fault`, after the row batch had committed. No adapter mocks or host/model calls. The harness supplied only extension registration, session metadata, and notification capture.

- `message_end`: awaited failure; exactly **1 warning**, no host-response exception.
- A shared queued retain hit the same real receipt trigger. `session_shutdown` observed **2 additional warnings** (ledger failure and shared queue failure); neither drain hid the other.
- Removed trigger, created a fresh wire/ledger in the same workspace, replayed the same delivery, ran `/tokens`, and shut down: **1 row, 6 report tokens, 6 optional-projection tokens**, unchanged host `attribution`/`messages` rows.
- Workspace row run `run-b5245496-86d7-4b34-9e61-a40a0babb15a`; successful receipt run `run-0b64103e-f64a-4b2d-9fdd-0e8a951adf62`. Exact worktree match verified; distinct receipt run verified.
- Command: `node --import tsx /tmp/attribution-r1r2r7-events-smoke.mjs` (throwaway script removed after success). Exit **0**. Log: `/tmp/attribution-r1r2r7-events-smoke.log`.
- Node emitted its `module.register()` deprecation warning from the installed TS loader; assertions and process exit succeeded.

## Supervisor integration notes

- No shared storage files changed. The existing `resolveConsumerContext`, `withBoundStore`, `commitConsumerBatch`, `consumerKey`, scoped correction, and run-private storage contracts are reused.
- Scope permits no living-doc edits. `docs/oh-my-pi.md:105-109` still describes the obsolete default stats DB authority/table selection and needs the supervisor's integrated documentation update. `docs/howto/inspect-project-token-use.md` should describe configured adapter/private-workspace visibility rather than implying global stats-table aggregation. No public API/host table fallback was retained to mask those stale descriptions.
- Full `npm run guardrails:check`, review/save/commit, and iterate-status closure remain supervisor-owned. This note closes only the assigned attribution repair.
