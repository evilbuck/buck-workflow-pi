---
status: active
date: 2026-10-01
subject: 2026-09-30.buck-loop-tui-preview
topics: [tui, buck-loop, activity, spinner, jev, profiles]
research: []
iterations: []
spec: null
memory: []
sql_memory_ids:
  - 01a0fce8-dfed-7605-8a1e-15570c9b2469
---

# Plan: Stacked-cards Buck-loop activity with live integration

## User Goal
The operator watching a Buck-loop run can tell, in one glance, what state is running right now, what it has cost, what the legal continuations are, and what just happened — without reading a stream of repetitive tool-event lines. The display must work at a narrow terminal and must never invent information the machine does not actually have.

## Goal

Take the styling work proven in the fixture gallery and wire it to live Buck-loop events. The `renderPreview` seam becomes a production renderer that consumes real machine state, and the new card replaces the current six-row activity viewport for `/buck-loop`.

## Context used / assumptions

**User-provided context.** The operator reviewed the three gallery layouts live, preferred vertical timeline on information density, and asked for a "compact vertical" variant of the horizontal flow cards. That became the **Stacked cards** shape (layout key `4`). The operator specified the card's content: previous state with the model used and its tokens; current state that is obviously live, with tokens incrementing and a spinner; next states, plural, with happy-path versus sad-path indication. Emojis and Nerd Font glyphs are available. The operator then replaced "happy path" with **rank the choices with Jev and display most-likely first**, and asked that more than one density level exist (verbose and compact, and possibly more).

**Session context.** Four layouts now exist in the gallery. The Stacked cards shape renders correctly with a closed heavy box around CURRENT and a Jev-ranked choice list. The spinner is verified animating live. The gallery has never touched production code and its folder is untracked working-tree state.

**Artifacts used.** `brainstorm-buck-loop-tui-preview.md` in this subject folder carries the full decision record, including the machine-semantics findings and the corrected Loader integration.

**Scout-verified machine semantics** (`extensions/buck-loop/machine.ts`, `types.ts`):
- `Snapshot` (`types.ts:158-187`) has **no** `next` and **no** `choices` field. It carries `state`, `lastChoice`, and `history`.
- `next()` (`machine.ts:378-391`) and `legalChoices()` (`machine.ts:403-406`) share one source: the declarative guard table's available-target set mapped through `choiceFor()` (`machine.ts:370-374`), which yields the closed enum `retry | advance | iterate | document | save`.
- **The machine never ranks.** There is no expected, default, primary, or happy identifier. `choice.ts:14` states "Never default-advance"; the choice stage fails closed rather than guessing.
- `statusOf()` (`loop.ts:198-212`) is the only existing renderer and shows no alternates.

**Assumptions.**
- A live adapter can call `legalChoices()` / `next()` at render time to obtain the current legal set. This is the seam that replaces the fixture's invented `next`/`choices` fields.
- Ranking for display does not violate "Never default-advance": that rule forbids auto-selecting. The operator still chooses.
- The existing six-row activity viewport (`extensions/buck-loop/index.ts:247`) is replaced for `/buck-loop` only. Other long-running commands keep their current `createActivity` surface.
- Profile levels follow the operator-approved ladder below. If a level proves wrong in the live run, changing the ladder is a data change, not an architecture change.

## Decision Closure

**Selected course.** Build a pure `activity-view` renderer in `extensions/buck-loop/`, driven by a live adapter that projects machine state into a snapshot; replace the `/buck-loop` six-row activity widget with the stacked-cards output; render the ranked legal-choice set with a second Jev `score` call that affects display order only.

**Evidence for ranking being cheap.** `choice.ts:141-168` already calls `runJev` with a `choice`-type question and a per-kind rubric (`CONTINUATION_RUBRIC`). The Jev tool already exposes a `score` type over an ordered rubric (`extensions/jev-tool/index.ts:51`, and the `xd://jev` schema). No new dependency is required.

