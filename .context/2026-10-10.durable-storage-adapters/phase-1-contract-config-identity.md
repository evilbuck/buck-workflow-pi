---
status: completed
phase: 1
order: 1
plan: plan-durable-storage-adapters.md
phases_overview: plan-durable-storage-adapters-phases.md
difficulty: hard
model_hint: strongest reasoning model available
buck_hint: /b-build-hard
goal: "Finalize the backend-neutral typed artifact contract, configuration parser, project/branch/worktree/run identity rules, persistence inventory, conformance fixtures, and validate assumption A-4 (SQLite runtime capability)."
files:
  - skills/_shared/storage/
  - skills/_shared/scripts/
  - extensions/sql-memory/migrations.ts
from_plan_steps: [1]
depends_on: []
dependency_type: NONE
acceptance_criteria:
  - "[x] Typed store-operation contract and config schema exist under skills/_shared/storage/ and typecheck strict under tsconfig (extensions/skills/prompts scope)."
  - "[x] config.yaml parser: versioned, strict known-key parsing, machine defaults + per-project overrides, repo-files default, no env-driven backend switch; BUCK_WORKFLOW_CONFIG override honored."
  - "[x] project_id / branch_id (incarnation) / worktree_id / run_id identity rules implemented with fail-closed behavior on missing/ambiguous identity; no traversal-capable or raw-URL project keys."
  - "[x] Persistence inventory written: every Buck-owned write/read path with artifact kind, scope, consumer, and cutover verification column."
  - "[x] Shared conformance fixture harness runs one suite of storage/visibility/lifecycle cases against a throwaway backend instance."
  - "[x] A-4 validated: real transactional SQLite (node:sqlite) exercised in actual OMP runtime, CI Node 22, and supported Bun; explicit capability-refusal path verified on an unsupported runtime. Result recorded in the phase file."
  - "[x] A-4 status updated in the parent plan's Assumptions Ledger (validated, or blocking with named follow-up)."
completed_at: 2026-10-10
completed_by: null
sql_memory_ids:
  - 01a127c3-490a-74ad-8cb8-04f01a67dd53
---

# Phase 1: Contract, Config, Identity & A-4 Validation

## User Goal
Technical chore — shared contract layer; the inherited parent goal is: users can choose durable storage per project and keep unmerged work invisible on other branches.

## Context
Parent User Goal: Buck Workflow users can choose where durable state lives, resume it reliably, and keep unmerged work out of unrelated branches' retrieval. This phase builds the backend-neutral contract every later phase implements against, and resolves deferred assumption A-4 (node:sqlite runtime support) before any SQLite adapter work begins.

## Implementation Details
From plan step 1:
1. Create `skills/_shared/storage/` module root with small, explicit modules: contract (typed operations), config, identity, visibility, fixtures. Keep the split minimal — no speculative abstraction.
2. Typed operations: artifact read/list/search/write-batch, scoped correction, lifecycle transition, run-state/receipt ops, checkpoint seal/bind/reconcile, export/import — signatures only; adapters come in Phase 2.
3. Config parser per plan Design contract §1: `${XDG_CONFIG_HOME:-~/.config}/buck-workflow/config.yaml`, `BUCK_WORKFLOW_CONFIG` override, strict known keys, machine defaults + project overrides, `repo-files` built-in default. No branch-level adapter overrides. No secrets in config; connection via `connection_env` only.
4. Identity per §2: stable project_id (configured key or redacted origin; old-origin aliases preserved at import), branch incarnation IDs, worktree_id/run_id, artifact key (project, subject, kind, logical name) + immutable revisions. Detached/unborn/no-Git → private workspace identity.
5. Persistence inventory: enumerate every retained Buck write/read path (plan "Affected files" list is the seed) into a table with kind/scope/consumer/cutover verification; commit it under `.context/<subject>/`.
6. Conformance fixtures: one shared behavioral suite (storage, visibility ordering, lifecycle refusal, correction scoping, stale-write rejection) parameterized over backend instances. No source-text assertions.
7. A-4 validation: run real transactional node:sqlite smoke in actual OMP runtime, CI Node 22, supported Bun; verify clear refusal on unsupported runtime; record results and update the Assumptions Ledger. This gates Phase 2's SQLite slice.

## Risks
- Contract over-design blocks four adapters later; keep operations data-shaped, not backend-shaped. Mitigation: derive signatures from existing consumers in the inventory, not in advance.
- SQLite capability may fail on CI Node 22 / OMP runtime — this is a legitimate outcome; record it and mark A-4 blocking rather than softening the gate.

