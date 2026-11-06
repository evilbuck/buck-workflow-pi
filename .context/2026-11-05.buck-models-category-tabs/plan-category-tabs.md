---
status: active
date: 2026-11-05
subject: 2026-11-05.buck-models-category-tabs
topics: [buck-models, tui, category-tabs, model-profiles]
research: []
iterations: []
memory: []
---

# Plan: Tabbed category editor for /buck-models

## User Goal

"the user can navigate between the tabs to easily skip setting up models for a category this is already configured."

## Goal

Replace the sequential per-category keep/edit checklist with one tabbed editor: one tab per existing Buck stage, two model columns per category, and a final Save tab containing one Save button. Preserve profile selection, scope selection, activation, final write confirmation, config format, and runtime routing.

## Context used / assumptions

- User request: category tabs, selected models beside the existing filterable model catalog, an explicit final Save tab, and otherwise unchanged save/scope flow.
- User clarification: use a per-tab shortcut to open the existing thinking-level choices; switching tabs must not trigger questions.
- Active-session capability probe: `full`; `probe_source: system available-skills catalog`; `b-build`, `b-review`, `b-save` all available; no missing sentinels.
- `extensions/buck-models/index.ts:167-209` currently visits every stage in order, prompts keep/edit, invokes a separate model checklist, then asks for thinking.
- `index.ts:104-119` computes scope ownership and project-to-global fallthrough. `index.ts:381-439` owns profile/scope selection, activation and final write confirmation.
- `extensions/buck-models/model-picker.ts` already supplies fuzzy filtering, host-native keybindings, unavailable-id retention, order-preserving selections, and saved-note preservation.
- `extensions/omp-models.ts:190-203` defines 12 canonical categories: brainstorm-plan, phase, build, review, iterate, save, commit, docs, choice, research, grill, present. Keep those keys; do not invent a new `plan` configuration key.
- `extensions/omp-models.ts:534-549` merges partial stage writes. An absent stage update preserves ownership/fallthrough; a present empty models list is an explicit override.
- Existing behavioral coverage in `index.test.ts` includes project/global saves, activation-only, notes/thinking preservation, fallthrough, cancellation, and registry failure. Migrate these behaviors, not the obsolete prompt sequence.
- `docs/howto/configure-buck-model-profiles.md` documents the current picker and override semantics.
- Durable project-memory search returned no matches. SQL recall failed with parameter binding (`there is no parameter $2`), not an empty-store result; current repository code and docs are the planning evidence.
- No brainstorm, research, or spec is required for this bounded change. No external dependencies or runtime model-selection changes.

## Scope

- A single custom TUI editor for the selected profile, using existing `ui.custom` and pi-tui primitives.
- Canonical category order followed by a final Save action tab. Label the existing `save` category `save (models)` to distinguish it from the final `Save` action without changing its config key.
- Selected models on the left; the existing fuzzy-filterable model catalog on the right.
- Prompt-free category navigation and in-memory category edits, including thinking changes.
- Preserve skipped categories, metadata, unavailable ids, and existing write safeguards.
- Update focused behavioral tests and the existing configuration how-to.

## Out of scope

- Config/schema changes, renamed stage keys, category creation/reordering, profile-management redesign, or changing prompt order outside category editing.
- Changes to Jev selection, `picker.ts`, runtime routing, doctor behavior, or model availability/authentication checks.
- Editing candidate notes, model reorder controls, new bulk actions, mouse support, extra Save-tab controls, or automatic writes.
- Existing separate backlog items for write-error feedback and Settings API integration.

## Interaction contract

