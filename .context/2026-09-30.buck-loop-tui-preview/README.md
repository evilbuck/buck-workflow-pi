---
status: draft
date: 2026-09-30
subject: 2026-09-30.buck-loop-tui-preview
---
# Buck-loop native styling preview

An isolated fixture gallery inside OMP's actual above-editor widget. It uses the native theme and terminal renderer. All state, model, token, and activity values are labelled sample data; it does not run Buck-loop or call a model.

## Run

From the repository root:

```bash
bash .context/2026-09-30.buck-loop-tui-preview/run-preview.sh
```

The gallery opens automatically. It is also already running in a dedicated tmux session:

```bash
tmux attach -t buck-loop-style-preview
```

The launcher disables extension discovery, skills, rules, built-in tools, LSP, session saving, and title generation. Only this explicitly loaded preview extension runs. `q` closes the gallery and returns to the idle OMP editor; press Ctrl+C twice to exit OMP. Do not send a normal chat prompt if you want to keep this a zero-model-call preview.

## Controls

| Key | Action |
| --- | --- |
| `1` | Flow cards: prior, prominent current, expected next |
| `2` | Compact ribbon: least vertical space |
| `3` | Vertical timeline: readable in a narrow terminal |
| Tab | Cycle through the three layouts |
| `n` / `b` or right / left | Next / previous scenario |
| `p` | Toggle automatic scenario replay |
| `w` | Toggle a 44-column panel without resizing your terminal |
| `q` / Esc / Ctrl+C | Close the gallery; clear its widget and replay timer |
| `/buck-loop-preview` | Reopen the gallery after closing it |

All three layout names are displayed above the sample panel. The active option has a `>` marker and `SELECTED` label. Layout keys and scenario keys are separate: `1`–`3` / Tab change the layout; `n` / `b` change the scenario. Number and letter shortcuts use the terminal SDK key matcher, including Kitty/CSI-u input; release events are ignored.

Below 80 columns, Flow cards uses the existing stacked fallback, which can resemble Vertical timeline. The preview now explicitly labels that fallback.

Scenarios: building, reviewing, pending choice, iteration, model retry, blocked, committing, completed. Choices in this gallery are illustrative fixture data, not a computed set from the live machine.

## What to judge

- Can you identify current state, work target, model, stage, and phase iteration at a glance?
- Is the expected next state clearly a forecast rather than a committed route?
- Are three activity rows enough without repeating each tool start and finish?
- Is the current state's I/O plus the completed-visit token ledger useful, or too dense?
- Compare `1` and `2` at your usual terminal size; `3` is the narrow-screen alternative.

The phase iteration and model retry attempt are separate. Completed state visits retain separate token entries. Unknown/not-run usage displays an em dash. The total is labelled **known run total**, not a fabricated complete total when a failed call has no usage.

## Verified

Executed in OMP 18.4.5, using the real widget and keyboard controller:

- All eight scenarios in all three layouts at 110 and 44 terminal columns, with a 44-row viewport: 48 native frames exercised. All three option names and the correct selected marker remained visible; wide layouts were checked for their distinct box/ribbon/timeline forms.
- Pending choices, selected iteration choice, phase iteration versus retry attempt, blocked/no-next display, and completed token ledger observed.
- Replay advanced a scenario and paused; narrow toggle worked; closing removed the widget; reopening reset the gallery.
- Follow-up on 2026-10-01: plain and Kitty/CSI-u shortcuts, Tab cycling/wraparound, ignored release events, encoded scenario/narrow controls, and encoded close followed by `/buck-loop-preview` reopening were exercised in native OMP.
- Strict TypeScript NodeNext check for both preview files and `bash -n` for the launcher passed.
- Native desktop capture is unavailable in this environment; verification used the running terminal's actual rendered screen via tmux, not a web mockup.

Only `.context/2026-09-30.buck-loop-tui-preview/` was written by this work. Production extensions, dependencies, existing backlog, and other work-in-progress were not changed. The project's check contract classifies `.context/` paths as documentation/context-only, so the production guardrails gate is skipped. This throwaway gallery has no permanent tests.

## Next boundary

Pick/tune the presentation before live integration. The pure `renderPreview(snapshot, layout, theme, width)` function is the seam to preserve. A later adapter can project real phase/model/transition/choice/usage events into that snapshot and coalesce each tool operation into one row. The gallery is not that adapter, and the production UI has not changed.

The dedicated preview session has been restarted with the clearer selector. Restart any separately launched preview process to load changes; its entry module/renderer may remain cached in an already-running OMP session.
