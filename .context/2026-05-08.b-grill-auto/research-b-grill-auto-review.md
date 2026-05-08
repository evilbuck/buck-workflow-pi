---
status: active
date: 2026-05-08
subject: 2026-05-08.b-grill-auto
topics: [b-grill-auto, rpc, skills, extensions, model-orchestration]
informs: [plan-b-grill-auto-extension.md]
---

# Research: b-grill-auto Design Review

## Summary
`b-grill-auto` is directionally correct as a prototype skill plus helper script, but it currently fits Pi's extension model better than Pi's skill model if the goal is reliable orchestration, argument parsing, progress UI, and dual-model control.

## Key Findings
- Pi skills are documentation/instruction packages; they do not inherently implement runtime orchestration.
- Pi extensions can register commands, tools, state, UI, and event hooks, which better matches `b-grill-auto`'s desired behavior.
- The desired architecture is two-role:
  - a faster orchestrator/breakdown model
  - a stronger answer model (`openai-codex/gpt-5.4`) in RPC mode
- A small prompt harness for the RPC answer model should improve consistency and make outputs easier to consume.

## Gaps Found
- Skill docs overstate runtime behavior vs what the helper actually guarantees.
- Helper/examples originally mixed provider/model formats inconsistently.
- Pi RPC `agent_end` should not be treated as if it includes a single `message` object.
- Current implementation does not yet define the exact harness/response schema for the RPC answer model.

## Recommendations
1. Keep the current skill/helper as a prototype.
2. If this becomes a first-class workflow, migrate to a TypeScript extension.
3. Default the RPC answer model for `b-grill-auto` only to `openai-codex/gpt-5.4`.
4. Treat the current session or another lightweight model as the orchestrator.
5. Add a minimal structured harness for the RPC answer model.

## Open Questions
- Should the orchestrator always be the current session model, or should `b-grill-auto` pick a fixed fast model?
- Should the RPC answer model be text-only, or allowed to use tools?
- Should answers be freeform text or structured JSON?