**Evidence the spinner needs no new primitive.** `@mariozechner/pi-tui@0.73.1` ships `Loader` (`dist/components/loader.d.ts`) with `frames`/`intervalMs`, and `ctx.ui.setWidget` has a component-factory overload (`@mariozechner/pi-coding-agent/dist/core/extensions/types.d.ts:96-98`) that supplies the `TUI` the `Loader` needs. Verified animating in the gallery: `⠧ → ⠙ → ⠴ → ⠏ → ⠼ → ⠇`.

**Excluded scope.** Full-screen TUI frameworks (Ink, OpenTUI, terminal-kit, blessed) are architecturally impossible here: the host owns the terminal and extensions receive only `ctx.ui` handles (`docs/oh-my-pi.md:51-58`). No dependency changes. No changes to the machine, the transition table, or `choiceFor()`.

**Bounded next action.** Implement the pure renderer plus its unit tests; no live wiring until the renderer is green.

## Assumptions Ledger

| ID | Assumption | Validation path |
|---|---|---|
| A1 | A live adapter can obtain the current legal choice set without changing the machine | Call `legalChoices(state, snapshot)` and `next()` in a unit test against a real `Snapshot` fixture; assert a non-empty set on a decision state and `[]` on a deterministic one |
| A2 | A second Jev call can rank the legal set without breaking the existing choice call | Unit-test the ranking helper with a stubbed `runJev`; assert it returns an order and never mutates `legal` or auto-selects |
| A3 | The pi-tui `Loader` animates inside the `/buck-loop` widget | Live smoke: run `/buck-loop`, sample the CURRENT row across ~2s, assert at least two distinct spinner glyphs |
| A4 | The pure renderer produces identical output for identical snapshot + width | Golden/round-trip unit test over all fixtures at 44, 80, and 110 columns |
| A5 | Replacing the six-row viewport does not lose information the operator relied on | Diff the fields the old viewport showed against the new card at the `verbose` profile; every old field must appear at verbose |

## Material Risks

| Risk | Impact | Recovery validation |
|---|---|---|
| Ranking is read by the operator as pre-selection, defeating "Never default-advance" | Silent trust violation in the core decision contract | Label the block `ranked, not pre-selected`; A2 asserts no auto-select; live smoke confirms the operator still picks |
| The `Loader` interval leaks when the loop is aborted | Stale spinner and a leaked timer after `/buck-loop` exits | Assert `dispose()` calls `loader.stop()` and `tui.removeChild(loader)`; run an abort mid-flight and confirm no repaint afterwards |
| Legal-choice ranking adds a Jev call to every decision, slowing the loop | Decision latency regression on a hot path | Only rank when `legal.length > 1`; measure the added call duration in live smoke and confirm the decision stage still completes |
| Narrow widths truncate the live row's tokens and spinner, the two most important fields | Violates the user goal exactly where it matters most | Resolve via the compact profile's reflow rule; A4 covers 44 columns |
| The new card drops tool-level detail the current viewport shows | Operators lose debugging visibility | Verbose profile must include the activity rows; A5 is the gate |

## Profile levels (operator-approved)

| Level | Previous | Current | Next / choices | Activity | Ledger |
|---|---|---|---|---|---|
| compact | omitted | state, skill, current tokens, spinner | single `→ STATE` line | omitted | omitted |
| standard | state, tokens, model | state, skill, tokens, spinner, attempt, phase iteration | `NEXT  STATE if no decision` plus ranked legal choices with scores | 3 rows | known run total |
| verbose | as standard, plus per-visit I/O split | as standard | as standard, plus full legal set and reason | all rows | past-visit list plus known run total |

Compact omits the previous row entirely. That is deliberate and is the point at which the compact profile starts to resemble the compact ribbon; if it collapses into the ribbon, the two should be unified rather than kept as separate entries.

## Scope

### In scope

- A pure renderer module that turns a snapshot plus a profile into lines, with no I/O, no timers, and no machine imports.
- A live adapter that projects real machine state into that snapshot, including the current legal choice set and the previous visit's model.
- Jev ranking of the legal set for display order, clearly labelled as advisory.
- The pi-tui `Loader` wired into the `/buck-loop` widget with correct registration and disposal.
- The `/buck-loop` widget switching from the six-row activity viewport to the stacked-cards output.
- Unit tests for the renderer, the profile ladder, the ranking helper, and the snapshot projection.
- A docs paragraph describing the card and its line contract.

