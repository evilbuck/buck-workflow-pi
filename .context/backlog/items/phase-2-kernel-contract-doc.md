---
title: "Phase 2: Kernel contract doc (cross-harness kernel plan)"
status: completed
priority: high
created: 2026-06-07
updated: 2026-06-07
completed: 2026-06-07
related:
  - .context/2026-06-06.omp-integration-buck-workflow/phase-2-kernel-contract-doc.md
  - .context/2026-06-06.omp-integration-buck-workflow/plan-cross-harness-kernel.md
  - .context/2026-06-06.omp-integration-buck-workflow/plan-cross-harness-kernel-phases.md
---
# Phase 2: Kernel contract doc

## Description
Create `docs/eval-kernel.md` with six sections (What it is, Helpers,
Budget, Schemas, Failure modes, Cross-platform). Cross-link
`docs/buck-workflow.md#omp-autonomous-loops`. Add a "See also" one-liner
to `b-plan`'s "Eval Cell Template" section. Update subject `index.md`
`artifacts:` list.

## Context
- Subject: `.context/2026-06-06.omp-integration-buck-workflow/`
- Phase file: `.context/2026-06-06.omp-integration-buck-workflow/phase-2-kernel-contract-doc.md`
- Difficulty: medium
- buck_hint: `/b-build`
- Depends on: Phase 1 (HARD — the contract doc references the runtime
  probe from Phase 1)
