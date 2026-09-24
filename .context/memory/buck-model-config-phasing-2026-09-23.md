---
date: 2026-09-23
domains: [planning, extensions, workflow]
topics: [buck-loop, model-profiles, jev, buck-models, phasing]
related:
  - .context/2026-09-22.buck-loop-model-config/plan-buck-loop-model-config.md
  - .context/2026-09-22.buck-loop-model-config/plan-buck-loop-model-config-phases.md
priority: high
status: completed
subject: 2026-09-22.buck-loop-model-config
artifacts:
  - plan-buck-loop-model-config-phases.md
  - phase-1-profile-config-and-resolution.md
  - phase-2-typesafe-model-picker.md
  - phase-3-loop-runtime-cutover.md
  - phase-4-interactive-command-cutover.md
  - phase-5-buck-models-command.md
  - phase-6-documentation-and-end-to-end-proof.md
---

# Buck model configuration phasing

## Outcome

Phase 1 profile config and resolution is implemented. Loop, interactive, and `/buck-models` callers are unchanged.

## Decisions

- Active name: non-blank project name wins; blank or whitespace project name uses the user-global name; both blank stops with `active name ""`; a name present in neither profile map stops with that name.
- Stage presence is key presence. An empty project model list wins and does not fall through. An omitted project key uses the same-named user-global profile stage.
- Availability filtering returns a new candidate list. Parsed and saved ids are not rewritten.
- Omitted or unrecognized thinking resolves to `off`. Unknown stage keys are dropped at parse.
- `writeBuckProfile` uses `yaml` `parseDocument` and refuses to overwrite a document that does not parse. Sibling keys, including `modelRoles`, stay. Other profiles in `buckModels` are merged back.
- Out-of-plan `extensions/buck-loop/*` complexity failure was not touched.
- `resolveActiveName` is split so lizard CCN is 3. Observable precedence is unchanged. Helpers stay at or under 10.
## Verification
- `npx vitest run extensions/omp-models.test.ts --reporter=verbose` — 30/30 passed after the complexity flatten.
- `lizard -C 10 -w extensions/omp-models.ts` warns only on baseline `parseModelRoles` (CCN 13). `resolveActiveName` is CCN 3. Lint gate is disabled. Full guardrails not run; dirty `extensions/buck-loop/*` remains out of plan.

## Files Modified

- `extensions/omp-models.ts`
- `extensions/omp-models.test.ts`
- `package.json`
- `package-lock.json`
- `.context/2026-09-22.buck-loop-model-config/iterate-phase-1-profile-config.md`
- `.context/2026-09-22.buck-loop-model-config/phase-1-profile-config-and-resolution.md`
- `.context/2026-09-22.buck-loop-model-config/iterate-phase-1-complexity.md`
- `.context/2026-09-22.buck-loop-model-config/draft-commit.md`

## Next
Phase 1 criteria are checked and the phase file is completed by `/b-save`. Do not start phase 2 until `/b-commit` lands this phase. Do not fix the out-of-plan buck-loop complexity failure inside this phase.


