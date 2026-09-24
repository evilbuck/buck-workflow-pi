---
date: 2026-09-24
domains: [extensions, testing, workflow]
topics: [buck-loop, model-profiles, phase-3, loop-runtime, b-save]
related: [buck-model-config-phase-2-save-2026-09-24.md, buck-model-config-phasing-2026-09-23.md]
priority: high
status: completed
subject: 2026-09-22.buck-loop-model-config
artifacts: [phase-3-loop-runtime-cutover.md, plan-buck-loop-model-config.md, plan-buck-loop-model-config-phases.md, draft-commit.md, review-zz-buck-loop-2026-09-24T11-54-36-692Z.md]
---

# Phase 3 loop runtime cutover — save

## User Goal

Engineers switch named profiles that map Buck stage groups to model-id sets and thinking levels, without silent host-model fallback.

## Decisions

- Phase 3 stays `completed`. Independent review `review-zz-buck-loop-2026-09-24T11-54-36-692Z.md` passed with no in-plan or out-of-plan findings.
- Nested Buck sessions and closed-set choice use the stage picker (`modelPattern` + stage thinking). `difficulty: hard` selects only the `b-build-hard` prompt. Failed host calls re-pick without that id; recovered text is kept; a missing stage blocks by name.
- Cutover is uncommitted. Draft commit title is `feat(buck-loop): run nested work on stage model profiles`.
- Subject stays `active`. `close-verified` must refuse until phases 4–6 complete.
- No documentation or how-to impact. Phase 6 owns the living-doc cutover.
- Harness `retain`/`learn` tools were not in this nested tool set, so only `.context/memory` was written.

## Verification

- Review baseline: uncommitted diff vs `bab8e2b`. Picker already in `9467816`.
- Focused Vitest cited by review: 73/73 on `run-step.test.ts`, `choice.test.ts`, `loop.test.ts`.
- Durable guardrails v2: pass. Coverage 85.9 vs baseline 84. Patch gate advisory (null). Complexity pass. Lint skipped. Functional tests skipped.

## Next

`/b-commit` for phase 3 only. Do not start phase 4 in that commit.
