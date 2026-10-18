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

## Machine semantics for next-state display (2026-10-01 session)

A scout read of the production machine settled how the next-state block must be built:

- `Snapshot` (`extensions/buck-loop/types.ts:158-187`) has **no** `next` or `choices` field. It carries `state`, `lastChoice`, and `history`. `next` is a function, not data.
- `next()` and `legalChoices()` (`machine.ts:378-406`) share one source: the declarative guard table's available-target set mapped through `choiceFor()`. `choiceFor` (`machine.ts:370-374`) maps targets onto the closed enum: `retry`, `advance`, `iterate`, `document`, `save`.
- **The machine never ranks.** There is no expected, default, primary, or happy identifier anywhere. `choice.ts:14` states "Never default-advance" and the choice stage fails closed rather than guessing.
- The only existing renderer, `statusOf()` (`loop.ts:198-212`), returns state and reason and shows no alternates.

Consequence: a "happy path" cannot be read from machine data. Inventing one in the renderer would contradict the machine's explicit design.

### Decision: rank the choices with Jev for display order

The operator's answer to "happy vs sad path" is to **rank the legal choices with Jev and display them most-likely first**, rather than assert a fixed happy path.

- This does not violate "Never default-advance": that rule forbids *auto-selecting*. Ranking for display still leaves the operator choosing.
- The plumbing already exists. `choice.ts:141-168` calls `runJev` with a `choice`-type question and a per-kind rubric (`CONTINUATION_RUBRIC`). The Jev tool already supports a `score` type on an ordered rubric, which is the ranking primitive. No new dependency is needed.
- The ranked list is **advisory presentation order**, and the UI should say so, so the operator is not misled into thinking the machine pre-selected.

The fixture data must be corrected to match: the fixtures currently use state names for `next` ("documenting") and choice names for `choices` ("document"), which the real machine never produces, and which made a string-comparison dedup look broken when it was actually two different vocabularies.

## Open questions
- Exact live usage semantics (input/output/cache/Jev attribution) remain an integration question; this prototype displays labelled input/output sample counts.
- The operator is defining the three profile levels by hand; the field budget for each is not yet written down.
- Whether flow cards and compact ribbon remain first-class shapes after the profile axis lands, or are demoted to variants.
- Which existing TypeScript TUI primitives supply the animated spinner and live-updating rows, rather than hand-rolling them. Under research.

## Stacked cards shape (2026-10-01 session)

The operator asked for the flow-card idea in a compact vertical form. A fourth shape, **Stacked cards** (layout key `4`), was added to the gallery.

It keeps the flow card's identity — box frame, a spine of `◀ ◉ ⇢ ↳`, a heavy separator marking the active section — but stacks the cards vertically instead of placing them side by side. Same information in roughly 8 lines where flow cards needs about 13.

### Rendered form

```
  ╭────────────────────────────────────────────────────────╮
  ◀ PREVIOUS  BUILDING · 24.1k tokens
  ├────────────────────────────────────────────────────────┤
  ╟════════════════════════════════════════════════════════╢
  ◉ CURRENT   REVIEWING · review · 7.2k tokens ⠹
  ╟════════════════════════════════════════════════════════╢
  ├────────────────────────────────────────────────────────┤
  ? NEXT      DOCUMENTING if no decision
     78%  document
     14%  save
  ╰────────────────────────────────────────────────────────╯
```

### Styling decisions

- **CURRENT is a closed heavy box, not an underline.** The operator's correction: a heavy seam only *below* the current row read as underlined rather than selected. It now carries heavy top, heavy bottom, and `╟`/`╢` sides, so the box is closed on all four edges. The rest of the card stays light.
- **A ranked choice list replaces the happy/sad split.** Deterministic transitions show a plain `NEXT ⇢ state · automatic` line. Ambiguous ones show `NEXT  state if no decision` followed by the Jev-ranked legal choices with their scores, sorted most-likely first, and `▸` marking the actual selection. Ranking and selection are visually independent, which is the point: the operator still chooses.
- The redundant `Choices: [...]` line was removed from this layout, since the card now carries the choice set itself. The free-text `reason` is kept below the card.

