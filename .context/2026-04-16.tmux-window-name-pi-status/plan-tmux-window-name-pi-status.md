---
status: completed
date: 2026-04-16
subject: 2026-04-16.tmux-window-name-pi-status
topics: [tmux, status, extension, state-machine, lifecycle]
research: []
memory:
  - .context/memory/tmux-window-status-2026-04-16.md
---

# Plan: tmux window name status for pi sessions

## Goal
Rename the active tmux window directly from pi so the window title always reflects the current session state with icon-only markers:
- `⚙️` working
- `🧠` thinking
- `✅ done`
- `🚧` stuck
- `🛑 timed out`

The status should update automatically from pi lifecycle events and reset/clear when a new prompt starts.

## Context used / assumptions
- User-provided context: wants the tmux window name to change automatically based on pi status, using the icons above, and wants the old icon cleared when a new prompt starts.
- Session context: this is a `b-plan` session in the Buck workflow, and the related brainstorm already narrowed the implementation toward a state machine plus direct `tmux rename-window` calls.
- Artifacts used:
  - `.context/2026-04-16.tmux-window-name-pi-status/brainstorm-tmux-window-name-pi-status.md`
  - `extensions/index.ts`
  - `docs/buck-workflow.md`
  - pi docs for extensions, SDK, and session/message semantics
  - `examples/extensions/titlebar-spinner.ts`
  - `examples/extensions/qna.ts`
- Assumptions / open questions:
  - Outside tmux, the extension should fail soft and leave pi usable.
  - The status machine should have deterministic priority rules so `thinking` does not override terminal states.
  - `🚧 stuck` is the least certain state; if no explicit pi hook exists for “waiting on user input,” use a conservative heuristic based on the final assistant turn.
  - Status changes should be local to the active tmux window only; no broader terminal UI changes are required.

## Scope
Implement a tmux-aware session-status extension that:
1. Detects when pi is running inside tmux.
2. Renames the current tmux window via `tmux rename-window`.
3. Uses a small explicit state machine for transitions.
4. Maps pi events to the five requested status markers.
5. Clears or resets the visible status when a new prompt begins.
6. Leaves existing Buck workflow session tracking behavior intact.

## Out of scope
- Changes to pi core or built-in lifecycle events.
- Non-tmux terminal title integrations.
- UI widgets, prompts, or slash commands unrelated to status naming.
- Changes to the Buck workflow plan/save/research behavior.
- Perfectly reliable “stuck” detection if pi does not expose a direct signal; a pragmatic heuristic is acceptable for the first pass.

## Affected files
- `extensions/index.ts` - likely where the new tmux status logic will live, or where it will be wired in if split into a helper module.
- `extensions/tmux-window-status.ts` or similar - optional new helper module if the logic is cleaner when separated from session tracking.
- `docs/buck-workflow.md` - optional follow-up documentation if we want the workflow docs to mention the tmux status behavior.

## Implementation steps
1. Inspect the current extension flow and decide whether to extend `extensions/index.ts` directly or extract a dedicated status helper/module.
2. Define a finite state machine with explicit states and priority ordering:
   - `working` on prompt/turn start
   - `thinking` on `message_update` with `thinking_delta`
   - `stuck` when pi is waiting on the user, if that can be detected; otherwise infer from the final assistant message
   - `done` when the assistant ends cleanly with `stopReason === "stop"`
   - `timed out` when the turn ends with `length`, `error`, `aborted`, or any other non-clean stop reason
3. Add a tmux window rename helper that:
   - checks for `$TMUX`
   - shells out safely to `tmux rename-window`
   - avoids crashing the extension if tmux is unavailable or the rename fails
4. Hook the helper into the relevant pi lifecycle events:
   - clear/reset on `before_agent_start` or equivalent prompt-start event
   - set `working` on the first active turn for a prompt
   - switch to `thinking` when `thinking_delta` is observed
   - set terminal states on `agent_end` / `turn_end` after inspecting stop reason and final assistant content
   - restore a safe default on `session_shutdown`
5. Validate how to detect “stuck” in this environment:
   - prefer an explicit tool/hook if the local pi setup exposes one
   - otherwise inspect the last assistant message for a question/clarification pattern and mark it as `🚧`
6. Keep the existing session-tracking responsibilities in place so `/b-save` and file tracking still work.

## Verification
- Run inside tmux and confirm the current window title changes at each state transition.
- Start a new prompt and verify the previous icon is cleared before the next run begins.
- Verify `⚙️` appears when work starts.
- Verify `🧠` appears during streaming thinking output when thinking is enabled.
- Verify `✅ done` appears only for a clean `stopReason === "stop"` completion.
- Verify `🛑 timed out` appears for `length`, `error`, `aborted`, or other non-clean endings.
- Verify `🚧` appears for the best available user-waiting signal, or document the fallback heuristic if no direct signal exists.
- Verify the extension no-ops cleanly when tmux is not present.

## Risks
- Event ordering may cause status flicker unless the state machine has a clear precedence model.
- A heuristic for `🚧 stuck` may misclassify some assistant turns.
- Shelling out to `tmux` introduces quoting/escaping concerns, especially with emoji and spaces in window names.
- If the extension already tracks session state in the same file, mixing concerns could make the code harder to maintain unless the status logic is isolated.

## Recommended next step
Proceed with `b-build-hard` if you want the implementation to handle the ambiguous stuck-detection and event-ordering details carefully; otherwise `b-build` is sufficient if you want the smallest direct implementation path.
