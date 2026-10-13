---
status: completed
date: 2026-10-10
updated: 2026-10-10
subject: 2026-10-10.durable-storage-adapters
topics: [review, iteration, storage-adapters]
domains: [storage, testing]
related: [phase-1-contract-config-identity.md, persistence-inventory.md]
priority: high
informs: []
addresses: phase-1-contract-config-identity.md
completed: 2026-10-10
from_review: b-review
---

# Iteration: Phase 1 contract, configuration and identity

## Source
- Reviewed after: `/b-build-hard` and supervisor acceptance recovery.
- Phase: `phase-1-contract-config-identity.md`.
- Parent plan: `plan-durable-storage-adapters.md`.
- Evidence and two-axis review: `review-phase-1-contract-config-identity-2026-10-10.md`.
- Scope: Phase 1 only. No production adapter or later-phase consumer migration is requested here.

## Critical Issues

### 1. Relative local Git origins collapse independent projects into one identity
- **File**: `skills/_shared/storage/identity.ts:33-65`
- **Problem**: `resolveProjectIdentity()` hashes a relative filesystem origin without resolving its checkout context and ignores `gitCommonDir` whenever an origin is present. A real Git smoke created two independent checkouts, each configured with `origin=../upstream.git`, with distinct bare upstreams under different parent directories. Both received the same `projectId`. This violates Phase 1's fail-closed identity requirement and the parent contract's independent-project isolation. It establishes a collision before any backend is implemented.
- **Proposed fix**: Resolve local filesystem origins against verified checkout context before deriving identity, or reject unresolved local origins until a configured key or unambiguous canonical identity is provided. Do not hash a context-dependent relative path as a global project identity. Preserve the intended identity sharing for worktrees and independent clones of the same remote. Add a deterministic behavioral regression using two real Git checkouts with distinct relative local remotes, and a same-project worktree case.


- **Jev failure**: Jev failed: missing, unreadable, or oversized file skills/_shared/storage/identity.ts:33-65. Re-review this finding with Jev.

### 2. Project-origin configuration permits credentials and disagrees with identity normalization
- **File**: `skills/_shared/storage/config.ts:67-81,109-117`
- **Problem**: `parseProject()` checks origins only for non-empty strings, so a URI with user/password credentials is accepted and retained verbatim in configuration intended for dotfile versioning. Separately, `resolveStorageConfig()` compares the raw origin literally, while `resolveProjectIdentity()` removes credentials. The smoke configured a credential-free origin with a PostgreSQL override: resolving the credential-free identity selected `postgres`, while resolving the same origin with URI credentials silently selected `repo-files`. The current tests reject unknown credential keys but miss secrets in an allowed field. These violate the phase's no-secret guarantee and consistent per-project selection contract.
- **Proposed fix**: Reject credential-bearing configured origin aliases without echoing secrets in errors. Establish one credential-redacted canonical origin comparison rule shared with identity resolution, and detect aliases that become ambiguous under that rule. Incoming Git-origin credentials must not cause a different project/backend selection. Add behavior cases for secret-bearing configured aliases, credential-redacted incoming origins, and canonical alias ambiguity. Preserve `connection_env` as the database-credential reference; do not add a backend-switch environment variable.


- **Jev failure**: Jev failed: missing, unreadable, or oversized file skills/_shared/storage/config.ts:67-81,109-117. Re-review this finding with Jev.

### 3. The conformance harness cannot accept the typed store contract it is meant to validate
- **File**: `skills/_shared/scripts/storage-conformance.test.ts:6-18,75-145`
- **Problem**: The harness introduces a second `ConformanceStore` interface with `writeBatch(): Promise<void>` and `correct(): Promise<void>`, while `StorageStore` returns revisions for both operations. A strict assignment of `StorageStore` to the harness's exact consumer shape fails with TS2322 on `writeBatch`. `defineStorageConformance()` is also private to a test module that eagerly imports and instantiates its SQLite fixture; later file/PostgreSQL backends cannot import one shared suite independently. The three passing cases validate the local fixture, not conformance to the canonical public boundary.
- **Proposed fix**: Extract an importable backend-neutral conformance definition using `StorageStore` or an accurate `Pick<StorageStore, ...>` instead of a divergent handwritten interface. Keep the SQLite throwaway fixture in its own test registration and make it satisfy that contract without result-discarding wrapper interfaces. Preserve the behavioral scenarios for exact bytes, transactional stale-batch rollback, visibility before limit, scoped correction and lifecycle refusal. Synchronize the bundled shared-skill copy and rerun the fixture and strict typecheck.


- **Jev failure**: Jev failed: missing, unreadable, or oversized file skills/_shared/scripts/storage-conformance.test.ts:6-18,75-145. Re-review this finding with Jev.

