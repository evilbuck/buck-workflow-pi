---
date: 2026-05-09
domains: [debugging, testing, orchestration]
topics: [b-flow, xstate, worker-subprocess, persistence, subject-detection]
subject: 2026-05-08.b-orchestration-extension
artifacts: [spec-b-flow-state-machine.md, phase-4-ui-commands-tests.md]
related: [b-flow-mvp-2026-05-09.md, b-orchestration-extension-2026-05-08.md]
priority: high
status: completed
---

# Session: 2026-05-09 - b-flow start/status debugging

## Context
- User reported `/b-flow start` appeared to launch something but never finished, and `/b-flow status` showed no useful active state.
- Relevant previous memory said live worker subprocess and snapshot restore were still unverified.

## Findings
- XState v5 invoked actors were wired as raw functions returning promises/machines; they must be wrapped with `fromPromise(...)`. This caused scan/queue actors to fail or hang instead of completing normally.
- The child chunk queue machine started in `idle` and no `START_QUEUE` event was sent by the parent, so execution could stall before building a queue.
- The scan result found phase/plan artifacts but the parent context never inferred/persisted the subject folder, so worker queue building could see `subject: null` and produce no chunks.
- `/b-flow status` depended only on projection files; projection/snapshot persistence was not kept current while the actor was sitting in an active state.

## Changes Made
- `extensions/b-flow/machine.ts`
  - Wrapped scan/classifier/chunk queue actors with `fromPromise(...)`.
  - Added subject inference from scanned artifact paths and persisted it into machine projection.
  - Wrapped the child queue actor and resolved parent output from final child context when snapshot output is absent.
- `extensions/b-flow/chunk-queue-machine.ts`
  - Wrapped buildQueue/runWorker/verifyResult actors with `fromPromise(...)`.
  - Auto-transitions from `idle` to `buildingQueue` when invoked.
- `extensions/b-flow/index.ts`
  - Subscribes to actor snapshots and writes projection + persisted XState snapshot.
  - Restores from persisted snapshot when available.
  - Makes `/b-flow status` read live actor state before disk projection.
  - Clarifies `/b-flow start` message: start initializes; `/b-flow run` executes queued chunks.
- `extensions/b-flow/__tests__/integration.test.ts`
  - Added regression test with a fake `pi` subprocess proving `START -> decomposing -> CONTINUE -> reviewing` completes one queued phase and writes worker output.

## Verification
- Passed: `npx tsx --test extensions/b-flow/__tests__/integration.test.ts extensions/b-flow/__tests__/guards.test.ts` (15/15).
- `npx tsc --noEmit` still fails on pre-existing unrelated issues in `extensions/grill-me-dialog.ts` and `extensions/tmux-window-status.test.ts`; no b-flow TypeScript errors remain.

## Next Steps
- Live-test `/b-flow start`, `/b-flow status`, `/b-flow run` inside Pi after package reload/install.
- Continue Phase 4 gaps: confirmation UI, footer status widget, full review/save lifecycle events.
