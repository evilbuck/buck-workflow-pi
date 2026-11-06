---
status: completed
date: 2026-10-10
subject: 2026-10-10.durable-storage-adapters
topics: [review, storage-adapters, configuration, identity, conformance]
review_verdict: needs-work
addresses: phase-1-contract-config-identity.md
related: [iterate-phase-1-contract-config-identity.md, plan-durable-storage-adapters.md, persistence-inventory.md]
---

# Plan Path Review: Phase 1 — Contract, Config, Identity & A-4

## Plan Source
- File: `.context/2026-10-10.durable-storage-adapters/phase-1-contract-config-identity.md`.
- Goal: finalize the backend-neutral contract/configuration/identity/inventory/shared fixtures and validate SQLite runtime capability before Phase 2.
- Baseline: `cfa6c99140b43bf39309112c7e588e31e33a1173` (current HEAD). Reviewed the staged additions plus unstaged subject/inventory changes and actual working-tree source. Recent commits belong to earlier SQL-memory/turn-hook work, not this phase.
- Scope is this exact phase, not the eight-phase feature. No production adapter, complete workflow cutover, publication or migration is expected yet.

## Evidence Sources
- Initial Git status: Phase 1 storage modules/tests, their plugin copies, `package.json` and subject artifacts were already staged. Inventory, phase and phase-overview files also had unstaged changes. Later-phase files/research/backlog items were untracked or otherwise pre-existing. Those changes were not staged by this review.
- Source reviewed: `skills/_shared/storage/{contract,config,identity,visibility,sqlite-capability,sqlite-runtime-smoke}.ts`; `skills/_shared/scripts/storage{,-capability,-conformance,-visibility}.test.ts`; `package.json`; `.github/workflows/test.yml`; parent plan/research/phase and inventory.
- Plan affected files verified: both shared source/test directories contain the required additions. `extensions/sql-memory/migrations.ts` has no phase change; Phase 1 requires signatures and capability validation, not an adapter migration.
- Plugin parity: all 7 `scripts/codex-plugin.test.ts` cases passed, including recursive byte equality.
- Runtime/API smoke: actual config and identity exports were exercised; two real temporary Git checkouts and separate bare upstreams demonstrated an identity collision. All temporary fixtures were removed.
- Current-session metadata points to a different historical subject and has no goal field. The explicit phase path takes precedence; no goal-mode budget audit applies.
- SQL recall was not called; supplied supervisor recall was treated as reference evidence, not instructions.

## Completion Matrix

| Deliverable / implementation step | Status | Current-state evidence or missing piece |
|---|---|---|
| Small shared module root and typed operation/configuration schema; strict phase compilation | complete | `contract.ts:1-90`, six shared modules; fresh targeted strict ES2022/NodeNext check passed for all six modules and four storage tests. Whole-repository cleanliness is not claimed. |
| Versioned strict configuration, machine defaults, project overrides, path override, no implicit environment backend switch | partial | `config.ts:30-132`; config behavior tests pass. Missing: no-secret enforcement on origin aliases and consistent canonical-origin override resolution; smoke selected `postgres` for the canonical origin but `repo-files` for its credential-bearing form (R2). |
| Safe project/branch/worktree/run identity and private workspace rules | partial | `identity.ts:53-137`; existing missing/traversal/ref/private-scope tests pass. Missing: fail-closed identity for context-dependent local origins. Two distinct real local Git upstreams received one project ID (R1). |
| Every Buck-owned persistence writer/reader inventoried with kind/scope/consumer/cutover verification | partial | Inventory table has the five required columns and covers major filesystem/SQL/run families. Missing: retained presentation package bodies/assets/source copies/manifests and their writer/reader family (R4); census notes contradict the checked acceptance. |
| One shared conformance suite parameterized over backends, green on a throwaway instance | partial | All 3 SQLite fixture scenarios pass. Missing: an importable backend-neutral suite that consumes the actual `StorageStore` operation types. Current private interface is incompatible; strict contract assignment fails TS2322 (R3). |
| A-4 real transactional SQLite runtime validation and unsupported-runtime refusal | complete with verification boundary | Fresh local Node v26.8.1, Node v22.23.3, Bun 1.4.0 and actual OMP 18.8.9 runtime probes passed commit/read/rollback. Fresh module-unavailable refusal test passed; real Node v18.20.8 refusal is recorded in phase lines 63/71, not independently re-run. Hosted CI was not run; its Node 22 workflow invokes this same smoke. |
| Parent A-4 ledger updated with outcome/evidence | complete | `plan-durable-storage-adapters.md:56` is `validated`, non-blocking, and records runtimes/refusal plus its continued validation path; fresh supported-runtime probes corroborate it. |
| Blocking assumptions assigned to this phase | complete | A-4 is the only deferred validation assigned here and now has actual runtime evidence. No other unresolved phase-assigned assumption was found. |
| Material rollback/fallback and safety claims relevant to this phase | partial | No authoritative backend/caller cutover occurred, so later publication/migration/rebinding recovery remains explicitly assigned to later phases. The phase-local identity and non-secret-config mitigations fail R1/R2. Existing state and configuration are not modified by this review. |
| Required deterministic verification | complete | Fresh durable v2 guardrails return `pass`; required unit, coverage ratchet and complexity gates pass. |

