# General Ideas

This document is a scratchpad for when I come up with ideas for the project.
All should be fleshed out. This is not work that has been approved.

> **Answered inline 2026-09-19.** Skipped: Q4 (model routing — answered, buck-loop routes by phase difficulty via `extensions/omp-models.ts`) and Q7 (idempotency — locked plan under `.context/2026-09-19.chooser-block-determinism/`).

## Build an "advisor" for the buckloop.
Can the sdk support an advisor to any running sdk agent natively? If not, can we emulate or straight up copy the existing advisor functionality to mimic with an sdk agent?

**Answer:** Not native in the Pi SDK (`@mariozechner/pi-coding-agent` 0.73.1) — zero `advisor` matches, and `CreateAgentSessionOptions` (`dist/core/sdk.d.ts:15-46`) has no advisor/observer field. But the **omp fork has a full native advisor system**: `src/advisor/` (advise-tool.ts, config.ts, runtime.ts, session-advisors, watchdog) wired into `AgentSession` (`src/session/agent-session.ts:519,1489-1541`). Advisors are discovered from `WATCHDOG.yml` (`AdvisorConfig {name, model?, tools?, instructions?, enabled?}`), expose an `advise()` tool with `{note, severity: nit|concern|blocker}` — concern/blocker steer the running agent, nit rides the aside queue. The pattern to copy for a Pi-SDK-native advisor is `AdvisorAgent` in `runtime.ts:42-49`: just `{prompt, abort, reset, rollbackTo?, state.messages}` — a second agent driven over a transcript snapshot. Since buck-loop children run with `disableExtensionDiscovery: true`, we'd build our own advisor AgentSession alongside the worker, feed it the same subscribed events, and let it steer via follow-up prompts.

## Abstract SDK agent interface
We may want to add functionality, like above advisor role, for sdk agents. It would be nice to automatically inherit this for all work.

**Answer:** buck-loop already touches a minimal session surface — abstracting it is cheap. The interface in use (`extensions/buck-loop/run-step.ts:124-130, 191-216`; `choice.ts` via `runOmpModelSession` in `extensions/omp-models.ts:200-277`) is:

```ts
{ prompt(text), abort(), subscribe(cb), dispose?(), messages }
```

Config axes: cwd, agentDir, model/modelPattern, thinkingLevel, tool allowlist (`toolNames` + `restrictToolNames`), `disableExtensionDiscovery`, `enableMCP`, `enableLsp`, in-memory vs persistent session, timeout, temperature, activity callback. Wrapping this in `{ create(opts): SessionHandle }` would let advisor/telemetry/decorator layers compose around every work session (and choice sessions) without touching run-step/choice call sites.

## Look into telemetry support for sdk agents
What do we get for free? Do we need to wire in our own telemetry?

**Answer:** For free: a rich event stream — `session.subscribe(listener)` gives `agent_start/end`, `turn_start/end`, `message_*`, `tool_execution_*`, compaction, auto-retry events; `session.getSessionStats()` gives tokens/cost/toolCalls/contextUsage; `ExtensionAPI.on(...)` gives the same plus mutable `tool_call`/`before_provider_request` hooks. **Not free:** no OTEL exporter, no metrics sink, no logs, no traces — the only shipped "telemetry" is `isInstallTelemetryEnabled()` (opt-out install ping). If we want real telemetry we wire it ourselves on the existing `subscribe()` boundaries: spans per agent/turn/tool (pair start/end by `toolCallId`), token+cost accumulation from the `done` message's `usage` or `getSessionStats()`. Buck-loop already subscribes for the widget; instrumentation is additive.

## buck-loop
Model routing for sdk agents. Does it happen already? How does it happen?

> Already answered — see session memory / `extensions/omp-models.ts`: buck-loop routes by phase difficulty (easy → smol→tiny→task, medium → slow→task, hard → default→plan→slow, fallback default), via the Settings API model roles.

**Configuration** - we should allow an easy interface for configuring the models. Use roles for a good set of defaults.

> **Answered:** OMP reads `modelRoles` from project/global `config.yml`; legacy Pi `buckModelMapping` is only a fallback. Difficulty-to-role priority is fixed in `extensions/omp-models.ts`; the remaining gap is a per-skill model override.

## buck-loop progress 
Why do we get progress that looks like
```
 buck-loop — Building plan-subject-work-state.md
 ▸ edit
 ✓ edit
 ▸ edit
 ✓ edit
 ▸ edit
 ✓ edit
```
```
```

**Answer:** This was addressed by the shared activity renderer. `createActivity()` now renders tool targets (`▸ tool → target`), tool failures, retry messages, and completion state; `/buck-loop` keeps a six-row viewport with a 64-character line cap. Consecutive identical operations are still separate events rather than a counted aggregate.

## buck-loop is it idempotent?

> Answered — locked plan + idempotency audit in `.context/2026-09-19.chooser-block-determinism/` and `.context/2026-09-19.ideas-questions/research-buck-loop-idempotency.md`. Short version: state machine, resume, counters, and choice audits are idempotent; step retry re-firing, non-atomic projection write, and the context-free chooser are the three gaps.

## buck-loop
we have a built-in iterate limit. We should prompt the user to continue or not. Let them override with n more iterations

What state do we leave the phase/plan in when this happens?
```
Warning: buck-loop: blocked: iterate limit reached on this phase (6 >=
 6)
```
```
```

**Answer:** The limit is `MAX_ITERATE_CYCLES_PER_PHASE = 6` (`extensions/buck-loop/machine.ts`), enforced by Buck-specific guards before work-emitting transitions. The projection records `state: "blocked"`, the counters, and transition history; plan and phase artifacts remain the source of truth. `/buck-loop --resume` emits `USER_CONFIRMED`, rescans artifacts, and returns through `resolving`. It preserves the iterate counter while the same phase remains active, resets it when the active phase changes, and does not raise the six-cycle ceiling. The independent total-loop default remains 12.
