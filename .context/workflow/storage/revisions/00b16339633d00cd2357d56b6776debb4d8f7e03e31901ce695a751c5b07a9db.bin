## Plan Path Review: OMP token attribution by project and feature

### Plan Source
- File: `.context/2026-09-23.omp-token-attribution/plan-omp-token-attribution.md`
- Goal: Record OMP token usage by git project and branch, including nested sessions, and expose it through `/tokens`.
- Baseline: `717174b..c208ef4`; implementation commit `c208ef4`.

### Evidence Sources
- Git status: implementation is committed. Existing unstaged/untracked `.context/` changes include this subject’s workflow artifacts and unrelated model-profile brainstorming; excluded from the implementation baseline.
- Modified implementation files:
  - `extensions/index.ts`
  - `extensions/token-attribution/{index,git-identity,db,report}.ts`
  - Five focused test files under `extensions/token-attribution/__tests__/`
- Live database: current rows in `~/.omp/stats.db` contain this repository’s origin, branch, provider/model, token total, and `cost_source=usage`.
- Deterministic guardrails: passed.

### Completion Matrix

| Step | Status | Evidence |
|---|---|---|
| 1. Git identity resolver | ✅ complete | Origin/common-dir fallback, branch, detached HEAD, and non-git handling in `git-identity.ts:22-78`; worktree/non-git/detached tests pass. |
| 2. SQLite ledger | ✅ complete | Plugin-owned schema, busy timeout, idempotent unique key, fallback table, and no writes to OMP tables in `db.ts:52-170`; database tests pass. |
| 3. Usage extraction | ✅ complete | Provider/model/API, token buckets, reasoning, total, and cost extraction in `index.ts:17-155`. |
| 4. Live `message_end` recording | ✅ complete | Identity refresh/cache, custom identity entry, and live insert in `index.ts:237-326`; wire test exercises the full path. |
| 5. Nested JSONL ingest | ✅ complete | Recursive current-session artifact scan, incremental byte cursors, partial-line retention, and fallback-key reconciliation in `index.ts:157-230`; nested ingest regressions pass. |
| 6. `/tokens` report | ✅ complete | Current project, exact branch, project substring, branch/model grouping, estimated cost, and empty state in `report.ts:18-54`; report tests pass. |
| 7. Extension wiring | ✅ complete | `wireTokenAttribution(pi)` registered beside TPS tracking at `extensions/index.ts:315-318`; package OMP entry already loads `extensions/index.ts`. |
| 8. Tests | ✅ complete | Guardrails unit gate passed; focused suite contains identity, DB, ingest, report, and runtime wiring coverage. |

### Review Axes
- Spec axis worst finding: none.
- Standards axis worst finding: non-blocking resource-lifecycle warning — the lazily opened `DatabaseSync` connection is not explicitly closed on `session_shutdown` (`index.ts:237-338`). OMP’s extension guidance recommends teardown cleanup. No active transaction or observed failure; garbage collection currently owns eventual release.
- Standards execution: sequential portable fallback, seeded with the TypeScript review guide and relevant long-method, primitive-obsession, duplicate-code, and comments smell references.
- Cross-axis ranking: none.

### Verification Status
- Goal achieved: yes.
- User goal: met — project/branch keys, model attribution, token buckets, estimated costs, nested ingestion, and report grouping are implemented.
- Scope adhered: yes.
- Out-of-scope implementation changes: none.
- Live proof observed: recent attribution rows for `git@github.com:evilbuck/buck-workflow-pi.git` on `brainstorm/buck-loop-model-profiles`.
- Nested behavior: verified through real temporary JSONL files and SQLite in the focused suite; no new live `task` turn was created during this review.

### Guardrails Verdict
- Contract: `durable`
- Contract version: `2`
- Status: `pass`
- Gates:
  - `unit_test_gate=pass`
  - `functional_test_gate=skipped`
  - `lint_gate=skipped`
  - `patch_gate=pass`
  - `global_ratchet=pass`
  - `complexity_gate=pass`
- Coverage: `85.8%`, above the `84%` baseline.
- Ratchet proposal: baseline coverage may advance to `85.8%`.

### User Goal Analysis
- Goal: Token counts and estimated dollars per git repository and branch across models, with linked worktrees sharing a project.
- Met:
  - Origin URL/common-dir project identity.
  - Branch-at-turn attribution.
  - Provider/model and token-bucket persistence.
  - Estimated-cost reporting.
  - Nested transcript ingestion and delivery reconciliation.
  - `/tokens` project and branch views.
- Partial: none.
- Missing: none.
- Verdict: met.

### Documentation Impact
- Flagged: new extension data flow, plugin-owned SQLite table, project/branch attribution semantics, and `/tokens` command are absent from living documentation.
- Recommended: `/b-docs` before `/b-save`; it should follow the how-to impact.

### How-to Impact
- Flagged: `/tokens`, its optional branch/project argument, `/token-use` collision fallback, and estimated-cost semantics are new user-facing actions.
- Recommended: cover through `/b-docs` → `/b-howto`.

### Issue Classification
- In-plan issues: none.
- Out-of-plan issues: none.
- Non-blocking standards warning: consider explicit `session_shutdown` database cleanup in a separate cycle if deterministic resource release becomes necessary.

### Verdict
**Pass with warnings.** No in-plan defect remains; no new iteration artifact was written.

### Recommended Next Step
Supervisor-owned per the nested assignment. Contractually: `/b-docs` first, then `/b-save` → `/b-commit`.
