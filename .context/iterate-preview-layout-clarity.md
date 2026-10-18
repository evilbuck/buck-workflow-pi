---
status: completed
date: 2026-10-01
updated: 2026-10-01
completed: 2026-10-01
subject: 2026-09-30.buck-loop-tui-preview
related:
  - preview.ts
  - README.md
---
# Preview layout clarity

## User Goal
The operator can see that three alternative layouts exist, identify each one, and know which is currently selected when running `/buck-loop-preview`.

## Reported issue
The user cannot clearly see the three alternatives. The original control footer showed only the active layout's name and a generic `1–3 layout` hint. Treat the observation as the bug evidence; do not ask the user to reproduce it.

## Focused correction
- Put all three named layout options above the sample panel, mark the selected one, and separate layout selection from scenario selection.
- Use the terminal SDK's key matcher for number and letter shortcuts; add Tab to cycle layouts.
- Explain that Flow cards uses a stacked fallback below 80 columns, so it can resemble the vertical layout when narrow.
- Keep the same fixture data and native theme. Do not change production Buck-loop or attach live events.

## Verification
Native OMP 18.4.5 smoke passed: all eight scenarios in all three layouts at 110 and 44 columns, both with 44-row viewports. All three names and the selected marker were visible in every frame. Wide box/ribbon/timeline forms were distinct. Plain and Kitty/CSI-u number keys, Tab cycling and wraparound, ignored release events, encoded scenario/narrow/replay controls, and encoded close/reopen were exercised. Strict TypeScript NodeNext checking passed after the source change.

README updated. Production code and dependencies remain unchanged; the `.context/`-only preview is exempt from the production guardrails gate. Inline review checked layout-versus-scenario controls, width bounds at the exercised sizes, and preserved widget/timer cleanup.
