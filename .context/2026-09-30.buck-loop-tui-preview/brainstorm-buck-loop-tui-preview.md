---
status: draft
date: 2026-09-30
subject: 2026-09-30.buck-loop-tui-preview
---
# Buck-loop TUI styling preview

## User Goal
The operator can glance at Buck-loop and understand what it is doing, how the current phase is progressing, what decision is pending, and what each state has cost in tokens, without reading repetitive tool-event lines.

## What we might build
A fixture-driven preview inside the actual OMP terminal UI. Compare three layouts with keyboard controls: flow cards, compact ribbon, and vertical timeline. The renderer receives a presentation snapshot; this preview never runs Buck-loop, calls a model, edits project files, or connects to live work events.

### Captured requirements
- Show progression without repeating activity lines.
- Show the iteration count for the current phase, separately from a model retry attempt.
- Show the actual prior state, clearly marked current state, and expected happy-path next state.
- Represent pending legal choices and the selected choice/reason.
- Keep the activity window to two or three distinct semantic rows.
- Header identifies state and the work target.
- Show the current model and Buck-workflow skill/stage.
- Show current-state tokens and token counts for completed state visits.

## Constraints / preferences
- Perfect the appearance first; connect live events only after the operator accepts a layout.
- Stay in this subject folder. Do not change production extensions, runtime behavior, dependencies, or the active unphased-closeout work.
- Use the native OMP theme and above-editor widget, not a web imitation.
- All preview values are explicitly labelled sample data.
- The next-state node is an expectation, not a claimed transition; terminal/blocked states have no promised successor.
- Phase iteration means `iterateCyclesOnPhase`, not `loopCount`; retries have a separate attempt counter.
- A future live adapter must retain actual transition history and legal choices from the machine. Repeated state visits need separate usage accounting; unavailable usage must display an em dash, never zero.

## Preview implementation
- `preview.ts`: isolated OMP extension and keyboard controller.
- `render.ts`: pure presentation renderer and fixture snapshots.
- Launch with explicit `-e` and extension/skill/rule/tool discovery disabled.
- Compare layouts with `1`–`3`; move through scenarios with `n`/`b`; toggle replay with `p`; toggle narrow width with `w`; quit with `q`.
- Scenarios: building, reviewing, pending decision, iteration, model retry, blocked, committing, and completed.

## Repository evidence
`extensions/extension-activity.ts:304-316` appends tool start and tool end as separate rows. `extensions/buck-loop/index.ts:247` currently requests six activity rows at a fixed 64-character width. `Snapshot` already contains phase iteration count, last accepted choice, and transition history (`extensions/buck-loop/types.ts:158-180`). No production changes are part of this preview.

## Open questions
- Which visual hierarchy is easiest to scan at the operator's usual terminal size?
- Should completed visits be a compact token ledger or an expandable detail view? Preview the compact ledger first.
- Exact live usage semantics (input/output/cache/Jev attribution) remain an integration question; this prototype displays labelled input/output sample counts.

## Brainstorm notes
The user requested a quick way to test aesthetics before attaching live events. Decision: a deterministic, isolated native-terminal fixture gallery. No formal implementation plan or live integration has been requested.
