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

> Open. Known gap: no per-skill model override and no host-config integration; routing is hard-coded difficulty tiers.

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

**Answer:** The renderer (`extensions/extension-activity.ts`) shows only `▸/✓ <toolName>` per event — no dedup, no coalescing. Three compounding causes: (1) `maxLineWidth: 64` (`extensions/buck-loop/index.ts:216`) truncates the file-path target to the same clipped tail for edits in the same directory, so rows look identical; (2) a 6-line viewport shows only the trailing rows; (3) repeated identical ops are appended blindly — nothing merges `✓ edit path (×3)`. Richer display = render basename instead of truncated path, coalesce consecutive same `(tool, target, ok)` events, bump viewport for build states, and pass through error text on `✗`. All rendering-layer changes; the event stream already carries targets.

## buck-loop is it idempotent?

> Answered — locked plan + idempotency audit in `.context/2026-09-19.chooser-block-determinism/` and `.context/2026-09-19.ideas-questions/research-buck-loop-idempotency.md`. Short version: state machine, resume, counters, and choice audits are idempotent; step retry re-firing, non-atomic projection write, and the context-free chooser are the three gaps.

## buck-loop
we have a built-in iterate limit. We should prompt the user to continue or not. Let them override with n more iterations

What state do we leave the phase/plan in when this happens?
```
Warning: buck-loop: blocked: iterate limit reached on this phase (3 >=
 3)
```
```
```

**Answer:** The limit is `MAX_ITERATE_CYCLES_PER_PHASE = 3` (`extensions/buck-loop/machine.ts`), enforced by Buck-specific guards before work-emitting transitions. State at block: **phase file, plan file, and subject folder are untouched** — the only on-disk change is `.context/workflow/buck-loop.json` gaining `state: "blocked"`, `iterateCyclesOnPhase: 3`, and a `to: "blocked"` history entry; `maxLoops` stays at 12. The counter only increments on entry to `iterating` and only resets on phase change (`loop.ts` `rescan()`). Today `--resume` is a **no-op for this block**: `userConfirmed()` moves `blocked → resolving` but carries `iterateCyclesOnPhase: 3` forward, so the loop re-blocks on the next tick; `legalChoices` returns `[]` once limits are exceeded, so even the model can't re-decide. Implementing the idea needs: a new flag in `parseArgs`/`FLAGS` (`index.ts`), logic in `resumeRun` to raise the ceiling (or decrement the counter) on the projection, and a UX seam — `takeStep` currently halts synchronously with no callback to prompt the user.