1. Keep the current scope → action → profile prompts before the editor. Activation-only skips the editor as today.
2. `Tab` advances category/action tabs; `Shift+Tab` reverses, wrapping at the ends. Tab changes never commit to disk or prompt. Show the active tab, category ownership, selected count, thinking level, and key help. Scroll the tab strip horizontally to keep the active tab visible.
3. `Left`/`Right` changes column focus. `Up`/`Down` moves within that column. Start in the catalog so typing immediately filters. Show a visible focus marker, not color alone.
4. Catalog typing/backspace keeps the existing fuzzy filter behavior. `Space` or `Enter` toggles a catalog model. In the selected column, `Space` or `Enter` removes the highlighted model. Neither key submits the profile from a category tab. Prevent duplicates; preserve retained-model order and append newly selected models.
5. The selected column is independent of the catalog filter: filtering never hides chosen models on the left. Retain existing unavailable saved ids, mark them visibly, and allow removal/reselection through the catalog's existing saved-id union.
6. Store selection, filter, cursor/scroll position, and focused column per category; restore them on revisit. Empty selections and zero filter results remain navigable, including when the live catalog is empty. Do not inherit the old picker's global no-choices rejection when other tabs and Save remain meaningful.
7. `Ctrl+T` opens the existing thinking choices for the active category; ordinary `t` still filters. Preserve the current thinking unless the user changes it. Canceling only this prompt returns to the editor unchanged. Avoid nested custom dialogs: return a typed thinking-request action plus editor state, run the existing select prompt, then reopen the editor at the same tab/state.
8. Build a partial stage update from deliberate edits only. Merely visiting/filtering tabs or opening/canceling thinking must not materialize inherited stages. A net-no-op edit returns to untouched state. Removing the last model from a previously populated stage produces an explicit empty override, not omission.
9. The last tab is labeled `Save`. Its pane contains one actionable control, `Save`; Enter/Space activates it. Tab navigation remains available to go back. Its button returns the draft update to the existing activation prompt, unavailable-id warning, and final save confirmation. Only the existing confirmed persistence path writes.
10. `Esc` cancels the entire editor without writes. Declining the final write confirmation also leaves disk unchanged. No new discard confirmation.
11. Render both columns within terminal width with ANSI-aware width helpers, independent viewport scrolling, and ellipsis for long ids. Keep active tab, focus, and controls reachable at small sizes; do not hide Save behind an overflowing tab strip. Verify 120×40, 80×24, and 40×16 terminals, with a clear resize-needed view if the component cannot safely fit its controls.

## Affected files

| File | Change |
|---|---|
| `extensions/buck-models/model-picker.ts` | Replace the single-stage checklist with the tabbed profile editor, typed editor state/actions, two-column rendering and navigation; reuse selection/note helpers where useful. |
| `extensions/buck-models/index.ts` | Replace sequential `editStages` and the per-stage picker dependency with the profile-editor loop; retain existing scope/profile/activation/writer boundaries. |
| `extensions/buck-models/model-picker.test.ts` | Replace obsolete checklist-submit tests with tab/editor state-transition and rendering-boundary coverage. |
| `extensions/buck-models/index.test.ts` | Migrate command harness to the new editor boundary; preserve consumer-visible persistence/cancellation/inheritance coverage. |
| `docs/howto/configure-buck-model-profiles.md` | Replace sequential keep/edit instructions with tab navigation, column controls, thinking shortcut and final Save action. |

## Implementation steps

1. Define the profile-editor input, per-category draft state, and typed outcomes (cancel, thinking request with resume state, submit). Seed from effective stages and ownership. Keep original stages immutable; compare edited candidates/thinking to the baseline to derive partial writes. Before replacing exported picker symbols, use available language-server references and migrate every caller; do not keep compatibility aliases.
2. Replace the checklist component in `model-picker.ts` with the tab strip and two independently scrollable columns. Reuse fuzzy filtering, candidate-note reconstruction, ANSI-aware clipping, and host keybindings. Add complete keyboard navigation, per-tab state, empty states and the final Save pane. Keep the new component local to buck-models; no shared tab framework.
3. Replace `editStages` with one profile-editor loop in `index.ts`. On thinking requests, reuse current choices and resume the draft; on submission, return only changed stages; on cancel, return null. Preserve existing scope/profile/activation/final-confirm/write flow and activation-only route. Remove obsolete keep/edit constants and old picker API/callers.
4. Update the two existing test files at behavior boundaries. Retain note/order/unavailable-id coverage, project/global merge semantics, explicit empty overrides, activation-only, registry errors, and no-write cancellation. Remove prompt-copy and forwarding assertions tied only to the retired wizard.
5. Exercise the actual TUI and save path in disposable project/global config locations, then update the existing how-to to the proven interactions. Run focused tests and the durable guardrails contract after the coherent implementation batch.

## Acceptance criteria

