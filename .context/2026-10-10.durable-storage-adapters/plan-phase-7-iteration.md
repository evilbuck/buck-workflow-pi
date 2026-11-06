---
status: completed
date: 2026-10-16
subject: 2026-10-10.durable-storage-adapters
---
# Phase 7 operational migration repair

Replace the uncalled cutover predicates with an operator-only snapshot/import/cutover journal. Add a versioned portable inventory to each adapter: all immutable revisions and pointers, correction idempotency, receipts/duties, checkpoints, lifecycle and importer side records. Source export must not discover/reconcile/project. Imports stage privately, persist cursor with staged bytes, and publish once atomically; digest-based replay handles a crash after destination commit. Reject nonempty/conflicting destinations instead of overwriting them. Preserve ambiguous legacy records in private recovery snapshots with no ordinary pointers. Add full bidirectional inventory comparison. Expose CLI export/import/resume/cutover/rollback/doctor; verify config and source before atomic project-only switch and preserve post-switch destination snapshot before rollback. Keep credentials out of operator metadata; payload bytes remain exact private data. Mirror shipped canonical files.

Verification: real file/SQLite history and correction/receipt round trips; restart before/after import visibility commit; config-switch interruption and rollback with new destination writes; actual CLI diagnostic and smoke. Required guardrails remain blocking. Supervisor owns review/save/commit and lifecycle state.

## Verified outcome

All seven iteration findings implemented; nine focused regressions and real
process-crash/operator/PG-temp-table smoke exercised. Final durable guardrails
pass (88% coverage vs 84% baseline; no new complexity violations). Seven extracted
shell snippets live-run; 12 canonical/bundle surfaces byte-equal; 22 shipped
dependencies present. Full evidence: `implementation-notes-phase-7.md`.
Independent review/save/commit remain supervisor-owned.
