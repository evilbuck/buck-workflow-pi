---
status: active
date: 2026-11-20
subject: 2026-11-20.bun-typescript-migration
topics: [extension-timeout, token-attribution, typescript, bun, release-safety, lockfile]
research: [research-bun-typescript-migration.md]
iterations: []
spec: null
memory: []
---

# Plan: Fix Bun-migration follow-ups — extension timeout, repo type errors, release safety

## User Goal
Buck Workflow sessions run without extension timeouts, the repository typechecks clean under the Bun-only runtime, and the release command fails closed on precursor errors.

## Goal
Eliminate the three defect classes left by the 2026-11-20 Bun/TypeScript migration: (1) the `message_end` extension-handler timeout, (2) 165 remaining `tsc` diagnostics, (3) the release script proceeding after failed checks; plus lockfile/JS-remnant housekeeping.

## Context used / assumptions
- Session context: full Bun migration landed and passed guardrails (unit, ratchet 86.8%, complexity, patch); plugin mirrors byte-identical; guardrails upgrade path shipped.
- Fresh measurement (2026-11-20): `bun --bun tsc --noEmit` → 165 errors. Top: `skills/b-auto-fix/scripts/auto-fix.test.ts` (58), `extensions/fix-pr-feedback/__tests__/index.test.ts` (19), `skills/b-memory-import/scripts/import-context-memory.test.ts` (8), `skills/b-auto-fix/scripts/auto-fix.ts` (8), `extensions/workflow-state/confined-fs.test.ts` (7), `skills/b-loop/scripts/recovery.ts` (6), ~59 more across ~20 files. Current tsconfig include excludes most of `scripts/`; an earlier wide run also showed `scripts/context-artifacts.test.ts` (~6) and `scripts/serve-presentations.ts` (1, untyped `Bun` global).
- Runtime-log diagnosis: timeouts are `message_end` on `extensions/index.ts` (omp.2026-11-20.443933.log, repeated; also 2026-11-19 logs). Only two `message_end` handlers exist; tps-tracker is counter-only, token-attribution does awaited persistence → token-attribution is the blocking handler.
- Quantified mechanism: `AttributionDatabase.insertReconciled` performs ~7 serialized store ops (alias read, current read, fallback read, alias read, `commitConsumerBatch`, optional `correct`, readback). `FileStorageStore` re-loads and JSON-parses the 61 MB manifest inside every locked op (~183 ms measured). Even unchanged replayed records run the full round trip. `scanSessionArtifacts` inserts per line. `message_end` also awaits `ledger.flush()` and the process-global `flushConfiguredRetains()` tail shared with other extension writers. Under contention this exceeds the 30 s handler budget.
- `bun.lock` exists (2026-11-18) but predates today's `package.json` metadata changes; `package-lock.json` was hand-edited. CI runs `bun install --frozen-lockfile`.
- Remaining JS: `docs/plans/astro.config.mjs` (Astro config, TS supported) and `.context/2026-05-06…/app.js` (generated presentation artifact).

## Decision Closure
Selected course: four independent phases, timeout first. Evidence: log-confirmed event + per-op cost model + unchanged-record rewrite amplification. Excluded scope: file-store manifest memoization (contingency only), repo-wide `@types/bun` adoption without measurement, npm lockfile preservation. Next bounded action: Phase 1 red test.

## Assumptions Ledger
- A1 (open): Bun type strategy for `bun:test` files. Recommended: scoped declarations or a dedicated tsconfig for Bun-only suites — repo memory records that repo-wide `@types/bun` flips `ReturnType<typeof setTimeout>`/`NodeJS.Timeout` inference in extension files. Validation: measure error delta; if fallout ≤ ~10, adopt repo-wide instead.
- A2 (open): `message_end` may stop awaiting persistence if failures still surface via `agent_end`/`session_shutdown` warnings (existing, tested convention). Validation: wire tests assert warning appears at flush points.
- A3 (open): `bun.lock` becomes the single lockfile; delete `package-lock.json`. Validation: `bun install --frozen-lockfile` clean on fresh CI run.
- A4 (resolved): `.context/…/app.js` is a generated artifact — excluded from conversion; `docs/plans` npm usage stays out of scope except `astro.config.mjs` → `.ts`.

## Material Risks
- Decoupling `message_end` could hide persistence failures until later — mitigated by flush-point warnings (A2) and existing shutdown-drain test.
- Batching artifact-scan writes changes failure granularity (whole-file retry instead of per-line) — preserve cursor-remainder retry semantics in the red test.

## Scope
Phases 1–4 below, in execution order.

## Out of scope
- File-store manifest caching/memoization (becomes its own plan if Phase 1a–1c leave live timeouts).
- `docs/plans` Astro site package-manager migration beyond its config file.
- The 31 pre-existing failing test cases gated on the npm-publish milestone.

