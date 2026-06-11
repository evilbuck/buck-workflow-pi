---
date: 2026-06-11
domains: [planning, buck-workflow, docs]
topics: [b-commit, git-commit, ralph, omp, chezmoi, global-agents]
related:
  - ../2026-06-11.b-commit-final-step/plan-b-commit-final-step.md
  - ../2026-06-11.b-commit-final-step/research-current-commit-surface.md
priority: high
status: active
subject: 2026-06-11.b-commit-final-step
artifacts:
  - ../2026-06-11.b-commit-final-step/index.md
  - ../2026-06-11.b-commit-final-step/research-current-commit-surface.md
  - ../2026-06-11.b-commit-final-step/plan-b-commit-final-step.md
  - ../backlog/items/b-commit-final-step.md
  - ../backlog/todo.md
---

# b-commit final step plan

## Summary

Created a b-plan subject for making `/b-commit` the final Buck workflow step. The plan keeps `skills/git-commit/SKILL.md` as the single implementation and introduces `/b-commit` as the Buck-facing wrapper/final step.

## Key decisions

- Use clean workflow wording: `build → review → iterate if needed → save → commit`.
- `/b-save` remains the durable context checkpoint before commit, not the final workflow step.
- Each phase and each workflow/body unit should have its own commit.
- Update the chezmoi source `/home/buckleyrobinson/.local/share/chezmoi/dot_pi/agent/AGENTS.md`; do not edit deployed `/home/buckleyrobinson/.omp/agent/AGENTS.md` directly.

## Artifacts

- `.context/2026-06-11.b-commit-final-step/research-current-commit-surface.md`
- `.context/2026-06-11.b-commit-final-step/plan-b-commit-final-step.md`
- `.context/backlog/items/b-commit-final-step.md`
