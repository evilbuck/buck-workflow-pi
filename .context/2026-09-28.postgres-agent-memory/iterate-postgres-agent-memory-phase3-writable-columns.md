---
status: completed
date: 2026-09-28
updated: 2026-09-28
subject: 2026-09-28.postgres-agent-memory
topics: [review, iteration, docs, sql-memory]
informs: []
addresses: phase-3-recall-patterns-docs.md
completed: 2026-09-28
from_review: b-review
---

# Iteration: Phase 3 writable-columns precision and verbatim-claim scope

## Source
- Reviewed after: `/b-iterate` (migrate-ack round) — third review pass on phase 3
- Phase: `phase-3-recall-patterns-docs.md`
- Plan: `plan-postgres-agent-memory.md`

Review re-verified everything live: fresh `pgvector/pgvector:pg18` container, schema 001 applied via `psql`, doc-matching seed, all 10 sql-mode examples from `docs/sql-memory.md` re-executed doc-exact through `checkSqlStatement` + the tool's execution path (`BEGIN; SET LOCAL search_path = public; SET LOCAL standard_conforming_strings = on` per `extensions/sql-memory/index.ts:34-41`). Every pasted output reproduced byte-for-byte (recall `text_rank` 0.06079271, ranks 1.35/0.56/0.75; trigger rejection message; ledger `rowCount:0`). Guardrails: durable contract v2, `pass` (unit 1126/1126, ratchet 88 ≥ 84, complexity clean). Both prior iterate rounds' fixes confirmed present. Remaining defects are doc-precision gaps in the phase's own files.

## Critical Issues

### 1. "Writable columns on `memories`" enumeration is verifiably incomplete
- **File**: `docs/sql-memory.md:11`
- **Problem**: Under "**Immutability is enforced, not conventional (Q6/Q7)**" the doc lists the trigger's 8 rejected columns (correct, matches `migrations/001_initial_schema.sql:97-104`) and then states "Writable columns on `memories`: `invalid_at`, `superseded_by`, `value_score`" as if that were the enforced complement. It is not: `seq`, `category`, and `id` are also absent from the trigger and unrestricted by the gate (`sql-gate.ts` has no SET-column check). Verified live this review: `UPDATE memories SET seq = 99 WHERE seq = 2` → `rowCount:1`; `UPDATE memories SET category = 'other'` → `UPDATE 1`. Both pass gate and trigger. An agent reading the operating rules as an enforcement map is misled in both directions (believes `seq` immutable; would be surprised a `category` rewrite succeeds).
- **Proposed fix** (documentation-only — do **not** widen the trigger or gate here): reword to: the trigger's immutable set is exactly the 8 listed columns; the transition columns you write are `invalid_at`/`superseded_by` (plus `value_score` for scoring); `id`, `category`, and `seq` are technically writable but must be treated as immutable by convention. Schema enforcement of `seq`/`category` would be a phase-1-schema change — out-of-plan follow-up, not this iteration.

## Warnings

### 1. "All examples … executed live through the registered tool; outputs are pasted verbatim" overreaches for the HNSW section
- **File**: `docs/sql-memory.md:28`
- **Problem**: Same defect class as the round-1 critical (blanket claim vs content). The HNSW sketch (`docs/sql-memory.md:162-175`) has no pasted output and is applied via `{ op: "migrate", destructive: … }`, not the `sql` op — "through the registered `sql_memory` tool" is at best true of the migrate path, and no output is captured either way.
- **Suggested approach**: Scope the sentence to the sql-mode examples ("Every sql-mode example below …"), or paste the migrate-op result for the sketch.

### 2. Toy embedding dims (4) vs the HNSW sketch's `vector(1536)` for the same model
- **File**: `docs/sql-memory.md:134-141` vs `docs/sql-memory.md:165-172`
- **Problem**: The backfill example inserts a 4-dim embedding under model `text-embedding-3-small`; the per-model sketch table for that same model is `vector(1536)`. Copying both verbatim then applying the sketch fails at the `INSERT … SELECT` with `expected 1536 dimensions, not 4` (hit live during this review's probe). Inherent to the toy example, but a one-line note prevents the surprise.
- **Suggested approach**: Add one sentence near the sketch: the typed table's dimension must match the model's real dimension, and toy-dim rows (like the 4-dim example above) cannot be backfilled into it.

## Recommended Workflow

Start with `/b-iterate` — it will pick up this file automatically. All three fixes are wording-only in `docs/sql-memory.md`; no schema, gate, or tool changes (widening the trigger to cover `seq`/`category` is an out-of-plan `/b-plan` follow-up if wanted). Then re-run `/b-review` against `phase-3-recall-patterns-docs.md`.
