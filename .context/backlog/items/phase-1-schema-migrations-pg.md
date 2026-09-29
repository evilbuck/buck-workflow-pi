---
title: "Phase 1: Schema and Migrations"
status: active
priority: high
created: 2026-09-28
updated: 2026-09-28
completed: null
related:
  - .context/2026-09-28.postgres-agent-memory/phase-1-schema-migrations.md
  - .context/2026-09-28.postgres-agent-memory/plan-postgres-agent-memory-phases.md
---

# Phase 1: Schema and Migrations

Migration 001 defining the v1 memory schema (users, projects, memories, categories, tags, ranks, embeddings, schema_migrations) with enforced body immutability and the versioned additive-only migration convention.

## Acceptance criteria

- [x] Migration 001 applies cleanly; re-apply is a no-op
- [x] Immutability trigger rejects body/context/author/scope updates; invalid_at and superseded_by stay writable
- [x] Branch CHECK: both fields NULL or both set; branch requires project
- [x] Seed categories loaded
- [x] migrations/README.md documents ordered files and the destructive-requires-ask rule

Repository guardrails remain blocking due to the pre-existing Codex bundle parity failure recorded in the session memory.
