---
status: pending
phase: 4
order: 4
plan: plan-sql-memory-buck-loop.md
phases_overview: plan-sql-memory-buck-loop-phases.md
difficulty: medium
model_hint: capable general model (documentation + end-to-end live proof)
buck_hint: /b-build
goal: "Align bootstrap, docs, and fixtures with SQL-mode behavior, then run the full live OMP nested-loop + PG scenario as closeout proof."
omp_execution: none
files:
  - GLOBAL_OR_PROJECT-AGENTS.md
  - AGENTS.md
  - docs/sql-memory.md
  - docs/howto/recall-project-memories.md
  - docs/buck-workflow.md
  - skills/b-memory-import/SKILL.md
from_plan_steps: [4]
depends_on: [3]
dependency_type: HARD
acceptance_criteria:
  - "[ ] `GLOBAL_OR_PROJECT-AGENTS.md` and repo `AGENTS.md` match installed bootstrap behavior for configured/unconfigured SQL paths"
  - "[ ] `docs/sql-memory.md`, recall how-to (`docs/howto/recall-project-memories.md`), and `docs/buck-workflow.md` document SQL mode, receipts, and file fallback"
  - "[ ] `b-memory-import` scans only the old `.context/memory/` directory and never ingests subject receipts; historical Markdown memories stay read-only in SQL mode"
  - "[ ] Live OMP nested loop + disposable PG18+pgvector scenario passes end-to-end: admission, recall, save, receipt, blocked/committed states"
  - "[ ] Full `npm run guardrails:check` green at closeout"
completed_at: null
completed_by: null
---

# Phase 4: Policy/docs and live proof

## Context

Parent User Goal: engineers share one remote PostgreSQL memory store across all projects — any OMP agent can store/recall project- and branch-scoped memories, replacing `.context/memory/` for new memories in `/buck-loop`. This phase makes the cutover documented and proves it live end-to-end.

HARD-depends on Phase 3 (save cutover must exist before docs describe it).

## Implementation Details

- Update `GLOBAL_OR_PROJECT-AGENTS.md` (installable bootstrap) and repo `AGENTS.md` per the bootstrap-vs-project rule: bootstrap policy changes go to the global file.
- Update `docs/sql-memory.md`, add `docs/howto/recall-project-memories.md` (one action, numbered steps ending in Eat), and `docs/buck-workflow.md` OMP loop section.
- Test fixtures aligned; `b-memory-import` guard against ingesting receipts.
- Historical Markdown memories stay read-only in SQL mode; no migration call from the loop.

## Risks

- Doc-embedded shell snippets must be extraction-tested (locked rule): live-run when the target is reachable.
- Do not overwrite currently unstaged user edits or staged deletions; keep them out of commits.

## Verification

- Live `/buck-loop` nested scenario against disposable `pgvector/pg18` (migration 001, provision, save, recall across branches, supersede, resume, failure), then full `npm run guardrails:check`.
