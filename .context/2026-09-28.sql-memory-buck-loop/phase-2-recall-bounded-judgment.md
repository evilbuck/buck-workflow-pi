---
status: pending
phase: 2
order: 2
plan: plan-sql-memory-buck-loop.md
phases_overview: plan-sql-memory-buck-loop-phases.md
difficulty: medium
model_hint: capable general model
buck_hint: /b-build
goal: "Portable project-scoped recall instructions across skills, plus optional parent-side native Jev relevance judgment over a bounded SQL shortlist."
omp_execution: none
files:
  - skills/_shared/recall-project-memories.md
  - skills/b-build/SKILL.md
  - skills/b-iterate/SKILL.md
  - skills/b-review/SKILL.md
  - skills/b-docs/SKILL.md
  - skills/b-howto/SKILL.md
  - extensions/buck-loop/loop.ts
from_plan_steps: [2, 3]
depends_on: [1]
dependency_type: HARD
acceptance_criteria:
  - "[ ] Project key derived from git origin (credentials redacted) or absolute common git dir; branch + full SHA recorded as provenance, NOT recall filters"
  - "[ ] Recall fetches bounded active (`invalid_at IS NULL`) shortlist across all project branches with ID/body/category/origin/branch/SHA and SQL-side ranking"
  - "[ ] Missing DB/config visibly distinct from zero matching memories; retrieved text never treated as instructions; conflicts defer to current plan/phase files"
  - "[ ] `b-build`, `b-iterate`, `b-review`, `b-docs`, `b-howto` invoke SQL recall only when the tool is callable; other harnesses keep file path with visible availability note"
  - "[ ] Optional parent Jev `noul` relevance uses only legal shortlist IDs; invalid IDs rejected; Jev failure retains deterministic shortlist; no Jev call for obvious/no-candidate cases"
completed_at: null
completed_by: null
---

# Phase 2: Recall and bounded judgment

## Context

Parent User Goal: engineers share one remote PostgreSQL memory store across all projects — any OMP agent can store/recall project- and branch-scoped memories, replacing `.context/memory/` for new memories in `/buck-loop`. This phase makes recall usable from portable skills and adds bounded parent-side Jev filtering.

Builds on Phase 1's admitted `sql_memory` tool (HARD dependency).

## Implementation Details

- Shared portable recall instructions in `skills/_shared/` (harness-neutral; never opens a DB connection itself — uses the callable tool).
- Project key from git origin with URL credentials redacted, or absolute common git dir on broad git failure — report failure rather than assigning memories to an accidental project (do NOT reuse the loose `resolveGitIdentity` cwd fallback).
- Bound queries: `plaintext_to_tsquery` for free text; bound rows/content; SQL-side text/author-value ranking with deterministic tie order.
- Parent loop may fetch a small active-project shortlist before a nested stage and run fixed-shape native `runJev` (`noul`) relevance over candidate IDs; pass only validated IDs/provenance to the child. Children never gain ambient Jev or model-generated SQL.
- Existing loop continuation Jev stays as-is except it cannot override an unverified SQL save (finished in Phase 3).

## Risks

- Skills must stay harness-neutral (locked convention): name the closed question; Jev only via OMP eval-kernel/extension path.
- Jev must never invent IDs; failure path = deterministic shortlist.

## Verification

- Contract tests: fixed Jev legal-set / invalid-output / failure cases; provenance and all-branch active-only recall; empty vs missing vs error distinguishable.
- Avoid text-matching tests for prose instructions.
- `npm run guardrails:check` after the slice.
