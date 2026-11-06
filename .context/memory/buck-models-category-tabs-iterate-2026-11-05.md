---
date: 2026-11-05
domains: [tui, testing, guardrails]
topics: [buck-models, profile-editor, clipping, cursor-clamp, live-smoke, coverage-baseline]
related: [iterate-category-tabs.md, plan-category-tabs.md]
priority: high
status: completed
subject: 2026-11-05.buck-models-category-tabs
artifacts:
  - extensions/buck-models/model-picker.ts
  - extensions/buck-models/model-picker.test.ts
  - .context/2026-11-05.buck-models-category-tabs/plan-category-tabs.md
  - .context/2026-11-05.buck-models-category-tabs/iterate-category-tabs.md
---

# buck-models category tabs — review iteration

## Decisions

- **Save button moved into fixed chrome.** `paint()` now emits `title / tab strip / help / meta`, then the `> [ Save ]` button, then the edit list. Because the button precedes the list, no edit count can push it off-screen. `savePane` clips the list to `terminalRows - SAVE_CHROME_ROWS(4) - 2` (button + tail reservation) and appends `+N more edit(s)`; `paint()` also slices to `terminalRows()` as a boundary guarantee.
- **Row budget arithmetic is the load-bearing detail.** The first attempt reserved only the tail (`rows - 4 - 1`), which silently swallowed the `+N more` line at 80×16 — caught by live resize, not by the unit test. Budget must subtract chrome + button + tail.
- **Catalog removal clamps `selectedCursor`** exactly as the selected-column removal branch already did.

## Evidence

- New tests fail against the pre-fix source (`git stash` of `model-picker.ts`): cursor remained 1 and the save-pane height test produced 18 lines at 17 rows. Both pass after the fix.
- `npx vitest run extensions/buck-models/` → 76 passed. Typecheck: 144 pre-existing project diagnostics, none in `extensions/buck-models`.
- Live TUI smoke (isolated `OMP_AGENT_DIR`, disposable project config, `--no-extensions` + explicit loader):
  - **OMP 18.16.0** 120×40: tab navigation, Shift+Tab (delivered as kitty `\x1b[9;2u`, `matchesKey` handles it), filtered catalog add, selected-column remove, Ctrl+T round trip (high → medium), Save tab list, activation decline, save confirm; project YAML written with notes retained and an unrelated `unrelated.keep` key plus its comment preserved; global file untouched.
  - **OMP** 80×24 (cancel path, both files byte-identical), 80×18 / 80×16 (12 edits: 16 rendered lines, Save visible, 10 listed + `+2 more`), 40×16 (resize-needed view; Esc cancels), `--doctor` (3 configured occurrences, 2 unavailable, per-stage ownership), user-global scope edit (only the global file changed; note retained, `active` preserved), activation-only flow (stages untouched).
  - **Pi** 120×40: Tab navigation, build baseline (thinking high, project-owned, 2 selected, notes, unavailable markers), cancel left both files byte-identical.
- Guardrails (`npm run guardrails:check`): all required gates pass; coverage 89.6 vs baseline 89.6, target 90 (advisory miss), patch gate `pass` with `patch: null`, no new complexity violations.

## Coverage baseline note (review warning 3)

`guardrails.json:ratchet.baseline_coverage` was raised 84 → 89.6 inside the feature commit (732eb36) without a recorded measurement. Measured value at this iteration is exactly 89.6 with the required ratchet gate green, so the raise is a tightening, not a softening; reverting to 84 would weaken the ratchet and requires explicit user approval, so the baseline is left at 89.6 and the measurement is recorded here. No headroom remains, and the 90 target is still unmet (advisory).

## Abandoned approaches

- Instrumented `handleInput`/`paint` with temporary `/tmp` logging to test a suspected Tab-delivery defect. Tab was delivered and applied; the misleading captures came from a smoke fixture that nested stages under a nonexistent `stages:` key, so no baseline parsed. Instrumentation was removed.