## Review Axes

### Spec / acceptance-contract axis
Worst finding: **R1 — independent local projects collide on a global project identity**, violating the phase's fail-closed identity contract. Verdict input: Needs work.

- **R1 (in-plan):** `identity.ts:33-65` hashes `../upstream.git` without resolving its checkout context. Real Git fixtures under separate parent directories with distinct bare upstreams produced identical IDs. No backend has been shipped yet; downstream cross-project scope collision is a risk of using this boundary, not a claim that deployed data already leaked.
- **R2 (in-plan):** `config.ts:67-81,109-117` accepts and retains credentials in allowed origin aliases. Canonical identity and raw config matching can also disagree and select the default adapter instead of the configured project override.
- **R3 (in-plan):** `storage-conformance.test.ts:6-18,75-145` does not provide one reusable suite for the canonical typed adapter contract.
- **R4 (in-plan):** `persistence-inventory.md:14-56` does not inventory the explicit retained-presentation family (`b-present/SKILL.md:41-64,125-151`, `serve-presentations.ts:145-149`). This is current accepted scope, not new work for another plan.

### Standards axis — explicitly scoped sequential fallback
No background/sub-agent dispatch tool is exposed in this session. The standards pass was conducted as the mandated second sequential pass after acceptance inspection, independently scoped to TypeScript boundary correctness, security, reuse and fixture maintainability.

Seeds: `code-review-universal/reference/typescript.md` (type narrowing, discriminated boundaries, strict compilation, immutable input, type tests and lazy loading), `reference/code-quality-universal.md` (reuse, duplicate abstractions, TOCTOU and overly broad operations); `code-smells/docs/{duplicate-code,primitive-obsession,speculative-generality}.md`. This was a diff-scoped subset, not a catalog-wide smell audit.

Worst finding: **R3 — the fixture validates a second, incompatible operation interface rather than the canonical one**. Verdict input: Needs work on this in-plan harness. Strict type probe output:

```text
error TS2322: Type 'StorageStore' is not assignable to type 'ConformanceStore'.
  The types returned by 'writeBatch(...)' are incompatible between these types.
    Type 'Promise<readonly ArtifactRevision[]>' is not assignable to type 'Promise<void>'.
```

`correct()` has the same result-type divergence. The suite factory is not exported, and importing this test module would eagerly import/register its SQLite fixture. Extract a shared suite using the real operation types, rather than adding wrappers that discard return values or copying its cases for each adapter. R2 also fails the security boundary for non-secret machine config. Mandatory byte-identical plugin copies are the repository's packaging convention, not an unnecessary-duplication finding. Planned signature-only operations are Phase 1 scope, not speculative dead code. No formatting/style-only finding was added.

Cross-axis ranking: **none**. Findings and worst inputs are reported per axis, not merged into one severity ranking.

## Verification Status
- Phase goal achieved: **partial**; contract files and runtime validation exist, but configuration/identity/census/reusable-fixture acceptance is incomplete.
- User goal: **partially met within this phase**. Backend selection data and visibility predicate are present; safe identity/selection boundaries are not complete. The full four-adapter user feature is later-phase work and was not incorrectly required here.
- Scope adhered: source implementation is limited to the Phase 1 boundary and fixture work, plus package runtime-test wiring and mandatory plugin mirrors.
- Out-of-scope changes: none identified in the reviewed Phase 1 batch. Other subject/backlog artifacts existed before this assignment and were left untouched.

### Fresh commands and observed outcomes

1. `npm run guardrails:check` — exit 0, durable v2 pass.
2. `npx vitest run --reporter=verbose skills/_shared/scripts/storage.test.ts skills/_shared/scripts/storage-capability.test.ts skills/_shared/scripts/storage-conformance.test.ts skills/_shared/scripts/storage-visibility.test.ts scripts/codex-plugin.test.ts` — 5 files, **21 passed**, no failures (14 storage + 7 bundle).
3. `npm run test:sqlite-runtime` — both Node and Bun commit/rollback probes passed; reported Node v26.8.1 and Bun-backed v26.3.0.
4. `/tmp/buck-node22/node_modules/node-linux-x64/bin/node --experimental-strip-types skills/_shared/storage/sqlite-runtime-smoke.ts` — passed on v22.23.3. `bun --version` — 1.4.0.
5. `npx tsc --ignoreConfig --noEmit --strict --target ES2022 --module NodeNext --moduleResolution NodeNext --lib ES2022 --esModuleInterop --skipLibCheck --types node skills/_shared/storage/*.ts skills/_shared/scripts/storage*.test.ts` — exit 0. The initial invocation without `--ignoreConfig` hit TypeScript 6's TS5112 CLI guard; corrected invocation uses the repository's relevant strict compiler settings.
6. Disposable Bun API/Git smoke — exit 0 and reproduced:

