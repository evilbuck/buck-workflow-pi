---
date: 2026-09-28
domains: [tooling, memory, workflow]
topics: [sql-memory, buck-loop, jev, planning]
subject: 2026-09-28.sql-memory-buck-loop
artifacts: [research-sql-memory-buck-loop.md, plan-sql-memory-buck-loop.md]
related: []
priority: medium
status: completed
---

# SQL memory in Buck-loop — exploration and plan

Explored the existing `sql_memory` extension, PostgreSQL schema/gate, isolated Buck-loop child sessions, b-* memory workflows, and Jev routing. The tool works in the parent host, but children currently exclude it; the loop confirms `saving` by a changed `.context/memory/` file and can choose an ambiguous save advance. A live read-only tool call returned migration `001` (`rowCount: 1`). No source code was changed in this session.

The 2026-09-28 Postgres-memory brainstorm was superseded by the ratified grill/plan: SQL replaces *new* `.context/memory/` records; no mandatory Jev gate or turn-end writer; branch is provenance and recall spans project branches. The plan therefore proposes a subject-scoped metadata receipt (SQL IDs and attempt identity), not a second Markdown memory, while retaining the existing file behavior when `SQL_MEMORY_URL` is absent. Current bootstrap still mandates Markdown memory; it must change with the implementation. This session obeys that current contract.

Implementation sequence: (A) parameter binding and restricted OMP child tool admission with read-only recall transactions; (B) bounded project recall and optional parent-side Jev relevance for an ambiguous SQL shortlist; (C) SQL writes, read-back, subject receipt, and fail-closed save/resume; (D) bootstrap/docs alignment and real child/Postgres proof. The restricted custom-tool option is documented in upstream OMP SDK, but remains to be proven against the installed fork. Application-level source-key lookup is only retry-safe within one run; concurrent exactly-once requires a separate uniqueness design. Cross-project reads remain possible by design because Q14 specifies a shared store without RLS.

Plan: `.context/2026-09-28.sql-memory-buck-loop/plan-sql-memory-buck-loop.md`. Research and source ledger are linked from the subject `index.md`. The subject lifecycle was inspected as active (revision 2, unphased plan open). No code gate was run: this session wrote only `.context/` artifacts. Pre-existing staged deletions and unstaged edits were not modified or committed.
