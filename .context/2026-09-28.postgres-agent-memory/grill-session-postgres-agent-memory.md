---
type: grill-session
date: 2026-09-28
subject: 2026-09-28.postgres-agent-memory
total_questions: 20
boundary_assessment: pending
break_points: []
decision_domains:
  - name: Capture and canonical record
    questions: [1-14, 20]
    resolved: 15
    deferred: 0
  - name: Identity and attribution
    questions: [15-16]
    resolved: 2
    deferred: 0
  - name: Retrieval design
    questions: [17]
    resolved: 1
    deferred: 0
  - name: Runtime and configuration
    questions: [18-19]
    resolved: 2
    deferred: 0
status: completed
---

# Grill Session: Postgres agent memory

## Decision Domains

### Domain: Capture and canonical record
- Q1: Does Postgres replace `.context/memory/`, or sit beside it? → resolved: replace it. Do not migrate existing `.context/` memories. They are task-specific and go stale.
- Q2: Does replacement stop at `.context/memory/`, or does the rest of `.context/` move too? → resolved: the rest moves too, as phase 2. Phase 1 is memory replacement only. No memory migration.
- Q3: In phase 1, do plans, specs, research, and backlog still write to `.context/` files? → resolved: yes. Get memory working first.
- Q4: Is phase 1 only a SQL tool over the schema, with no required Jev gate and no `turn_end` auto-writer? → resolved: yes. Agent gets SQL against the schema. No required Jev gate. No `turn_end` auto-writer.
- Q5: Are schema changes a separate versioned migration path, or can the memory SQL tool run DDL? → resolved: separate path. Ordered migration files, explicit migrate, `schema_migrations`. Memory SQL cannot run DDL.
- Q8: Does the agent apply migrations, or only author them for a human to apply? → resolved: the agent applies them. Classified `direct_answer`.
- Q9: May the agent apply a migration on its own, or only when explicitly asked? → resolved: on its own. Classified `direct_answer`.
- Q10: May an autonomous apply run destructive SQL (`DROP`, `TRUNCATE`, deletes), or only additive changes? → resolved: additive only. Classified `direct_answer` by session `jev` (`jev-1.13.0`, confidence 0.96).
- Q11: Can the memory SQL tool change a user's skill weight? → resolved: yes. Classified `direct_answer` by session `jev` (`jev-1.13.0`, confidence 1.0).
- Q12: When a branch merges, do branch-scoped memories close, promote to project scope, or stay as-is? → resolved: stay valid. Branch is provenance (where and when the memory came from), not a validity window. No close, no promote on merge. Classified `direct_answer` by session `jev` (0.77).
- Q13: Does recall filter to the current branch, or return project memories from all branches with the branch shown as context? → resolved: all branches, branch shown as context. Classified `direct_answer` by session `jev` (0.99).
- Q14: Are memories visible to all users immediately on write, or private to the author until promoted? → resolved: visible immediately. Shared by default. Classified `direct_answer` by session `jev` (1.0).
- Q15: How is the acting user identified on each memory write? → resolved: git email (`git config user.email`). Single-user system for now; alias normalization out of scope. Classified `direct_answer` by session `jev` (0.98).
- Q16: How is a project identified? → resolved: git origin URL, with absolute git common dir as the non-remote fallback (token-attribution precedent). Classified `direct_answer` by session `jev` (1.0).
- Q17: Does v1 include semantic embeddings, or full-text search only? → resolved: embeddings in v1 via a separate `memory_embeddings (memory_id, model, dims, embedding)` table. Model choice open, embeddings optional, agent decides usage. Classified `direct_answer` on confirm (1.0).
- Q18: Where does the database connection string live? → resolved: environment variable (`SQL_MEMORY_URL`), read at tool registration like `TYPESAFE_API_KEY`. Classified `direct_answer` by session `jev` (1.0).
- Q19: Is the tool always registered when the env var is set, or opt-in via a flag? → resolved: always registered. `SQL_MEMORY_URL` set = opt-in. Classified `direct_answer` by session `jev` (1.0).
- Q20: Is a memory tied to branch name only, or branch name plus commit SHA? → resolved: branch name plus commit SHA. Classified `direct_answer` by session `jev` (0.99).
- Q6: Should a memory body be updated in place? → resolved: no. New row. Old row gets `invalid_at` and a successor pointer. Rank and skill rows may be updated.
- Q7: Does the schema reject body updates, or is immutability only a convention? → resolved: reject them. Trigger or column privilege blocks body, context, and embedding updates. `invalid_at` and the successor pointer stay writable. Rank and skill tables stay writable.

## Addenda
- Author identity = git email was the Q15 addendum candidate; confirmed as direct answer on re-ask.
- Turn classification uses the session `jev` tool, not eval `judge()`. Skill updated.
- Q17: "Leave it open to the agent to decide what and how to use it" — no prescribed embedding workflow; agent chooses when and how to embed. Classified `addendum` (0.91).

## Boundary Assessment

> Triggered at Q20 (assessment threshold: 20)

**Assessment**: boundaries_found

**Separation-of-concerns boundaries identified:**
- After Q14 (end of canonical-record decisions): the data/capture contract is closed — replacement, phasing, tool shape, migrations, immutability, branch semantics.
- After Q16 (end of identity): author and project keys are closed — git email, origin URL.
- After Q17-Q19: retrieval and runtime config close together — embeddings table, env var, registration.

**Recommended phases:**
- Phase 1: Schema and migrations (Domain 1 + identity keys) — `schema_migrations`, tables, immutability triggers, additive-only autonomous apply.
- Phase 2: Extension and SQL tool (Domain 4) — `api.registerTool`, `SQL_MEMORY_URL`, DML-only statement gate.
- Phase 3: Recall and embeddings usage (Domain 3) — agent-driven query patterns, embeddings backfill, docs.
- External phase 2 (user-declared, out of this grill): migrate the rest of `.context/` to Postgres.

Run `/skill:b-phase` to create the formal phased plan.

## Deferred Questions
