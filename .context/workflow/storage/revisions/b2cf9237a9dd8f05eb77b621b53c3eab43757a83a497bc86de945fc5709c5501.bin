---
status: completed
date: 2026-09-23
updated: 2026-09-23
subject: 2026-09-22.buck-loop-model-config
topics: [review, iteration, buck-models, complexity]
informs: []
addresses: phase-1-profile-config-and-resolution.md
completed: 2026-09-23
from_review: b-review
---

# Iteration: Phase 1 profile config and resolution

## Source
- Reviewed after: `/b-iterate` (phase 1 resolver/writer now present)
- Plan: `plan-buck-loop-model-config.md` steps 1–2
- Phase: `phase-1-profile-config-and-resolution.md`
- Spec: none

## Critical Issues

### 1. `resolveActiveName` exceeds the complexity hard ceiling
- **File**: `extensions/omp-models.ts`
- **Problem**: Durable guardrails (`npm run guardrails:check`, contract v2) fail `complexity_gate` (required). New violation and hard-ceiling violation: `resolveActiveName` cyclomatic 17, ceiling 15, new-function max 10. Phase verification requires that contract to pass before completion. `extensions/omp-models.test.ts` is 30/30, including the precedence cases this function implements, so the defect is the gate, not wrong fallthrough.
- **Proposed fix**: Flatten `resolveActiveName` (and any helper it splits into) so lizard reports ≤ 10. Keep the same observable rules: trimmed project active wins, blank project active uses the trimmed global active, both blank is `missing-active` with that name in `formatBuckStop`, and a name absent from both profile maps is `unknown-profile`. Do not edit `extensions/buck-loop/*`.

## Warnings

None in phase scope.

## Recommended Workflow

Start with `/b-iterate` — it will pick up this file automatically.
Then re-run `/b-review` against `phase-1-profile-config-and-resolution.md`.

## Resolution

`resolveActiveName` no longer nests `?.`, `??`, and `||`. Precedence is the same: trimmed project active wins, a blank project active uses the trimmed global active, both blank is `missing-active`, and a name in neither profile map is `unknown-profile`. Lizard reports CCN 3 for `resolveActiveName` and CCN ≤ 10 for the helpers. `extensions/buck-loop/*` was not edited.
Do not start phase 2. Do not fix buck-loop complexity in this iteration.
