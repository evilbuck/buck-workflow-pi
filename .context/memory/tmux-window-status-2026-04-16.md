---
date: 2026-04-16
domains: [tooling, pi-extension, testing, docs]
topics: [tmux, status-icons, state-machine, lifecycle-events, window-naming, refactor, vitest, brainstorm-sidecar, naming-fix, bug-fix, jsonl-logging]
subject: 2026-04-16.tmux-window-name-pi-status
artifacts:
  - .context/2026-04-16.tmux-window-name-pi-status/plan-tmux-window-name-pi-status.md
  - .context/2026-04-16.tmux-window-name-pi-status/brainstorm-tmux-window-name-pi-status.md
related: []
priority: high
status: active
---

# Session: tmux window name status for pi

## What was built
A pi extension module (`extensions/tmux-window-status.ts`) that renames the active tmux window with status icons based on pi lifecycle events.

## Status icons
- ⚙️ working — agent processing
- 🧠 thinking — streaming thinking output
- ✅ done — clean completion (stopReason === "stop")
- 🚧 stuck — agent ended by asking user a question (heuristic)
- 🛑 timed out — error/length/aborted stop

## Architecture
- **Three-layer design**: `StateMachine` (pure logic) → `TmuxAdapter` (injectable IO) → `wire()` (pi event plumbing)
- **State machine** has no IO — observable `.current` getter, `transition()` returns boolean
- **`StatusDisplay` interface** — 4-method contract (`show`, `clear`, `init`, `teardown`) for test injection
- **TmuxAdapter** owns `savedName` state (no module-level globals), no-ops cleanly outside tmux
- **Stuck detection** uses regex heuristics on the last ~500 chars of assistant text (keyword-based, NOT bare `?`)
- **`wire()`** accepts `{ machine, display }` deps for testing without execSync mocks

## Key decisions
- Used `before_agent_start` for reset + working transition (clears prior terminal state)
- Used `message_update` with `thinking_delta` for thinking icon
- Used `message_update` with `text_delta` to transition back to working when thinking ends
- Used `message_end` for stop reason and final text capture
- Used `agent_end` for terminal status finalization
- `toolUse` stop reason treated as "done" (agent made progress)
- Multi-turn handling: stop reason and text get overwritten each turn, final values used
- **Icon is always appended** to original window name (e.g., `bash ⚙️`), never replaces it
- Non-terminal states (working ↔ thinking) transition freely — no priority guard
- Terminal states (done, stuck, timedout) are locked until `reset()`
- `transition()` returns boolean so callers know if the transition was accepted
- **JSONL debug logging** to `~/.cache/pi-tmux-status/events.jsonl` for live diagnostics

## Bug fix #2 (b-iterate session)
- **Problem**: Icons stayed at 🧠/⚙️ after pi finished, never transitioned to ✅
- **Root cause**: False "stuck" detection — bare trailing `?` in `QUESTION_PATTERNS` matched casual LLM text like "How can I help you today?"
  - Verified via JSONL logging: `agent_end` DID fire, but `terminal: "stuck"` instead of `"done"`
- **Fix**: Removed bare `?` patterns from `QUESTION_PATTERNS` — only keyword patterns remain (`should I`, `would you like`, `do you want`, etc.)
- **Result**: "Hello! 👋 How can I help you today?" now correctly resolves to `done`

## Bug fix #3 — Icon stacking (b-iterate session)
- **Problem**: Window name accumulated icons: `development_tools#master 🧠 ⚙️ ⚙️`
- **Root cause**: `TmuxAdapter.init()` saved the current window name including previously appended icons
- **Fix**: Added `ICON_SUFFIX_RE` regex to strip trailing status icons from captured name in `init()`
  - Regex: `/(?:\s+(?:⚙️|🧠|✅|🚧|🛑|⏳))+\s*$/` handles multiple spaced icons

## Bug fix #4 — session_shutdown fallback (b-iterate session)
- **Problem**: If `agent_end` never fires (e.g. cancelled session), status stays at working/thinking
- **Fix**: `session_shutdown` handler now finalizes state if non-terminal before teardown
- **Tested**: Two new wire tests verify session_shutdown finalizes when agent_end doesn't fire

## Files modified
- `extensions/tmux-window-status.ts`:
  - Three-layer architecture: `StateMachine`, `TmuxAdapter`, `wire()`
  - JSONL debug logger (`~/.cache/pi-tmux-status/events.jsonl`)
  - `ICON_SUFFIX_RE` for stripping stacked icons in `init()`
  - `session_shutdown` fallback finalization
  - Tightened `QUESTION_PATTERNS` (removed bare `?`)
- `extensions/tmux-window-status.test.ts` — 42 vitest tests
  - StateMachine tests: transitions, terminal locking, stuck detection, finalize
  - Wire integration tests: full lifecycle + session_shutdown fallback tests
  - New tests: bare `?` → done, casual greeting → done, stuck at working → finalized
- `extensions/index.ts` — imports `wire` from tmux-window-status, calls `wireTmuxStatus(pi)`

## Bug fix #1 (earlier this session)
- **Problem**: When model stopped thinking but was still working (outputting text), icon stayed at 🧠 instead of reverting to ⚙️
- **Root cause**: Priority guard + missing `text_delta` handler
- **Fix**: Removed priority guard, added `text_delta` handler

## Refactor (earlier this session)
- Extracted three-layer architecture with injectable deps for testability

## Brainstorm sidecar naming fix (earlier this session)
- Renamed `.b-brainstorm/<slug>.json` → flat `brainstorm-state-<slug>.json` in subject folder

## Verification
- ✅ 42 vitest tests pass (was 38)
- ✅ Live test: `echo "say hello" | pi -p` → correctly shows `terminal: "done"` in JSONL
- ✅ Live test: `echo "create a file" | pi -p` → correctly shows `terminal: "done"` in JSONL
- ✅ Icon stripping regex verified against stacking cases
- Debug log available at `~/.cache/pi-tmux-status/events.jsonl`
