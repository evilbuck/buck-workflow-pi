# SQL memory store (`sql_memory`)

Agent-shared PostgreSQL memory store. Replaces `.context/memory/` for new memories; existing `.context/` memories are not migrated (Q1/Q2). Plans, specs, research, and backlog still write to `.context/` files (Q3).

## Operating rules

- **Usage-driven, no gates.** SQL over the schema is the whole tool. No required Jev gate, no `turn_end` auto-writer. These docs are worked examples, not workflow prescriptions (Q4).
- **Connection:** `SQL_MEMORY_URL` environment variable, read at tool registration. Set = tool registered; unset = nothing registered (Q18/Q19).
- **Tool modes:** `{ op: "sql", statement }` — one `SELECT`/`INSERT`/`UPDATE` against public memory tables, function-allowlisted, DDL denied. `{ op: "migrate", destructive? }` — applies ordered files from `migrations/`; see `migrations/README.md`.
- **Schema changes:** never via `sql` mode. Author a numbered migration file and apply it with `migrate`. The agent authors and applies migrations autonomously (Q8/Q9), but only additive ones it can parse (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `CREATE EXTENSION IF NOT EXISTS vector`, `ALTER … ADD COLUMN` with basic types). Anything unparsed — destructive statements (`DROP`, `TRUNCATE`, deletes) or additive-but-unparseable forms (typed vector columns, `REFERENCES`, `USING hnsw`, `INSERT … SELECT` backfills) — requires the user to explicitly name the exact file via `destructive` (Q10).
- **Immutability is enforced, not conventional (Q6/Q7).** The trigger rejects updates to `body`, `context`, `author`, `project`, `branch_name`, `commit_sha`, `created_at`, `valid_at`. The trigger's immutable set is exactly those 8 columns. The transition columns you write are `invalid_at` and `superseded_by` (plus `value_score` for scoring). `id`, `category`, and `seq` are technically writable — not in the trigger's rejected set — but treat them as immutable by convention. `memory_embeddings` rows are immutable; insert a replacement.
- **Writable beyond memory transitions (Q11/Q6/Q7).** `UPDATE users SET skill_weight` (Q11) and `memory_ranks` rows for per-rater scores (Q6/Q7) are allowed through `sql` mode; the tool may change a user's skill weight.
- **Identity:** author = `git config user.email` (Q15). Single-user for now; alias normalization out of scope. Project = git origin URL, absolute git common dir as fallback (Q16). Provenance = branch name + commit SHA together, or both NULL for global (Q20).
- **Visibility and branch semantics:** memories are visible to all users immediately (Q14). Branch is provenance, not a validity window — merges close nothing, promote nothing (Q12). Recall spans all branches with the branch shown as context (Q13).

## Identity keys

| What | How |
|---|---|
| Author | `users.email` — git email |
| Project | `projects.origin_url` — git origin URL or common dir |
| Provenance | `branch_name` + `commit_sha` (both set or both NULL) |
| Order | `memories.seq` — explicit per-thread integer |
| Quality | `users.skill_weight` (author skill), `memories.value_score`, `memory_ranks` rows |

## Recall patterns

Every sql-mode example below was executed live through the registered `sql_memory` tool; outputs are pasted verbatim. The HNSW migration sketch in the embeddings section is applied via the `migrate` op instead and its file is shown without pasted output.

### Project memories across all branches, ordered by seq, ranked by skill × value

```sql
SELECT m.body, m.category, p.origin_url AS project,
       m.branch_name, m.commit_sha, m.seq,
       ts_rank(m.search, to_tsquery('english', 'pgvector')) AS text_rank,
       u.skill_weight * COALESCE(m.value_score, 0) AS author_value_rank
FROM memories m
JOIN users u ON u.email = m.author
JOIN projects p ON p.id = m.project
WHERE p.origin_url = 'git@github.com:evilbuck/buck-workflow-pi.git'
  AND m.invalid_at IS NULL
ORDER BY m.seq
LIMIT 50;
```

Live output:

```json
{"rows":[
 {"body":"Use skill://_shared for cross-skill imports","category":"convention","project":"git@github.com:evilbuck/buck-workflow-pi.git","branch_name":"main","commit_sha":"abc123","seq":"1","text_rank":0,"author_value_rank":"1.35"},
 {"body":"pgvector HNSW operator class must match <=> queries","category":"pitfall","project":"git@github.com:evilbuck/buck-workflow-pi.git","branch_name":"feature/pg","commit_sha":"def456","seq":"2","text_rank":0.06079271,"author_value_rank":"0.56"},
 {"body":"Global: prefer additive migrations","category":"decision","project":"git@github.com:evilbuck/buck-workflow-pi.git","branch_name":null,"commit_sha":null,"seq":"3","text_rank":0,"author_value_rank":"0.75"}],
 "rowCount":3}
```

Notes:
- `branch_name IS NULL` = global memory; `branch_name`/`commit_sha` always travel together.
- `ORDER BY m.seq` preserves capture order; re-rank in a second pass or order by `author_value_rank DESC` when priority matters more than chronology.
- The SQL gate function allowlist covers `ts_rank`, `to_tsquery`, `plaintext_to_tsquery`, `coalesce`, aggregates — no `websearch_to_tsquery`. For arbitrary user input prefer `plaintext_to_tsquery`, which quotes its input safely.

### Pure skill × value ranking

