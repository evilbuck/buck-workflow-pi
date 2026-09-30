---
date: 2026-09-28
domains: [database, migrations, testing]
topics: [postgres-agent-memory, schema-migration, pgvector, guardrails]
related: [.context/2026-09-28.postgres-agent-memory/phase-1-schema-migrations.md]
priority: medium
status: active
subject: 2026-09-28.postgres-agent-memory
artifacts: [phase-1-schema-migrations.md, migrations/001_initial_schema.sql, migrations/README.md]
---

# PostgreSQL agent memory schema — Phase 1

Implemented migration 001 with `schema_migrations`, users, projects, memories, categories, tags, memory tags, ranks, and embeddings. It requires PostgreSQL 18 for `uuidv7()` and pgvector for `vector`; embeddings have no fixed vector dimension. Categories are seeded idempotently. Project-null rows are global; branch name and commit SHA must be paired, and a branch requires a project. Generated English `tsvector` and GIN index support text search. Memory content/provenance and embedding updates are rejected; `invalid_at` and `superseded_by` remain writable. Migration triggers use `CREATE OR REPLACE TRIGGER`, avoiding destructive drop operations on re-apply.

`migrations/README.md` defines ordered numbered files, checksums, additive-only autonomous migrations, and the explicit-user-ask rule for destructive operations.

Scratch proof: applied and reapplied the migration in `pgvector/pgvector:pg18`; confirmed two global/project-branch memory inserts, full-text search, writable invalidation/supersession fields, body and embedding update rejection, missing-project branch rejection, and unpaired branch field rejection. Scratch container removed.

Repository guardrails remain blocking: first run could not find Vitest before `npm ci`; after installing the locked dependencies, `npm run guardrails:check` failed the required unit/coverage gate on pre-existing byte-parity differences in `scripts/codex-plugin.test.ts` (one failure among 1,081 tests; 1,080 passed). Complexity passed; patch is advisory; lint/functional are disabled. No unrelated bundle files were changed. Phase remains in progress until the repository check failure is cleared.
