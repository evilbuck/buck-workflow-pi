# Plan: tmux window name from pi status

## What we might build
- A pi extension that updates the tmux window name directly when pi changes state.
- The implementation should be built around an explicit state machine rather than scattered event handlers.
- Show these status markers in the tmux window name:
  - ⚙️ working
  - 🧠 thinking
  - ✅ done
  - 🚧 stuck
  - 🛑 timed out
- Detect status from pi lifecycle events and the assistant message stop reason.
- Use icon-only tmux window names with no extra text.

## Why it matters
- Makes it easy to scan tmux windows and see which pi session finished, got stuck, or timed out.
- Reduces context switching when juggling multiple agent sessions.
- Gives a lightweight status signal without needing to focus the pane.

## Constraints / preferences
- User wants tmux window naming to update with the icons above.
- This should happen automatically.
- Implementation preference: update the tmux window name directly.
- The plan should instruct the implementation agent to create a state machine.
- Clear the old icon when a new prompt starts.
- `🚧 stuck` means pi is waiting on the user for input.
- `🛑 timed out` means any error or non-finish response.
- Add a distinct thinking state separate from the broader working state.
- We should use pi-native hooks if available.

## Open questions
- Does this pi setup actually expose a dedicated question tool/hook for user clarification, or will we need to infer it from generic events?

## Brainstorm notes
- pi does expose extension lifecycle events.
- Relevant docs found:
  - `docs/extensions.md`: `agent_start`, `agent_end`, `turn_start`, `turn_end`, `message_update`, `tool_execution_*`
  - `docs/sdk.md`: `message_update` can include `assistantMessageEvent.type === "thinking_delta"` when thinking is enabled
  - `docs/session.md`: assistant messages include `stopReason: "stop" | "length" | "toolUse" | "error" | "aborted"`
  - `examples/extensions/titlebar-spinner.ts` shows a real extension using `ctx.ui.setTitle()` during `agent_start` / `agent_end`
  - `examples/extensions/qna.ts` treats non-`stop` assistant messages as incomplete/error-like
- Direct tmux rename now looks like the preferred path:
  1. On relevant pi events, extension checks whether it is running inside tmux (`$TMUX`)
  2. On new prompt start, extension clears the previous icon and sets `⚙️`
  3. Extension runs `tmux rename-window "<status>"`
- The eventual implementation should define a state machine with explicit states and transitions.
- State mapping draft:
  - `⚙️` while the agent is actively working in a broad sense
  - `🧠` when the agent is in a more specific thinking/streaming-thought phase
  - `✅ done` when the run ends cleanly and assistant `stopReason === "stop"`
  - `🛑 timed out` when the run ends with `stopReason !== "stop"`, including `error`, `aborted`, `length`, or other non-finish cases
  - `🚧 stuck` when pi is waiting on the user for input
- Candidate transitions to formalize later:
  - idle/cleared -> working on `before_agent_start` or `turn_start`
  - working -> thinking on `message_update` with `thinking_delta`
  - working/thinking -> stuck on question-tool detection or inferred user-question end state
  - working/thinking -> done on clean `agent_end` / final `stopReason === "stop"`
  - working/thinking -> timed out on non-finish or error `stopReason`
  - stuck -> working when the user resumes input or a new prompt starts
  - any terminal state -> working on next prompt start after clearing the old icon
- Main implementation challenge is defining “waiting on the user” in a way pi can reliably detect.
- Updated detection strategy based on user-provided research:
  1. Best case: hook `tool_call` for a dedicated user-question tool if the local pi setup provides one
  2. Use `before_agent_start` / `turn_start` to enter the broader `⚙️` working state
  3. Use `message_update` with `thinking_delta` when available to enter the more specific thinking state
  4. Fallback: use `agent_end` / `turn_end` plus assistant message analysis to infer that pi ended by asking the user something
  5. Optional: detect extension-driven UI prompts such as `ctx.ui.select()` / `ctx.ui.confirm()` when those are part of the flow
  6. Optional: use an `input` hook to notice when the user starts answering, which could clear or replace the `🚧` state
- Local docs checked so far do show generic hooks like `tool_call`, `agent_end`, and `turn_end`.
- Local docs checked so far do **not** clearly show a built-in `ask` / `ask_user` tool or `runWhenIdle()` helper in this pi install.
- Practical implication:
  - if the user already has a question tool in their setup, `🚧 stuck` can be set directly from that tool call
  - otherwise `🚧 stuck` likely needs a heuristic based on the final assistant message asking for input
- `🛑 timed out` is now much clearer than before because pi surfaces `stopReason` on assistant messages.
- Remaining risk:
  - the most reliable stuck detection may depend on project-specific tooling rather than core pi alone.
  - if Autopilot or similar behavior auto-responds to clarifying questions, `🚧 stuck` may be skipped or much harder to observe.
  - without a clear state-machine design, overlapping pi events could otherwise cause flaky or conflicting window-name updates, so the state machine requirement is important.