```sql
SELECT m.body, m.branch_name,
       u.skill_weight * COALESCE(m.value_score, 0) AS author_value_rank
FROM memories m
JOIN users u ON u.email = m.author
JOIN projects p ON p.id = m.project
WHERE p.origin_url = 'git@github.com:evilbuck/buck-workflow-pi.git'
  AND m.invalid_at IS NULL
ORDER BY author_value_rank DESC;
```

```json
{"rows":[
 {"body":"Use skill://_shared for cross-skill imports","branch_name":"main","author_value_rank":"1.35"},
 {"body":"Global: prefer additive migrations","branch_name":null,"author_value_rank":"0.75"},
 {"body":"pgvector HNSW operator class must match <=> queries","branch_name":"feature/pg","author_value_rank":"0.56"}],
 "rowCount":3}
```

## Supersede flow

Bodies never update. Insert the successor, then close the old row — `invalid_at` and `superseded_by` are the only transition columns.

```sql
INSERT INTO memories (author, project, body, category, seq)
VALUES ('buckley@example.com',
        (SELECT id FROM projects WHERE origin_url = 'git@github.com:evilbuck/buck-workflow-pi.git'),
        'Import shared skill resources via skill://_shared/<file>',
        'convention', 4);
```

```json
{"rows":[],"rowCount":1}
```

```sql
UPDATE memories
SET invalid_at = now(), superseded_by = '<successor-uuid>'
WHERE id = '<old-uuid>';
```

```json
{"rows":[],"rowCount":1}
```

Verify only the successor is visible:

```sql
SELECT body FROM memories WHERE invalid_at IS NULL AND seq <= 4 ORDER BY seq;
```

```json
{"rows":[
 {"body":"pgvector HNSW operator class must match <=> queries"},
 {"body":"Global: prefer additive migrations"},
 {"body":"Import shared skill resources via skill://_shared/<file>"}],
 "rowCount":3}
```

Attempting a body update fails through the trigger — expected:

```json
{"error":true,"message":"memory content and provenance are immutable; insert a successor memory"}
```

## Embeddings

Embeddings are optional (Q17); the agent decides what and how to embed. v1 table: `memory_embeddings(memory_id, model, dims, embedding vector)` — no fixed dimension, PK `(memory_id, model)`, rows immutable.

### Backfill

```sql
INSERT INTO memory_embeddings (memory_id, model, dims, embedding)
VALUES ('<memory-uuid>', 'text-embedding-3-small', 4, '[0.1,0.2,0.3,0.4]');
```

```json
{"rows":[],"rowCount":1}
```

Nearest-neighbor read (cosine, exact scan without an index):

```sql
SELECT m.body, e.embedding <=> '[0.1,0.2,0.3,0.4]' AS distance
FROM memory_embeddings e
JOIN memories m ON m.id = e.memory_id
WHERE e.model = 'text-embedding-3-small'
ORDER BY distance
LIMIT 5;
```

```json
{"rows":[{"body":"Import shared skill resources via skill://_shared/<file>","distance":0}],"rowCount":1}
```

### Additive HNSW migration (per model)

HNSW indexes require a dimension-typed column (`vector(n)`); the base table's untyped `vector` cannot be indexed. The immutability trigger also blocks any UPDATE, so a typed-column backfill is impossible. The additive pattern is a **per-model table** — verified live against pgvector/pg18:

```sql
-- migrations/00N_hnsw_<model>.sql (NOT autonomous: apply via
-- { op: "migrate", destructive: "00N_hnsw_<model>.sql" })
CREATE TABLE memory_embeddings_tes (
    memory_id uuid PRIMARY KEY REFERENCES memories(id),
    embedding vector(1536) NOT NULL
);
INSERT INTO memory_embeddings_tes (memory_id, embedding)
SELECT memory_id, embedding FROM memory_embeddings
WHERE model = 'text-embedding-3-small'
ON CONFLICT DO NOTHING;
CREATE INDEX memory_embeddings_tes_hnsw
    ON memory_embeddings_tes USING hnsw (embedding vector_cosine_ops);
```

The typed table's dimension must match the model's real dimension — `1536` for `text-embedding-3-small` — so toy-dim rows (like the 4-dim backfill example above) cannot be copied into it; the `INSERT … SELECT` fails with `expected 1536 dimensions, not 4`.

The operator class must match the distance operator used at query time: `vector_cosine_ops` for `<=>`, `vector_ip_ops` for `<#>`, `vector_l2_ops` for `<->`. Adopts stay additive: nothing in 001 changes, the new table is a pure addition, and old rows are copied, never mutated.

**Applying this file requires the exact-file `destructive` acknowledgment, even though nothing is dropped.** The autonomous additive grammar cannot express `vector(1536)` typed columns, `REFERENCES` constraints, `INSERT … SELECT` backfills, or `USING hnsw (… vector_cosine_ops)` operator classes — and there is no autonomous `INSERT` form. Any unparsed statement, not only destructive ones, forces classification as non-additive, so a plain `{ op: "migrate" }` refuses the file; pass `destructive: "00N_hnsw_<model>.sql"` naming it exactly (see `migrations/README.md`). A grammar-conformant rewrite is not possible — no `vector(n)` type or `USING` clause exists in the grammar — so the acknowledgment is the correct path, not a schema workaround.

## Migration ledger check

```sql
SELECT version, applied_at FROM schema_migrations ORDER BY version;
```

```json
{"rows":[],"rowCount":0}
```

Migration 001 was bootstrapped manually via `psql` (phase 1); the ledger is populated by `migrate` runs from phase 2 onward.
