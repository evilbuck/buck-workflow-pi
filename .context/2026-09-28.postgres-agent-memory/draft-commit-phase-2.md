## Title
fix(sql-memory): enforce additive migrations and correct write counts

## Body
Admit autonomous migration files only under a bounded additive grammar, pin the reviewed bootstrap checksum, and demand exact-filename acknowledgment for other forms. Report PostgreSQL affected-row counts for writes without RETURNING. Keep SQL-gate lexical and function-call protections and Codex skill bundle parity from the earlier review iteration.
