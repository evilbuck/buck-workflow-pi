---
status: completed
phase: 2
order: 2
plan: plan-design-palette.md
phases_overview: plan-design-palette-phases.md
difficulty: easy
model_hint: smaller/faster general model is fine
buck_hint: /b-build
goal: "Add b-design-palette SKILL.md and README catalog entry documenting LLM extract → script call."
omp_execution: none
files:
  - skills/b-design-palette/SKILL.md
  - README.md
from_plan_steps: [5]
depends_on: [1]
dependency_type: SOFT
acceptance_criteria:
  - "[x] skills/b-design-palette/SKILL.md has portable frontmatter (name + description) and instructs: extract inputs from brief/styleguide, then call the script for all color math; never invent hex by hand."
  - "[x] SKILL.md documents CLI flags, output path convention, and that consumer design-brief.jsonc is distinct from skills/_shared/design-brief.jsonc."
  - "[x] README.md Skills table lists b-design-palette."
completed_at: 2026-11-02
completed_by: null
---

# Phase 2: Skill + docs

## Context

Wire the human/agent procedure around the Phase 1 CLI.

## Implementation Details

1. Write SKILL.md with use-when, procedure (extract → invoke → verify contrast report), CLI reference.
2. Add README catalog row near design/styleguide skills.

## Verification

- Frontmatter test still passes (`scripts/skill-frontmatter.test.ts`).
- README lists the skill.
