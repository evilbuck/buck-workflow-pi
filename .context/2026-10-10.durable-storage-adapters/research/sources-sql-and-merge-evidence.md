---
status: active
date: 2026-10-10
subject: 2026-10-10.durable-storage-adapters
topics: [sql-drivers, git-evidence]
---

# Sources consulted by research subagent

Access date: 2026-10-10. Findings delivered by `sql-adapter-runtime-research`; local smoke claims are subagent evidence, not parent-exercised OMP verification.

- https://orm.drizzle.team/docs/sqlite/get-started-sqlite — SQLite driver choices; current examples may use RC tags, not evidence that stable adoption is impossible.
- https://orm.drizzle.team/docs/sqlite/connect-node-sqlite — node:sqlite DatabaseSync integration.
- https://orm.drizzle.team/docs/get-started-postgresql — pg Pool integration.
- https://kysely.dev/docs/dialects.md — core vs community dialects.
- https://kysely-org.github.io/kysely-apidoc/classes/SqliteDialect.html — SQLite dialect driver contract.
- https://kysely.dev/docs/migrations.md — Migrator/FileMigrationProvider and migration discipline.
- https://nodejs.org/api/sqlite.html — node:sqlite introduced in Node 22.5; runtime support and evolving API.
- https://bun.com/docs/runtime/sqlite — Bun-specific SQLite API and concurrency guidance.
- https://git-scm.com/docs/git-merge-base — `--is-ancestor` returns 0 for ancestor, 1 otherwise; failures must remain distinct.
- https://git-scm.com/docs/git-merge — squash does not preserve normal merge ancestry.
- https://git-scm.com/docs/git-rebase — commits are transplanted/recreated.
- https://git-scm.com/docs/git-cherry — patch equivalence omits whitespace and line numbers; unsuitable for exact artifact-body attestation.
- https://git-scm.com/docs/git-log — cherry marking describes patch equivalence, not external state contents.

Repository evidence to verify locally before execution: `package.json`, `extensions/sql-memory/migrations.ts`, `extensions/token-attribution/db.ts`, actual OMP extension runtime, CI runtime selection. Package registry latest-version observations are time-sensitive; do not turn them into permanent blanket compatibility claims.
