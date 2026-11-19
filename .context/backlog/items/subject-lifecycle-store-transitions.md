---
title: Route subject-lifecycle.ts through workflow_state transitions (Phase B)
status: active
priority: high
created: 2026-11-18
updated: 2026-11-18
completed: null
related:
  - skills/_shared/scripts/subject-lifecycle.ts
  - extensions/plan-artifact.ts
  - extensions/code-review-iteration/report.ts
  - extensions/buck-loop/loop.ts
  - skills/b-loop/scripts/git-commit.ts
  - .context/2026-11-18.workflow-state-routing-audit/plan-workflow-state-routing.md
---

# Phase B: subject-lifecycle store-backed transitions

`skills/_shared/scripts/subject-lifecycle.ts` (659 lines) is the lifecycle authority
every creating skill invokes (`initialize`/`activate`/`close-verified`/`reopen`), and
it is a pure file writer: direct frontmatter edits plus legacy→canonical renames on
`.context/<subject>/index.md`, with `close-verified` evidence checks reading plan
files from disk. Under any non-repo-files adapter the lifecycle state never reaches
the store, and the evidence checks read files that do not exist.

The store-backed path already exists: `workflow_state transition`
(`artifact_lifecycle_scope` per migration `004_domain_semantics.sql`), used by
`extensions/plan-artifact.ts:232-289` and `extensions/code-review-iteration/report.ts:142-197`.

## Design

- Dual-mode CLI: repo-files adapter → current behavior unchanged; adapter mode →
  store `transition` + `inspect-lifecycle` reads.
- `close-verified` evidence verification must read retained plan/iterate artifacts
  through the store in adapter mode (search/list by kind), not from `.context/`.
- Route the remaining direct lifecycle writers or gate them:
  `extensions/buck-loop/loop.ts:445` (`applySubjectLifecycleIntent`) and
  `skills/b-loop/scripts/git-commit.ts:329` (phase-status edits during loop commit).

## Effort

Hard — `/b-build-hard`. The evidence-verification rewrite is the risky part; the
transition plumbing is proven.

## Found during

2026-11-18 workflow-state routing audit (scout inventory; store plan revision
`e194d3a3`, subject `2026-11-18.workflow-state-routing-audit`). Phase A (b-save
extension retain) landed in `12c6ce9e9d`.
