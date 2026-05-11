# Session: 2026-05-09 - pi-coding-agent hang diagnosis

## Context
- Goal: determine why the interactive Pi coding agent can get stuck showing `working...` and ignore later user messages.
- User provided event-timeline evidence showing a hanging model call, rapid manual model cycling, and later ignored prompts.
- Relevant local files inspected:
  - `extensions/index.ts`
  - `extensions/tmux-window-status.ts`
  - `extensions/b-grill-auto/rpc-client.ts`

## Decisions Made
- Treat the primary issue as an upstream Pi/core request-lifecycle problem, not a Buck workflow extension bug.
- Do not patch the workflow package with speculative recovery logic that cannot actually abort the in-flight provider call.

## Implementation Notes
- `extensions/index.ts` registers `/b-save` by sending a follow-up user message with `pi.sendUserMessage(...)` and immediately marking `save_completed = true`. This means the workflow state can report save-complete before the assistant run actually finishes.
- `extensions/index.ts` save warnings and model switch-back both depend on `pi.on("agent_end", ...)`. If a provider call hangs and `agent_end` never fires, these code paths never run.
- `extensions/tmux-window-status.ts` also finalizes its visible terminal state only on `agent_end` or `session_shutdown`, so a hung run can remain visually stuck in `working`.
- `extensions/b-grill-auto/rpc-client.ts` has its own per-prompt timeout for RPC subprocess use, which reinforces that this repository already distinguishes between bounded subprocess work and unbounded interactive runs.

## Confirmed Findings
- The symptom pattern is consistent with an interactive model API call that never returns and never emits `agent_end`.
- Manual model cycling changes selected model state but does not prove cancellation of the already-running provider request.
- Because the in-flight run stays open, later user messages can remain queued behind that run and appear ignored.
- A subprocess-style workflow can still succeed independently while the main interactive session remains hung.

## Next Steps
- [ ] Fix in Pi core: add a hard provider timeout for interactive runs and surface an error when exceeded.
- [ ] Fix in Pi core: abort the active provider request when the user cancels or cycles models during an in-flight run.
- [ ] Optional workflow-package follow-up: stop marking `save_completed` true before save execution is actually confirmed.
