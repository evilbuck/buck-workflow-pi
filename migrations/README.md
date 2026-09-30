# Database migrations

Migration files use zero-padded, monotonically increasing numeric prefixes and a
short description, for example `001_initial_schema.sql`. Apply them in filename
order. The runner records each applied version and file checksum in
`schema_migrations`; changing an applied migration is not an update mechanism.

Autonomous application accepts only simple `CREATE TABLE IF NOT EXISTS`,
`CREATE INDEX IF NOT EXISTS`, `CREATE EXTENSION IF NOT EXISTS vector`, and
`ALTER TABLE ... ADD COLUMN` statements with basic column types and no computed
expressions. Procedural SQL, renames, replacements, and other unparsed forms
require explicit acknowledgment naming the exact migration file. Migration 001
is a reviewed, checksum-pinned exception for its immutability triggers; edits
to it are not automatically trusted. Applied migrations remain immutable.

Migration 001 requires PostgreSQL 18 (`uuidv7()`) and the `vector` extension.
Embedding dimensions are intentionally not fixed in this migration; a later
additive migration may add an HNSW index for a selected model and dimension.
