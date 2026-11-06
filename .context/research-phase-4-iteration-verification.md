---
status: completed
date: 2026-10-12
domains: [storage, testing, security, packaging]
topics: [native-access, cli, branch-identity, artifact-tokens, iteration]
related: [phase-4-native-access.md, iterate-phase-4-native-access-review.md, plan-phase-4-iteration.md]
priority: high
subject: 2026-10-10.durable-storage-adapters
---
# Phase 4 iteration verification

## Repairs

| Review finding | Repair and observed evidence |
|---|---|
| 1. Backend override lost | Trusted context carries the single origin/config selection into store opening. Native → canonical CLI → isolated bundle readback used a project external-files override under a repo-files default, without creating `.context`. CLI migration uses the same trusted selection. |
| 2. Identity registration race | Serialize the complete registry RMW, re-read under ownership, retain atomic rename. Eight actual processes share one branch/workspace ID. A synchronized competing-workspace fixture retains every registration; removing the lock loses five registrations in the observed mutation run. Live smoke also retained four independent projects. Abandoned registry locks fail closed with a timeout rather than unsafe lock stealing. |
| 3. CLI permission bypass | Restricted stages have no host bash. `workflow_exec` runs inside Bubblewrap with an explicit filesystem, cleared environment and no network; machine config/store cannot be reached through a caller-set environment or the operator CLI. An operator fixture reads the other-branch private fact, while isolated CLI inspection returns no private items and forced host configuration/raw reads fail. Git metadata is read-only except at commit; a real isolated worktree commit succeeded. Native stage roles remain unchanged. |
| 4. CLI operations unusable | Ordinary CLI operations use save permissions, not admin. Token-only reads derive subject. Named branches also bind stable worktree/run identity. Actual CLI initialize/activate, correction, token-only read, attempted/complete receipt and readback passed. |
| 5. Published token unreadable | Resolve exact membership in the trusted visible view, including actual owner and revision; return the selected revision without rebinding to the current branch. Listed published token readback, current overlay precedence and unlisted-private-token denial passed. |
| 6. Bridge token grammar mismatch | Persist and append the returned write token. Actual turn-end fixture read the marker through the shared reader after resolving context again. |
| 7. Bundle runtime imports broken | Move pool/migrations/SQL policy into portable shared storage, migrate every extension/runtime/test import, and ship immutable SQL resources in root npm and curated bundle. No extension re-export shim. Isolated copied bundle CLI consumed a native-created token without any extensions directory. |
| 8. Recall correction identity lost | Rows carry unique revision ID, token, subject and logical name. Jev keys use revision identity. Recall → correction passed for identical logical names in two subjects and for a trusted published predecessor, leaving its owner branch unchanged. |
| 9. Error-shaped native success | Throw sanitized execution errors; denied scope and real stale persistence conflicts reject rather than return successful tool results. Existing save failure/receipt recovery tests remain green. |
| 10. Manifest staged inside Git | Repo-files retains editable body paths but opens immutable authority under the machine identity registry's project root. Actual native repo write left editable content in `.context/smoke/plan-smoke.md`, with the manifest outside Git and no `.context/workflow/storage`. |

## Verification

- Final focused surface run: 8 files / 87 tests passed, including the published-predecessor recall/correction regression.
- Final full durable `npm run guardrails:check` passed: unit gate pass, global ratchet pass at 88.8% versus 84%, complexity pass with no new/hard-ceiling violations, lint/functional skipped by contract, patch advisory. No gate was weakened; both complete full runs passed.
- Live throwaway smoke output: `{"nativeCliBundleRoundtrip":"pass","projectOverride":"external-files","correction":"pass","receipt":"complete","repoEditableBody":"pass","privateManifestOutsideGit":"pass","isolatedWorktreeCommit":"pass","concurrentProjects":4}`. The script and its fixtures were removed after execution.
- `npm pack --dry-run --json --ignore-scripts` included all four SQL migrations plus README, and portable `db.ts`, `migrations.ts`, `sql-gate.ts`.
- Mutation checks deliberately restored the reviewed defects. Published reads, CLI backend override, bridge marker, recalled IDs, real native error propagation, filesystem isolation and private-manifest placement each went red for the intended failure. An initially weak concurrent fixture survived the no-lock mutation; the synchronized fixture replaced it and observed lost registrations. All mutants were restored before final checks.
- Existing wording/wiring-only child allowlist/prompt tests were removed, not repinned; behavioral permission/isolation tests remain.

## Files modified

Canonical access/runtime/tests: `skills/_shared/scripts/workflow-state{,-cli,.test}.ts`, `skills/_shared/scripts/postgres-store.test.ts`, `skills/_shared/storage/postgres-store.ts`, moved shared `db.ts`, `migrations.ts`, `sql-gate.ts`, and `skills/_shared/workflow-state-access.md`.

Extensions: `extensions/workflow-state/index{,.test}.ts`, new `execution{,.test}.ts`, `extensions/plan-artifact{,.test}.ts`, `extensions/buck-loop/project-memory.ts`, `run-step.ts`, and their touched tests, plus the SQL-memory consumers/tests/declaration updated for the moved portable modules. The old SQL-memory pool/migration/policy source paths are deleted, not aliases.

Packaging/docs: `package.json`, `scripts/install.mjs`, new `scripts/sync-storage-bundle.mjs`, byte-identical touched bundle shared runtime/access copies, new bundle migrations/package manifest, `plugins/buck-workflow/README.md`, and `docs/buck-loop.md`.

Assignment records: this note, the iteration repair plan, existing phase draft commit, and the active review iteration closeout. Phase/subject lifecycle fields are supervisor-owned and were not changed.

## Limits and handoff

- No disposable PostgreSQL test URL was configured; no real PostgreSQL surface smoke is claimed. File/SQLite tests and migration-resource packaging are not PostgreSQL end-to-end proof.
- Nested execution now requires Linux Bubblewrap and working namespaces; unavailable isolation fails closed. Network-dependent checks require operator execution outside the child boundary. There is no host-shell fallback.
- The prior generated repository-local manifest and unrelated/pre-existing artifacts were not removed or staged wholesale. Existing-data migration remains Phase 7; publication/reconciliation remains Phase 6.
- The old `current-session.json` names another subject and has no memory file. It was left untouched; this exact-phase subject note is the durable execution record. The supervisor owns review, SQL save and commit.
