---
status: completed
date: 2026-09-10
subject: 2026-09-10.b-save-state-machine-analysis
informs:
  - research-b-save-state-machine.md
---

# OMP SDK and native-memory source notes

## Scope

Verify the OMP-first integration boundary for `/b-save` Step 8: whether a state-machine extension can persist validated memory facts through OMP's supported SDK/runtime APIs without asking the mainline model to invoke `retain` or `learn`.

Source revision: `can1357/oh-my-pi` commit `3b3a6dc9bbd85102ce19d0b1c11bf6870915f6ec` (`main`, observed 2026-09-10).

## Official documentation

- <https://omp.sh/docs/sdk>
  - OMP embeds through `@oh-my-pi/pi-coding-agent`, not upstream `@mariozechner/pi-coding-agent`.
  - `createAgentSession()` owns a normal model-backed prompt lifecycle. Tool execution occurs within `session.prompt()` and is observable through events such as `tool_execution_end`.
  - Tool availability can be restricted, but the documented API still has the model select and invoke tools during a prompt; it is not a direct host-side tool-call API.
- <https://omp.sh/docs/extension-authoring>
  - `ExtensionContext.memory` is the configured structured-memory runtime when available.
  - `ExtensionContext.invokeTool` delegates to the native implementation only when an extension replaces that same built-in tool. It is not a general command-context tool dispatcher.
- <https://omp.sh/docs/memory>
  - Supported user-facing backends are `off`, `local`, `mnemopi`, and `hindsight`.
  - Local memory is a machine-local rollout-summary/lesson system; Mnemopi is local structured memory; Hindsight is a remote structured bank.

## Official source contracts

### Extension runtime

