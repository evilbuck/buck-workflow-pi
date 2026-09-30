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

# Iteration: Phase 3 recall patterns and docs

## Source
- Reviewed after: `/b-build` (phase 3)
- Phase: `phase-3-recall-patterns-docs.md`
- Plan: `plan-postgres-agent-memory.md`

Review verified live-execution evidence end-to-end (container `pgvector/pgvector:pg18` on 55432, seed SQL, two probe runs through the registered `sql_memory` tool, both `ok:true`; pasted outputs arithmetically consistent with the seed data: 1.5×0.9=1.35, 0.8×0.7=0.56, 1.5×0.5=0.75; all 11 documented statements pass the project's own `checkSqlStatement` gate). Remaining items are documentation-polish defects inside the phase's scope.

## Critical Issues

### 1. "Outputs are pasted verbatim" claim overreaches for the ledger check
- **File**: `docs/sql-memory.md`
- **Problem**: Line 27 claims all example outputs are pasted verbatim, but the "Migration ledger check" section (lines 177–183) shows a query with no output block. The query did run live (probe step 4, `buck-loop.log.jsonl` ~23:45:50Z) — the ledger was empty because 001 was applied via `psql -f`, not `migrate` — so the omission is explainable, but the blanket claim no longer matches the content. Phase risk was exactly "docs drifting"; acceptance criterion 6 ("output captured") is partial for this one query.
- **Proposed fix**: Paste the actual result (an empty `{"rows":[],"rowCount":0}` is itself faithful evidence supporting the prose "ledger is populated by migrate runs from phase 2 onward"), or scope the line-27 claim to the recall/supersede/embeddings pattern sections.

## Warnings

### 1. Supersede example keys the project by non-unique `projects.name`
- **File**: `docs/sql-memory.md`
- **Problem**: The supersede INSERT resolves the project via `(SELECT id FROM projects WHERE name = 'buck-workflow-pi')`. `projects.name` has no unique constraint (only `origin_url` does, per `migrations/001_initial_schema.sql:19-23`), and the doc's own Identity keys table declares origin URL the canonical project key. Two same-named projects make the subquery error out. Worked fine live against the single seeded project.
- **Suggested approach**: Use `WHERE origin_url = 'git@github.com:evilbuck/buck-workflow-pi.git'` in the example so copied patterns use the canonical identity key.

### 2. Executed query variant differs textually from documented query 1
- **File**: `docs/sql-memory.md`
- **Problem**: The probe's live run used `plaintext_to_tsquery('english','pgvector')` with `LEFT JOIN projects` + `COALESCE(p.origin_url,'(global)')` (after `websearch_to_tsquery` was correctly denied by the gate); the doc shows `to_tsquery` with plain `JOIN`. Both forms are gate-allowlisted and semantically identical for this data (single lexeme; the WHERE on `origin_url` makes LEFT JOIN ≡ JOIN), so the pasted output is valid for the documented query — but the doc's exact text was never byte-for-byte executed.
- **Suggested approach**: At the next live DB session, re-run the doc-exact recall query once and confirm identical output; optionally mention `plaintext_to_tsquery` in the allowlist note (line 58) since it is allowlisted and is the safer choice for arbitrary user input.

## Resolution (2026-09-28)

All three findings fixed in `docs/sql-memory.md`; verified live against a fresh `pgvector/pgvector:pg18` container (schema 001 + doc-matching seed):

- **Critical 1** — pasted the actual ledger-check output (`{"rows":[],"rowCount":0}`); the verbatim-output claim at line 27 now holds for every example.
- **Warning 1** — supersede INSERT now keys the project by `origin_url`; re-executed live, `rowCount:1`.
- **Warning 2** — doc-exact recall query 1 (`to_tsquery` + plain `JOIN`) re-executed live; output matches the pasted block exactly (`text_rank` 0.06079271; ranks 1.35/0.56/0.75; rowCount 3). Allowlist note now lists `plaintext_to_tsquery`.

Supersede flow + verify query also re-run live (verify output rowCount 3, matching doc). Container stopped after verification.
