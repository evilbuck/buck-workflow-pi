---
status: active
date: 2026-05-30
subject: 2026-05-30.b-flow-sdk-redesign
topics: [pi-sdk, session-isolation, worker-architecture, b-flow]
informs: ["plan-b-flow-sdk-redesign.md"]
---

# Research: Pi SDK for Isolated Worker Contexts in b-flow

## Summary

The Pi SDK (`@earendil-works/pi-coding-agent`) provides first-class APIs for creating isolated agent sessions programmatically. This eliminates the need for the current b-flow worker model, which spawns `pi -p --no-session` as a heavyweight subprocess. Each `AgentSession` created via the SDK has its own independent message history, tool set, model, and event stream — providing the context isolation that b-flow workers need.

## Key Findings

### 1. `createAgentSession()` — Primary Worker Factory

The main factory function creates a single isolated `AgentSession`:

```typescript
const { session } = await createAgentSession({
  cwd: projectRoot,
  sessionManager: SessionManager.inMemory(projectRoot),  // no disk I/O
  model: myModel,
  tools: ["read", "bash", "edit", "write"],  // scoped tools
  thinkingLevel: "off",  // reduce cost for workers
});
```

**Context isolation guarantees:**
- Each session has its own `messages: AgentMessage[]` array
- Each session has its own event subscription stream
- `session.dispose()` cleans up all resources
- No shared state between sessions unless explicitly configured

### 2. SDK Session API Surface

`AgentSession` interface provides everything a worker needs:

| Method | Worker Use |
|--------|-----------|
| `session.prompt(text, options)` | Send the chunk prompt, await completion |
| `session.subscribe(listener)` | Monitor tool calls, streaming output, progress |
| `session.abort()` | Cancel worker on timeout/pause |
| `session.dispose()` | Clean up when worker finishes |
| `session.messages` | Read conversation history for audit |
| `session.agent.state` | Access model, tools, error state |

### 3. Event-Driven Worker Monitoring

Workers can be monitored via event subscriptions:

```typescript
session.subscribe((event) => {
  switch (event.type) {
    case "tool_execution_start":
      // Track which tools the worker is using
    case "tool_execution_end":
      // Track success/failure per tool call
    case "agent_end":
      // Agent finished a turn (LLM response + tool calls)
    case "turn_end":
      // event.message + event.toolResults for each turn
    case "message_update":
      // Streaming text output
  }
});
```

### 4. Configuration Per Worker

Each worker session can be independently configured:

- **Model**: Different models per chunk difficulty (e.g., Haiku for easy, Sonnet for medium, Opus for hard)
- **Tools**: Restrict workers to read-only for review chunks, full tools for build chunks
- **System Prompt**: Override per-worker via `ResourceLoader.systemPromptOverride`
- **Skills**: Load specific skills per worker via `skillsOverride`
- **Settings**: In-memory settings with per-worker overrides (compaction, retry limits)

### 5. `createAgentSessionRuntime()` — For Session Replacement

The runtime API is needed if the orchestrator needs to replace sessions dynamically (new, resume, fork). For the b-flow worker model, `createAgentSession()` is sufficient — workers are fire-and-forget, not interactive sessions that need replacement.

### 6. Current Worker Model Problems

The current `worker.ts` (lines ~170) has these issues:

| Problem | Impact |
|---------|--------|
| `spawn("pi", args)` subprocess | Heavy process overhead (~2-5s startup) |
| CLI prompt file (`-p @promptFile`) | No programmatic control over context |
| No streaming feedback | Orchestrator blind during execution |
| No graceful abort | Only SIGTERM on timeout |
| Shared model across all workers | Can't optimize cost per difficulty |
| No result parsing | Relies on file-based result format |
| Audit via JSON file | No structured API for result retrieval |

### 7. Extension Already Has `ExtensionAPI`

The b-flow extension imports `ExtensionAPI` from `@mariozechner/pi-coding-agent` (note: different package name — need to verify if this is the same as `@earendil-works/pi-coding-agent` or an alias). The extension has access to:

- `api.on(event, handler)` — lifecycle event subscription
- `api.registerCommand(name, options)` — slash commands
- `api.registerTool(definition)` — custom tools
- `ctx.ui` — user interaction (notify, confirm, input)
- `ctx.cwd` — current working directory

### 8. SDK Examples Provide Templates

The SDK ships with 13 examples at `examples/sdk/`:
- `01-minimal.ts` — defaults, auto-discovery
- `05-tools.ts` — scoped tool selection
- `06-extensions.ts` — custom extensions per session
- `11-sessions.ts` — session management patterns
- `12-full-control.ts` — fully explicit configuration
- `13-session-runtime.ts` — session replacement patterns

## Architecture Implications

### Proposed Worker Model (SDK-driven)

```
┌─────────────────────────────────────────────────┐
│  b-flow Extension (main thread)                  │
│                                                   │
│  ┌─────────────┐   ┌──────────────────────────┐  │
│  │ XState      │──▶│ SDK Worker Manager        │  │
│  │ Machine     │   │                           │  │
│  │ (orchestrator)│  │  createAgentSession()     │  │
│  └─────────────┘   │  → session A (chunk 1)    │  │
│                     │  → session B (chunk 2)    │  │
│                     │  → session C (chunk 3)    │  │
│                     │                           │  │
│                     │  Results via Promise       │  │
│                     └──────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

### Key Design Decisions Needed

1. **Sequential vs parallel workers**: Can multiple SDK sessions run concurrently? (SDK appears to support this, but need to verify no shared state conflicts)
2. **Worker pool vs fire-and-forget**: Should workers be pooled/reused, or created fresh per chunk?
3. **Result extraction**: Instead of file-based results, extract from `session.messages` directly
4. **Timeout handling**: `session.abort()` + `session.dispose()` vs subprocess SIGTERM
5. **Package name**: ~~Verify `@mariozechner` vs `@earendil-works`~~ — **RESOLVED**: Same package. `@mariozechner` is the npm namespace; `@earendil-works` is the GitHub org.

## Sources Consulted

| Source | Type | Confidence | URL |
|--------|------|------------|-----|
| Pi SDK Docs | Official | High | https://pi.dev/docs/latest/sdk |
| SDK Examples (01, 05, 06, 11, 12, 13) | Source code | High | GitHub repo examples/sdk/ |
| Extension Docs | Official | High | https://pi.dev/docs/latest/extensions |
| Current b-flow codebase | Source code | High | extensions/b-flow/ |

## Open Questions

1. **Can multiple `AgentSession` instances run concurrently in the same process?** — SDK docs don't explicitly address this
2. **Does each session get its own agent lifecycle (LLM API calls, tool execution)?** — Likely yes based on event model, but needs verification
3. **What happens to the `ResourceLoader` if multiple sessions share the same one?** — Need to verify resource sharing behavior
4. **Is there a memory leak risk from many `createAgentSession()` → `dispose()` cycles?** — Need to test
5. **Package naming**: ~~`@mariozechner` vs `@earendil-works`~~ — **RESOLVED**: Same package. `@mariozechner` is the npm namespace, `@earendil-works` is the GitHub org. SDK docs use org name; installed package uses npm name.

## Recommended Next Step

`/b-plan` — turn these findings into a bounded implementation plan for the SDK-driven worker architecture.
