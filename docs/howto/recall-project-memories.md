# Recall project memories from the SQL store

Fetch shared memories for the current project — across all branches, with branch provenance as context, newest capture order intact — using the `sql_memory` tool.

## Steps

1. Check that `SQL_MEMORY_URL` is set in the environment — when set, `sql_memory` is registered; if it is missing, the store is not configured for this session — stop and tell the user.
2. Get the project key: run `git remote get-url origin` (fallback: absolute git common dir). This matches `projects.origin_url`.
3. Recall ordered memories with ranking context via `sql_memory` `{ op: "sql" }`:

   ```sql
   SELECT m.body, m.category,
          m.branch_name, m.commit_sha, m.seq,
          u.skill_weight * COALESCE(m.value_score, 0) AS author_value_rank
   FROM memories m
   JOIN users u ON u.email = m.author
   JOIN projects p ON p.id = m.project
   WHERE p.origin_url = '<project-key>'
     AND m.invalid_at IS NULL
   ORDER BY m.seq;
   ```

   `branch_name IS NULL` rows are global; everything else carries branch + commit provenance. Re-rank with `ORDER BY author_value_rank DESC` when priority beats chronology, or add `ts_rank(m.search, to_tsquery(...))` for keyword relevance.

   Canonical recall patterns (authoritative copies, with live outputs): [docs/sql-memory.md](../sql-memory.md).
4. When a memory is stale, supersede it — do not update its body: insert a new row, then `UPDATE memories SET invalid_at = now(), superseded_by = '<new-id>' WHERE id = '<old-id>'`. Worked examples with live outputs: [docs/sql-memory.md](../sql-memory.md).
5. **Eat:** the query returns rows for the project with `invalid_at IS NULL`, each row shows its `branch_name`/`commit_sha` provenance (or NULL for global), and rows appear in `seq` order.

If `rowCount` is 0, the store has no memories for this project yet — record one with an `INSERT` following the supersede-flow example's insert form.
