---
title: Redesign b-flow to use Pi SDK for isolated worker contexts
status: active
priority: high
created: 2026-05-30
updated: 2026-05-30
completed: null
related:
  - extensions/b-flow/
---

# Redesign b-flow to use Pi SDK for isolated worker contexts

## Description
b-flow orchestration is wired but dormant — never invoked in practice. The core problem: ralph and the current b-flow worker both eat context on the main thread. Redesign b-flow to drive isolated worker sessions via the Pi SDK from within the extension, giving each worker its own controlled context window.

## Context
- **Current state**: b-flow extension (~3,500 lines) is loaded but unused. Orchestration via XState state machine works in tests but the worker subprocess model (spawning `pi --mode rpc`) is heavyweight and context-expensive.
- **User insight**: Since b-flow is already an extension, it has access to the Pi SDK directly — no need for RPC mode. The SDK can create isolated sessions with their own context windows.
- **Key constraint**: Must not eat main thread context. Workers need fully isolated context that the orchestrator controls.
- **SDK docs**: https://pi.dev/docs/latest/sdk

## Technical Notes
- Extension already has `ExtensionAPI` from `@mariozechner/pi-coding-agent`
- Need to research: what the Pi SDK exposes for session creation, context isolation, and result retrieval
- Current worker model (`worker.ts`) spawns a child process — would be replaced by SDK-driven sessions
- The XState state machine structure (machine.ts, guards, persistence) may still be useful as the orchestration layer

## Next Steps
- [ ] Research Pi SDK capabilities for session/context isolation
- [ ] Brainstorm architecture: how orchestrator drives workers via SDK
- [ ] Design the new worker model

## Related Work
- `extensions/b-flow/` — current implementation
- `extensions/b-flow/worker.ts` — current subprocess-based worker (to be replaced)
- Pi SDK docs: https://pi.dev/docs/latest/sdk
