---
date: 2026-06-13
domains: [planning, skill, buck-workflow]
topics: [code-smells, b-plan, audit-workflow, schema, omp]
related: [".context/2026-06-13.code-smells-audit-skill/plan-code-smells-audit-contract-hardening.md", ".context/2026-06-13.code-smells-audit-skill/iterate-code-smells-audit-skill.md", "skills/code-smells/SKILL.md"]
priority: medium
status: completed
subject: 2026-06-13.code-smells-audit-skill
artifacts: ["plan-code-smells-audit-contract-hardening.md", "iterate-code-smells-audit-skill.md", "index.md"]
---

# Code Smells Audit Contract Hardening Plan

Created a b-plan artifact from the completed review iteration for `skills/code-smells/SKILL.md`.

Key decision: keep the plan tightly scoped to the two review findings: partial scan handling and required finding metadata. The deterministic analyzer preflight research remains explicitly out of scope.

Observed current source state: `skills/code-smells/SKILL.md` already appears to include the intended fixes, so the plan instructs b-build to verify current state before editing to avoid churn.

## Implementation (b-build, 2026-06-13)
Outcome: both review findings were already fixed in source (verified, not reapplied); the only new edit was plan step 5.

- **Finding 1 (drop categories)**: already addressed — OMP path checkpoints finished categories and marks `status: partial` with `unscanned_categories` instead of dropping coverage. Verified present.
- **Finding 2 (schema required)**: already addressed — `category` + `confidence` both in `required` and `properties`. Verified present.
- **Step 5 (new)**: added `"additionalProperties": False` + documenting comment to `FINDING_SCHEMA`. The repo enforces this (`docs/eval-kernel.md § Schemas`); code-smells was the lone eval-cell schema without it. `LIST_SCHEMA` (array) intentionally omitted — `additionalProperties` is void for arrays.

Verification: contract assertions pass (valid Python cell, strict schema, partial-checkpoint text, 23/23 coverage 5/4/3/6/5); `npx vitest run` 198/198.
