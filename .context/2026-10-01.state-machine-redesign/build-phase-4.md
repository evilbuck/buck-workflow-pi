---
status: completed
date: 2026-10-01
phase: phase-4-delete-and-document.md
---

# Phase 4 build

## Scope and seams

Delete the unused legacy evaluator and its suite. Update only the phase-listed living docs and HTML surfaces; retain the guide’s eight-step recipe, copy controls, theme switch, and responsive layout. No production adapter changes.

The guide smoke crosses the real browser copy control → complete example files → portable module → publication file boundary. It type-checks the copied files and compares their executed standard output and publication bytes with the rendered expected blocks. It is a throwaway Playwright smoke, not a permanent source/wording test. Desktop/mobile browser inspection covers actual rendering, navigation, and themes.

## Pre-deletion evidence

At committed Phase 3 HEAD `61b4a11`, the repo consumer search found only the old evaluator’s own test and the living docs/guide slated for replacement outside historical paths. LSP references for the legacy `defineMachine` and `MachineFailure` resolve only within the old module and its test. `.context/`, `presentations/`, `docs/brainstorms/`, and `node_modules/` remain historical/excluded.

## Verification

- RED: the throwaway copied-recipe smoke failed because the old guide imported `../extensions/state-machine.js` rather than the portable module.
- GREEN: both smoke cases passed. The complete copied article machine, caller, safety checks, and strict type-check file execute with `extensions/state_machine/index.js`; executed output and published file bytes equal the displayed expected blocks.
- Safety smoke exercises not-a-target and guard-reject errors, exclusion of manual cancellation from automatic availability, deliberate manual cancellation, unknown restore, invalid graph, and moves out of a final state.
- `bun extensions/state_machine/examples/transmission.ts` passes, including the final-state-with-targets behavior.
- Actual Chromium surface: 1280×900 desktop and 390×844 mobile; screenshots/accessibility observations; light/dark switch; jump navigation to the run step; home `index.html` → guide link; zero horizontal overflow and no missing recipe anchors.
- A Tailwind runtime utility named `contents` overrode the guide sidebar display. Explicit `.contents { display: block; }` restores the intended desktop grid/sidebar; browser proof taken after the CSS correction.
- Post-deletion repo search paginated all 26 matching files; matches occur only under historical `.context/`. No living code/docs consumer remains. Legacy files are deleted.
- `npm test`: 78 Vitest files, 1373 passed / 6 skipped; Bun 70 passed / 0 failed. Exit 0.
- `npm run guardrails:check`: durable v2 pass; coverage 87.4% vs baseline 84%; no new/hard-ceiling complexity violations. Functional/lint gates remain disabled; patch coverage is advisory/null. Raw verdict: `guardrails-phase-4.json`. Proposed baseline raise not applied.
- `npm run subject-lifecycle:check`: `{"ok":true,"violations":[]}`. No direct subject lifecycle writes.
- `npm run context:validate`: 189 warnings / 2 errors. The errors are invalid `in-progress` statuses in untouched historical memories `mattpocock-adoption-2026-09-10.md` and `state-machine-module-build-2026-10-01.md`; no Phase 4 artifact errors. Existing research/index/overview metadata warnings remain out of scope.
- Temporary Playwright smoke removed; managed browser tab closed. No new permanent source/wording tests.

## Scope and next step

All Phase 4 acceptance criteria are verified. Phase 4 build is completed; review/save/commit remain pending. Phase 1–3 checkpoint commits are `c68e51b`, `52ce651`, and `61b4a11`.

The strict guide examples pass. Whole-project `npx tsc --noEmit -p .` was not rerun for this deletion/docs phase; the parent clean-project TypeScript criterion is intentionally left unchecked, following the earlier unresolved diagnostics recorded in the Phase 3 review.

Run `/b-review .context/2026-10-01.state-machine-redesign/phase-4-delete-and-document.md`, then `/b-save`, then `/b-commit`. No commit or push performed in this build.
