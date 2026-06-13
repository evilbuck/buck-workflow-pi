---
status: completed
subject: code-smells-audit-skill
date: 2026-06-13
---

# Code Smells Audit Skill

## Goal
Add an operational code-smells audit to the `code-smells` skill: fan out parallel subagents (one per category) to scan a codebase for all 23 smells, producing a buck-workflow-ready remediation report (impact, severity, effort).

## Outcome
- `skills/code-smells/SKILL.md` augmented with: frontmatter, audit workflow (scope/setup, OMP-optimized execution model + portable fallback), per-category detection playbook (gitnexus-preferred), finding schema, severity/impact/effort rubric, report schema, `b-blueprint` review offer, and `b-plan` / `/goal set buck-workflow` handoff.
- Existing 23-smell reference catalog preserved verbatim.

## Verification
- 23/23 docs referenced via markdown links; 0 missing, 0 uncovered.
- CATEGORIES starter cell covers all 23 bare names (5+4+3+6+5).
- vitest: 198 passed, 0 regressions.

## Artifacts
- `skills/code-smells/SKILL.md` (augmented)
- `draft-commit.md`
- `iterate-code-smells-audit-skill.md`
- `.context/memory/code-smells-audit-skill-iteration-2026-06-13.md`
- `.context/memory/code-smells-audit-skill-review-2026-06-13.md`
