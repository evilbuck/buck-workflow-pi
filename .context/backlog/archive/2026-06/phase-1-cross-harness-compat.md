---
title: "Phase 1: Cross-harness compat (cross-harness kernel plan)"
status: completed
priority: high
created: 2026-06-07
updated: 2026-06-07
completed: 2026-06-07
related:
  - .context/2026-06-06.omp-integration-buck-workflow/phase-1-cross-harness-compat.md
  - .context/2026-06-06.omp-integration-buck-workflow/plan-cross-harness-kernel.md
  - .context/2026-06-06.omp-integration-buck-workflow/plan-cross-harness-kernel-phases.md
---
# Phase 1: Cross-harness compat

## Description
Add header guards to the three `omp-*.md` slash-command stubs, a top-row
guard to `b-plan`'s OMP Execution Recommendation table, a runtime probe
to the eval cell template prelude, and a one-liner to `docs/buck-workflow.md`'s
"does NOT" list. Six small, mechanical text edits. No new code paths.

## Context
- Subject: `.context/2026-06-06.omp-integration-buck-workflow/`
- Phase file: `.context/2026-06-06.omp-integration-buck-workflow/phase-1-cross-harness-compat.md`
- Difficulty: easy
- buck_hint: `/b-build`
- Depends on: nothing (foundation phase)
- Plan-level `omp_execution: orchestrate` is set on the first turn of the plan
  (not the phase); per-phase `omp_execution: none`.