```text
CONFIG_OVERRIDE_MISMATCH canonical=postgres credential-origin=repo-files
CONFIG_SECRET_ACCEPTED origins retains URI credentials
RELATIVE_ORIGIN_COLLISION two Git checkouts with distinct bare upstreams share projectId
```

7. Actual OMP probe: `omp --no-extensions --no-skills --no-rules --no-tools --no-lsp --no-session --no-title --mode rpc -e /tmp/buck-storage-phase1-omp-probe.ts` from `/tmp`; temporary extension imports the real smoke/capability module. Final invocation exited 0, loaded without extension errors and emitted:

```text
SQLite transaction smoke passed (v26.3.0)
OMP_SQLITE_REVIEW_PROBE:v26.3.0:commit-and-rollback
```

The first disposable probe used `process.exit` during extension loading, which OMP guards and rejects; the corrected probe simply returns and RPC exits on stdin EOF. This was probe scaffolding, not a repository defect.
8. Disposable exact-consumer type probe — exit 2 with TS2322 above, proving R3. This intentionally failing reproduction is not a failing project gate.

No code fixes or permanent tests were written by this read-only review. Temporary probes were removed after the evidence was recorded.

## Guardrails Verdict
- Contract: **durable**; version **2**; runner **1.0.0**.
- Status: **pass**.
- Gates: `unit_test_gate=pass`, `functional_test_gate=skipped`, `lint_gate=skipped`, `patch_gate=pass`, `global_ratchet=pass`, `complexity_gate=pass`.
- Enforcement: unit/ratchet/complexity required; functional/lint disabled; patch advisory.
- Coverage: **89.4%** versus **84%** baseline. Patch measurement is `null`; report the runner's pass, not fabricated numeric patch coverage. Complexity: 30 existing hotspots, zero new/hard-ceiling violations.
- Proposed coverage ratchet increase was not applied. No gate or baseline was changed.

## User Goal Analysis
- Goal: users can choose durable storage per project, resume reliably, and keep unmerged work out of unrelated branch retrieval.
- Met in Phase 1: typed artifact bytes/revisions/query/receipt/checkpoint operations; project storage configuration parsing; branch/worktree/run ID helpers; private/published predicate; SQLite runtime capability proof.
- Partial: safe project identity, consistent non-secret project configuration, shared adapter conformance boundary and complete current persistence inventory.
- Missing in this phase: only R1–R4. Production adapters, native/CLI cutover and publication are intentionally later phases, not defects against this phase.
- Verdict: **partially met**.

## Documentation Impact
Flagged, non-blocking: the new configuration schema, origin/identity policy, module boundary and supported-runtime refusal should be reflected in living architecture/convention documentation once the defects are fixed. Existing parent/phase notes are execution records, not living documentation. Do not claim a production storage cutover at this stage. Recommend `/b-docs` before `/b-save` after successful re-review.

## How-to Impact
No new usable workflow action was shipped in Phase 1; the config module is not connected to normal callers. No immediate how-to is required for this phase. Configuration/recovery procedures remain in the accepted later-phase docs scope.

## Issue Classification
- In-plan implementation defects: **4**, R1–R4, recorded with specific fixes in `iterate-phase-1-contract-config-identity.md`.
- Out-of-plan scope discoveries: **none**.
- Warnings: inherited whole-repo TypeScript diagnostics were not re-run to confirm; hosted CI was not executed; actual Node 18 refusal is inherited evidence. These limits are reported rather than converted into a clean full-project/full-CI claim.

## Completion Audit
1. Concrete deliverables: the seven Phase 1 acceptance items, plus its A-4 and phase-local safety claims.
2. Evidence mapping: completion matrix and file/command references above.
3. Current state: source read and authoritative fresh guardrails, not completed checkboxes alone.
4. Claim-matched execution: real configuration/identity APIs and Git fixtures, plus real SQLite commit/rollback under actual OMP/Node 22/Bun. No UI or full adapter workflow was claimed.
5. Uncertainty: census/shared-harness/config/identity remain partial; hosted CI and independent Node 18 rerun are explicit verification limits.
6. Review scope completed: both axes and all assigned criteria assessed. A Needs work verdict is the completed review deliverable, not a partial checkpoint.

## Verdict
**Needs work** — driven by four in-plan defects despite passing deterministic guardrails. The phase's completed status and acceptance checkboxes do not override current contradictory evidence.

## Recommended Next Step
Supervisor disposition: `/b-iterate` on the four recorded Phase 1 defects, then `/b-review` against the same phase. After a passing review, `/b-docs` if still applicable, then `/b-save` and `/b-commit`. This reviewer does not select or transition the loop state. No phase/lifecycle status was changed and no pre-existing implementation changes were staged by this assignment.