- [x] All 12 canonical categories are reachable as tabs, plus a distinct final Save tab. No keep/edit sequence remains.
- [x] A user can jump past configured categories, edit one later category, revisit earlier tabs, and submit without answering questions for skipped categories.
- [x] Both columns remain visible; the selected list is independent of catalog filtering. Add/remove actions update selection immediately and do not submit the profile.
- [x] Per-category drafts, filters, cursor/focus and thinking survive navigation and thinking-prompt round trips without cross-category leakage.
- [x] Unchanged and net-no-op categories are omitted from the update; inherited project stages stay inherited. Modified stages preserve retained notes/order and current thinking unless explicitly changed.
- [x] Unavailable saved models remain visible and retainable/removable; new models are deduplicated; clearing a populated stage persists an explicit empty list.
- [x] `Ctrl+T` offers the same thinking choices; cancel is non-destructive; ordinary `t` remains a filter character.
- [x] Only the Save-tab button submits the editor. Scope, profile creation/editing/activation, unavailable-id warning and final write confirmation retain their existing behavior.
- [x] Escape from any tab, or rejecting final write confirmation, produces no disk changes. Activation-only and `--doctor` remain unchanged.
- [x] Keyboard-only operation works at the stated terminal sizes; active tab, focus and Save are reachable; rendered lines do not exceed width.
- [x] Existing how-to reflects the shipped controls; focused behavior tests and required guardrails gates pass.

*2026-11-05 Jev wrap-up (`jev-1.14.0`, one `noul` per criterion, threshold ≥ 0.7): c1 0.93, c2 0.92, c3 0.93, c4 0.94, c5 0.94, c6 0.93, c7 0.95, c8 0.94, c9 0.95, c10 0.93, c11 0.95 — all met → all boxes checked.*

Subsequent review found that reselecting a retained model followed by a thinking change could reorder the saved models; the initial c5 judgment missed this combined action. Serialization now restores retained baseline order and appends new IDs. The combined-action regression failed before the fix and passes afterward.

## Decision Closure

- **Selected course:** replace only the sequential category UI with a local tabbed editor. Maintain the partial-write boundary and existing confirmation pipeline. Use a thinking action/resume loop rather than nested custom dialogs or automatic prompts.
- **Evidence:** user requested prompt-free category skipping and unchanged save/scope flow; user chose per-tab thinking shortcut. Existing effective-stage lookup and partial writer already support retaining skipped categories. Keyboard focus and inherited-stage writes are material interaction/data-preservation boundaries.
- **Excluded scope:** no schema, runtime picker, doctor, dependency, profile-management or unrelated write-error work.
- **Next action:** implement the local editor contract and integrate it with the existing profile-update path, starting with state transitions and partial-write semantics.

## Assumptions Ledger

| id | statement | status | blocking | evidence / validation_path |
|---|---|---|---|---|
| A-1 | Skipping a project category must preserve global fallthrough rather than copying effective models into project scope. | validated | false | `effectiveStage` in `index.ts:104-119`, partial update merge in `omp-models.ts:534-549`, documented presence semantics. |
| A-2 | Thinking remains user-editable without interrupting tab navigation. | validated | false | User selected “Per-tab shortcut”; existing `THINKING_CHOICES` and thinking prompt remain the semantic source. |
| A-3 | The chosen key chords and narrow-terminal layout work in the installed Pi/OMP TUI hosts. | validated | false | 2026-11-05 live smoke in OMP 18.16.0 and Pi with disposable configs: Tab/`Shift+Tab` (kitty `\x1b[9;2u`), Ctrl+T, filtering, column navigation, Save at 120×40, 80×24, 80×18, 80×16; 40×16 shows the resize-needed view. See `## Verification → Live smoke record`. |

## Material Risks

| failure_mode | impact | mitigation | rollback_or_fallback | validation_path |
|---|---|---|---|---|
| Visiting a tab or toggling back to baseline writes an inherited stage locally. | Project unintentionally stops following global profile updates. | Immutable baseline; net-change comparison; serialize only changed stages. | Before final confirmation, cancel/reject to retain the original config; if found during validation, correct the delta calculation before release. | Integration fixture with global-only categories: visit/filter/no-op-edit them, change another stage, save and assert absent project keys remain absent; cancellation fixture compares original file bytes. |
| Tab/column key handling traps focus or hides Save on narrow terminals. | Keyboard users cannot finish configuration. | Distinct key roles, visible focus markers, scrolled tab strip, bounded column viewports and safe resize-needed view. | Escape exits without writes; resize and reopen retain saved config rather than accepting a malformed editor state. | Actual TUI smoke at all stated sizes; from both columns and Save verify Esc exits and original config bytes remain unchanged; resize to a supported size and reopen successfully. |
| Thinking prompt round trip drops draft state or leaks one category into another. | Wrong models/thinking are saved. | Explicit editor resume state and stage-keyed action outcomes; no nested custom dialogs. | Cancel the editor before persistence; correct state ownership before release. | Edit two categories, set/cancel thinking on one, revisit both and save; assert only intended models/thinking changed. Repeat with Esc and prove no write. |

