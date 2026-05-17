---
title: Add plan-specific implementation ledger for b-review traceability
status: active
priority: medium
created: 2026-05-17
updated: 2026-05-17
completed: null
related:
  - .context/2026-05-17.b-review-plan-path/research-b-review-plan-path.md
---

# Add plan-specific implementation ledger for b-review traceability

## Problem

`b-review <plan-path>` can infer completed work from git history, subject artifacts, and current source state, but attribution becomes weak when multiple Buck workflow sessions happen on the same branch or touch overlapping files.

## Desired outcome

`b-build` and/or `b-save` records a plan-specific implementation ledger that `b-review` can read to deterministically map work back to a plan.

## Candidate ledger fields

- Plan path / subject folder
- Build session command and timestamps
- Commit SHAs created during the build, if any
- Files touched for this plan
- Implementation steps completed
- Verification commands run and outcomes
- Known follow-up issues or skipped checks

## Acceptance criteria

- Ledger is written under the plan subject folder or referenced from plan frontmatter.
- `b-review <plan-path>` can use the ledger before falling back to branch-wide heuristics.
- Multiple workflow sessions on one branch can be reviewed independently.
