---
status: active
date: 2026-10-10
subject: 2026-10-10.durable-storage-adapters
topics: [storage-adapters, branch-visibility, sql, artifact-tools]
informs: [plan-durable-storage-adapters.md]
---

# Research: Durable storage adapters

## Conclusion
A configurable write path is insufficient. Buck needs a shared artifact service with backend-specific persistence, project/branch/run identity, visibility before retrieval, native artifact operations, and adapter-backed save/subject verification. All four requested backends remain in scope. An ORM is not needed initially.

## Confirmed user decisions
1. User Goal: choose where durable workflow state lives; resume across sessions/worktrees; keep unmerged work out of unrelated ordinary retrieval.
2. Required backends: repository `.context/`, external machine per-project files, SQLite, PostgreSQL.
3. Ordinary retrieval sees current branch plus merged state for ALL knowledge artifacts, including memories.
4. Manifest stays centrally stored, in database or machine-local storage; no tracked repository manifest.
5. Automatic promotion only when ancestry proves a sealed checkpoint's associated commit reached the integration ref; rewritten history requires an explicit verified mapping.
6. All Buck-owned durable state is included; run-private state is persisted but not published as knowledge.

## Parent-examined evidence
- `docs/sql-memory.md:23-28`, shared recall protocol, and `extensions/buck-loop/project-memory.ts:77-84`: current SQL memories are immediately project-wide; branch/SHA are provenance, not visibility.
- `extensions/sql-memory/remember.ts:100-137`: idempotency is project-scoped. `extensions/sql-memory/index.ts:296-320`: a correction invalidates the predecessor globally; branch-local corrections must stop doing that before publication.
- `extensions/buck-loop/sql-save.ts:17,55-93`: hardcoded filesystem attempt/receipt protocol and environment-switched memory storage.
- `skills/_shared/scripts/subject-lifecycle.ts:56-113`: lifecycle authority reads Markdown files; semantic rules should remain, physical reads should move behind the adapter. LSP found 25 references to `inspectSubjectLifecycle`, including context helpers, plan bridge, save-apply, and review reports.
- `extensions/buck-loop/scan.ts:87-133`, `persist.ts:4-11,107-124`: scanners resolve physical `.context` paths; resume projection is a bookmark, artifacts are authoritative.
- `hooks/post/turn-memory.ts:26-29,106-114`: hook is gated by SQL_MEMORY_URL and calls pg memory writes directly.
- `extensions/token-attribution/db.ts:45-49,92-100`: existing deferred `node:sqlite` import and machine-local SQLite precedent. `extensions/sql-memory/migrations.ts:40-91`: numbered checksummed transaction migrations.
- `package.json:9-21,66-71`: packaging roots and existing pg/yaml dependencies; Node >=18 declaration does not itself prove SQLite support.

## Additional consumer map (read-only subagent)
Evidence from `storage-consumer-seams`:
- `extensions/b-save-improved/index.ts:722-767` and `skills/b-save-improved/scripts/save-apply.ts:111-121,473-554`: second save pipeline shares receipt checks and lifecycle apply; CLI/IPC boundary must resolve the same adapter.
- `extensions/plan-artifact.ts:14-17,230-264`: plan-mode bridge writes `.context` and activates subjects.
- `extensions/turn-memory/capture.ts:85-94`: synthetic `turn-memory` subject and window IDs require branch/run-scoped idempotency.
- `extensions/code-review-iteration/report.ts:125-126` and run-state/loop modules: subject selection and retained pass artifacts require the service. Immutable pass evidence must remain immutable; don't redesign the review execution allowlist.
- `skills/b-memory-import/scripts/import-context-memory.ts:68-78,574,758`: importer scans legacy directories and retains its own manifest. Read selected adapter artifacts instead; host LTM mirrors must not leak unmerged knowledge.
- `docs/plans/src/lib/plans/index.ts:55-71`, `sql.ts:3-25`: existing read-only PlanSource factory has an unimplemented SQL proposal. Reuse the reader seam, not its stub or SQL-vs-files union as a new source of truth.
- `scripts/codex-plugin.test.ts:9-53`: physical canonical skill copies require release-bundle parity. `scripts/commands-mirror.test.ts:16-21`: prompts are canonical; commands are mirrors.
- `extensions/index.ts:14,31` registers SQL memory; post-hook is separately package-discovered. Move both through one resolved configuration.
- Buck-owned attribution rows in host stats SQLite are included; host-owned rows/database/session storage are not. Existing host session dedupe entries are projections, not the new adapter's durable authority.

## Rejected overclaims from raw subagent findings
- Existing filesystem consumers do NOT make materialization intrinsically required: refactor them to logical artifact reads; exported files may be an optional scoped view, never the canonical DB store.
- Git's info/exclude is not reliable evidence of per-worktree privacy; current file paths are checkout-local. External stores need explicit worktree/run identity.
- A NULL branch is not automatically published/global knowledge. Detached/unknown/legacy state must fail closed.
- Neither current SQLite package engines nor RC examples prove no Node 18 driver exists or Drizzle mandates RC adoption.
- Git cannot prove external artifact bytes were code-reviewed. Central checkpoint hashes plus source-commit ancestry implement the USER-SELECTED publication policy, not in-repository content proof.

## SQL choice
Use pg and a confined `node:sqlite` adapter with dialect-specific SQL and checksummed migrations. No general-purpose ORM/query-builder dependency. Existing PostgreSQL ranking metadata remains preserved; SQLite/file ranking need deterministic meaningful retrieval, not fabricated PostgreSQL rank parity. Filter visibility BEFORE scoring/limit/pagination/model judgment. Do not introduce vector search as part of this feature.

Parent smoke: Node v26.8.1 inserted and selected `{id:plan, revision:1, body:sealed body}` using an in-memory node:sqlite database; Bun 1.4.0 queried SQLite 3.53.2 through node:sqlite. CI Node 22 and actual OMP runtime remain build-time checks.

## Merge proof
Use immutable checkpoint revisions bound by an explicit successful commit/sealing operation. Never infer publication from creation HEAD, branch deletion, patch equivalence, or timestamp. Auto-publish only an eligible checkpoint anchor's ancestry in the configured integration ref; squash/rebase mappings remain explicit and evidence-backed. New edits after sealing stay private. Central state is an attestation of content selection, not Git content proof. Preserve orphan state; no automatic deletion.

## Source trail
- External rolling notes: `research/notes-sql-and-merge-evidence.md`.
- Authoritative URLs and caveats: `research/sources-sql-and-merge-evidence.md`.
- User-confirmation trail is preserved in the plan's Light Grill section.

## Verification boundaries
This session inspected code, ran project SQL recall, initialized/inspected subject lifecycle, and exercised in-memory SQLite under Node/Bun. No storage adapter, migration, visibility policy, UI, or OMP integration has been implemented or claimed verified.
