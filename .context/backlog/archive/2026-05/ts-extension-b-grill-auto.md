---
title: b-grill-auto TypeScript extension
status: completed
priority: high
created: 2026-05-08
updated: 2026-05-08
completed: 2026-05-08
related:
  - .context/2026-05-08.b-grill-auto/research-b-grill-auto-review.md
  - skills/b-grill-auto/SKILL.md
  - skills/b-grill-auto/grill.py
  - items/rpc-harness-b-grill-auto.md
  - extensions/b-grill-auto/index.ts
  - extensions/b-grill-auto/rpc-client.ts
  - extensions/b-grill-auto/harness.ts
  - extensions/b-grill-auto/grill-state.ts
  - extensions/b-grill-auto/types.ts
---

# b-grill-auto TypeScript Extension

## Description

Convert `b-grill-auto` from a prototype skill + Python helper into a proper TypeScript extension that provides real command behavior, model routing, progress UI, and persistent state.

## Context

The current `b-grill-auto` skill is a SKILL.md + Python helper script. This approach has limitations:

- Skills are documentation/instruction packages, not runtime orchestration
- `/skill:b-grill-auto` sends text to the main model, which then runs Python
- No real argument parsing, progress tracking, or state persistence
- Relies on the main model to "remember the protocol"

## Requirements

### Must Have
- [ ] Register `/b-grill-auto` as a real command
- [ ] Parse command arguments (model, provider, plan context)
- [ ] Spawn and manage Pi RPC subprocess for the answer model
- [ ] Manage grill session state (questions asked, divergences found, domain tracking)
- [ ] Write `grill-auto-session-*.md` to subject folders

### Should Have
- [ ] Model selection logic (use different model than current session)
- [ ] Progress/status UI during grilling
- [ ] Auto-cleanup of RPC sessions on completion/error
- [ ] Configurable assessment threshold (question count before phasing check)

### Could Have
- [ ] Interactive mode: stop and ask user at key decision points
- [ ] Resume interrupted grill sessions
- [ ] Generate summary reports from grill sessions

## Architecture

```
User invokes /b-grill-auto
        │
        ▼
Extension command handler
        │
        ├── Parse args (model, plan context, threshold)
        ├── Read plan/design from context
        ├── Spawn Pi RPC subprocess with answer model
        │
        ▼
Fast orchestrator (current session model or fast model)
        │
        ├── Generates question
        ├── Sends to RPC answer model
        ├── Records response
        ├── Tracks divergences
        ├── Updates session file
        │
        ▼
RPC subprocess (openai-codex/gpt-5.4)
        │
        └── Answers question (with optional harness)
```

## Implementation Notes

### Key Files to Create/Modify

- `extensions/b-grill-auto.ts` — new extension file
- `extensions/index.ts` — import and register the extension
- `skills/b-grill-auto/` — keep as documentation reference (not removed)

### Extension Location
Follow existing pattern in `extensions/index.ts`:
- Subdirectory: `extensions/b-grill-auto/`
- Entry: `index.ts`

### State Management
Similar to `extensions/index.ts` buck workflow state:
- Store in `.context/workflow/grill-session.json`
- Track: question count, domains, divergences, current domain

### RPC Management
- Spawn Pi subprocess with `pi --mode rpc --model openai-codex/gpt-5.4`
- Use JSONL stdin/stdout protocol
- Handle `agent_end` events correctly (not the mistaken `event.message`)
- Graceful cleanup on completion/error/abort

### Integration Points
- Read from `.context/` subject folders
- Write `grill-auto-session-*.md` to subject folders
- Feed into `b-phase` via existing `grill-session-*.md` reading logic

## Verification

- [ ] `/b-grill-auto` command is registered and callable
- [ ] RPC subprocess starts with correct model
- [ ] Questions are sent and responses are received
- [ ] Session file is created and updated
- [ ] Extension cleans up RPC process on completion
- [ ] Errors are handled gracefully

## Notes

- See `extensions/index.ts` for patterns on state management, command registration, and subprocess handling.
- The RPC helper in `skills/b-grill-auto/grill.py` can be referenced for protocol details, but the extension should manage its own subprocess.
- Coordinate with `rpc-harness-b-grill-auto.md` — the harness should be designed before or alongside this extension.
