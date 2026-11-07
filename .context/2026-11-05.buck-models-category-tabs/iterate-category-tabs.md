---
status: completed
date: 2026-11-05
updated: 2026-11-05
subject: 2026-11-05.buck-models-category-tabs
topics: [review, iteration, buck-models, tui]
informs: []
addresses: plan-category-tabs.md
completed: 2026-11-05
from_review: b-review
---

# Iteration: 2026-11-05.buck-models-category-tabs

## Source
- Reviewed after: `/b-build` (commit `732eb36`)
- Plan: `plan-category-tabs.md`
- Spec: none

## Critical Issues

### 1. Save pane is unclipped, so the only submit control falls off the terminal between 10 and 17 rows
- **File**: `extensions/buck-models/model-picker.ts:304-318` (`savePane`), `:207-215` (`rowCapacity`, `resizeNeeded`), `:320-351` (`paint`)
- **Problem**: Every category pane bounds its body by `rowCapacity()` (terminal rows − `EDITOR_CHROME_ROWS` = 7, clamped to 3…12). `savePane()` emits `changed.length` lines plus two, unbounded, and `paint` emits the chrome (5 lines) + save pane. `resizeNeeded()` only rejects `rows < 10` and `width < 60`, so at any height in 10…17 the component renders more lines than the terminal has while claiming a usable size — no resize notice, no scrolling, and the `> [ Save ]` line is the *last* line, so it is the first thing clipped. Measured with the real component (12 stages each holding one model, `terminalRows()` set, `render(80)`):
  ```
  80x24 lines=18 saveVisible  |  80x18 lines=18 saveVisible  |  80x17 lines=18 saveVisible=false
  80x16 lines=18 saveVisible=false | 80x12 lines=12 saveVisible=false | 60x10 lines=10 saveVisible=false
  40x16 lines=3 resizeView (the only size that shows the notice)
  ```
  Enter/Space still submits while the button is invisible, so the user sees a Save tab with a truncated edit list and no submit control. Violates interaction contract item 11 ("active tab, focus, and controls reachable at small sizes … do not hide Save") and defeats acceptance criterion c10 outside the three sizes the tests cover. `model-picker.test.ts:387-404` asserts only *width* for every line and never asserts `lines.length <= terminalRows()`, so the regression is untested.
- **Proposed fix**: Make the Save button part of the fixed chrome (render it directly under the `meta` line, before the edit list) and clip the edit list to `rowCapacity()` with a `+N more` tail; alternatively extend `resizeNeeded()` to require the rows that the current edit count needs. Either way, `paint()` must never return more lines than `input.terminalRows()`. Add a test that, with every stage edited, asserts `render(width).length <= terminalRows()` for rows 40, 24, 20, 18, 17, 16, 12, 10, and that the `[ Save ]` line is inside that bound.

### 2. Removing a selected model from the catalog leaves `selectedCursor` past the end, so the SELECTED column loses its focus marker and keyboard removal
- **File**: `extensions/buck-models/model-picker.ts:407-433` (`handleToggle`, catalog branch), contrast `:414-425` (selected branch, which does clamp)
- **Problem**: The selected-column branch clamps `selectedCursor` after a splice; the catalog branch splices the same array without clamping. Removing an earlier model while the SELECTED cursor sits on a later one leaves `selectedCursor` out of range, so `selectedRowText` is never called with `focused === true` for any row — the column renders with no `>` marker even though it has focus — and a subsequent `Space`/`Enter` in that column is a no-op (`draft.ids[view.selectedCursor]` is `undefined`). Reproduced against the built component: cursor 1, ids `[aaa/one, bbb/two]` → catalog-toggle `aaa/one` → `cursor=1`, `ids=[bbb/two]`, `inRange=false`, `markedRows=0`, `Space` changes nothing. Violates interaction contract item 3 ("Show a visible focus marker, not color alone") and item 4 (Space/Enter removes the highlighted model). No test covers catalog-side removal while the selected cursor is beyond the new length.
- **Proposed fix**: clamp after the catalog removal exactly as the selected branch does:
  ```ts
  if (at >= 0) {
    draft.ids.splice(at, 1);
    if (draft.ids.length > 0 && view.selectedCursor >= draft.ids.length) {
      view.selectedCursor = draft.ids.length - 1;
    }
  } else draft.ids.push(id);
  ```
  Verified in an isolated copy: cursor clamps to 0, `inRange=true`, a focus marker renders, and the next `Space` removes the last model. Add a regression test for this sequence (select `down`, focus catalog, toggle an earlier id, return to SELECTED, `Space`).

## Warnings

### 1. Stale module header describes the retired checklist
- **File**: `extensions/buck-models/model-picker.ts:1-4`
- **Problem**: The file now holds the tabbed profile editor, but the header still says "Searchable checkbox list of installed model ids … Enter saves the checked set."
- **Suggested approach**: Rewrite the header to describe the tabbed editor, the typed outcomes, and the partial-write boundary.

### 2. Live TUI smoke from the plan's Verification section has no recorded evidence
- **File**: `.context/2026-11-05.buck-models-category-tabs/plan-category-tabs.md` (Verification, `:130-133`)
- **Problem**: Plan step 5 requires exercising the actual extension in isolated Pi/OMP sessions at 120×40, 80×24, and 40×16 with disposable configs, plus byte-for-byte cancellation comparison. Nothing in the subject, memory, or commit records that run, so host key encoding (`Ctrl+T`, `Shift+Tab`), real overlay clipping, and the activation-only/`--doctor` paths are unproven in a live host.
- **Suggested approach**: Run the smoke after fixing the two defects above and record which hosts and dimensions were exercised in the plan's Verification section, or record an explicit override.

### 3. `guardrails.json` baseline was raised inside a feature commit with no recorded approval
- **File**: `guardrails.json:19`
- **Problem**: `baseline_coverage` moved 84 → 89.6 in the same commit as the feature, and `guardrails.json` is not in the plan's affected files. The raise is monotonic (tightening, not softening) and the current run is green at exactly 89.6, but it leaves the ratchet with zero headroom and no recorded measurement or approval in the subject.
- **Suggested approach**: Either revert to 84 (the gate still passes at 89.6 measured) or record the measurement and the approval in the subject's memory.

### 4. Coverage target 90 is missed at 89.6
- **File**: `guardrails.json:14` (`targets.coverage_min: 75`, `coverage_target: 90`)
- **Problem**: The global-ratchet gate passes, but the repo's stated coverage target is not met and `patch_gate` is `advisory` with `patch: null`, so the new editor code is not patch-covered as a gate.
- **Suggested approach**: Not blocking. Fold into the same follow-up that resolves the baseline question.

## Recommended Workflow

Start with `/b-iterate` — it will pick up this file automatically.
Then re-run `/b-review` against the same plan or phase.
Inside an OMP execution session, `/b-iterate` completes this artifact before it returns; the supervisor then re-reviews. Do not leave the file `active` waiting for review or save.