## Affed files
- `extensions/token-attribution/index.ts`, `db.ts`, `__tests__/wire.test.ts`, `__tests__/ingest.test.ts`
- `tsconfig.json`; ~25 files listed in the error distribution; `scripts/serve-presentations.ts`, `scripts/context-artifacts.test.ts`
- `scripts/publish.ts`, `scripts/publish.test.ts`
- `bun.lock` (regenerate), `package-lock.json` (delete), `docs/plans/astro.config.mjs` → `astro.config.ts`, stray `.context/turn-memory/turn-memory/["/` directory (delete)

## Implementation steps

### Phase 1 — token-attribution `message_end` timeout (high; user-reported)
1. Red: wire-harness test — second `insert` of an unchanged record performs zero store writes (spy on `commitConsumerBatch`) and returns `false`.
2. Green: `insertReconciled` skips write/commit/correct/readback when `current` exists and bytes equal the retained record, then still calls `this.project(retained, fallbackEntryKey)` before returning `false`.
3. Red: ingest test — `scanSessionArtifacts` over N delivered lines issues one `commitConsumerBatch` per file, not per line; failure keeps the file's lines for retry.
4. Green: batch deliveries per file (dedupe by entryKey, preserve alias writes and cursor-remainder retry).
5. Red: wire test — `message_end` resolves without awaiting queued persistence; a seeded retention failure still warns at `agent_end` (and shutdown).
6. Green: `message_end` enqueues (insert + scan) and returns; keeps `persistIdentity` inline (cheap, ordered). `agent_end`/`session_shutdown` keep flush + warning behavior.
7. Mutation-check each new test (break guard/batch/decouple → red).
8. Live proof: restart the OMP session, run a normal turn, confirm zero `message_end` timeouts in the new omp log. If timeouts persist → open the file-store memoization plan (contingency).

### Phase 2 — zero TypeScript diagnostics
1. Resolve A1 (measure `@types/bun` fallout vs scoped declarations; pick smaller blast radius).
2. Fix errors in descending concentration: auto-fix.test.ts (58), fix-pr-feedback index.test.ts (19), memory-import tests (12), auto-fix.ts (8), confined-fs.test.ts (7), recovery.ts (6), remainder (~55).
3. Re-widen tsconfig include to `scripts/**/*`; fix `serve-presentations.ts` (`Bun` global via structural declaration, pack.ts precedent) and `context-artifacts.test.ts`.
4. No `@ts-nocheck`; no assertion-based narrowing hacks.

### Phase 3 — release script fails closed
1. Red: rewrite the git-status failure case to expect non-zero exit and no publish. Add a not-found `bun pm view` case whose shim exits nonzero and still publishes, and a registry, transport, or authentication failure case that expects non-zero exit and no publish.
2. Green: `publish.ts` gains a `must()` runner that aborts on `git status --porcelain` failure and on `bun pm view` registry, transport, or authentication failures. A lookup that reports the version about to be published as not found is benign — the release continues — even when Bun reports that absence through a nonzero status. Empty output from a clean worktree stays allowed.
3. Mutation-check.

### Phase 4 — lockfile and remnants
1. Regenerate `bun.lock` (`bun install --lockfile-only`), verify `bun install --frozen-lockfile` clean, delete `package-lock.json` (A3).
2. Convert `docs/plans/astro.config.mjs` → `astro.config.ts`; confirm `astro build` still works.
3. Delete stray `.context/turn-memory/turn-memory/["/` directory.

## Acceptance criteria
- [ ] Restarted OMP session log shows no `Extension handler timed out` for `message_end` across a working session
- [ ] Unchanged attribution records incur zero store writes (spy test green)
 [ ] `scanSessionArtifacts` batches one commit per artifact file with retry semantics preserved (test green)
- [ ] `message_end` handler does not await persistence; failures warn at `agent_end`/`session_shutdown` (tests green)
- [ ] `bun --bun tsc --noEmit` exits 0 with tsconfig including `scripts/**/*`
- [ ] `scripts/publish.ts` aborts on failed git-status or on a registry, transport, or authentication failure from `bun pm view`; a not-yet-published version is benign (tests green)
- [ ] `bun install --frozen-lockfile` exits 0; `package-lock.json` absent; repo contains no tracked `.js`/`.mjs` sources except generated `.context` artifacts
- [ ] `bun run guardrails:check` passes after each phase

## Verification
- Per phase: targeted red/green vitest suites; `bun run guardrails:check`.
- Phase 1 live: fresh omp log grep for `handler timed out`.
- Final: `bun run test` (vitest + bun suites + sqlite smoke), `bunx --bun playwright test tests/e2e/packed-report.spec.ts --project=chromium`, `bun --bun tsc --noEmit`.

## Execution Instructions
This plan exceeds single-session thresholds (4 phases, >8 steps, >5 areas). Run `/skill:b-phase` to split into sequential OMP-ready phases with per-phase model hints; Phase 1 first. Per phase: `/b-build` → `/b-review` → `/b-iterate` (in-plan) → `/b-docs` if flagged → `/b-save` → `/b-commit`.

## Risks
- Store-behavior changes could break attribution dedup/reconciliation — bounded by existing wire/ingest/db suites plus new red tests.
- Lockfile deletion breaks any residual npm workflows — CI already Bun-only; `package.json` has no npm-specific lifecycle left besides `prepublishOnly` (runs `bun run test`).
