---
status: completed
date: 2026-09-10
subject: 2026-09-10.b-save-state-machine-analysis
topics: [b-save, hindsight, omp-sdk, guarded-retain]
informs: [spec-b-save-command-contract.md, plan-b-save-state-machine.md]
---

# Hindsight guarded-retain public-SDK result

Locked decision: **`unsupported`**

Installed CLI: `omp/18.1.17`
Inspected package: `@oh-my-pi/pi-coding-agent@18.1.17`
SDK root: npm pack `@oh-my-pi/pi-coding-agent@18.1.17` (matches installed `omp/18.1.17`)

The experiment reads public SDK sources only. It does not prompt a model, call Hindsight HTTP, or write to a memory bank.

## API surface inspected

- `CreateAgentSessionOptions.restrictToolNames`
- `CreateAgentSessionOptions.allowRestrictedCustomTools`
- `CreateAgentSessionOptions.customTools`
- `CreateAgentSessionOptions.toolNames`
- `ExtensionContext.invokeTool`
- `MemoryRuntimeContext.save`
- `MemoryRetainTool.execute`

## Observations

- `allowRestrictedCustomTools`: `true`
- `restrictedSessionsSkipCreateMemoryTools`: `true`
- `invokeToolSameToolOnly`: `true`
- `hindsightBackendImplementsSave`: `false`
- `retainToolUsesEnqueueRetain`: `true`

## Mechanism

None. Phase 5 must record Hindsight delivery as `unsupported`.

## Reasons

- restrictToolNames leaves createMemoryTools undefined, so native retain/recall/reflect are never registered and ctx.invokeTool has no retain target.
- hindsightBackend does not implement MemoryBackend.save(), so ctx.memory.save cannot deliver Hindsight facts.
- A token-only custom tool can be injected into a restricted session, but trusted execute() cannot expand that token into native Hindsight retain.

## Phase 5 lock

Hindsight delivery is `unsupported`. Do not expose raw `retain`, patch OMP, or treat `tool_execution_end` as an integrity boundary. Local and Mnemopi continue to use `ctx.memory.status()/save()`. The durable `.context` checkpoint remains valid either way.