### Out of scope

- Any change to the machine, transition table, `choiceFor()`, or the closed `Choice` enum.
- Any change to how `/buck-loop` *chooses*; only display order is affected.
- Changes to other long-running commands' `createActivity` surfaces.
- Full-screen TUI frameworks and new dependencies.
- Realtime streaming token increments beyond what the machine already exposes at render time.
- Nerd Font glyph selection beyond the spinner and spine already in use.
- Any automatic compaction or loop behaviour driven by the displayed percentage; context usage is read for the operator only, and `ctx.compact()` stays operator-initiated.

## Affected files

| Path | Change |
|---|---|
| `extensions/buck-loop/activity-view.ts` | New pure renderer: snapshot + profile + width to lines. |
| `extensions/buck-loop/activity-view.test.ts` | Line shape per profile, width bounds, no-choices case, leak checks. |
| `extensions/buck-loop/activity-snapshot.ts` | New projection from real machine state to the render snapshot, including legal choices and previous visit model. |
| `extensions/buck-loop/activity-snapshot.test.ts` | Projection against real `Snapshot` fixtures; legal set present on decision states, empty on deterministic ones. |
| `extensions/buck-loop/choice-ranking.ts` | Jev `score` ranking of the legal set; returns order only, never a selection. |
| `extensions/buck-loop/choice-ranking.test.ts` | Ordering correctness; asserts no mutation of the legal set and no auto-select. |
| `extensions/buck-loop/index.ts` | Register the card widget with a `Loader`; retire the six-row activity request. |
| `extensions/buck-loop/index.test.ts` | Widget registration, profile selection, dispose behaviour. |
| `docs/buck-loop.md` | One paragraph: the card, the three profiles, and the advisory-ranking rule. |
| `extensions/buck-loop/activity-view.ts` | Add `context: ContextView` to the render snapshot; render the context line per profile. |
| `extensions/buck-loop/activity-widget.ts` | Add `context(usage)` to the card surface; store the last child usage and render it. |
| `extensions/buck-loop/run-step.ts` | Extend `SessionHandle` with `getContextUsage`; sample the **child** session's usage in the existing `session.subscribe` callback and forward it as a new optional dep. |
| `extensions/buck-loop/loop.ts` | Declare and thread the new optional dep (e.g. `onContextUsage`) through `LoopDeps` alongside `onSessionEvent`. |
| `extensions/buck-loop/index.ts` | Wire the dep to `card.context(...)`. |
| `extensions/buck-loop/index.test.ts` | Assert the context line renders, updates on usage events, and degrades when usage is unknown. |

## Implementation steps

1. Port the Stacked cards renderer from the gallery into `activity-view.ts` as a pure function over a typed snapshot and a `Profile` of `compact | standard | verbose`. Drop the fixture-only `next` field; the snapshot carries an explicit `legalChoices` list and an optional `expectedState`.
2. Add the three profile levels per the table above. Compact omits the previous row; verbose includes activity rows and the past-visit ledger.
3. Resolve the narrow-width conflict: at widths below the card's minimum, compact reflows the current row so tokens and the spinner are never truncated. Standard and verbose may truncate lower-priority fields instead, never the current row's tokens or spinner.
4. Write `activity-snapshot.ts` to project a real `Snapshot` into the render snapshot: current state, skill, model, current usage, previous visit with its model, phase iteration, attempt, and the legal set from `legalChoices()` / `next()`.
5. Write `choice-ranking.ts` using the existing `runJev` plumbing with a `score` question over the legal kinds, reusing `CONTINUATION_RUBRIC`. Return an ordering; never return a selection. Only call when the legal set has more than one member.
6. Wire the card into `/buck-loop`: register a `setWidget` component, construct a `Loader` with the spinner frames, `tui.addChild(loader)`, `loader.start()`, and in `dispose()` call `loader.stop()` and `tui.removeChild(loader)`. Read the live glyph from `loader.render(width)[1]`, since index 0 is a padding line.
7. Retire the six-row activity request for `/buck-loop` only, after step 6 renders correctly.
8. Add the profile switch to the `/buck-loop` command surface so the operator can change density at runtime.
9. Update `docs/buck-loop.md`.
10. Run the focused suites and `npm run guardrails:check`.

