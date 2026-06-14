---
title: Implement hybrid context artifact model
status: completed
priority: medium
created: 2026-06-13
updated: 2026-06-13
completed: 2026-06-13
related:
  - .context/2026-06-13.context-format-research/index.md
  - .context/2026-06-13.context-format-research/research-context-format.md
  - .context/2026-06-13.context-format-research/plan-hybrid-context-artifact-model.md
  - scripts/context-artifacts.mjs
  - scripts/context-artifacts.test.mjs
  - docs/context-artifacts.md
  - README.md
  - package.json
  - .context/index/subjects.json
  - .context/index/memory.json
  - .context/index/backlog.json
  - .context/index/artifacts.json
---

# Implement hybrid context artifact model

## Problem
Buck's `.context/` artifacts need two different strengths at once:
- rich Markdown narrative for plans, research, memory, and cross-linking
- explicit machine-queryable structure for validation and `jq`-driven inspection

A repo-wide migration to JSON would overfit the query problem and degrade the authoring/navigation strengths of Markdown.

## Desired outcome
Deliver the first hybrid slice:
- Markdown remains canonical for narrative artifacts
- strict JSON remains canonical for machine-owned state
- generated `.context/index/*.json` files provide query surfaces
- validator tooling enforces frontmatter contracts for Markdown artifacts

## Acceptance criteria
- There is a concrete implementation module for scanning `.context/` artifacts and generating indexes.
- There is validation coverage for memory, subject index, research, plan, and backlog item frontmatter.
- `jq`-friendly JSON indexes exist for at least subjects, memory, and backlog.
- Repo docs state which artifact classes are Markdown source vs JSON source.