### 4. The persistence inventory excludes retained presentation packages and their readers
- **File**: `.context/2026-10-10.durable-storage-adapters/persistence-inventory.md:14-56`
- **Problem**: The table has no row for `presentations/<slug>/{pages,assets,sources,manifest.json}` or its owning `b-present` writer and `scripts/serve-presentations.ts` reader. Those paths are explicit in `skills/b-present/SKILL.md:41-64,125-151` and the reader loads bytes at `scripts/serve-presentations.ts:145-149`. The parent plan explicitly includes retained presentation packages/attachments, distinguishing canonical retention from optional generated exports. A source scan restricted to filesystem function names and `skills/_shared/` cannot establish the required census of skill-defined writers. The completed acceptance box also contradicts the phase's own open-census note at lines 66-67.
- **Proposed fix**: Complete the current-code census including instruction-defined skill writers, retained presentation/binary package paths, source copies/manifests and their readers. Record kind, scope, consumer, canonical-versus-export ownership and concrete cutover verification for each family; make completeness claims consistent with the evidence. Do not migrate those consumers in Phase 1: only finish the inventory required for later phases.

For each source change above, synchronize the corresponding `plugins/buck-workflow/skills/_shared/` copy. Preserve all pre-existing staged and unrelated work.


- **Jev failure**: Jev failed: missing, unreadable, or oversized file .context/2026-10-10.durable-storage-adapters/persistence-inventory.md:14-56. Re-review this finding with Jev.

## Warnings
- Full-repository TypeScript diagnostics were already reported in the phase. The fresh strict check passed for all six phase modules and four storage test files; this is not a whole-project clean claim.
- Hosted CI was not run during review. The exact SQLite smoke passed locally on Node v22.23.3, matching the CI Node 22 major, and the workflow invokes it via `npm test`.
- Unsupported Node v18.20.8 refusal is recorded in the supplied phase evidence; this review freshly ran the injected module-unavailable refusal case rather than independently repeating that Node 18 invocation.
- Guardrails pass: durable v2, coverage 89.4% versus 84%; unit/ratchet/complexity pass, functional/lint skipped, advisory patch gate reports pass with no numeric patch measurement. No gate weakening is needed.

## Recommended Workflow

Start with `/b-iterate` on this phase only, then re-run `/b-review` against `phase-1-contract-config-identity.md`. Inside an OMP execution session, `/b-iterate` completes this artifact before returning; the supervisor then re-reviews. Do not leave this artifact active waiting for review or save after its fixes are implemented. For larger rework, use `/b-build` or `/b-build-hard`.

## Applied fixes and verification

- Identity: unresolved relative filesystem origins now refuse shared identity; callers must provide an absolute origin or configured project key. Real Git regression exercises two independent checkouts with relative origins, distinct absolute upstreams and same-project linked worktrees.
- Config: configured URI credentials/query/fragment data are rejected with value-free errors. Configuration aliases and incoming Git origins use the same credential-redacted canonical form as project identity; normalized ambiguous aliases refuse selection. `connection_env` remains the credential reference.
- Conformance: `skills/_shared/storage/conformance.ts` exports the backend-neutral suite using `Pick<StorageStore, ...>`. Only fixture registration imports SQLite. Fixture write/correction results satisfy the public contract, including null correction; lifecycle assertions no longer require the SQLite fixture's revision naming convention.
- Inventory: retained package pages/assets (including binary payloads), copied source snapshots, manifests and readers are explicitly tabled. All 58 matching skill instruction files were examined across three result pages; scope/ownership and concrete later-phase cutover checks are recorded. Phase notes no longer contradict the closed current-family census.
- Fresh verification: storage plus plugin suites: **24 passed / 5 files**. Strict targeted TypeScript command (`--ignoreConfig --strict --target ES2022 --module NodeNext --moduleResolution NodeNext --skipLibCheck --types node`, storage modules and storage tests): exit 0. This is not a whole-repository TypeScript claim.
- Mutation evidence: pre-fix regression run failed on relative-origin refusal, canonical alias ambiguity and credential-bearing backend selection. Disabling the configured-origin credential guard made the corrected secret-rejection regression fail (`undefined` was not an Error); guard restored and final suites passed.
- Runtime smoke: actual Bun config/identity calls selected `postgres` for a credential-bearing incoming origin and refused `../upstream.git` as ambiguous. SQLite runtime smoke passed on standalone Node v26.8.1 and Bun's v26.3.0 compatibility version. The raw Node strip-types config smoke cannot resolve this repository's `.js`-specifier TypeScript sources; Bun is the exercised source runner.
- Final durable guardrails: **pass**, required unit/global-ratchet/complexity gates pass, coverage **89.5% vs 84%**, no new or hard-ceiling violations. Lint/functional disabled; advisory patch reports pass without numeric measurement. Contract/baselines unchanged.
- Canonical/bundled storage directory and both changed test files are byte-identical (`diff`, exit 0).
- Modified: canonical and bundled `identity.ts`, `config.ts`, new `conformance.ts`, `storage.test.ts`, `storage-conformance.test.ts`; inventory, assigned phase notes, this iteration and existing draft commit.
- Session pointer names a different historical subject and has no memory file. It was not rewritten; this artifact is the durable assignment record. Supervisor owns SQL save, lifecycle/acceptance updates, re-review and commit. No next loop state selected.
