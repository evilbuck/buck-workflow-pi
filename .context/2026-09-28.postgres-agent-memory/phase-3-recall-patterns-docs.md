---
status: completed
phase: 3
order: 3
plan: plan-postgres-agent-memory.md
phases_overview: plan-postgres-agent-memory-phases.md
difficulty: easy
model_hint: smaller/faster general model
buck_hint: /b-build
goal: "Document agent-driven recall patterns, embeddings usage, and the store's operating rules; verify them live against the registered tool."
files:
  - docs/sql-memory.md
  - docs/howto/recall-project-memories.md
from_plan_steps: [recall, docs]
depends_on: [2]
dependency_type: SOFT
acceptance_criteria:
  - "[x] `docs/sql-memory.md` records the locked decisions (Q1–Q20 digest), env var, tool modes, and additive-migration rule"
  - "[x] Example recall query: project memories across all branches, branch shown as context, ordered by seq, ranked by author skill × value"
  - "[x] Example supersede flow: insert successor, close old row (invalid_at + superseded_by)"
  - "[x] Embeddings how-to: backfill via memory_embeddings, per-model HNSW additive migration sketch"
  - "[x] How-to ends with an observable success check (Eat step) per b-howto format"
  - "[x] Every example query executed live against the registered tool; output captured"
completed_at: 2026-09-28
completed_by: null
---

# Phase 3: Recall Patterns and Docs

## Context

Parent goal (one line): engineers share one remote PostgreSQL memory store across projects — project/branch-scoped, skill-ranked, order- and context-preserving — replacing `.context/memory/` for new memories.

The tool exists (Phase 2). This phase turns usage into documentation: the recall, supersede, rank, and embedding patterns the agent will reach for, verified live. Nothing here prescribes workflow — these are worked examples, not gates (Q4).

## Implementation Details

1. `docs/sql-memory.md`: decision digest from the grill, `SQL_MEMORY_URL`, `sql_memory` modes, additive-only migration rule, destructive acknowledgment, single-user/alias caveat.
2. Recall example: join `memories` + `users` for the project key (origin URL), all branches, `invalid_at IS NULL`, hybrid `ts_rank` + skill_weight × value_score ordering, `seq` for order, branch_name/commit_sha in the projection.
3. Supersede example: `INSERT` successor row, then `UPDATE` old row's `invalid_at`/`superseded_by` (the two writable columns).
4. Embeddings how-to: insert into `memory_embeddings` with model + dims; sketch the additive HNSW migration (`CREATE INDEX ... USING hnsw (embedding vector_cosine_ops)` — operator class must match `<=>`).
5. How-to file per b-howto format with an Eat step.

## Risks

- Docs drifting from schema — every query must run live before it's written down.
- Temptation to add gates/workflow here: resist; usage-driven is a locked decision (Q4).

## Verification

- Run each documented query through `sql_memory`; paste outputs into the doc as examples.

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Run `/b-build` for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. Out-of-plan issues route to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If the phase is incomplete, leave `status: in-progress` so the session resumes here next turn.
