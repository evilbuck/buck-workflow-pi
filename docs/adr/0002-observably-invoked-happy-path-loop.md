# Observably invoked happy-path loop runner

Deprecated XState `b-flow` is unwired because hidden orchestration is dead weight. We still need an unattended mini-cycle for an existing Buck plan. `/buck-loop` is that runner: a Buck-specific workflow definition over an internal pure evaluator, nested isolated sessions, artifact truth, and closed-set model choices. `b-plan` recommends `omp_execution`; `b-phase` writes it on new phases. The advisory stamper skill (`/skill:b-loop`) was removed 2026-09-20.

## Decision

Ship `extensions/buck-loop/` as an explicit `/buck-loop` command. The operator supplies a plan, phase, or subject path (or `--resume` / `--status` / `--stop`). `extensions/buck-loop/machine.ts` owns the Buck workflow declaration: states, facts, guards, edges, effects, operator moves, retry limits, and priority. It uses the domain-neutral `extensions/state_machine/` module for graph validation and synchronous guard/effect evaluation; the Buck adapter enforces its exactly-one-route and bounded-choice policies. The Buck supervisor remains the sole interpreter of effects and owner of scanning, persistence, model calls, nested sessions, clocks, retries, and durable blocking. Every user-visible hop is therefore either a deterministic disk/git check or a machine-validated legal enum. Nested workers cannot recurse (`disableExtensionDiscovery`, empty extensions/skills/prompts).

`extensions/code-review-iteration/machine.ts` is the module’s second production consumer. Its review-loop supervisor retains git, model, artifact, resume, and terminal-report effects; its adapter owns exactly-one-route policy. The portable module owns only the declared graph, each instance’s current state, and synchronous transitions. One engine before, one engine after: both consumers share `extensions/state_machine/`, with no legacy evaluator or compatibility path.

## Considered Options

- Restore XState `b-flow`: rejected. Snapshot restore re-invokes actors; unguarded arms skip scan results; the classifier never called a model.
- Another FSM library: rejected. Same opacity, new dependency. The internal module validates a graph and evaluates pure guards and effect descriptions; it does not supply actors, async orchestration, persistence, retries, or effect execution.
- Hidden main-session injection (`before_agent_start`): rejected. That was the 2026-06-01 failure mode.
- Expand the advisory stamper skill into a runner: rejected. Mixing runner and stamper would hide invocation. The stamper skill was later removed (2026-09-20).

The module seam does not reverse these rejections. It is a synchronous graph evaluator, not XState, an actor system, a generic async supervisor, or an effect runner. `extensions/b-flow/` was removed 2026-09-20.

## Consequences

- Invocation is observable: `/buck-loop`, not a side-effect of chat.
- `.context/workflow/buck-loop.json` is a projection. Artifacts win on resume.
- Retries and counters are bounded. Illegal model output blocks instead of advancing.
- `extensions/b-flow/` was removed 2026-09-20. `xstate` is no longer a dependency. `/skill:b-loop` was removed the same day.
- The runner does not auto-plan, auto-phase, parallelize phases, or enable OMP `orchestrate` / `workflow` / `/goal set`.
