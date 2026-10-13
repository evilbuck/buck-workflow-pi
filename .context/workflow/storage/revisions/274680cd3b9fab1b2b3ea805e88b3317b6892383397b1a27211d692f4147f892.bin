---
status: completed
date: 2026-09-24
updated: 2026-09-24
subject: 2026-09-22.buck-loop-model-config
topics: [review, iteration, buck-models]
informs: []
addresses: phase-5-buck-models-command.md
completed: 2026-09-24
from_review: b-review
---

# Iteration: Phase 5 `/buck-models` command

## Source
- Reviewed after: `/b-build`
- Plan: `plan-buck-loop-model-config.md` step 6
- Phase: `phase-5-buck-models-command.md`
- Spec: none

## Critical Issues

### 1. Existing model rows are not visible or preserved by the real host input
- **File**: `extensions/buck-models/index.ts:28-31, 96-108, 129-152`
- **Problem**: `editStages` passes `formatRows(effective.stage?.models ?? [])` as the second argument to `ui.input` and models that argument as an initial value. The host contract defines it as a placeholder (`ExtensionUIContext.input(title, placeholder, opts)`), and the installed interactive component currently ignores that placeholder and starts with an empty `Input`. Consequently, editing an existing profile does not display or prefill its model ids/notes; submitting a stage without manually retyping every row replaces it with an empty model list. The thinking selector similarly has no current-value/default marker. This violates the phase's edit and round-trip requirements and can silently destroy the selected profile's stage configuration.
- **Proposed fix**: Treat the input's second argument only as a placeholder. Add an explicit per-stage keep/edit decision that shows the current source and formatted model rows; omit unchanged stages from `BuckProfileWrite.stages`, and prompt for rows only when the engineer chooses to replace them. Add a `Keep current (<level>)` thinking option (or equivalent explicit unchanged path) so model-only edits preserve thinking. Cover an existing profile with non-empty models, notes, and non-`off` thinking using a host-faithful fake where `input` starts empty and the second argument is not returned as a value; prove an unchanged stage is byte-semantically preserved and an edited stage alone changes.

### 2. Reserved selector text creates an uneditable profile
- **File**: `extensions/buck-models/index.ts:117-133`
- **Problem**: The create/edit selector uses the visible string `Create a new profile` as its control sentinel, while the profile-name input accepts that exact string. After creating such a valid YAML profile, choosing it from the edit list is indistinguishable from choosing the create action and prompts for another name. The engineer can activate the profile but cannot edit it through `/buck-models`, violating the create/name/edit contract.
- **Proposed fix**: Reject the reserved selector label as a profile name with a clear non-writing validation message, or render profile choices with labels that cannot collide with the stored name and map the selected label back to the original profile name. Add a command regression that creates or loads the colliding name and proves the command either rejects it before save or can select and edit it.

### 3. Unavailable ids in kept or activation-only stages are never warned
- **File**: `extensions/buck-models/index.ts:217-229`
- **Problem**: `unavailableIds` receives only the sparse `stages` update. Stages kept during editing are omitted from that object, and activation-only updates always pass `{}`. Saving or activating a profile that already contains unavailable model ids therefore emits no warning, contrary to the acceptance criterion that unavailable ids produce a non-blocking warning before save.
- **Proposed fix**: Build the warning set from the effective post-edit profile, overlaying edited stages onto the selected profile with project/global fallthrough, then compare every configured id with the current registry. Keep warning behavior non-blocking. Add regressions for an unchanged unavailable id during edit and for activation-only save.

### 4. Notes containing commas do not round-trip through the command editor
- **File**: `extensions/buck-models/index.ts:98-109`
- **Problem**: `formatRows` emits each model as `id | note` and joins candidates with `, `, while `parseRows` splits every comma with no escaping. A valid note such as `fast, cheap` is displayed as `provider/model | fast, cheap` and then parsed as two candidates (`provider/model` with note `fast`, plus model id `cheap`). The Phase 1 schema accepts arbitrary note strings, so editing and saving this profile corrupts the note and candidate list. This violates the Phase 5 optional-note and round-trip acceptance criteria.
- **Proposed fix**: Use an unambiguous editing representation that round-trips arbitrary notes (for example, one candidate per line with the first `|` separating id from note), or define and implement escaping for delimiters. Add a command regression with a comma-containing note that edits and saves the stage, then assert the parsed YAML retains exactly one candidate and the complete note.

## Warnings

None.

## Resolved Issue 1

- Added an explicit keep/edit decision for every stage. The prompt displays ownership, current model rows, notes, and thinking.
- Unchanged stages are omitted from `BuckProfileWrite.stages`, so the lossless writer preserves them.
- Edited stages treat the host input value as replacement text and the second argument only as a placeholder.
- A `Keep current (<level>)` thinking choice preserves thinking during model-only edits.
- Added a host-faithful regression covering non-empty rows, notes, and thinking. Focused tests passed 5/5; the unit gate passed 982/982. Lint is disabled by the durable contract.

## Resolved Issue 2

- Existing profiles now render as `Edit profile: <stored name>` choices and map back to their original names by index, keeping control labels outside the profile-name namespace.
- Added a regression that edits the valid profile name `Create a new profile` and proves no display-label profile is created.
- Focused tests passed 6/6; the light unit gate passed 983/983. Lint is disabled and has no command in the durable contract.

## Resolved Issue 3

- Availability warnings now inspect the effective post-edit profile: explicit stage replacements overlay project-owned or user-global-fallthrough stages, while kept stages retain their effective values.
- Activation-only saves inspect every effective stage in the selected profile.
- Existing edit and activation regressions now prove unavailable ids in kept and activation-only stages produce non-blocking warnings.
- Focused tests passed 6/6; the light unit gate passed 983/983 Vitest tests and 70/70 Bun tests. Lint is disabled and has no command in the durable contract.

## Resolved Issue 4

- Candidate rows now escape commas and backslashes with `\`, preserving arbitrary comma-containing notes while retaining the compact comma-separated editor.
- The stage prompt documents `\,` for literal commas, and existing values display in that escaped form.
- Added a regression that edits and saves `provider/original | fast\, cheap`, then proves the parsed profile still has exactly one candidate with note `fast, cheap`.
- Focused tests passed 7/7; the light unit gate passed 984/984 Vitest tests and 70/70 Bun tests. Lint is disabled and has no command in the durable contract.

## Recommended Workflow

Start with `/b-iterate` — it will pick up this file automatically.
Then re-run `/b-review` against `phase-5-buck-models-command.md`.
Inside an OMP execution session, the iterate artifact is not done until it is completed, review passes, and `/b-save` has recorded durable state.
