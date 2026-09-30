---
status: completed
date: 2026-09-28
subject: 2026-09-28.postgres-agent-memory
topics: [postgres, agent-memory, sql-tool, migrations, omp-extension]
research: research-postgres-agent-memory.md
brainstorm: brainstorm-postgres-agent-memory.md
grill: grill-session-postgres-agent-memory.md
memory:
  - postgres-agent-memory-schema-phase-1-2026-09-28.md
  - postgres-agent-memory-sql-tool-phase-2-2026-09-28.md
  - postgres-agent-memory-phase3-docs-iterate-2026-09-28.md
  - postgres-agent-memory-phase3-save-2026-09-28.md
iterations:
  - iterate-postgres-agent-memory.md
  - iterate-postgres-agent-memory-additive-migrations.md
  - iterate-postgres-agent-memory-phase3-docs.md
  - iterate-postgres-agent-memory-phase3-migrate-ack.md
  - iterate-postgres-agent-memory-phase3-writable-columns.md
---

# Plan: Remote Postgres agent memory

## User Goal

Engineers share one remote PostgreSQL memory store across all projects: any OMP agent can store and recall memories scoped by project and git branch, ranked by author skill and value, with order and context preserved — replacing `.context/memory/` for new memories. Ratified through the 2026-09-28 grill session (20/20 questions resolved, zero deferred).

## What we build

An OMP extension registering a SQL tool over a remote PostgreSQL memory schema. The agent gets SQL and an intelligent schema; usage improves the system. No prescribed memory workflow.

## Locked decisions (from grill-session-postgres-agent-memory.md)

| # | Decision |
|---|---|
| Q1 | Postgres **replaces** `.context/memory/` for new memories. No migration of existing memories — they are stale task notes. |
| Q2 | The rest of `.context/` moves to Postgres as an **external phase 2**, after v1. |
| Q3 | In v1, plans/specs/research/backlog keep writing `.context/` files. Memory only. |
| Q4 | v1 = SQL tool + schema. **No required Jev gate, no `turn_end` auto-writer.** |
| Q5 | Schema changes are versioned migration files + `schema_migrations`. Memory SQL cannot run DDL. |
| Q8/Q9 | The agent authors **and applies** migrations, on its own. |
| Q10 | Autonomous apply is **additive only**. `DROP`/`TRUNCATE`/row deletes need an explicit ask. |
| Q6/Q7 | Memory body is immutable: correction = new row; old row gets `invalid_at` + successor pointer. Schema **rejects** body/context/embedding updates (trigger or column privilege). Rank and skill rows stay writable. |
| Q11 | The SQL tool may change a user's skill weight. No human gate. |
| Q12 | Branch memories stay valid after merge. Branch is provenance, not a validity window. |
| Q13 | Recall returns project memories from **all branches**, branch shown as context. |
| Q14 | Memories visible to all users immediately. No private staging, no RLS on the critical path. |
| Q15 | Author identity = `git config user.email`. Alias normalization out of scope (single-user for now). |
| Q16 | Project identity = git origin URL; absolute git common dir fallback (token-attribution precedent). |
| Q17 | Embeddings ship in v1 as a separate `memory_embeddings (memory_id, model, dims, embedding)` table. Model open, usage agent-discretionary. |
| Q18 | Connection string = `SQL_MEMORY_URL` env var, read at registration (`TYPESAFE_API_KEY` pattern). |
| Q19 | Tool always registered when env var is set. The var is the single opt-in. |
| Q20 | Branch provenance = branch name **plus commit SHA**. |

## Schema (v1, migration 001)

- `users` — email (PK), skill_weight.
- `projects` — origin_url (unique), name. Common-dir fallback keys allowed.
- `memories` — id uuidv7, author → users, project → projects (NULL = global), branch_name NULL, commit_sha NULL (both set = branch-scoped), body, context jsonb, category, seq, created_at, valid_at, invalid_at NULL, superseded_by NULL, value_score. Generated tsvector + GIN. Body/context immutable via trigger.
- `categories` — slug, description, status candidate|active. Seed: methodology, tool, project, preference, decision, pitfall, convention, other.
- `tags` + `memory_tags` — many-to-many retrieval tags, not Jev outputs.
- `memory_ranks` — memory, rater, score. Separate from author.
- `memory_embeddings` — memory_id, model, dims, embedding vector. HNSW index created lazily per model/dims when first needed (additive migration).
- `schema_migrations` — version, applied_at, checksum.

Additional tables (episodes, summaries) are deliberately deferred: the additive migration path adds them when usage demands.

## Tool contract

- Name: `sql_memory`. Registered in `extensions/sql-memory/`, wired from `extensions/index.ts` (`jev`/`fix_pr_feedback` precedent).
- Reads `SQL_MEMORY_URL`; absent → not registered (Q19).
- Statement gate: `SELECT`/`INSERT`/`UPDATE` only, on schema tables. `DELETE`, all DDL, and other databases rejected. (Follows from Q5, Q6, Q10.)
- Migration mode: separate operation applying pending migration files in order; autonomous apply additive-only; destructive statements require an explicit user ask.
- Postgres client lazily loaded (token-attribution `createRequire` precedent) so non-OMP harnesses and tests don't pay for it.

## Verification

- Live tool smoke: set `SQL_MEMORY_URL`, insert a memory with author/project/branch/SHA, recall by project across branches, supersede it, confirm old row closed not mutated.
- Immutability: `UPDATE memories SET body = ...` fails.
- Migration runner: apply 001, re-apply is a no-op, destructive file refused without explicit ask.
- DML gate: `DROP TABLE` through the tool is rejected.

## Out of scope

- Migrating existing `.context/memory/` content (Q1).
- Moving plans/specs/research/backlog to Postgres (external phase 2, Q2/Q3).
- Jev gates, `turn_end` capture, summaries pipeline (Q4; revisit after usage).
- RLS, multi-user auth beyond git email, alias normalization (Q14/Q15).
- Graph database, vector sidecar (research: not justified under ~5–10M vectors).
