---
date: 2026-09-25
domains: [extensions, testing, docs]
topics: [buck-loop, activity-log, jsonl, streaming]
related: [.context/2026-09-24.buck-loop-streaming-log-drain/plan-buck-loop-streaming-log-drain.md]
priority: medium
status: active
subject: 2026-09-24.buck-loop-streaming-log-drain
artifacts: [plan-buck-loop-streaming-log-drain.md, draft-commit.md, iterate-buck-loop-streaming-log-drain.md]
---

# `/buck-loop` streaming activity-log build

Implemented the version-1 local JSONL drain at `.context/workflow/buck-loop.log.jsonl`.

- `start` truncates and `resume` appends an invocation record; `status` and `stop` receive a no-op handle.
- The command boundary fans progress, normalized activity, synthetic failure activity, and terminal state to the existing six-row widget and the drain in the same callback order.
- The writer maintains one stream per invocation, flushes before terminal UI state, awaits closure in `finally`, locally ignores the runtime file, and degrades to one warning plus a no-op drain on I/O setup/write/close errors.
- Added unit and command-surface tests, including a paused supervisor that proves an activity JSONL record becomes readable before settlement. Added the operator `tail -F` how-to.

## Verification

- Passed: `npx vitest run extensions/buck-loop/__tests__/activity-log.test.ts extensions/buck-loop/__tests__/wire.test.ts --reporter=verbose` — 16 tests.
- Passed: `npx vitest run --coverage --coverage.reporter=lcov` — 67 files, 1,010 tests.
- `npm run guardrails:check` failed twice after a coherent re-run. Unit tests pass, but the runner reports its coverage subprocess exits 1 without its output; it therefore fails `global_ratchet`. It also fails `complexity_gate` on pre-existing, unrelated dirty files: `extensions/buck-models/model-picker.ts` `handleInput` (16) and `extensions/buck-models/index.ts` `runCommand` (11). The coverage command itself passes standalone; no guardrail or source weakening was applied.
- `npx tsc --noEmit` remains repository-red on pre-existing test and runtime errors. It initially surfaced two target-related `Promise.withResolvers` errors because the configured TypeScript target does not include ES2024; the implementation uses compatible Promise executors instead. The full compiler result also contains unrelated existing errors in `buck-loop` model tests, other extensions, and Bun scripts.

## Review iteration — 2026-09-25

Addressed both critical findings and both warnings in the iteration artifact. The real-filesystem visibility test now waits for an observable record with a wall-clock deadline and always releases/awaits its paused supervisor. Supervisor exceptions produce a blocked terminal result unless saved state is already aborted.

Replaced the unbounded per-record Promise queue with immediate ordered stream writes, write/drain pressure tracking, and a 1 MiB pending-byte ceiling. Overflow disables the drain rather than retaining arbitrary model output; the loop/widget continue. Hygiene and I/O failures share one warning budget. Close awaits stream completion idempotently. The operator how-to documents possible incomplete output when disabled.

Verification after fixes: 20 focused tests passed. A throwaway real `tail -F` process observed activity before terminal/close; terminal flush and resume append also passed, with no warnings. Smoke script and temporary repository removed. Final durable guardrails unit gate passed; coverage 87.5% against 84%; lint/functional skipped and patch advisory. Required complexity gate still fails only on unrelated pre-existing `buck-models/model-picker.ts` `handleInput` (16) and `buck-models/index.ts` `runCommand` (11).

Files modified by iteration: `extensions/buck-loop/activity-log.ts`, `extensions/buck-loop/index.ts`, both activity-log/wire test files, `docs/howto/watch-buck-loop-activity.md`, subject iteration/draft artifacts, this memory, and the streaming-log backlog item. Existing memory-index entry remains valid; unrelated session pointer and memory-index edits were preserved.

The iteration remains active pending supervisor review and resolution of the unrelated required gate. No authority exercised over next loop state; no commit made.