### Addendum 2026-10-01 — context window usage and percentage

**Operator request (mid-flight).** The card must show how much context the current phase is using, as an absolute count and a percentage of the model's context window. This was added after steps 1–6 had already been implemented in the current `/b-iterate` run.

**Which session is measured.** The number that matters is the **child** session's — the nested agent that runs the phase — not the parent's. `/buck-loop` spawns a per-stage child via `createAgentSession` (`run-step.ts:462`) pinned to that stage's model and its own context window. The card's `ActivityCardUI` is built from the parent command's `ctx.ui` (`index.ts:263`), so `ctx.getContextUsage()` on `ExtensionContext` would report the **parent's** context — the supervisor's chat, not the phase's work. That is the wrong number and it would move for reasons unrelated to the phase.

11. Add a `context` field to the render snapshot carrying `{ usedTokens, contextWindow, percent }`. Source it from the **child** session: `createAgentSession` returns a live session exposing `getContextUsage(): ContextUsage | undefined` (`agent-session.d.ts:574`). `ContextUsage` is `{ tokens: number | null, contextWindow: number, percent: number | null }` (`types.d.ts:192-198`); `percent` is null exactly when `tokens` is null, which is expected right after compaction.
12. Extend `SessionHandle` (`run-step.ts:169-175`) with `getContextUsage` — it currently declares only `prompt`, `abort`, `subscribe`, `dispose`, and `messages`, so the cast to `SessionHandle` drops the method at the type boundary. Sample the child's usage inside the existing `session.subscribe` callback (`run-step.ts:473`) and forward it through a new optional dep beside `onSessionEvent`, e.g. `onContextUsage(usage)`.
13. Declare `onContextUsage` on `LoopDeps` in `loop.ts` next to `onSessionEvent` (`loop.ts:136`), thread it through `runNestedSkill`, and wire it in `index.ts` to `card.context(usage)`. Sampling in the subscribe callback rather than on a repaint timer is deliberate: the child already emits events continuously, so this adds no timer and no provider polling, and it naturally resets per stage because a new child session starts each stage.
14. Render the context line per profile: `verbose` shows `ctx 42.0k / 200k · 21%` plus the per-visit I/O split; `standard` shows `ctx 21%`; `compact` shows the percentage only, because that is the last row the operator can afford at narrow widths. The line must never displace the current row's tokens or spinner — the same protection step 3 established for those two fields applies here.
15. Degrade explicitly when usage is unknown. `tokens` and `percent` are both nullable; when they are `null`, render the context window size alone (`ctx /200k`) rather than a fabricated `0%`. Never display a zero for an unknown value — the plan's standing rule is that the display must never invent information the machine does not have.

**Assumptions added.**

| ID | Assumption | Validation path |
|---|---|---|
| A6 | The child session returned by `createAgentSession` exposes `getContextUsage` and returns non-null usage during a live phase | Unit test `run-step` with a stubbed `SessionHandle` whose `getContextUsage` returns a fixed `ContextUsage`; drive one synthetic session event and assert the dep fires with that value. A second test with the method returning `undefined` asserts the degraded form |
| A7 | Rendering the context line does not push the card past its width budget at 44 columns | Extend the A4 width sweep to the context line; assert the current row's tokens and spinner remain untruncated in all three profiles |
| A8 | The reported usage is the child's, not the parent's | Live smoke: compare the card's percentage against the **child** stage session's own usage for that phase, not against the parent chat's. They must differ — if they track the parent's number, the wiring regressed to the parent source |

**Scope note.** This addendum changes display only. It does not touch the machine, the transition table, `choiceFor()`, the legal-choice set, or ranking. The percentage is read for the operator and is never used to trigger compaction or to change loop behaviour; compaction stays operator-initiated on the child.