- [`packages/coding-agent/src/extensibility/extensions/types.ts`](https://github.com/can1357/oh-my-pi/blob/3b3a6dc9bbd85102ce19d0b1c11bf6870915f6ec/packages/coding-agent/src/extensibility/extensions/types.ts)
  - `ExtensionContext.memory?: MemoryRuntimeContext`.
- [`packages/coding-agent/src/extensibility/extensions/runner.ts`](https://github.com/can1357/oh-my-pi/blob/3b3a6dc9bbd85102ce19d0b1c11bf6870915f6ec/packages/coding-agent/src/extensibility/extensions/runner.ts)
  - Context construction sets `memory: this.#getMemoryFn?.()`.
  - `invokeTool` is populated only for same-tool native delegation and calls `invokeNativeTool(delegation.toolName, ...)`.
- [`packages/coding-agent/src/sdk.ts`](https://github.com/can1357/oh-my-pi/blob/3b3a6dc9bbd85102ce19d0b1c11bf6870915f6ec/packages/coding-agent/src/sdk.ts)
  - The extension runner receives `createSessionMemoryRuntimeContext(session, agentDir, cwd)`.

### Structured memory API

- [`packages/coding-agent/src/memory-backend/types.ts`](https://github.com/can1357/oh-my-pi/blob/3b3a6dc9bbd85102ce19d0b1c11bf6870915f6ec/packages/coding-agent/src/memory-backend/types.ts)
  - `MemoryRuntimeContext.status(): Promise<MemoryBackendStatus>`.
  - `MemoryRuntimeContext.save(input): Promise<MemoryBackendSaveResult>`.
  - Save input contains `content`, optional `context`, `source`, and `importance`.
  - Save result contains `backend`, `stored`, optional `ids`, `queued`, and `message`.
  - A backend's `save` implementation is optional.
- [`packages/coding-agent/src/memory-backend/runtime.ts`](https://github.com/can1357/oh-my-pi/blob/3b3a6dc9bbd85102ce19d0b1c11bf6870915f6ec/packages/coding-agent/src/memory-backend/runtime.ts)
  - `save()` resolves the configured backend and calls its `save` method.
  - A backend without `save` returns `{ backend, stored: 0, message: "Memory save is not available ..." }`.

### Backend behavior

- [`packages/coding-agent/src/memory-backend/local-backend.ts`](https://github.com/can1357/oh-my-pi/blob/3b3a6dc9bbd85102ce19d0b1c11bf6870915f6ec/packages/coding-agent/src/memory-backend/local-backend.ts)
  - Implements `save()` through `saveLearnedLesson()`.
  - Reports `writable: true`; facts are stored in project `learned.md`.
- [`packages/coding-agent/src/mnemopi/backend.ts`](https://github.com/can1357/oh-my-pi/blob/3b3a6dc9bbd85102ce19d0b1c11bf6870915f6ec/packages/coding-agent/src/mnemopi/backend.ts)
  - Implements `save()` through `rememberScoped()` and returns a stored ID when successful.
- [`packages/coding-agent/src/hindsight/backend.ts`](https://github.com/can1357/oh-my-pi/blob/3b3a6dc9bbd85102ce19d0b1c11bf6870915f6ec/packages/coding-agent/src/hindsight/backend.ts)
  - Does not implement the optional backend `save()` method at this revision.
- [`packages/coding-agent/src/tools/memory-retain.ts`](https://github.com/can1357/oh-my-pi/blob/3b3a6dc9bbd85102ce19d0b1c11bf6870915f6ec/packages/coding-agent/src/tools/memory-retain.ts)
  - The built-in `retain` tool supports Hindsight and Mnemopi.
  - Hindsight retention queues facts through `HindsightSessionState.enqueueRetain()` and returns immediately; eventual queue failure is surfaced as a UI-only warning.

## Conclusion

`ctx.memory` is the correct public OMP-first state-machine boundary, but it is not currently backend-complete. It provides deterministic direct delivery for `local` and `mnemopi`; at this source revision it returns `stored: 0` for `hindsight` because `hindsightBackend` lacks `save()`.

`ctx.invokeTool` cannot fill that gap from a `/b-save` command because it is only exposed for same-tool overrides. A restricted nested `createAgentSession()` could ask a model to call `retain`, but that converts delivery back into an LLM-mediated effect and therefore does not satisfy a deterministic adapter contract.

Architecture Q&A outcome: use `ctx.memory.status()/save()` directly for local and Mnemopi. For Hindsight, permit an LLM-mediated nested OMP SDK fallback only behind a trusted pre-execution retain capability: the model receives an opaque delivery token, and trusted code expands it to the already validated facts before native `retain` runs. A raw restricted built-in `retain` tool is insufficient because the model still controls its payload. The design may use only OMP's shipped public API interfaces; modifying, patching, forking, or requiring changes to OMP source is out of scope. Proving the guarded capability through existing APIs is a pre-implementation prerequisite. If it cannot be enforced, record Hindsight delivery as unsupported/failed. Retry once after a valid gate is available; a second delivery failure is non-blocking because `.context` is already durable. Never bypass OMP with raw Hindsight HTTP.

## SDK fallback isolation contract

OMP's `CreateAgentSessionOptions` supports the isolation boundary for zero-tool semantic roles, but the trusted Hindsight pre-execution capability remains an implementation prerequisite:
- `restrictToolNames: true` limits built-ins to the explicit `toolNames` list; the source's automatic addition of `recall`/`retain`/`reflect` runs only in non-restricted sessions. This protects zero-tool roles, but exposing raw built-in `retain` would still let the model choose its payload.
- At the researched revision, restricted sessions omit registered extension tools. The implementation must prove an inline guarded-retain capability or another trusted pre-execution boundary can coexist with the required isolation; otherwise Hindsight delivery fails closed.
- Restricted sessions disable MCP and discovered custom-tool/command capabilities. Set `enableMCP`, `enableLsp`, and `enableIrc` false as an explicit fail-closed policy.
- Pass `skills: []`, `rules: []`, `contextFiles: []`, `promptTemplates: []`, and `slashCommands: []`; set `disableExtensionDiscovery: true` so ambient repository instructions do not enter fallback authority.
- Use a minimal caller-owned `systemPrompt`, a strict `outputSchema`, a bounded deadline, and the explicitly configured model.

Prompt/data rules:
- `buildPromptFromError` maps a typed error code and bounded evidence records; it does not concatenate arbitrary exception messages or repository text into the instruction layer.
- Evidence is untrusted data with stable IDs, source provenance, size bounds, and secret redaction.
- Classifier/auditor/scribe roles receive no tools. Hindsight delivery may receive only a guarded retain capability and only an opaque delivery token, never raw fact content.
- A trusted pre-execution gate must resolve that token to the already validated facts or compare proposed arguments before native `retain` runs. `tool_execution_end` is confirmation, not an integrity gate: OMP emits `tool_execution_start` immediately before execution and exposes no documented event-veto contract.
- Deterministic code validates schema, evidence citations, allowed transitions, and tool payloads. Any unexpected tool call, unsupported claim, stale evidence, or unavailable pre-execution retain gate fails closed; no model-altered fact may be queued.
- Retry from the original sanitized snapshot, never from the previous model's prose.
