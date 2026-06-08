---
title: "Phase 3: Real kernel usage examples (cross-harness kernel plan)"
status: completed
priority: high
created: 2026-06-07
updated: 2026-06-07
completed: 2026-06-07
related:
  - .context/2026-06-06.omp-integration-buck-workflow/phase-3-eval-kernel-examples.md
  - .context/2026-06-06.omp-integration-buck-workflow/plan-cross-harness-kernel.md
  - .context/2026-06-06.omp-integration-buck-workflow/plan-cross-harness-kernel-phases.md
---
# Phase 3: Real kernel usage examples

## Description
Create `eval-review-audit.py` (per-phase `parallel()` + `llm()` judge
with the F6 schema) and `eval-migration-sweep.py` (per-directory
`parallel()` + multi-criterion `llm()` judge schema). Both have
`__main__` guards. Append "Example cells" subsection to `b-plan`'s
"Eval Cell Template".

## Context
- Subject: `.context/2026-06-06.omp-integration-buck-workflow/`
- Phase file: `.context/2026-06-06.omp-integration-buck-workflow/phase-3-eval-kernel-examples.md`
- Difficulty: medium
- buck_hint: `/b-build`
- Depends on: Phase 2 (HARD — the cells import helpers documented in
  Phase 2)
