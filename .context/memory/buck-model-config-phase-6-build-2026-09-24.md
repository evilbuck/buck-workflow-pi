---
date: 2026-09-24
domains: [docs, extensions, testing, workflow]
topics: [model-profiles, buck-models, phase-6, end-to-end-proof]
related: [buck-model-config-phase-5-build-2026-09-24.md]
priority: high
status: completed
subject: 2026-09-22.buck-loop-model-config
artifacts: [phase-6-documentation-and-end-to-end-proof.md, plan-buck-loop-model-config.md, plan-buck-loop-model-config-phases.md, review-phase-6-documentation-and-end-to-end-proof-2026-09-24.md, iterate-buck-loop-model-config.md, iterate-phase-1-profile-config.md, iterate-phase-1-complexity.md, iterate-phase-5-buck-models-command.md, draft-commit.md]
---

# Phase 6 model-profile documentation and proof

## User Goal

Engineers can discover, configure, activate, and safely run named Buck model profiles without any Buck stage silently inheriting the host model.

## Decisions

- `docs/buck-workflow.md` now treats `buckModels` stage profiles as the Buck routing source. It documents `/buck-models`, both config scopes, all twelve exact stage keys, project-stage presence and user-global fallthrough, `off` thinking defaults, availability filtering, Jev/random selection, retry ordering, and hard stops.
- Unrelated `modelRoles` behavior remains documented as available outside Buck stage routing; the separate Settings API migration remains out of scope.
- `docs/howto/configure-buck-model-profiles.md` is the canonical operator sequence. Its Eat check requires both the save notification and a mapped stage running the configured id/thinking, with named refusal instead of host fallback.
- No permanent tests were added. Existing behavioral suites already cross the resolver/picker/runtime seams for loop work, loop choice, interactive commands, missing profile/stage/candidates, and retained `mappingFromOmpRoles`; duplicating those cases would add weight without defending a new edge.
- The complete six-phase plan and phase overview are completed. The phase and umbrella backlog items are archived.
- Final Phase 6 review approved the completed documentation/proof work with no in-plan or out-of-plan findings.

## Files Modified

- `docs/buck-workflow.md`
- `docs/howto/configure-buck-model-profiles.md`
- `docs/howto/README.md`
- `.context/2026-09-22.buck-loop-model-config/phase-6-documentation-and-end-to-end-proof.md`
- `.context/2026-09-22.buck-loop-model-config/plan-buck-loop-model-config.md`
- `.context/2026-09-22.buck-loop-model-config/plan-buck-loop-model-config-phases.md`
- `.context/2026-09-22.buck-loop-model-config/draft-commit.md`
- `.context/backlog/todo.md`
- `.context/backlog/archive/2026-09/buck-loop-model-config.md`
- `.context/backlog/archive/2026-09/phase-6-model-profiles-documentation-proof.md`
- `.context/backlog/archive/completed.md`
- `.context/memory/index.md`
- `.context/workflow/current-session.json`

## Verification

- Focused feature suites: 6 files, 86 Vitest tests passed (`omp-models`, picker, command writer, interactive adapter, loop run-step, loop choice).
- Throwaway Bun smoke passed: wrote a project profile, resolved `build`, accepted a low-confidence Jev pick of `provider/b`, observed `{ modelPattern: "provider/b", thinkingLevel: "medium" }`, then resolved missing `review` and observed a named no-host-default refusal. The script and temporary config were removed.
- Documentation review found exactly twelve stage-key rows and no remaining `buckModelMapping`, difficulty-tier mapping, default-model, or model-auto-switch claims in `docs/buck-workflow.md`.
- Durable guardrails v2 passed: required unit, global coverage ratchet, and complexity gates passed; 87.3% global coverage against 84% baseline; patch gate passed with no patch value; lint and functional gates skipped by contract.
