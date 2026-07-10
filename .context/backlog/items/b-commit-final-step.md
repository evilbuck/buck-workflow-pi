---
title: Make b-commit the final Buck workflow step
status: active
priority: high
created: 2026-06-11
updated: 2026-07-10
completed: null
related:
  - .context/2026-06-11.b-commit-final-step/plan-b-commit-final-step.md
  - .context/2026-06-11.b-commit-final-step/research-current-commit-surface.md
  - .context/2026-07-10.buck-workflow-implementation-audit/phase-3-stage-commit-safety.md
---

# Make b-commit the final Buck workflow step

## Problem

Buck workflow currently treats `/b-save` as the final step in several docs and skills, while some Ralph instructions separately mention `/git-commit`. The desired contract is one final Buck step: `/b-commit`, backed by the existing `git-commit` skill.

## Desired outcome

All Buck workflow loops complete with save → commit, and each phase/body unit has its own commit.

## Acceptance criteria

- `/b-commit` prompt and OMP command mirror exist.
- Buck workflow docs and skills use `/b-commit` as the final step.
- `skills/git-commit/SKILL.md` remains the commit implementation.
- README, docs, project AGENTS, reusable GLOBAL_OR_PROJECT-AGENTS, and chezmoi global AGENTS source are aligned.
- Verification includes scoped searches, symlink checks, tests, and chezmoi diff/deploy check as appropriate.

## Phasing

The remaining safety gap is absorbed by Phase 3 of the Buck Workflow contract remediation: every closeout becomes `save → stage → commit`, and subject-scoped drafts are validated against staged reality. Do not pick this item up independently.
