---
status: completed
date: 2026-06-13
subject: 2026-06-13.code-smells-audit-skill
topics: [code-smells, audit-workflow, b-iterate, schema, omp]
research: []
iterations: [iterate-code-smells-audit-skill.md]
spec: null
memory: [code-smells-audit-skill-review-2026-06-13.md]
---

# Plan: Code-Smells Audit Contract Hardening

## User Goal
Users running the code-smells audit get a complete, schema-consistent remediation report; any incomplete scan is clearly marked partial and cannot be mistaken for a final buck-workflow handoff.

## Goal
Close the review findings from `iterate-code-smells-audit-skill.md` by making the audit instructions enforce full 23-smell coverage and requiring every structured finding to carry grouping and triage metadata.

## Context used / assumptions
- User-provided context: `iterate-code-smells-audit-skill.md`.
- Subject artifact used: `.context/2026-06-13.code-smells-audit-skill/index.md`.
- Code inspected: `skills/code-smells/SKILL.md`.
- Current source already appears to contain the intended fixes: the OMP execution path now checkpoints partial scans instead of dropping categories, and `category` / `confidence` are required in the starter cell schema.
- Assumption: this plan is for durable, replayable Buck workflow state even if the code changes were already applied during `/b-iterate`.

## Scope
- Harden `skills/code-smells/SKILL.md` only where needed to satisfy the two review findings.
- Preserve the existing 23-smell reference catalog and category fan-out model.
- Keep the skill portable across OMP and non-OMP harnesses.

## Out of scope
- Adding the deterministic analyzer preflight proposed in `research-deterministic-detection-pipeline.md`.
- Adding new smell definitions beyond the existing 23 Refactoring.Guru smells.
- Building a standalone CLI or test harness for running audits.

## Affected files
- `skills/code-smells/SKILL.md`
- `.context/2026-06-13.code-smells-audit-skill/iterate-code-smells-audit-skill.md` for cross-reference stitching only.
- `.context/2026-06-13.code-smells-audit-skill/index.md` for subject status/artifact listing only.

## Implementation steps
1. Re-read `skills/code-smells/SKILL.md` around the OMP execution model.
2. Ensure low-budget behavior never drops categories silently: finished categories may be checkpointed, but the report must use `status: partial`, list `unscanned_categories`, and avoid final remediation handoff language until all 5 categories / 23 smells are scanned.
3. Re-read the OMP starter cell finding schema.
4. Ensure `category` and `confidence` are both present in `properties` and `required`.
5. Add `additionalProperties: false` to `FINDING_SCHEMA` if the eval helper accepts strict JSON schemas in the current repo pattern; otherwise leave a concise rationale in the plan/memory rather than forcing an unsupported schema shape.
6. Run targeted verification for the skill contract: parse the markdown/text assertions that check category coverage, schema required fields, and absence of any "drop categories" instruction.
7. Re-run `/b-review` against `.context/2026-06-13.code-smells-audit-skill/`.

## Verification
- Text contract check: `skills/code-smells/SKILL.md` contains `status: partial`, `unscanned_categories`, and all 5 categories / 23 smells coverage language in the OMP path.
- Schema check: the starter `FINDING_SCHEMA.required` includes `category` and `confidence`.
- Coverage check: every smell linked in the reference catalog appears in exactly one `CATEGORIES` entry.
- Existing project tests: run the targeted test command that previously produced `198 passed` if this plan changes test-covered installer/docs behavior; otherwise record why source-only skill markdown did not need a full test suite run.

## Ralph Instructions

This is a non-phased Ralph-ready plan. Treat the whole plan as one unit:
1. Run `/b-build` against this plan.
2. Run `/b-review` against this plan.
3. If review creates an `iterate-*.md` artifact, run `/b-iterate`, then re-run `/b-review`.
4. Run `/b-save` to consolidate memory, draft commits, and review/iteration artifacts.
5. Run `/b-commit` to checkpoint durable state before `ralph_done`.
6. If interrupted before completion, leave a clear note in memory and resume from this active plan or the newest iterate artifact.

## Risks
- The source already appears fixed; reapplying this plan without a current-state check could create churn instead of improvement.
- `additionalProperties: false` may be desirable but should not be added if the current eval helper or downstream agent return path cannot honor strict schemas.
- A partial audit report is useful for checkpointing but must not be treated as buck-workflow-ready remediation input.