### Open conflict: fixed card width truncates the live row

The card clamps itself to 58 columns, so at a 44-column panel the current row truncates to `CURRENT REVIEWING · review · ...` — **the token count and the spinner are exactly what gets dropped**, and those are the two elements the operator's vertical-timeline contract calls most important.

This is a real conflict between the card's fixed width and the compact profile still to be defined. It should be settled by the profile design (for example, letting the card adopt the panel width and reflowing its rows, or moving tokens onto a separate line at narrow widths) rather than patched here.

## Available TUI primitives (2026-10-01 session, scout-verified)

Both hard requirements — an animated spinner and a live-updating row — are already satisfied by installed dependencies. Do not hand-roll them.

### `@mariozechner/pi-tui@0.73.1` (devDependency, `package.json:104-107`)

- **`Loader`** (`node_modules/@mariozechner/pi-tui/dist/components/loader.d.ts`) is a real animated spinner, not a static glyph: `constructor(ui, spinnerColorFn, messageColorFn, message?, indicator?: { frames?, intervalMs? })` plus `start()`, `stop()`, `setMessage()`, `setIndicator()`. It extends `Text`, so it composes like any other component.
- **`CancellableLoader`** adds `AbortSignal` and Escape handling for abortable work.
- **Width engine** (`dist/utils.js:1-29,145-165`) already handles `Intl.Segmenter`, `eastAsianWidth`, an RGI emoji regex, and regional-indicator pairs. Emoji and Nerd Font glyphs are measured correctly by `visibleWidth`; no custom width math is needed.
- Helpers already in use: `visibleWidth`, `wrapTextWithAnsi`, `truncateToWidth`, `sliceByColumn`, `matchesKey`, `isKeyRelease`, `KeybindingsManager`.

### OMP extension UI contract

- `ctx.ui.setWidget` has a **component-factory overload** (`@mariozechner/pi-coding-agent/dist/core/extensions/types.d.ts:96-98`): it hands the extension the live `TUI` instance and the `Theme`, returning a `Component & { dispose?() }`. That is precisely the constructor `Loader` requires, so a widget can own a real spinner.
- `ctx.ui.setStatus(key, text)` is the cheaper single-line status path, already used by `extensions/tps-tracker.ts:26,62-64`.
- `Theme.fg/bg/bold/italic` is the only sanctioned styling surface; the widget does not own colors itself.

### Architectural constraint: full-screen frameworks are excluded

The host (OMP/Pi interactive mode) owns the terminal and its differential render loop. Extensions receive only `ctx.ui` handles, so Ink, OpenTUI, terminal-kit, and blessed **cannot** be used from an extension. This is the documented convention (`docs/oh-my-pi.md:51-58`: footer spinner plus aboveEditor live widget) and matches shipped code.

`extensions/extension-activity.ts:25-30` is a hand-rolled braille spinner driving `setStatus` plus `setWidget`. That is the existing precedent for live progress, and the new work should compose with it rather than replace it.

### Correction to the earlier spinner decision

The earlier note that the spinner is out of scope for the preview was based on the assumption that animation would require building a tick loop by hand. `Loader` plus the `setWidget` component overload removes that cost, so the spinner can be prototyped in the preview rather than deferred to the live adapter. The decision still stands that the *realtime token increment* is a live-adapter concern, because that depends on streaming usage data the fixture gallery does not have.

### Verified Loader integration (2026-10-01)

The pi-tui `Loader` **does** animate inside a `setWidget` component. Verified live in the preview: frames cycle `⠧ → ⠙ → ⠴ → ⠏ → ⠼ → ⠇`.

Two integration facts that were initially gotten wrong and cost real time:

1. **`Loader.render()` returns `["", ...super.render(width)]`** (`node_modules/@mariozechner/pi-tui/dist/components/loader.js:22-24`). The indicator glyph is at **index 1**; index 0 is always an empty padding line. Reading index 0 makes the spinner look permanently blank, which is easy to misdiagnose as "animation does not work in this host".
2. **The `Loader` must be registered with the widget's `TUI` via `tui.addChild(loader)`**, and `loader.start()` must be called. `start()` internally calls `ui.requestComponentRender(this)`, so a partial TUI stub throws `requestComponentRender is not a function`.

`dispose()` must call `loader.stop()` and `tui.removeChild(loader)` to avoid leaking an interval and an orphaned component into the host's tree.

The lesson worth keeping: when a third-party component appears inert, check its `render()` output shape before concluding the host cannot host it. Two separate "this cannot work" conclusions in this session were actually one off-by-one read.

## Profile axis (2026-10-01 session)

The three existing layouts are a single axis with a hardcoded detail set per layout. The operator wants **more than one version of a layout** — at minimum a verbose and a compact version, and possibly more. This makes detail level a first-class axis orthogonal to shape.

| Axis | Values today | Notes |
|---|---|---|
| Shape | flow cards / compact ribbon / vertical timeline | Spatial layout. |
| Profile | compact / standard / verbose | Which fields appear and how much detail each carries. |

The operator has not yet defined which fields belong to each profile level; that is the next open question.

### Vertical timeline as the default shape

The operator judged vertical timeline the strongest of the three on information density per line. It is the only shape guaranteed to render at narrow widths (flow cards silently falls back to it below 76 columns). The default-shape decision is deferred until the profiles render.

### Current shape of the code

`renderPreview(snapshot, layout: number, theme, width)` takes the layout as a bare integer, and `preview.ts` hardcodes `layoutKeys = ["1","2","3"]`, the `"${layout + 1} OF 3"` counter, and a `layout === 0 && width < 80` width warning. Layout identity is integer comparison in three places and the count is baked into the UI copy. Adding a profile axis means replacing the bare integer with a named value and making the selector enumerate `shape × profile` instead of three fixed options.

## Vertical timeline contract (2026-10-01 session)

The operator specified what the current vertical timeline must show:

1. **Previous** — the state that ran, the tokens it cost, and the model used. The model is missing today: `Visit` in `render.ts` carries `label/state/usage` only.
2. **Current** — must be obvious it is being worked on, with tokens incrementing in realtime and a spinner activity notification.
3. **Next states** — plural, with icon or text labels distinguishing the happy path from the sad path (example given: `b-review → b-save | b-docs` versus `b-review → b-iterate`).
4. Emoji and Nerd Font glyphs are available for decoration.

Decisions taken on the three questions this raised:

- **Next-state fan-out is candidate successors, from the machine's legal choices.** `Snapshot.choices` is already available in the machine. The machine knows the legal set, not which option will be taken, so the fan-out is presented as candidates with the happy path marked rather than as a promised transition. This narrows the existing "expected next state is not a claimed transition" constraint rather than contradicting it.
- **The spinner and realtime token increment are out of scope for the preview.** The gallery is a static fixture renderer with no tick loop; animation is a requirement on the future live adapter and is recorded here so it is not lost.
- The operator is defining the three profile levels directly; the field budget per level is still open.

## Preview running surface (2026-10-01 session)

The preview runs in a Herdr pane on the workspace tab labelled **tui preview** (tab `wP:t15`, pane `wP:p49`). It is launched with `bash .context/2026-09-30.buck-loop-tui-preview/run-preview.sh`. tmux is not used.

## Brainstorm notes
The user requested a quick way to test aesthetics before attaching live events. Decision: a deterministic, isolated native-terminal fixture gallery. No formal implementation plan or live integration has been requested.

Continued 2026-10-01 as a back-and-forth review of the three live layouts. The operator preferred vertical timeline on information density, and asked for a profile (density) axis so more than one version of a layout can exist. The vertical timeline's content contract was specified in detail: previous state with model and tokens, current state with live spinner and incrementing tokens, and a fan-out of candidate next states marking the happy path. Emojis and Nerd Font glyphs are available. Preview stays static; animation belongs to the live adapter. The operator is writing the three profile levels by hand.
