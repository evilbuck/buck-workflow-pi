---
date: 2026-09-23
domains: [extensions, testing, workflow]
topics: [buck-models, profile-resolution, yaml, phase-1, b-save]
related:
  - .context/2026-09-22.buck-loop-model-config/phase-1-profile-config-and-resolution.md
  - .context/2026-09-22.buck-loop-model-config/plan-buck-loop-model-config.md
  - .context/memory/buck-model-config-phasing-2026-09-23.md
priority: high
status: completed
subject: 2026-09-22.buck-loop-model-config
artifacts:
  - phase-1-profile-config-and-resolution.md
  - plan-buck-loop-model-config-phases.md
  - plan-buck-loop-model-config.md
  - iterate-phase-1-profile-config.md
  - iterate-phase-1-complexity.md
  - draft-commit.md
---

# Phase 1 profile config save

## Outcome

Phase 1 is saved as completed. `extensions/omp-models.ts` parses `buckModels`, resolves one stage with project-then-global fallthrough, filters availability without rewriting saved ids, and writes either config scope without dropping unrelated YAML keys. Loop and interactive callers are unchanged.

## Decisions

- Non-blank project `active` wins. Blank or whitespace project `active` uses the user-global name. Both blank stops with `active name ""`. A name in neither profile map stops with that name.
- Stage presence is key presence. An empty project model list wins. An omitted project key falls through to the same user-global profile stage.
- Omitted or unrecognized thinking is `off`. Unknown stage keys are ignored.
- `writeBuckProfile` uses `yaml` `parseDocument` and refuses a document that does not parse. `modelRoles` and other sibling keys stay.
- `resolveActiveName` stays split (lizard CCN 3) so the complexity ceiling holds. Observable precedence is unchanged.
- Out-of-plan `extensions/buck-loop/*` complexity was not fixed.

## Verification

- Phase acceptance checkboxes are all checked.
- Prior focused run recorded in `buck-model-config-phasing-2026-09-23.md`: `npx vitest run extensions/omp-models.test.ts` 30/30 after the complexity flatten.
- Draft commit is `feat(omp): resolve Buck model profiles without clobbering config`.

## Next

`/b-commit` this phase only. Do not start phase 2. Subject lifecycle stays `active`; phases 2–6 are not completed. `plan-buck-loop-model-config-phases.md` has no `## User Goal` heading (the goal is in the Overview bullet).
