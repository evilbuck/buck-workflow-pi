---
status: completed
date: 2026-09-28
updated: 2026-09-28
subject: 2026-09-28.postgres-agent-memory
topics: [review, iteration, docs, sql-memory, migrations]
informs: []
addresses: phase-3-recall-patterns-docs.md
completed: 2026-09-28
from_review: b-review
---

# Iteration: Phase 3 migrate-ack semantics and Q11 digest gap

## Source
- Reviewed after: `/b-iterate` (phase-3-docs round) — this is the second review pass on phase 3
- Phase: `phase-3-recall-patterns-docs.md`
- Plan: `plan-postgres-agent-memory.md`

Fresh review re-verified current state: all sql-mode example statements pass the
project's own `checkSqlStatement` gate (10/10 in `docs/sql-memory.md`, plus the
how-to query), the allowlist note matches `SAFE_FUNCTIONS`
(`extensions/sql-memory/sql-gate.ts:20-26`), schema names match
`migrations/001_initial_schema.sql`, and the durable guardrails verdict is pass
(contract v2, unit/ratchet/patch/complexity all pass). Two in-plan defects
remain; both are doc-accuracy gaps inside the phase's own files.

## Critical Issues

### 1. HNSW migration sketch cannot be applied as documented — `{ op: "migrate" }` refuses it
- **File**: `docs/sql-memory.md:157-175` (and `docs/sql-memory.md:10`)
- **Problem**: The doc labels the per-model HNSW sketch
  `-- migrations/00N_hnsw_<model>.sql (applied via { op: "migrate" })` and says
  "Adopts stay additive". Verified against the shipped gate
  (`containsDestructiveMigration`, `extensions/sql-memory/sql-gate.ts:236-250`):
  **every statement of the sketch is ack-required** — the autonomous additive
  grammar admits only `CREATE TABLE IF NOT EXISTS` with simple types (no
  `REFERENCES`, no `vector(1536)`), `ALTER … ADD COLUMN`, and bare
  `CREATE INDEX … (col)` (no `USING hnsw (…) vector_cosine_ops`), and it has no
  `INSERT` form at all; the `'text-embedding-3-small'` literal alone forces the
  non-additive classification. A plain `{ op: "migrate" }` therefore throws
  `Non-additive migration 00N_hnsw_<model>.sql requires explicit acknowledgment
  naming that exact file`. Operating rules (line 10) compound this by describing
  the `destructive` ack as required only for `DROP`/`TRUNCATE`/deletes, while
  the accurate semantics (post phase-2 hardening) are in `migrations/README.md:8-14`:
  any unparsed form — including this additive-but-unparseable sketch — needs the
  exact-file acknowledgment. An agent following the doc hits an unexplained
  refusal. This is the phase's declared risk ("docs drifting") materialized, and
  leaves acceptance criterion 6 partial for this example (it was verified via raw
  SQL on pgvector/pg18, not through the registered tool's migrate op).
- **Proposed fix**: In the HNSW section, state that the autonomous additive
  grammar cannot express typed vector columns, `REFERENCES` constraints,
  `INSERT … SELECT` backfill, or HNSW operator classes, so applying
  `00N_hnsw_<model>.sql` requires `destructive: "00N_hnsw_<model>.sql"` — the
  exact-file acknowledgment gates unparsed forms, not just destructive ones.
  Align the Operating-rules `destructive` sentence (line 10) with
  `migrations/README.md:8-14`. A grammar-conformant rewrite of the sketch is not
  possible (no `vector(n)` type, no `USING` clause in the grammar), so the ack
  note is the correct documentation, not a schema workaround.

### 2. Q11 decision missing from the Q1–Q20 digest
- **File**: `docs/sql-memory.md` (Operating rules / Identity keys table)
- **Problem**: Acceptance criterion 1 requires the locked decisions (Q1–Q20
  digest). 19/20 are recorded (Q5 in substance, unlabeled, at line 10). Q11 —
  "Can the memory SQL tool change a user's skill weight? → resolved: yes"
  (`grill-session-postgres-agent-memory.md:41`, confidence 1.0), reinforced by
  Q6/Q7's "rank and skill rows may be updated / stay writable" (lines 51-52) —
  appears nowhere. The doc lists writable columns for `memories` only and never
  states `users.skill_weight` or `memory_ranks` are writable through the tool.
  The decision is realizable: `users` is in `MEMORY_TABLES` and the gate allows
  `UPDATE users SET skill_weight = …` (re-verified live against
  `checkSqlStatement`).
- **Proposed fix**: Add to Operating rules (or the Identity keys table) a line:
  writable beyond `memories` transitions — `UPDATE users SET skill_weight`
  (Q11) and `memory_ranks` rows for per-rater scores (Q6/Q7); cite Q11.

## Warnings

### 1. Recall query duplicated across the two docs
- **File**: `docs/howto/recall-project-memories.md:12-21`, `docs/sql-memory.md:31-43`
- **Problem**: Near-identical recall queries live in both files; a schema change
  requires editing both. Partially mitigated: the how-to drops `ts_rank` and
  links to `docs/sql-memory.md` for worked examples.
- **Suggested approach**: Add one pointer line in the how-to ("canonical recall
  patterns: [docs/sql-memory.md]") so a future editor knows which copy is
  authoritative.

### 2. How-to step 1 presumes the env var is set
- **File**: `docs/howto/recall-project-memories.md:7`
- **Problem**: "`SQL_MEMORY_URL` is set in the environment, so `sql_memory` is
  registered" reads as an assertion about the current environment; in sessions
  without the variable (this review's, for example) the first clause is false
  even though the instruction ("confirm, else stop") is right.
- **Suggested approach**: Reword to "Check that `SQL_MEMORY_URL` is set — when
  set, `sql_memory` is registered; if it is missing, the store is not configured
  for this session — stop and tell the user."

## Recommended Workflow

Start with `/b-iterate` — it will pick up this file automatically. Both fixes
are documentation-only (no schema, gate, or tool changes; do not widen the
additive grammar to make the sketch autonomous — the ack requirement is the
locked phase-2 behavior). Then re-run `/b-review` against
`phase-3-recall-patterns-docs.md`.
