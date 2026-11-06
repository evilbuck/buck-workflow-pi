---
status: completed
phase: 3
order: 3
plan: plan-sql-memory-buck-loop.md
phases_overview: plan-sql-memory-buck-loop-phases.md
difficulty: hard
model_hint: strongest reasoning model available (cutover across save contract, supervisor postcondition, resume — high blast radius)
buck_hint: /b-build-hard
goal: "SQL-backed saves in b-save/b-save-improved with metadata-only subject receipts, supervisor postcondition verification before commit, and no competing .context/memory body in SQL mode."
omp_execution: none
files:
  - skills/b-save/SKILL.md
  - skills/b-save-improved/SKILL.md
  - extensions/b-save-improved/index.ts
  - skills/b-save-improved/scripts/save-preflight.ts
  - skills/b-save-improved/scripts/save-apply.ts
  - skills/b-build/SKILL.md
  - skills/b-iterate/SKILL.md
  - skills/b-review/SKILL.md
  - skills/_shared/subject-resolution.md
  - extensions/buck-loop/loop.ts
  - extensions/buck-loop/scan.ts
  - extensions/buck-loop/machine.ts
from_plan_steps: [4, 5]
depends_on: [2]
dependency_type: HARD
acceptance_criteria:
  - "[x] Save path: bound `sql_memory` statements with git email, project ID, branch+SHA pair (or both NULL), active category, explicit per-session seq, subject/phase/source context; `INSERT ... RETURNING id`; source-key lookup in memories.context prevents single-run retry duplication"
  - "[x] Correction inserts successor then updates only invalid_at/superseded_by; immutable content never updated"
  - "[x] Metadata-only receipt written to `.context/<subject>/sql-memory-receipts/<run-id>-<attempt>.json` after same-project read-back; NO new `.context/memory/` file or index entry in SQL mode"
  - "[x] Supervisor generates save-attempt ID before launching b-save; saving → committing requires matching receipt + same-project SQL rows; stale receipt cannot satisfy a new attempt"
  - "[x] `{error:true}`, missing row, or DB outage blocks with operator-visible reason; ambiguous `saving` Jev advance route removed for unverified SQL mode"
  - "[x] Explicit no-fact receipt only after successful SQL connectivity probe; verified no-fact saves advance"
  - "[x] `--resume` reconciles receipt and rows before commit; DB URL never persisted"
  - "[x] Without SQL_MEMORY_URL, existing portable file contract fully preserved (except unconfirmed save not treated as proof); b-save-improved/subject resolution cannot silently require competing memory files in SQL mode"
completed_at: 2026-09-29
completed_by: supervisor-receipt
---

# Phase 3: SQL save and truthful completion

## Context

Parent User Goal: engineers share one remote PostgreSQL memory store across all projects — any OMP agent can store/recall project- and branch-scoped memories, replacing `.context/memory/` for new memories in `/buck-loop`. This phase is the ratified cutover: SQL is the source of new reusable memory bodies; only a control-plane receipt lives under the subject.

HARD-depends on Phase 2 (recall + tool surface). This is the highest-risk slice: it changes the save contract, supervisor postconditions, and resume semantics together (`scan.ts:458`, `machine.ts:339-343`, `current-session.json` pointer in `skills/_shared/subject-resolution.md:17-23`).

## Implementation Details

- `b-save` selects self-contained decisions/conventions/outcomes from actual work; with bound `sql_memory` statements ensure user/project identity, source-key lookup, `INSERT ... RETURNING id`, supersede flow.
- Update `b-save-improved` (extension + scripts) so new memory is not written to a competing body store in SQL mode.
- Supervisor: pre-generate attempt ID; confirm matching receipt + same-project SQL IDs by read-back before `saving → committing`; remove ambiguous `saving` Jev advance route in unverified SQL mode; retry or block, never vote past persistence.
- Handle verified no-fact saves via explicit empty-ID receipt after a connectivity probe.
- Update plan/spec cross-references to SQL receipt/IDs rather than `memory:` Markdown paths; keep backlog/phase/lifecycle duties.

## Risks

- Ratified SQL replacement conflicts with the current mandatory `.context/memory` bootstrap — all coupled contracts change together; file mode keeps legacy behavior.
- Application-level source-key dedupe does not cover simultaneous writers; no cross-worker exactly-once is claimed.
- Stale/`current-session.json` pointer semantics must not regress file mode.

## Verification

- Contract tests: receipt/no-fact/resume/failure-before-commit; retry-within-run no-duplicate; legacy file fallback; false/stale receipt rejection.
- Live throwaway against disposable `pgvector/pg18`: save with apostrophes, supersede, crash/resume, connection failure; verify rows, receipt, no new memory file, blocked/committed loop state. Never use the real shared DB for test data.
- `npm run guardrails:check` after the slice.
