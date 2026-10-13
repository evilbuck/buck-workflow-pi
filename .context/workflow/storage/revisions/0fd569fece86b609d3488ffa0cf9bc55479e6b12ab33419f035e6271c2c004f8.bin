---
status: completed
date: 2026-09-28
updated: 2026-09-28
subject: 2026-09-28.postgres-agent-memory
topics: [review, iteration, postgres, migrations]
informs: []
addresses: phase-2-extension-sql-tool.md
completed: 2026-09-28
from_review: b-review
---

# Iteration: additive migration enforcement

## Source
- Reviewed after: `/b-iterate`
- Plan: `plan-postgres-agent-memory.md`
- Phase: `phase-2-extension-sql-tool.md`

## Critical Issues


### 1. Autonomous migrations are not additive-only
- **File**: `extensions/sql-memory/sql-gate.ts:234-240`, `extensions/sql-memory/migrations.ts:68-76`
- **Problem**: `containsDestructiveMigration` only searches for `DROP`, `TRUNCATE`, and `DELETE` tokens, plus those words contiguous inside dollar-quoted bodies. It returns `false` for `ALTER TABLE memories RENAME TO retired_memories;`, which is a non-additive schema mutation. A fake-pool probe called `applyMigrations` with this file and no `destructive` acknowledgment; it returned `applied: ["002_rename.sql"]` and sent the rename SQL to the client. It also returns `false` for `CREATE FUNCTION wipe() RETURNS void LANGUAGE plpgsql AS 'BEGIN DELETE FROM memories; END;';` and `DO $$ BEGIN EXECUTE 'TRU' || 'NCATE memories'; END $$;`. The latter executes a destructive statement immediately while evading the contiguous-keyword search. This violates the phase's additive-only autonomous apply criterion and its exact-filename destructive acknowledgment requirement.
- **Proposed fix**: Enforce an explicit additive-statement grammar for unacknowledged migrations, rather than a blacklist of destructive words. Reject transformations (`ALTER ... RENAME`, `CREATE OR REPLACE` of existing objects, etc.), procedural/dynamic SQL, and any unparsed form unless the exact migration filename is acknowledged. Keep first migration compatibility with its additive `CREATE OR REPLACE FUNCTION/TRIGGER` definitions only if equivalently safe under the policy; otherwise revise the migration and preserve its checksum before first release. Add fake-pool regression tests proving each non-additive file is refused before opening a transaction and a benign additive migration still applies. Run a disposable PostgreSQL tool smoke for the repaired migration path.

## Warnings

### 1. Successful writes report zero affected rows
- **File**: `extensions/sql-memory/index.ts:39-41`
- **Problem**: The tool reports `rowCount: result.rows.length`. PostgreSQL returns no rows for `UPDATE` or `INSERT` without `RETURNING`, even when a row was affected. A tool probe with a client result of `{ rows: [], rowCount: 1 }` returned `{ rows: [], rowCount: 0 }`. Agents cannot distinguish a successful write from a no-match update using the reported count.
- **Suggested approach**: Use the driver's `result.rowCount` for write operations (and preserve `rows` for returning/read operations); extend the query-result interface and add a behavioral test for `UPDATE` with one affected row and no `RETURNING`.

The durable guardrails verdict passes (required unit, global ratchet, complexity; functional and lint skipped, patch advisory/pass), but it does not exercise either case above.

## Iteration evidence

- Unacknowledged migrations now pass only a small additive grammar; non-additive rename, replacement, procedural/dynamic SQL, and unparsed expressions require exact-filename acknowledgment. The audited initial migration remains autonomous only at its pinned SHA-256 checksum.
- `sql_memory` reports PostgreSQL's affected-row count for writes without `RETURNING`.
- Fake-pool regression coverage checks non-additive rejection before transaction, additive `ADD COLUMN`, and bootstrap checksum pinning. Live disposable PostgreSQL 18 smoke passed migration 001, inserts, project recall across branches, supersession preserving the original body, write `rowCount: 1`, and migration replay. Container and smoke script removed.
- Durable guardrails: pass (1126 tests, coverage 88% against 84% ratchet, complexity pass; lint and functional disabled).

## Recommended Workflow

Start with `/b-iterate` on this file, then re-run `/b-review` against `phase-2-extension-sql-tool.md`. The phase is not accepted until the new iteration is completed, review passes, and `/b-save` records the repaired state.
