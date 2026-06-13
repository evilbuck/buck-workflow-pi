---
status: completed
date: 2026-06-13
updated: 2026-06-13
subject: 2026-06-13.code-smells-audit-skill
topics: [review, iteration]
informs: [plan-code-smells-audit-contract-hardening.md]
addresses: index.md
completed: 2026-06-13
ralph_status: completed
from_review: b-review
---

# Iteration: code-smells-audit-skill

## Source
- Reviewed after: `/b-build`
- Plan: `index.md`
- Scope: `skills/code-smells/SKILL.md`, `skills/code-smells/docs/`

## Critical Issues

### 1. Low-budget path can skip smells despite the skill's all-smells contract
- **File**: `skills/code-smells/SKILL.md:46`
- **Problem**: The goal and audit workflow promise a scan of all 23 smells, but the OMP execution model says to "drop the lowest-value categories" when budget is low. That can produce a report that is explicitly not all 23 smells while still following the skill instructions.
- **Proposed fix**: Replace the drop behavior with an incomplete-review behavior: run categories sequentially or pause/resume via a durable checkpoint; if budget prevents full coverage, mark the report `status: partial`, list unscanned categories, and do not present it as the final buck-workflow remediation report.

## Warnings

### 1. JSON schema does not require the full finding contract
- **File**: `skills/code-smells/SKILL.md:251-265`
- **Problem**: The finding schema documents `category` and `confidence`, but `required` omits both. Schema-enforced OMP subagents may return findings that cannot be grouped by category and do not expose confidence for deferred/low-confidence triage.
- **Suggested approach**: Add `category` and `confidence` to `required`; optionally add `additionalProperties: false` if the eval helper supports strict JSON schema.

## Recommended Workflow

Start with `/b-iterate` — it will pick up this file automatically.
Then re-run `/b-review` against the same subject.
If running inside Ralph, do not call `ralph_done` until the iterate artifact is completed, review passes, and `/b-save` has recorded durable state.
