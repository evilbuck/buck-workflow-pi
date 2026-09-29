---
date: 2026-09-28
domains: [docs, postgres, memory-store]
topics: [sql-memory, iteration, review, pgvector]
related: [postgres-agent-memory-schema-phase-1-2026-09-28.md, postgres-agent-memory-sql-tool-phase-2-2026-09-28.md]
priority: medium
status: completed
subject: 2026-09-28.postgres-agent-memory
artifacts: [iterate-postgres-agent-memory-phase3-docs.md, draft-commit-phase-3.md]
---

# Phase 3 docs iteration (b-iterate)

Resolved the active iterate artifact `iterate-postgres-agent-memory-phase3-docs.md` for phase 3:

- Critical: pasted the live ledger-check output (`{"rows":[],"rowCount":0}`) into `docs/sql-memory.md`; the "outputs pasted verbatim" claim now holds for every example.
- Warning 1: supersede INSERT example keys the project by `origin_url` (canonical identity), not non-unique `projects.name`.
- Warning 2: re-executed the doc-exact recall query live; output matches the pasted block exactly (`text_rank` 0.06079271, ranks 1.35/0.56/0.75). Added `plaintext_to_tsquery` to the allowlist note.

**Verification method:** spun up a fresh `pgvector/pgvector:pg18` container on :55432, applied `migrations/001_initial_schema.sql`, seeded the doc-matching rows, re-ran recall query 1, supersede flow (INSERT + UPDATE + verify), and ledger check through psql — all outputs matched the doc. Container stopped after.

Decision: left `.context/workflow/current-session.json` untouched — it belongs to the supervisor's session (stale buck-loop-model-config pointer); nested workers do not own it.

## Second round: `iterate-postgres-agent-memory-phase3-migrate-ack.md` (resolved 2026-09-28)

- Critical 1: `docs/sql-memory.md` now states the HNSW sketch requires `destructive: "00N_hnsw_<model>.sql"` — the additive grammar cannot express `vector(n)`, `REFERENCES`, `USING hnsw`, or `INSERT..SELECT`; Operating-rules `destructive` sentence aligned with `migrations/README.md`.
- Critical 2: added "Writable beyond memory transitions (Q11/Q6/Q7)" rule — `UPDATE users SET skill_weight` and `memory_ranks` rows allowed through `sql` mode.
- Warning 1: how-to marks `docs/sql-memory.md` as the canonical recall-pattern copy. Warning 2: step 1 reworded as an env-var check, not an environment assertion.
- Verified via `checkSqlStatement`: all three sketch statements rejected; `UPDATE users SET skill_weight` allowed. Gates: vitest 1126 pass, bun 70 pass; no lint gate configured (`lint_cmd: null` in guardrails.json).
