# Observably invoked happy-path loop runner

Deprecated XState `b-flow` is unwired because hidden orchestration is dead weight. We still need an unattended mini-cycle for an existing Buck plan. `/buck-loop` is that runner: a hand-rolled transition table, nested isolated sessions, artifact truth, and closed-set model choices. `/skill:b-loop` stays the advisory stamper.

## Decision

Ship `extensions/buck-loop/` as an explicit `/buck-loop` command. The operator supplies a plan, phase, or subject path (or `--resume` / `--status` / `--stop`). Every user-visible hop is either a deterministic disk/git check or a machine-validated legal enum. Nested workers cannot recurse (`disableExtensionDiscovery`) and cannot choose the next state.

## Considered Options

- Restore XState `b-flow`: rejected. Snapshot restore re-invokes actors; unguarded arms skip scan results; the classifier never called a model.
- Another FSM library: rejected. Same opacity, new dependency. The table is a pure function like `code-review-iteration/loop.ts`.
- Hidden main-session injection (`before_agent_start`): rejected. That was the 2026-06-01 failure mode.
- Expand `/skill:b-loop` into a runner: rejected. That skill stamps `omp_execution`; mixing runner and stamper would steal `/b-loop` and hide invocation.

## Consequences

- Invocation is observable: `/buck-loop`, not a side-effect of chat.
- `.context/workflow/buck-loop.json` is a projection. Artifacts win on resume.
- Retries and counters are bounded. Illegal model output blocks instead of advancing.
- `extensions/b-flow/` stays on disk, unwired. Deletion is a later pass.
- The runner does not auto-plan, auto-phase, parallelize phases, or enable OMP `orchestrate` / `workflow` / `/goal set`.
