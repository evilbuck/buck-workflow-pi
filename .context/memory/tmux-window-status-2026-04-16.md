---
date: 2026-04-16
domains: [tooling, pi-extension, testing, docs]
topics: [tmux, status-icons, state-machine, lifecycle-events, window-naming, refactor, vitest, brainstorm-sidecar, naming-fix]
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
- **Stuck detection** uses regex heuristics on the last ~500 chars of assistant text
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

## Files modified
- `extensions/tmux-window-status.ts` — refactored into three layers:
  - `StateMachine` class — pure state transitions, no IO, `.current` getter
  - `TmuxAdapter` class — implements `StatusDisplay`, owns `savedName` state
  - `wire()` function — connects pi events to machine + display, accepts injectable deps
  - Exports: `Status`, `STATUS_ICONS`, `StatusDisplay`, `StateMachine`, `TmuxAdapter`, `wire`
- `extensions/tmux-window-status.test.ts` — 38 vitest tests
  - StateMachine tests: transitions, terminal locking, stuck detection, finalize
  - Wire integration tests: full lifecycle with recordingDisplay stub, zero execSync mocks
- `extensions/index.ts` — imports `wire` from tmux-window-status, calls `wireTmuxStatus(pi)`
- `.gitignore` — added (vitest creates node_modules on `vitest run`)

## QMD fix
- **Problem**: `b-save` called `qmd index .context/memory --collection memory` which doesn't exist
- **Solution**: Changed to `qmd collection add .context/memory --name buck-workflow-memory --mask '*.md'`
- **Why not `qmd update`**: It crashes on the vault collection (tracked as `fix-qmd-index-crash` in backlog)
- **Collection registered**: `buck-workflow-memory` → `/home/buckleyrobinson/projects/development_tools/buck-workflow-pi/.context/memory` with `*.md` pattern

## Bug fix (this session)
- **Problem**: When model stopped thinking but was still working (outputting text), icon stayed at 🧠 instead of reverting to ⚙️
- **Root cause 1**: `PRIORITY` map blocked thinking→working because `PRIORITY[working]=1 < PRIORITY[thinking]=2`
- **Root cause 2**: No event handler for `text_delta` to trigger the transition back to working
- **Fix**: Removed priority guard (non-terminal states transition freely), added `text_delta` handler in `message_update`

## Refactor (this session)
- **Problem**: State machine was untestable — IO in `transition()`, module-level globals, hidden state
- **Solution**: Extracted three-layer architecture with injectable deps
- **Result**: 38 tests pass with zero execSync mocking for core state machine tests

## Brainstorm sidecar naming fix (this session)
- **Problem**: `prompts/b-brainstorm.md` instructed AI to create hidden `.b-brainstorm/` subdirectory inside subject folders for sidecar state, violating flat hierarchy
- **Root cause**: Prompt template and docs both specified `.b-brainstorm/<slug>.json` as nested subdirectory
- **Fix**: Renamed to flat `brainstorm-state-<slug>.json` file directly in subject folder
- **Also removed dot prefix**: User pointed out `.context` is already hidden, so no need to double-hide files inside it
- **Files changed**:
  - `prompts/b-brainstorm.md` — 2 path references updated
  - `docs/buck-workflow.md` — sidecar path in brainstorm docs + folder structure diagram updated
  - Runtime: moved existing `.b-brainstorm/tmux-window-name-pi-status.json` → `brainstorm-state-tmux-window-name-pi-status.json`, removed empty directory

## Verification
- ✅ 38 vitest tests pass covering transitions, terminal locking, stuck detection, full lifecycles
- Test inside tmux: window title changes at each state
- Test outside tmux: no errors or side effects
- Test stuck detection with real assistant questions
