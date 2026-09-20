# Observably invoked happy-path loop runner

Deprecated XState `b-flow` is unwired because hidden orchestration is dead weight. We still need an unattended mini-cycle for an existing Buck plan. `/buck-loop` is that runner: a Buck-specific workflow definition over an internal pure evaluator, nested isolated sessions, artifact truth, and closed-set model choices. `/skill:b-loop` stays the advisory stamper.

## Decision

Ship `extensions/buck-loop/` as an explicit `/buck-loop` command. The operator supplies a plan, phase, or subject path (or `--resume` / `--status` / `--stop`). `extensions/buck-loop/machine.ts` owns the Buck workflow definition: states, facts, guards, choices, events, effects, retry limits, and priority. It delegates synchronous route selection and fail-closed validation to the domain-neutral `extensions/state-machine.ts` evaluator. The Buck supervisor remains the sole interpreter of effects and owner of scanning, persistence, model calls, nested sessions, clocks, retries, and durable blocking. Every user-visible hop is therefore either a deterministic disk/git check or a machine-validated legal enum. Nested workers cannot recurse (`disableExtensionDiscovery`) and cannot choose the next state.

`extensions/code-review-iteration/machine.ts` is the evaluator's second production consumer. Its review-loop supervisor retains git, model, artifact, resume, and terminal-report effects; the shared evaluator owns only synchronous lifecycle route selection.

## Considered Options

- Restore XState `b-flow`: rejected. Snapshot restore re-invokes actors; unguarded arms skip scan results; the classifier never called a model.
- Another FSM library: rejected. Same opacity, new dependency. The internal evaluator selects among pure rules; it does not supply actors, async orchestration, persistence, retries, or effect execution.
- Hidden main-session injection (`before_agent_start`): rejected. That was the 2026-06-01 failure mode.
- Expand `/skill:b-loop` into a runner: rejected. That skill stamps `omp_execution`; mixing runner and stamper would steal `/b-loop` and hide invocation.

The evaluator seam does not reverse these rejections. It is an internal synchronous decision evaluator, not XState, an actor system, a generic async supervisor, or a reusable effect runner. `extensions/b-flow/` remains deprecated and unwired.

## Consequences

- Invocation is observable: `/buck-loop`, not a side-effect of chat.
- `.context/workflow/buck-loop.json` is a projection. Artifacts win on resume.
- Retries and counters are bounded. Illegal model output blocks instead of advancing.
- `extensions/b-flow/` stays on disk, unwired. Deletion is a later pass.
- The runner does not auto-plan, auto-phase, parallelize phases, or enable OMP `orchestrate` / `workflow` / `/goal set`.
