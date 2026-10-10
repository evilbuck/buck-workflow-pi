---
status: active
date: 2026-10-10
subject: 2026-10-10.durable-storage-adapters
topics: [sqlite, postgresql, orm, merge-proof]
---

# SQL adapter and merge evidence notes

## Confirmed planning decisions
- User confirmed the draft User Goal.
- Required: repository files, external project files, SQLite, PostgreSQL.
- Default retrieval: current branch plus merged state, including memories.
- User rejected a tracked in-repository manifest; prefers central machine location or database.
- User chose automatic promotion when ancestry proves a centrally sealed checkpoint's associated commit merged; explicit verified mapping for rewritten history.
- Include all Buck-owned durable state, including resume/evidence/attachments. Run state stays private rather than publishing as reusable knowledge. Exclude host-managed sessions and unrelated source/living docs.

## External source findings (research subagent)
Authoritative docs establish node-postgres and SQLite support in Drizzle; Kysely core Postgres/SQLite dialects and migration provider support; node:sqlite added in Node 22.5; Bun has a separate bun:sqlite API. Agent reported a live node:sqlite smoke on Node 26.8.1 and Bun 1.4.0, not CI Node 22 or actual OMP integration.

Registry observations reported by agent: Kysely 0.29.6 and better-sqlite3 13.0.3 require Node >=22; Drizzle 0.45.4 has no engine declaration; current docs often use an RC install example. These do NOT establish that no SQLite package works on Node 18 or that using Drizzle necessarily requires an RC. Those broader claims are excluded.

Recommendation: use existing pg plus a narrow explicit node:sqlite adapter, reuse version/checksum migration discipline, and keep dialect SQL behind the storage contract. No ORM is needed for the currently bounded artifact operations. An ORM does not solve file storage, visibility, provenance, or save completion. Do not invent a general-purpose query-builder framework. Actual runtime/CI compatibility must be exercised before choosing the SQLite path definitively.

## Git findings and limitations
Official merge-base docs define ancestor exits 0/1; other errors are failures, not non-ancestry. Squash and rebase can erase original ancestry; patch-id ignores whitespace and is not exact artifact revision proof. Agent reproduced merge/rebase/squash and the creation-SHA false-positive scenario in scratch Git repositories; parent has not rerun those smokes.

The agent suggested a tracked Git manifest, but user explicitly rejected that option. A centrally sealed checkpoint mapping is an external attestation, not proof that Git contains/reviewed the artifact bytes. The accepted policy permits automatic publication of EXACT immutable snapshot revisions when the specifically bound checkpoint commit becomes reachable. Never substitute an artifact's creation HEAD, branch name, timestamp, or missing ref for checkpoint proof. Later edits need a new sealed checkpoint; draft state never follows promotion automatically.

Normal ancestry proof must distinguish a new source checkpoint from inherited integration history. Binding arbitrary new content to an old integration commit would leak it immediately. Bind via successful commit checkpoint or explicit verified sealing of an unmerged source tip; record the integration tip observed at sealing. Rewritten history requires an explicit source-checkpoint-to-merged-commit mapping, retained as evidence. Provider-confirmed mapping may be supported later only if explicitly scoped; no patch-id heuristic for automatic publication.

Central storage cannot offer Git-native review/clone portability for external artifact bodies; that is an accepted storage-medium trade-off, not a promise to solve with invisible repository files.
