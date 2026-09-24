---
date: 2026-09-23
domains: [extensions, testing]
topics: [buck-models, jev, model-picker, phase-2]
related: [buck-model-config-phase-1-save-2026-09-23.md]
priority: high
status: completed
subject: 2026-09-22.buck-loop-model-config
artifacts: [phase-2-typesafe-model-picker.md, plan-buck-loop-model-config-phases.md, draft-commit.md]
---

# Phase 2 TypeSafe model picker

## User Goal

Engineers switch named profiles that map Buck stage groups to model-id sets and thinking levels, without silent host-model fallback.

## Decisions

- Seam is `createBuckModelPicker({ evaluate, random }).pick()`. Default evaluator is `createTypeSafeEvaluator()`; tests inject both seams.
- Choice criteria are remaining ids. A non-empty note is the criterion text; an empty note sends the id alone.
- State carries stage, skill, candidate ids/notes, and the caller-supplied context unchanged.
- A Jev choice runs only if it is a member of the remaining set. Confidence is returned and never gated.
- Unavailable, error, missing answer, and a non-member answer use `Math.floor(random() * length)`. An out-of-range index returns the named-stage `no-candidates` stop, not `candidates[0]`.
- `exclude` filters a copy. Exhaustion returns `no-candidates` with the stage name and excluded ids. No host model.

## Files Modified

- `extensions/buck-models/picker.ts`
- `extensions/buck-models/picker.test.ts`
- Phase 2 status and overview table

## Verification

- `npx vitest run extensions/buck-models/picker.test.ts --reporter=verbose`: 5 passed.
- Throwaway smoke: Jev selected `provider/b`, random selected `provider/b` from index 0.9, exclude-all stopped with stage `build`. Script removed.
- `npm run guardrails:check`: pass. Coverage 86 vs baseline 84. Patch advisory with null patch. Complexity gate pass, no new violations.

## Next

Phase 3 loop runtime cutover. Review this phase before that cutover.
