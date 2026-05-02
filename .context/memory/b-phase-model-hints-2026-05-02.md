---
date: 2026-05-02
domains: [tooling, skills, buck-workflow, planning, extension, debugging, tui]
topics: [b-phase, model-hints, phase-difficulty, b-plan, model-auto-switch, extension, model-picker, interactive-setup, selector-flicker, input-lifecycle, selectlist]
subject: 2026-05-02.b-phase-model-hints
artifacts: [plan-b-phase-model-hints.md, plan-model-auto-switch.md]
related: [b-phase-skill-2026-05-01.md]
priority: medium
status: active
---

# Session: 2026-05-02 - b-phase model hints

## Context
- User wanted `b-phase` to suggest what kind of model should be used per phase.
- Preferred a simple three-bucket classification rather than concrete provider/model IDs.
- Existing Buck workflow already distinguished `/b-build` and `/b-build-hard`, but phased plans did not annotate execution difficulty.
- Follow-on work extended this into runtime model auto-switching and then into an interactive setup flow for `buckModelMapping`.

## Decisions Made
- Added a simple `easy | medium | hard` rubric to `skills/b-phase/SKILL.md`.
- Kept model guidance generic and provider-agnostic at the skill/planning layer.
- Implemented runtime model auto-switching in the Buck extension based on active phased-plan difficulty.
- Read `buckModelMapping` directly from Pi settings JSON because `SettingsManager` does not support arbitrary custom keys.
- Used an `autoSwitchingModel` flag to distinguish extension-driven `pi.setModel()` calls from user-driven model changes.
- Used project `.pi/settings.json` as override over global `~/.pi/agent/settings.json`.
- Upgraded the initial mapping setup flow from a static confirmation prompt to an interactive picker sourced from `ctx.modelRegistry.getAvailable()`.
- After diagnosing selector flicker, moved setup/model-switch UI out of the `input` event and into `before_agent_start`.
- Replaced generic `ctx.ui.select()` usage with a custom `ctx.ui.custom()` + `SelectList` picker so controls are explicit and preselection is reliable.

## Implementation Notes
### b-phase model-hint work
- Updated `skills/b-phase/SKILL.md` to:
  - require a difficulty/model hint for every phase
  - add a phase-difficulty rubric
  - extend the output template with `Difficulty`, `Model hint`, and `Buck execution hint`
  - require the final summary to mention model hints, especially for Phase 1
- Updated `docs/buck-workflow.md` to document the new b-phase behavior and rubric.
- Updated `prompts/b-plan.md` recommendation text so b-phase discoverability mentions per-phase model hints.

### Model auto-switch work
- Added model auto-switch logic to `extensions/index.ts` that:
  - reads `buckModelMapping` from Pi settings
  - detects active phased-plan difficulty on `/b-build`, `/b-build-hard`, `/b-iterate`, `/b-review`
  - auto-switches models on tier mismatch
  - switches back after `agent_end`
  - respects manual mid-phase model changes by cancelling switch-back
  - provides a non-phased soft suggestion path
- Unified `agent_end` handling so save-warning logic and model switch-back live together.
- Used a simple plan-complexity heuristic for non-phased suggestions (step count + backtick-quoted file count).

### Interactive mapping setup work
- Initial enhancement used `ctx.modelRegistry.getAvailable()` to enumerate models with configured auth.
- Grouped models by configured tier (`easy`, `medium`, `hard`) or `unassigned`.
- Added direct writing of `buckModelMapping` to `~/.pi/agent/settings.json`, avoiding manual JSON editing.

### Selector flicker diagnosis and fix
- Symptom: running `/b-build` opened the picker, but arrow keys caused flicker and selection was unclear/unusable.
- Findings from Pi docs:
  - `ctx.ui.select()` supports `↑/↓`, `Enter`, `Esc`
  - the selector API does not support a `default` option
  - Pi recommends `ctx.ui.custom()` + `SelectList` for richer selection UIs
- Root causes identified:
  - picker was opened too early from the `input` event, competing with editor/slash-command UI lifecycle
  - extension passed an unsupported `default` option to `ctx.ui.select()`
- Fix applied:
  - deferred model-switch/setup UI using a `pendingModelSwitchCommand` flag handled in `before_agent_start`
  - replaced `ctx.ui.select()` flow with a custom `SelectList` TUI picker
  - added explicit on-screen controls: `↑↓ navigate • Enter select • Esc cancel`
  - preserved preselection by moving the current choice to the top and by setting selected index in the custom picker

## Abandoned Approaches
- **Hard-coding provider/model IDs in b-phase output** — rejected because model catalogs change and the skill should stay durable.
- **Static confirmation-only mapping setup** — replaced because it still required the user to manually edit settings JSON.
- **Generic `ctx.ui.select()` inside the `input` event** — abandoned after diagnosing flicker/unusable selection behavior and discovering unsupported `default` usage.

## Verification
- `npx tsc --noEmit extensions/index.ts` passes (ignoring unrelated external `node_modules` typing issues).
- Pi docs reviewed for:
  - extension dialogs and selector semantics
  - TUI custom components
  - keybindings for selectors
  - `SelectList`-based patterns in shipped examples
- No end-to-end interactive runtime verification yet; still needs a real `/b-build` session after `/reload`.

## Files Modified
- `skills/b-phase/SKILL.md`
- `prompts/b-plan.md`
- `prompts/b-build.md`
- `prompts/b-build-hard.md`
- `extensions/index.ts`
- `docs/buck-workflow.md`
- `.context/2026-05-02.b-phase-model-hints/plan-b-phase-model-hints.md`
- `.context/2026-05-02.b-phase-model-hints/plan-model-auto-switch.md`
- `.context/memory/b-phase-model-hints-2026-05-02.md`
- `.context/memory/index.md`
- `.context/workflow/current-session.json`

## Next Steps
- [ ] Run `/reload` and test `/b-build` interactively to confirm the custom picker no longer flickers.
- [ ] Confirm selection works normally in the user’s terminal emulator.
- [ ] Test model auto-switch end-to-end with a real phased plan and configured `buckModelMapping`.
- [ ] Verify switch-back after `agent_end`.
- [ ] Verify manual mid-phase model change cancels switch-back.
- [ ] Decide later whether Buck should persist phase difficulty hints into backlog items or session state.
