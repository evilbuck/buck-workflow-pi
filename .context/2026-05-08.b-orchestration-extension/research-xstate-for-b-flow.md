---
status: active
date: 2026-05-08
subject: 2026-05-08.b-orchestration-extension
topics: [xstate, state-machine, actors, guards, persistence, orchestration]
informs: [plan-b-flow-mvp.md]
---

# Research: XState for Buck Workflow Orchestration

## Summary

XState v5 is a strong fit for the Buck orchestration extension. It provides exactly the primitives needed for a durable guarded workflow loop: typed states/events/context, guarded transitions, actions, invoked actors for async work, spawned actors for workers, and persisted actor snapshots for restore/resume.

Recommended use: use XState as the **supervisor state machine**, with Pi subprocess/RPC workers represented as invoked promise/callback actors. Keep durable Buck artifacts (`.context/**`) as source of truth; use XState persisted snapshots as runtime/control-plane state.

## Key Findings

### Guards

XState supports guarded transitions. In v5, guards use `guard`, not v4 `cond`.

- Guards should be pure and synchronous.
- Best use: check facts already loaded into machine context.
- Do not run async file scans or model calls directly inside guards.
- For our use case: build a `TransitionContext` snapshot first, assign it into machine context, then guards route based on it.

### Actions

Actions are fire-and-forget effects.

- Good for logging, assigning context, writing small runtime state, sending events.
- Async actions are not awaited before the transition continues.
- Therefore: do not put worker subprocess execution in an action if later routing depends on the result.
- Use invoked actors for awaited async work.

### Invoked actors

XState can invoke actors from a state. Invoked actors start when the state is entered and stop when the state exits.

Useful actor types for Buck:

- `fromPromise(...)` for one-shot async tasks:
  - scan artifacts
  - evaluate model classifier
  - spawn worker and await result
  - write/read worker result file
- `fromCallback(...)` for long-running worker process with progress events:
  - stream worker status
  - support cancellation/abort
  - send progress events back to supervisor

### Persistence

XState v5 supports persisted actor snapshots and restore via `createActor(machine, { snapshot })`.

This maps well to:

```text
.context/workflow/orchestration.snapshot.json  # XState runtime snapshot
.context/workflow/orchestration.json           # human-readable Buck state projection
```

Caveat: external OS subprocesses are not truly resumable just because the actor snapshot is persisted. On restore, the supervisor must reconcile:

- `active_worker.pid` still alive?
- result file exists?
- queue item stuck as `running`?
- mark stale worker as `blocked` or recover by retrying.

### Actors model

XState actors map naturally to this architecture:

```text
root actor: b-flow supervisor
invoked actor: scan transition context
invoked actor: model guard/classifier
invoked actor: worker subprocess for one chunk
invoked actor: verification/result parser
```

This is a better fit than hand-rolled `if/else` state because it gives explicit lifecycle, cancellation, onDone/onError transitions, and typed events.

### Package impact

Current latest npm version checked: `xstate@5.31.0`, unpacked size about 2.3 MB, no listed dependencies from `npm view`.

Adding it as a runtime dependency is reasonable for this package if we implement `/b-flow` as a real extension feature.

## Recommended Architecture

Use XState for the orchestration engine, but not for every Buck artifact detail.

```text
extensions/b-flow/
├── index.ts              # wire(pi), command registration
├── machine.ts            # XState machine definition
├── types.ts              # BuckState, events, context, guard/result types
├── persistence.ts        # save/load snapshot + projection JSON
├── scan.ts               # build TransitionContext from .context + git
├── worker.ts             # spawn Pi worker subprocess/RPC actor
├── routes.ts             # command/action mapping
└── render.ts             # status / human summaries
```

## Suggested Machine Shape

```ts
const bFlowMachine = setup({
  actors: {
    scanContext: fromPromise(buildTransitionContext),
    evaluateModelGuard: fromPromise(evaluateAmbiguousTransition),
    runCommand: fromPromise(runBuckCommand),
    runWorker: fromPromise(runWorkerForChunk),
    verifyResult: fromPromise(verifyStateResult),
  },
  guards: {
    hasPendingPhase: ({ context }) => Boolean(context.snapshot.artifacts.activePhase),
    shouldPhasePlan: ({ context }) => context.snapshot.planSignals.shouldPhase === true,
    reviewPassed: ({ context }) => context.snapshot.review.passed === true,
    needsModelDecision: ({ context }) => context.route?.confidence < 0.8,
    underLoopLimit: ({ context }) => context.safety.loopCount < context.safety.maxLoops,
  },
}).createMachine({
  id: 'bFlow',
  initial: 'idle',
  states: {
    idle: { on: { START: 'scanning' } },
    scanning: {
      invoke: {
        src: 'scanContext',
        onDone: { target: 'routing', actions: 'assignSnapshot' },
        onError: { target: 'blocked', actions: 'assignError' },
      },
    },
    routing: {
      always: [
        { guard: 'needsModelDecision', target: 'modelEvaluating' },
        { guard: 'underLoopLimit', target: 'executing' },
        { target: 'blocked' },
      ],
    },
    modelEvaluating: {
      invoke: {
        src: 'evaluateModelGuard',
        onDone: { target: 'executing', actions: 'assignRoute' },
        onError: { target: 'askUser' },
      },
    },
    executing: {
      invoke: {
        src: ({ context }) => context.route.action.type === 'spawn-worker' ? 'runWorker' : 'runCommand',
        onDone: { target: 'verifying', actions: 'assignExecutionResult' },
        onError: { target: 'blocked', actions: 'assignError' },
      },
    },
    verifying: {
      invoke: {
        src: 'verifyResult',
        onDone: [
          { guard: 'isDone', target: 'done' },
          { target: 'scanning', actions: 'incrementLoop' },
        ],
        onError: { target: 'blocked', actions: 'assignError' },
      },
    },
    askUser: {},
    blocked: {},
    done: { type: 'final' },
  },
});
```

Exact syntax may differ during implementation, but the concept is sound.

## Fit Assessment

### Good fit

- Guarded transitions with ordered fallback routes.
- Invoked async actors for scans, classifiers, commands, and workers.
- onDone/onError paths for worker success/failure.
- Persist/restore supervisor state across Pi reloads/restarts.
- Better observability/debuggability than a custom loop.
- Strong TypeScript types for events/context/actors.

### Caveats

- Guards must stay pure; async/model checks must be actors before routing.
- External subprocess resume requires manual reconciliation.
- Adds a runtime dependency.
- XState learning curve may make simple flows feel heavier.
- Need to avoid encoding too much business logic in the machine graph; keep artifact scanning/routing helpers separate and testable.

## Recommendation

Use XState v5 for `/b-flow`.

Design principle:

```text
XState controls lifecycle and routing.
Buck artifacts control truth.
Pi workers perform work.
```

Implement MVP with XState if we are serious about autonomous looping. If we only wanted `/b-flow next`, hand-rolled would be enough. Because the target is a durable subagent loop with guards, retries, blocking, worker lifecycle, and persistence, XState is worth the dependency.
