# State machine

A synchronous state machine whose states, edges, guards, effects, and operator moves are declared together. The library in `index.ts` has no imports or import-time effects. Copy this folder into another project to use it; it has no runtime dependencies. The behavior tests use Vitest as a development dependency.

## Vocabulary

| Term | Meaning |
| --- | --- |
| `initial` | The one state where `start()` begins. |
| `final` | A state where a run may legally end. It may still have targets, and the initial state may be final. |
| `targets` | The declared edges out of a state. Each row is `{ name, guard?, effect?, manual? }`; `name` is the destination. There is at most one row per source/destination pair. `[]` means no outgoing edges. |
| `guard` | A pure, synchronous `(facts) => boolean` on an edge. Returning `true` allows the move. An edge without a guard is allowed. |
| `manual` | An operator-only edge. `available()` excludes it; a caller may name it explicitly in `transition()`. |
| `effect` | A synchronous `(facts) => Effect` describing work as data. The caller executes the returned description. |
| `facts` | Caller-owned data about the world, supplied anew for each call. The machine reads facts without storing them. |

Every state declares `targets`. Definition validation rejects undeclared targets, duplicate edges, unreachable states, states with no targets that are not final, and graphs with no final state. Reachability checks the static graph, including manual edges, without evaluating guards.

## Definition and instance

`defineMachine<Facts, Effect>()(config)` validates the graph once and returns a `MachineDefinition`. State names are inferred from the keys in `states`, so TypeScript rejects misspelled initial states and target names. The definition has no current state.

`definition.start()` returns a `MachineInstance` at `initial`. Each instance owns its own `state`; creating or moving one instance does not move another. `instance.isFinal` says whether the run may end at its current state, and does not prevent further transitions.

```typescript
import { defineMachine } from "./index.js";

const job = defineMachine()({
  initial: "ready",
  states: {
    ready: { targets: [{ name: "done" }] },
    done: { final: true, targets: [] },
  },
});

const run = job.start();
run.available(); // ["done"]
run.transition("done"); // { from: "ready", to: "done", effect: undefined }
run.isFinal; // true
```

Machines without facts use `available()` and `transition(to)`. With `Facts`, pass the facts to `available(facts)` and `transition(to, facts)`.

The definition also exposes `targets(state)` for all declared target names, `isFinal(state)`, and `edge(from, to)` for an edge's guard, effect, and manual flag. These describe the graph; they do not select or execute a move.

## The caller chooses a policy

`instance.available(facts)` returns non-manual targets whose guards pass, in declaration order. It does not move the instance or evaluate effect functions.

| Available targets | Caller policy |
| --- | --- |
| One | The caller may transition to that target. |
| Many | The caller may ask for a choice, apply its own selection policy, or reject ambiguity. The module does not pick one. |
| Zero | The caller may finish if the state is final, wait for new facts or an operator action, or report a routing failure. Zero alone does not mean the run is complete. |

An adapter that requires exactly one automatic route must enforce that rule itself. Guards may overlap. `transition(to, facts)` always checks the edge and its guard again, including when a target came from an earlier `available()` call.

## Effects are data

Effects describe work; guards and effect functions should not perform it. For example, an effect can return `{ kind: "rev-match", rpm: 3150 }`, which an outer interpreter logs, persists, or executes.

`transition()` checks that the edge exists, evaluates its guard, describes its effect, and then changes the instance state. It returns `{ from, to, effect }`, with `effect: undefined` when the edge has none. A missing edge, rejected guard, or throwing guard/effect function leaves the current state unchanged. Errors thrown by guard/effect functions propagate to the caller.

The caller owns asynchronous work, retries, and failure handling. After a successful transition, the caller can persist the new state before executing the effect. If execution fails, the instance has already moved; the caller decides how to recover.

## Operator moves

Declare START, STOP, or resume moves with `manual: true`. They are never offered by `available()`, so a loop using that method cannot select them automatically. For a declared manual edge to `aborted`, the operator's handler calls `transition("aborted", facts)` explicitly.

Manual edges can also have guards. A resume edge guarded by `(facts) => !facts.limitReached` still rejects `transition("working", facts)` while the limit is reached. Manual status only affects discovery; it does not bypass guards.

**DEFERRED:** An opt-in such as `available(facts, { includeManual: true })` could expose guarded operator options for a UI. It is not implemented. The default exclusion of manual edges must remain unchanged.

## Restore persisted state

Persist the state name, then reconstruct the instance from the same definition:

```typescript
const restored = job.restore("ready");
restored.state; // "ready"
```

`restore(state: string)` validates an untrusted name and throws `UnknownStateError` if it is undeclared. Restoring does not run guards or effects, or replay transitions. Facts and effect execution remain the caller's responsibility.

## Errors and public types

| Error | When it is thrown | Details |
| --- | --- | --- |
| `InvalidMachineError` | Definition validation fails. | `problems`: the validation problems. |
| `UnknownStateError` | `restore()` receives an undeclared state name. | `state`: the supplied name. |
| `IllegalTransitionError` | `edge()` or `transition()` names a missing edge, or a transition guard rejects the move. | `from`, `to`, and `reason`: `"not-a-target"` or `"guard-rejected"`. |

The module exports `defineMachine`, `MachineInstance`, these error classes, and the `MachineDefinition`, `Transition`, `Guard`, and `EffectOf` types.

## Runnable example

From the repository root:

```sh
bun extensions/state_machine/examples/transmission.ts
```

Expected standard output:

```text
[ "third" ]
[ "third", "first" ]
blip throttle to 3150 rpm
tick: []
after stop: aborted
```

The [example](examples/transmission.ts) demonstrates a guarded downshift, an effect interpreter, restoring an instance, and a cut-down loop whose STOP edge is hidden from automatic routing.

Run the module's behavior tests from the repository root with `npx vitest run extensions/state_machine`. Type-check with `npx tsc --noEmit -p .`.
