---
description: Review implementation changes for correctness, edge cases, regressions, and workflow compliance. Optionally provide a plan/spec/phase/subject path as the acceptance contract.
---

# B-Review

$ARGUMENTS

You may optionally provide a path to a plan, spec, phase, or subject folder as an argument. Examples:
- `/b-review .context/2026-05-17.my-plan/plan-my-plan.md`
- `/b-review .context/2026-05-17.my-plan/`
- `/b-review` (no argument — loads active subject folder or session context)

Load and follow the `b-review` skill:

```
skills/b-review/SKILL.md
```
