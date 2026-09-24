---
date: 2026-09-24
domains: [extensions, testing, workflow]
topics: [model-profiles, interactive-switch, phase-4, b-save]
related: [buck-model-config-phase-3-save-2026-09-24.md, buck-model-config-phasing-2026-09-23.md]
priority: high
status: completed
subject: 2026-09-22.buck-loop-model-config
artifacts: [phase-4-interactive-command-cutover.md, plan-buck-loop-model-config.md, plan-buck-loop-model-config-phases.md, draft-commit.md, review-zz-buck-loop-2026-09-24T12-07-49-566Z.md]
---

# Phase 4 interactive command cutover — save

## User Goal

Engineers switch named profiles that map Buck stage groups to model-id sets and thinking levels, without silent host-model fallback.

## Decisions

- Phase 4 stays `completed`. Independent review `review-zz-buck-loop-2026-09-24T12-07-49-566Z.md` passed with warnings. No in-plan findings.
- Mapped interactive Buck skills resolve the active stage, apply the picked model and thinking level, and restore both on `agent_end`. Unlisted skills do not consult `buckModels`. Missing profile, stage, or candidates refuse before the skill runs and name the stage.
- Cutover is uncommitted. Draft commit title is `feat(models): switch interactive Buck commands by stage profile`.
- Out-of-plan warning: a second mapped command before `agent_end` overwrites the restore snapshot. Phase verification covers one mapped command plus one unmapped command. Do not fold that race into this commit.
- Subject stays `active`. `close-verified` must refuse until phases 5–6 complete.
- No `/b-docs` or `/b-howto` for this phase. Phase 6 owns the living-doc cutover of the old four-command difficulty switch.
- Harness `retain`/`learn` tools were not in this nested tool set, so only `.context/memory` was written.

## Verification

- Review baseline: uncommitted diff vs `HEAD` (`12a8e6d`). Phase 3 is `3ffeaa9`.
- Focused Vitest cited by review: 24/24 on `extensions/index.test.ts` and `extensions/buck-mode.test.ts`.
- Durable guardrails v2: pass. Patch gate advisory (`patch: null`). Complexity pass. Lint skipped. Functional tests skipped.

## Next

`/b-commit` for phase 4 only. Do not start phase 5 in that commit.
