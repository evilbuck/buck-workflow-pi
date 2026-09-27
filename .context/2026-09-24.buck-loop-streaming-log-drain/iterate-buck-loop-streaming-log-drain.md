---
status: active
date: 2026-09-25
updated: 2026-09-25
subject: 2026-09-24.buck-loop-streaming-log-drain
topics: [review, iteration]
informs: []
addresses: plan-buck-loop-streaming-log-drain.md
completed: null
from_review: b-review
---

# Iteration: buck-loop-streaming-log-drain

## Source
- Reviewed after: `/b-build`
- Plan: `plan-buck-loop-streaming-log-drain.md`
- Spec: none

## Critical Issues

### 1. Live-drain test fails the deterministic unit gate
- **File**: `extensions/buck-loop/__tests__/wire.test.ts:45-56`
- **Problem**: The paused-supervisor test polls at most 20 `setImmediate` turns for the asynchronous `createWriteStream` open/write. In the required `npm run guardrails:check` run, it failed to observe the activity record; 1 of 1,010 unit tests failed. The check cannot pass on this implementation. The isolated write path is asynchronous; a fixed turn count does not bound filesystem scheduling time.
- **Proposed fix**: Await the real observable activity line with a bounded wall-clock deadline and ensure the supervisor gate is released and the pending handler awaited in test cleanup even on assertion failure. Keep the pre-settlement assertion. Then rerun the full deterministic contract.

### 2. Supervisor exception records an idle terminal state
- **File**: `extensions/buck-loop/index.ts:166-180,294-299`
- **Problem**: `supervisorFailure` defaults to `idle` if a start fails before a projection exists. The new catch path logs `{type:"terminal",state:"idle",ok:false}` rather than the plan's synthesized blocked/aborted terminal result. Consumers reading the JSONL receive a success-looking idle state for a failed invocation.
- **Proposed fix**: Use a failure terminal state (`blocked` or `aborted`) when saved state is not already one, preserving the original failure reason; exercise the pre-projection throw in a command-surface test and assert the terminal record.

## Warnings

### 1. Serialized callback queue grows without bound under text-delta pressure
- **File**: `extensions/buck-loop/activity-log.ts:119-137`
- **Problem**: Each activity allocates and chains a Promise that starts its `stream.write` only after the previous write callback. If deltas arrive faster than filesystem callbacks, arbitrarily many records remain in memory; the stream's `write()` backpressure signal is never used. This misses the plan's streaming-I/O-pressure mitigation and can delay terminal flush substantially.
- **Suggested approach**: Write to the open stream immediately in callback order; track a bounded backpressure/flush condition using `write()`/`drain` and `finish`, disabling the sink once on errors without rejecting the loop. Test a burst/slow-writer case and terminal close.

### 2. Hygiene failure and writer failure can warn twice
- **File**: `extensions/buck-loop/activity-log.ts:92-105,111-117`
- **Problem**: A failed Git hygiene operation emits `options.onWarning` directly, bypassing `warnOnce`. A subsequent asynchronous stream-open failure emits a second warning for the same invocation, violating the one-visible-warning contract.
- **Suggested approach**: Route both failures through the same one-warning mechanism while leaving logging available in non-Git workspaces.

## Verification
- `npm run guardrails:check`: durable v2 **fail**; unit gate failed on the live-drain test; complexity gate failed on unrelated dirty `extensions/buck-models/model-picker.ts` (`handleInput` 16) and `extensions/buck-models/index.ts` (`runCommand` 11). Global coverage ratchet passed (87.2% vs 84%); patch advisory, functional and lint skipped. The unrelated complexity violations need their owner's correction or an explicit user override before completion; do not weaken the contract.
- Earlier build memory reported 16 focused tests passed, but the present full-suite result is authoritative for this review.

## Iteration result — 2026-09-25

- Critical 1 addressed: the live-read assertion polls for the actual JSONL activity with a three-second wall-clock deadline; `finally` releases the supervisor gate and awaits the handler before deleting the temporary directory.
- Critical 2 addressed: supervisor exceptions synthesize `blocked`, preserving `aborted` only when already saved; the original error remains the terminal reason. Added the pre-projection exception regression.
- Warning 1 addressed: records write immediately in order, without a per-record Promise chain. Node write/drain backpressure is tracked; pending bytes are capped at 1 MiB. Overflow disables only the drain. `finished()` owns idempotent close, including errors. Burst-order/terminal and overflow tests pass.
- Warning 2 addressed: hygiene and asynchronous writer failures share `warnOnce`; a combined-failure regression passes.
- Focused suite: 20 tests passed. Real `tail -F` smoke observed activity before terminal/close, then verified terminal flush and resume append with no warnings. Temporary smoke files removed.
- Final durable guardrails: unit gate pass; coverage 87.5% versus 84% baseline; lint/functional skipped; patch advisory. Required complexity gate remains failed solely on unrelated pre-existing `buck-models` changes (`handleInput` 16, `runCommand` 11). Those files were not changed or staged by this iteration.
- Status remains active, `completed: null`: fixes are ready for supervisor review, but full-contract completion is blocked. No loop-state selection or commit performed.

## Recommended Workflow

Start with `/b-iterate` — it will pick up this file automatically. Then re-run `/b-review` against the same plan. Inside an OMP execution session, the iterate artifact is not done until it is completed, review passes, and `/b-save` has recorded durable state. For larger rework, use `/b-build` or `/b-build-hard`.
