---
date: 2026-06-05
domains: [tooling, architecture, refactor]
topics: [extension-slimdown, model-auto-switch, b-save, session-state, buck-workflow, pi-extension, omp-plugin]
related:
  - .context/2026-06-05.extension-slimdown/plan-extension-slimdown.md
  - .context/2026-05-15.tps-tracker-review/iterate-tps-tracker-review.md
priority: high
status: completed
subject: 2026-06-05.extension-slimdown
artifacts:
  - plan-extension-slimdown.md
  - extensions/index.ts
  - extensions/buck-mode.test.ts
  - extensions/tmux-window-status.test.ts
  - prompts/b-save.md
  - skills/b-save/SKILL.md
  - docs/extension-loading.md
  - package.json
memory: []
---

# Extension Slimdown — Complete

## What happened

Stripped `extensions/index.ts` from ~1470 lines to ~690 lines. Removed all subsystems except model auto-switch and TPS tracker. `/b-save` converted to pure prompt + skill with no extension backing. Added `package.json` `"omp"` key for OMP runtime parity.

## Key decisions

- `/b-save` is now a pure skill + prompt — no extension backing. LLM reads `.context/workflow/current-session.json` directly.
- Dead code (`b-flow/`, `b-grill-auto/`, `grill-me-dialog.ts`, `tmux-window-status.ts`) stays on disk but is unwired. Easy to re-add.
- Model auto-switch helpers (`findActivePhaseDifficulty`, etc.) preserved exactly as-is.
- Extension context types now use proper interfaces (`ModelSwitchContext`, `UiTheme`, `TuiComponent`) instead of bare `any`.
- `MODEL_SWITCH_COMMANDS` changed from `string[]` to `ReadonlySet<string>` for O(1) lookups.
- Added `"omp"` key to `package.json` with `extensions` array matching `"pi"` — enables OMP to discover the extension without relying on directory discovery.
- Pre-existing broken tests in `tmux-window-status.test.ts` fixed (broken since commit `cb797d3` — `session_start` handler removed from `wire()` but tests still expected it there).

## Files modified

| File | Change |
|---|---|
| `extensions/index.ts` | Major rewrite: ~690 lines from ~1470. Only model auto-switch + TPS tracker remain. |
| `extensions/buck-mode.test.ts` | All old tests removed (modes, restrictions, save command, CWD restriction, write guards). New comprehensive model auto-switch tests added. |
| `extensions/tmux-window-status.test.ts` | Fixed 2 pre-existing failing tests: `before_agent_start` now triggers `init()` (not `session_start`). |
| `package.json` | Added `"omp"` key with `extensions: ["./extensions/index.ts"]` for OMP runtime loading parity. |
| `prompts/b-save.md` | Replaced `{{SESSION_STATE}}` placeholder with direct file-read instruction. |
| `skills/b-save/SKILL.md` | New file: b-save skill instructions mapping all 10 responsibilities. |
| `docs/extension-loading.md` | Full rewrite: current state of buck-workflow-pi, extension contents, loading for both Pi and OMP. |

## Test results

- `extensions/buck-mode.test.ts`: All model auto-switch tests pass (14 tests)
- `extensions/tmux-window-status.test.ts`: Fixed 2 pre-existing failures; 43 tests now pass
- Total: 163/163 tests passing

## Review findings (b-review iteration)

b-review identified one issue during review:
- `package.json` was missing the `"omp"` key — added `extensions: ["./extensions/index.ts"]`
- `extensions/tmux-window-status.test.ts` had pre-existing broken tests from a prior refactor (`session_start` handler removed from `wire()` but tests still expected `init()` to be called there)

## Risks noted

- `before_agent_start` timing: pending model switch must fire after `input` sets it
- `{{SESSION_STATE}}` placeholder removed — old prompt template won't crash, just won't show state
- Dead code on disk could confuse contributors — mitigated by not importing it
