---
date: 2026-09-24
domains: [extensions, testing, workflow]
topics: [model-profiles, buck-models, phase-5, tui]
related: [buck-model-config-phase-4-save-2026-09-24.md]
priority: high
status: completed
subject: 2026-09-22.buck-loop-model-config
artifacts: [phase-5-buck-models-command.md, plan-buck-loop-model-config.md, plan-buck-loop-model-config-phases.md, iterate-phase-5-buck-models-command.md, review-phase-5-buck-models-command-2026-09-24.md, draft-commit.md]
---

# Phase 5 `/buck-models` build and iteration

## User Goal

Engineers create, edit, and activate portable named Buck model profiles without hand-editing YAML.

## Decisions

- `/buck-models` offers project and user-global scopes, separate create/edit and activation-only paths, and one shared editor loop over the twelve canonical stage groups.
- Candidate input uses comma-separated `id | optional note` rows with backslash escaping for commas and backslashes, so arbitrary notes round-trip without becoming extra candidates. Thinking offers omitted/off plus `minimal`, `low`, `medium`, `high`, and `xhigh`.
- Each project-scope stage prompt identifies project ownership, user-global fallthrough, or unset state. Portable unavailable ids warn but remain saveable.
- Writes occur only after the complete interaction and final confirmation, through `writeBuckModelsScope`; cancellation leaves files untouched.
- Review found that the host treats `ui.input`'s second argument as a placeholder, not an initial value. Stage editing now starts with an explicit keep/edit choice that displays current ownership, rows, notes, and thinking.
- Keeping a stage omits it from the write update. Editing models offers `Keep current (<level>)` for thinking, preventing model-only edits from resetting the stage's thinking level.
- Existing profile choices use `Edit profile: <stored name>` display labels mapped back by index. This keeps the create-action sentinel outside the stored-name namespace, including for a profile literally named `Create a new profile`.
- Availability warnings inspect the effective post-edit selected profile rather than only sparse stage updates. Kept and user-global-fallthrough stages are included, and activation-only saves inspect all effective stages.
- All four in-plan review fixes are complete. Final re-review approved Phase 5 with one out-of-plan warning; Phase 6 remains pending.
- The review warning about surfacing config write failures in the command UI is tracked in `.context/backlog/items/buck-models-write-error-feedback.md`.

## Files Modified

- `extensions/buck-models/index.ts`
- `extensions/buck-models/index.test.ts`
- `extensions/index.ts`
- `extensions/buck-mode.test.ts`
- `.context/2026-09-22.buck-loop-model-config/phase-5-buck-models-command.md`
- `.context/2026-09-22.buck-loop-model-config/plan-buck-loop-model-config-phases.md`
- `.context/2026-09-22.buck-loop-model-config/draft-commit.md`
- `.context/2026-09-22.buck-loop-model-config/iterate-phase-5-buck-models-command.md`
- `.context/2026-09-22.buck-loop-model-config/review-phase-5-buck-models-command-2026-09-24.md`
- `.context/backlog/archive/2026-09/phase-5-buck-models-command.md`
- `.context/backlog/items/buck-models-write-error-feedback.md`

## Verification

- Focused Vitest after the final iteration: 7/7 passed in `extensions/buck-models/index.test.ts`, covering host-placeholder behavior, the create-label/profile-name collision, unavailable ids in kept and activation-only stages, and escaped comma-containing notes.
- Light deterministic unit gate after the final iteration: 65 files and 984 Vitest tests passed; 70/70 Bun tests passed. Lint is disabled and has no command in the durable contract.
- The regressions invoke the registered command callback against real temporary YAML files. Existing stages preserve omitted data unless explicitly edited, unavailable ids warn across the complete effective selected profile, a profile named `Create a new profile` remains editable, and `fast\, cheap` round-trips as one candidate note. Visual TUI verification remained unavailable in the nested tool surface.
- The earlier full durable guardrails v2 run passed: global coverage 87.2% vs 84% baseline; complexity pass; patch gate advisory because patch coverage was unavailable; lint and functional gates skipped by contract.
- Supplemental `tsc --noEmit` remains red on unrelated repository-wide test and Bun typing debt. A filtered rerun reported no errors in `extensions/buck-models/`; this command is not part of the deterministic contract.
- Final `/b-review` verdict: Pass with warning; no in-plan defects remain. The warning is separately backlogged.