## Verification
- `tsc` clean on phase files; `npm run guardrails:check` passes.
- Fixture harness runs green against at least one throwaway backend instance (files or in-memory SQLite).
- A-4 evidence: command transcripts/results for OMP, CI Node 22, Bun; refusal-path test.
- Config parser unit cases: valid file, unknown key rejection, project override, env-var override, no-secret guarantee.

## Execution checkpoint
- `skills/_shared/storage/contract.ts`, `config.ts`, `identity.ts`, `visibility.ts`, `sqlite-capability.ts`, and `sqlite-runtime-smoke.ts` implement the typed operation/config/identity/visibility boundary. Artifact project/subject/branch IDs and run/worktree IDs are validated before use; unsafe path-bearing identities fail closed. Phase 1 adds no backend adapter.
- `npx vitest run --reporter=verbose skills/_shared/scripts/storage*.test.ts`: 14 tests passed across config, identity, visibility, runtime refusal, and a throwaway `node:sqlite` conformance fixture. The fixture covers exact byte round-trip, stale batch rollback, filter-before-limit privacy, branch-local correction, evidence-required lifecycle completion, and stale-transition refusal.
- Strict targeted TypeScript check passed with the repository's `strict`, ES2022, NodeNext settings for the six storage modules and four storage test files. Full-repository `tsc` still reports unrelated pre-existing diagnostics; it is not a clean whole-project check.
- `npm run test:sqlite-runtime`: Node v26.8.1 and Bun-backed SQLite transaction/rollback probes passed. `/tmp/buck-node22/node_modules/node-linux-x64/bin/node --experimental-strip-types skills/_shared/storage/sqlite-runtime-smoke.ts`: passed on Node v22.23.3. `.github/workflows/test.yml` installs Node 22 and Bun and invokes `npm test`; the CI workflow itself was not run in this session.
- Actual OMP extension probe observed `OMP_SQLITE_PROBE:v26.3.0:omp-transaction` under OMP 18.8.9. Unsupported-runtime probe under Node v18.20.8 emitted `SQLite adapter unavailable in this runtime: node:sqlite could not be loaded (No such built-in module: node:sqlite)`.
- `npm run guardrails:check`: pass; durable contract, unit gate, global coverage ratchet, and complexity gate pass; coverage 89.4% vs 84% baseline. Functional/lint gates are disabled; patch gate is advisory and reported pass.
- `scripts/codex-plugin.test.ts`: 7/7 pass after adding byte-identical `_shared/storage/` and storage-test copies under `plugins/buck-workflow/skills/_shared/`.
- The current-code family census now includes instruction-defined capture/research/grill writers, retained presentation pages/assets/binary payloads, copied source snapshots, manifests and the static-server reader. Ownership is explicit: retained canonical attachments versus scoped optional exports, rebuildable indexes and excluded configuration/host stores. Consumer migration remains later-phase work.
- Acceptance boxes were ticked by supervisor recovery on 2026-10-10. The subsequent Phase 1 iteration addresses identity, config, conformance and inventory defects; re-review remains supervisor-owned. This checkpoint does not choose a loop state.

## A-4 Validation Result (recorded 2026-10-10)

Validated. Transactional node:sqlite write/commit/read/rollback smokes passed on: OMP 18.8.9's runtime (Node v26.3.0), standalone Node v22.23.3 (matching CI's Node 22 major), supported Bun 1.4.0, and local Node v26.8.1 (`npm run test:sqlite-runtime` covers Node+Bun in CI). Explicit capability refusal verified on Node v18.20.8 (`node:sqlite` unavailable). Parent plan Assumptions Ledger row A-4 updated to `validated`. Full transcript evidence lives in the ledger's evidence column.

## Verification
- `tsc` clean on phase files; `npm test` green (70 pass, 0 fail) including conformance fixtures against a throwaway in-memory SQLite backend; `npm run test:sqlite-runtime` green on Node and Bun.
- Config parser unit cases: unknown-key and embedded-credential rejection, `BUCK_WORKFLOW_CONFIG` override, project override resolution (skills/_shared/scripts/storage.test.ts).
- Identity: fail-closed on missing/ambiguous identity, traversal-capable artifact names and project keys refused, detached/no-Git → private workspace (storage.test.ts).

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Run `/b-build-hard` for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this phase), do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If the phase is incomplete, leave `status: in-progress` so the session resumes here next turn.
