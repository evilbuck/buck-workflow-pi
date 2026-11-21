---
status: pending
phase: 1
order: 1
plan: plan-migration-followups.md
phases_overview: plan-migration-followups-phases.md
difficulty: hard
model_hint: strongest reasoning model available
buck_hint: /b-build-hard
goal: "Eliminate message_end extension-handler timeouts by removing awaited persistence from the hot path."
depends_on: []
dependency_type: NONE
files:
  - extensions/token-attribution/index.ts
  - extensions/token-attribution/db.ts
  - extensions/token-attribution/__tests__/wire.test.ts
  - extensions/token-attribution/__tests__/ingest.test.ts
from_plan_steps: [1, 2, 3, 4, 5, 6, 7, 8]
acceptance_criteria:
  - "[ ] Unchanged attribution records incur zero store writes (spy on commitConsumerBatch returns false) — red/green test"
  - "[ ] scanSessionArtifacts batches one commitConsumerBatch per artifact file; failure keeps the file's lines for retry — red/green test"
  - "[ ] message_end resolves without awaiting queued persistence; a seeded retention failure still warns at agent_end and shutdown — red/green test"
  - "[ ] Each new test mutation-checks red (break guard / batch / decouple → fail)"
  - "[ ] Fresh omp log across a working restarted session shows no 'Extension handler timed out' for message_end"
completed_at: null
completed_by: null
---

# Phase 1: token-attribution `message_end` timeout

## Context
Parent goal (inherited): Buck Workflow sessions run without extension timeouts, the repository typechecks clean under Bun, and the release command fails closed. This phase fixes the user-reported `message_end` timeout.

Measured mechanism (research): `AttributionDatabase.insertReconciled` performs ~7 serialized store ops; `FileStorageStore` re-loads and JSON-parses the 61 MB manifest inside every locked op (~183 ms measured). `scanSessionArtifacts` inserts per line. `message_end` awaits `ledger.flush()` plus the process-global `flushConfiguredRetains()` tail shared with other extension writers. Only two `message_end` handlers exist; tps-tracker is counter-only — token-attribution is the blocking handler.

**A2 (deferred assumption, this phase validates):** `message_end` may stop awaiting persistence if failures still surface via `agent_end`/`session_shutdown` warnings (existing, tested convention). Validation path: wire tests assert a seeded persistence failure warns at flush points; shutdown-drain test stays green.

## Implementation Details
1. Red: wire-harness test — second `insert` of an unchanged record performs zero store writes (spy on `commitConsumerBatch`) and returns `false`.
2. Green: `insertReconciled` skips write/commit/correct/readback when `current` exists and bytes equal the retained record, then still calls `this.project(retained, fallbackEntryKey)` before returning `false`.
3. Red: ingest test — `scanSessionArtifacts` over N delivered lines issues one `commitConsumerBatch` per file, not per line; failure keeps the file's lines for retry.
4. Green: batch deliveries per file (dedupe by entryKey, preserve alias writes and cursor-remainder retry).
5. Red: wire test — `message_end` resolves without awaiting queued persistence; a seeded retention failure still warns at `agent_end` (and shutdown).
6. Green: `message_end` enqueues (insert + scan) and returns; keeps `persistIdentity` inline (cheap, ordered). `agent_end`/`session_shutdown` keep flush + warning behavior.
7. Mutation-check each new test (break guard/batch/decouple → red).
8. Live proof: restart the OMP session, run a normal turn, confirm zero `message_end` timeouts in the new omp log. If timeouts persist → open the file-store memoization plan (contingency, out of scope here).

## Risks
- Store-behavior changes could break attribution dedup/reconciliation — bounded by existing wire/ingest/db suites plus the new red tests.
- Batching artifact-scan writes changes failure granularity (whole-file retry instead of per-line) — preserve cursor-remainder retry semantics in the red test.
- Decoupling `message_end` could hide persistence failures until later — mitigated by flush-point warnings (A2) and the existing shutdown-drain test.

## Verification
Targeted red/green vitest suites (`__tests__/wire.test.ts`, `__tests__/ingest.test.ts`); `bun run guardrails:check`; live restart log grep for `handler timed out`.

## Per-Phase Execution Loop
1. Run `/b-build-hard` for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. Out-of-plan issues (new scope) do not iterate — route to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If review flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save`.
5. Run `/b-commit`.
6. If incomplete, leave `status: in-progress` for resume.
