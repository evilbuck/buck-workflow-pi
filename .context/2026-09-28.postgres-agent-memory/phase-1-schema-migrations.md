---
status: completed
phase: 1
order: 1
plan: plan-postgres-agent-memory.md
phases_overview: plan-postgres-agent-memory-phases.md
difficulty: medium
model_hint: capable general model
buck_hint: /b-build
goal: "Ship migration 001 defining the full v1 memory schema with enforced immutability, plus the versioned migration-file convention."
files:
  - migrations/001_initial_schema.sql
  - migrations/README.md
from_plan_steps: [schema, migrations]
depends_on: []
dependency_type: NONE
acceptance_criteria:
- "[x] `schema_migrations` table exists with version, applied_at, checksum"
- "[x] `users`, `projects`, `memories`, `categories`, `tags`, `memory_tags`, `memory_ranks`, `memory_embeddings` tables match the plan's schema section"
- "[x] `memories` enforces: project NULL = global; branch_name/commit_sha both NULL or both set; branch requires project"
- "[x] Seed categories loaded: methodology, tool, project, preference, decision, pitfall, convention, other"
- "[x] Trigger (or equivalent) rejects UPDATE to memories.body, context, author, project, branch_name, commit_sha; invalid_at and superseded_by stay writable"
- "[x] Generated tsvector column + GIN index on memories"
- "[x] Migration file applies cleanly via psql against a scratch database; re-apply is a no-op"
- "[x] migrations/README.md documents: ordered files, additive-only autonomous rule, destructive-requires-explicit-ask rule"
completed_at: 2026-09-28
completed_by: null
---

# Phase 1: Schema and Migrations

## Context

Parent goal (one line): engineers share one remote PostgreSQL memory store across projects — project/branch-scoped, skill-ranked, order- and context-preserving — replacing `.context/memory/` for new memories.

This phase creates the data contract everything else targets. The schema encodes the grill's structural decisions so the tool in Phase 2 only has to gate statements, not enforce semantics.

## Implementation Details

1. Create `migrations/001_initial_schema.sql` with the plan's schema section, verbatim decisions:
   - `users(email PK, skill_weight)` — skill_weight numeric, default 1.0.
   - `projects(id, origin_url UNIQUE, name)` — common-dir strings allowed as origin_url values.
   - `memories`: `id uuid DEFAULT uuidv7() PK`, `author FK users`, `project FK projects NULL`, `branch_name text NULL`, `commit_sha text NULL`, `body text NOT NULL`, `context jsonb NOT NULL DEFAULT '{}'`, `category FK categories`, `seq bigint NOT NULL` (explicit per-thread order), `created_at timestamptz DEFAULT now()`, `valid_at timestamptz DEFAULT now()`, `invalid_at timestamptz NULL`, `superseded_by uuid FK memories NULL`, `value_score numeric NULL`. Generated `search tsvector` + GIN.
   - CHECK: `(branch_name IS NULL) = (commit_sha IS NULL)` and `branch_name IS NULL OR project IS NOT NULL`.
   - Immutability trigger: block updates to body, context, author, project, branch_name, commit_sha, created_at, valid_at. Allow invalid_at, superseded_by, value_score.
   - `categories(slug PK, description, status candidate|active)` + seed insert.
   - `tags(id, slug UNIQUE)`; `memory_tags(memory_id, tag_id, PK(memory_id, tag_id))`.
   - `memory_ranks(id, memory_id FK, rater FK users, score, created_at)`.
   - `memory_embeddings(memory_id FK, model text, dims int, embedding vector)` — note in a comment: no fixed dimension; HNSW index added by a later additive migration per model/dims when first needed. Requires `CREATE EXTENSION IF NOT EXISTS vector`.
   - `schema_migrations(version text PK, applied_at, checksum)`.
2. Create `migrations/README.md`: ordered filenames, checksums, additive-only autonomous apply, destructive statements need an explicit user ask, agent authors and applies (Q8/Q9/Q10).
3. Bootstrap apply is manual `psql` in this phase; the runner lands in Phase 2.

## Risks

- **uuidv7() requires PostgreSQL 18+.** If the target server is older, fall back to app-generated uuidv7 from the extension and plain `uuid` default — record the choice in the migration header comment.
- **pgvector availability.** If the extension is absent, split `memory_embeddings` into `002` so 001 still applies; keep the split decision visible.
- Trigger must not block the valid_at/superseded_by path or Phase 2 verification fails.

## Verification

- Apply 001 to a scratch database (`psql -f`).
- `UPDATE memories SET body='x'` fails; `UPDATE memories SET invalid_at=now(), superseded_by=...` succeeds.
- Insert branch row without project fails; both-NULL branch fields succeed (global).
- Re-run 001: no duplicate rows, no error.

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Run `/b-build` for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. Out-of-plan issues route to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If the phase is incomplete, leave `status: in-progress` so the session resumes here next turn.