**Verification added.**

- `bun test extensions/buck-loop/activity-view.test.ts extensions/buck-loop/run-step.test.ts extensions/buck-loop/index.test.ts` — assert the context line at each profile, that the dep fires with the child's usage on a session event, that a later usage event updates the rendered percentage, and that `undefined` usage degrades to the window-size-only form.
- Live smoke: run `/buck-loop` through one phase and confirm the percentage rises **during the phase** and matches that phase's child session usage. Comparing against the parent chat's readout is not a valid check — see A8.

## Acceptance criteria

- [ ] A pure renderer produces lines for every profile at 44, 80, and 110 columns, with no I/O or timer dependency.
- [ ] The compact profile never truncates the current row's token count or spinner at any supported width.
- [ ] The current row is enclosed by a closed heavy box, not underlined, in every profile.
- [ ] A deterministic state renders a plain `→ STATE` line and no ranked list.
- [ ] A decision state renders the full legal set ranked by Jev, most-likely first, with a visible advisory label.
- [ ] Ranking never auto-selects and never mutates the legal set; a unit test asserts both.
- [ ] The previous visit shows its model and its token cost.
- [ ] The spinner animates during a live run; two distinct glyphs are observed across two seconds.
- [ ] Aborting or finishing the loop disposes the Loader with no leaked interval and no repaint afterwards.
- [ ] Every field the retired six-row viewport showed is present at the verbose profile.
- [ ] The machine, transition table, and choice-selection behaviour are unchanged.
- [ ] Focused tests and `npm run guardrails:check` pass.
- [ ] The card shows current context usage and its percentage of the context window, sourced from the **child** stage session's `getContextUsage()`.
- [ ] The reported percentage tracks the running phase's child session, not the parent supervisor chat.
- [ ] The context percentage updates during a live phase rather than being cached from stage entry.
- [ ] Unknown context usage renders as window-size-only; no fabricated `0%` is ever shown.

## Verification

- `bun test extensions/buck-loop/activity-view.test.ts extensions/buck-loop/activity-snapshot.test.ts extensions/buck-loop/choice-ranking.test.ts extensions/buck-loop/index.test.ts`
- `npm run guardrails:check`
- Live smoke, `/buck-loop`: run one phase to a decision state; confirm the card shows previous-with-model, current-with-spinner, and the ranked legal set; switch profiles with the runtime control and confirm each level's field set.
- Live smoke, animation: sample the current row across two seconds and record the distinct spinner glyphs observed.
- Live smoke, narrow: run in a 44-column terminal and confirm compact keeps tokens and spinner visible.
- Live smoke, teardown: abort a run mid-flight and confirm the widget clears and nothing keeps repainting.

## Risks

| Failure mode | Impact | Mitigation | Rollback |
|---|---|---|---|
| The live adapter cannot obtain the legal set cleanly | No ranked choices; card falls back to a plain next line | A1 validates before step 5 depends on it | Render without ranking; the card still shows state, model, and tokens |
| Ranking reads as pre-selection | Violates the machine's explicit no-default rule | Advisory label; A2 asserts no auto-select | Drop ranking; show the legal set unranked |
| The Loader misbehaves inside the loop widget | Spinner stuck or blank | A3 smoke test; reuse the verified gallery wiring verbatim | Fall back to `setStatus` for the spinner line, as production does at `extension-activity.ts:215` |
| Replacing the six-row viewport loses detail | Debugging regression | Verbose profile must carry the activity rows; A5 gates it | Keep both widgets, verbose on demand |
| Profile ladder turns out wrong in practice | Wasted design | Profiles are a data change, isolated in the renderer | Adjust the ladder without touching the adapter |

## Execution Instructions

This is a non-phased execution-ready plan. Treat the whole plan as one unit:

1. Run `/b-build` (or `/b-build-hard` if the live adapter turns out ambiguous) against this plan.
2. Run `/b-review` against this plan.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this plan), do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, receipts, and review artifacts.
5. Run `/b-commit` to checkpoint durable state.