## Verification

- Focused suite after implementation: `npx vitest run extensions/buck-models/model-picker.test.ts extensions/buck-models/index.test.ts`. Tests must prove transitions and persisted config semantics, not source text, labels, or mock forwarding.
- Regression suite: run existing buck-models picker/doctor and model-config behavior through the durable repository check runner, `npm run guardrails:check`; required gate failures block completion and must not be waived implicitly.
- Live smoke (not replaced by component tests): launch the actual extension in isolated Pi and OMP TUI sessions with disposable project config and isolated global agent config. Do not save to the user's real profile files. Prepare one local stage, one global-only stage with notes/high thinking, one unavailable id, and unconfigured categories.
- Navigate forward/backward through all tabs including `save (models)` and final Save; filter/add/remove models, revisit tabs, round-trip thinking, and preserve the global-only category while editing another. Save through existing activation/write prompts; inspect parsed project/global YAML for exact intended changes and preservation of unrelated YAML.
- Repeat a global-scope edit and an activation-only command; exercise `--doctor` without writes. Cancel from category/Save tabs and reject final write confirmation; compare both config files byte-for-byte.
- Inspect actual rendered output at 120×40, 80×24 and 40×16 with long ids, empty matches, zero available models, and more selected models than the viewport; verify visible focus and usable tab/Save navigation. Record which hosts and dimensions were actually exercised.

- Planning-session validation passed: required frontmatter fields/identity, 13 required sections, five existing affected paths, and backlog metadata/link checked by an executable assertion script. Lifecycle `inspect --json` reports canonical active state, revision 2. Full YAML-parser validation was unavailable in the eval process (`Cannot find module 'yaml'`); field/structure assertions were used instead. Only `.context/` artifacts changed; implementation tests and guardrails were not run, and no behavioral pass is claimed.

### Live smoke record (2026-11-05, post-iteration)

Isolated run: `OMP_AGENT_DIR` pointed at a disposable agent dir, project config in a `/tmp` project, both hosts launched with `--no-extensions` plus an explicit loader for `extensions/buck-models/index.ts`; no user profile files were touched.

| Host | Size | Exercised | Result |
|---|---|---|---|
| OMP 18.16.0 | 120×40 | all tabs, Space add/remove, filter, Ctrl+T round trip (high → medium), Save tab → activation decline → save confirm | project YAML written with notes kept, unrelated `unrelated.keep` key and its comment preserved, global file untouched |
| OMP 18.16.0 | 80×24 | edit then Esc | both config files byte-identical |
| OMP 18.16.0 | 80×18 / 80×16 | 12 deliberate edits on the Save tab | 16 rendered lines at 16 rows, `[ Save ]` visible, 10 edits listed + `+2 more` |
| OMP 18.16.0 | 40×16 | open editor | resize-needed view, Esc cancels |
| OMP 18.16.0 | 120×40 | `--doctor` | 3 configured occurrences, 2 unavailable, per-stage ownership correct |
| OMP 18.16.0 | 120×40 | user-global scope edit; activation-only | only the global file changed (note kept, `active` preserved); activation-only left stages untouched |
| Pi | 120×40 | tab navigation, build baseline, edit then Esc | build stage shows thinking high, project-owned, 2 selected with notes/unavailable markers; both config files byte-identical |

Host key encoding: `Tab` arrives as `"\t"` and `Shift+Tab` as the kitty form `\x1b[9;2u`; `matchesKey` handles both, so A-3's key-encoding path is validated, not merely assumed.

## Risks

- Save is both an existing stage name and the requested final action; display labels distinguish them without a schema change.
- A two-column UI reduces visible id width; clipping must be ANSI-aware and never alter stored ids.
- The profile editor is a bounded stateful UI change but does not justify a new dependency or cross-extension tab abstraction.

## Execution Instructions

One build/review cycle is sufficient: five affected files, one extension boundary, no schema change. Recommended next step: `/b-build` against this plan, then `/b-review` and the normal conditional docs/save/commit flow. No phasing required.

Optional OMP `goal` recommendation: this is one persistent objective with no phase boundary; the non-phased budget hint is 12,000 tokens. This is a recommendation only: do not set `omp_execution` or start goal mode without user confirmation.
