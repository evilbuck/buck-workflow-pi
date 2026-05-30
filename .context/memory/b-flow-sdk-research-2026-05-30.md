---
date: 2026-05-30
domains: [research, architecture]
topics: [b-flow, pi-sdk, session-isolation, worker-redesign]
subject: 2026-05-30.b-flow-sdk-redesign
artifacts: [research-pi-sdk-worker-architecture.md, index.md]
related: []
priority: high
status: active
---

# Session: 2026-05-30 - b-flow SDK Research

## Context
- **Goal**: Research Pi SDK capabilities for replacing b-flow's subprocess worker model with SDK-driven isolated sessions
- **Trigger**: Backlog item `b-flow-sdk-redesign.md` — b-flow is wired but never invoked; subprocess model eats context

## Key Findings
- `createAgentSession()` from `@mariozechner/pi-coding-agent` creates fully isolated sessions with independent message history, tools, model, and event streams
- Each session supports `prompt()`, `subscribe()`, `abort()`, `dispose()` — all needed for worker lifecycle
- Workers can be independently configured per chunk: different models, scoped tools, custom system prompts
- `createAgentSessionRuntime()` is overkill for b-flow — simple `createAgentSession()` suffices for fire-and-forget workers
- Package naming resolved: `@mariozechner` = npm namespace, `@earendil-works` = GitHub org, same package

## Current Worker Problems Identified
- Subprocess spawn overhead (~2-5s startup)
- No streaming feedback to orchestrator
- No graceful abort (only SIGTERM)
- No per-worker model optimization
- File-based result parsing (fragile)

## Open Questions Remaining
1. Can multiple `AgentSession` run concurrently in same process?
2. Resource sharing behavior with shared `ResourceLoader`?
3. Memory leak risk from create→dispose cycles?

## Files Examined
- `extensions/b-flow/worker.ts` — subprocess worker (to replace)
- `extensions/b-flow/index.ts` — extension entry with ExtensionAPI
- `extensions/b-flow/machine.ts` — XState state machine (keep)
- `extensions/b-flow/chunk-queue-machine.ts` — queue orchestration (adapt)
- `extensions/b-flow/types.ts` — type definitions (adapt)
- Pi SDK docs + 6 SDK examples

## Next Steps
- `/b-plan` — implementation plan for SDK-driven worker
- Need to answer concurrent session question before build
