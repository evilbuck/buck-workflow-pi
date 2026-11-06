---
status: completed
date: 2026-10-10
subject: 2026-10-10.durable-storage-adapters
topics: [review, storage-adapters, configuration, identity, conformance]
domains: [storage, testing]
priority: high
review_verdict: pass-with-warnings
addresses: phase-1-contract-config-identity.md
related: [phase-1-contract-config-identity.md, iterate-phase-1-contract-config-identity.md, persistence-inventory.md, plan-durable-storage-adapters.md]
---

# Plan Path Review: Phase 1 — Contract, Config, Identity & A-4 (re-review)

## Plan Source
- File: `.context/2026-10-10.durable-storage-adapters/phase-1-contract-config-identity.md`.
- Goal: finalize the backend-neutral typed contract, configuration, identity, inventory and shared conformance fixtures; validate A-4 before SQLite adapter implementation.
- Baseline: `cfa6c99140b43bf39309112c7e588e31e33a1173`, current HEAD. Evidence is the staged implementation plus actual working-tree source and subject artifacts. Recent commits are previous SQL-memory/turn-hook work, not Phase 1 implementation.
- Scope: exactly Phase 1. Production adapters, caller migration, publication/recovery and end-to-end four-backend proof belong to later phases.

## Evidence Sources
- Initial status: storage modules/tests and their plugin copies, package runtime-smoke wiring and several subject artifacts already staged. Inventory, iteration, phase and overview also had unstaged changes; later-phase/research/backlog files were pre-existing. None of those pre-existing changes was staged or modified by this assignment.
- Source: `skills/_shared/storage/{contract,config,identity,visibility,conformance,sqlite-capability,sqlite-runtime-smoke}.ts`, the four storage test files, `package.json`, `tsconfig.json`, `.github/workflows/test.yml`, parent plan/research, inventory and previous iteration/review.
- Affected directories verified: `skills/_shared/storage/` and `skills/_shared/scripts/`. `extensions/sql-memory/migrations.ts` remains intentionally unchanged: this phase introduces no production adapter or migration.
- Fresh focused suites: 24 passing tests in five files (17 storage cases and seven plugin cases). The real-Git identity regression creates separate upstreams/checkouts and same-project linked worktrees.
- Fresh API smoke: actual config/identity/capability exports exercised under Bun; temporary files and environments restored/removed.
- Fresh runtime smoke: Node v26.8.1, Node v22.23.3, Bun 1.4.0 and actual OMP 18.8.9's Node v26.3.0. All exercised transactional commit/read/rollback.
- Current-session metadata points to another historical subject and has no active goal field. The explicit phase path takes precedence; no goal-mode budget audit applies.
- Supervisor recall was used only as reference. No SQL-memory query/save, lifecycle transition or loop-state selection was performed.

## Completion Matrix

| Deliverable / implementation step | Status | Current-state evidence |
|---|---|---|
| Small module root, typed operations/config schema, strict phase compilation | ✅ complete | `contract.ts:1-90` contains byte/revision/query/correction/lifecycle/receipt/checkpoint/export/import signatures. Strict ES2022/NodeNext compilation of seven storage modules and four test files exited 0. |
| Versioned strict config, defaults, project overrides, path override, no environment backend switch | ✅ complete | `config.ts:34-135`: known-key/version/adapter checks, defaults, project selection and `BUCK_WORKFLOW_CONFIG`. Storage tests and actual API smoke prove override behavior, secret rejection, canonical matching and that `SQL_MEMORY_URL` alone does not choose PostgreSQL. |
| Safe project/branch/worktree/run identity and private workspace rules | ✅ complete | `identity.ts:33-156`: canonical redacted origin, refusal of unresolved relative local origins, safe keys/refs and explicit private scope. Fresh real-Git regression proves different absolute upstreams differ and worktrees share identity; unsafe/missing identity tests pass. |
| Persistence inventory with kind/scope/consumer/cutover verification | ✅ complete | `persistence-inventory.md:14-69` covers current retained knowledge/run families, instruction-defined writers, package assets/binary payloads, source snapshots/manifests, readers and ownership boundaries. Presentation rows match `b-present/SKILL.md:41-64,121-151` and `serve-presentations.ts:145-149`. No consumer migration is claimed. |
| Importable shared conformance suite, green on throwaway backend | ✅ complete | `conformance.ts:1-64` exports one suite using `Pick<StorageStore, ...>`; only fixture registration imports SQLite (`storage-conformance.test.ts:1-83`). All three scenarios pass: exact bytes/stale-batch rollback, visibility before limit, branch-scoped corrections and evidence/stale lifecycle refusal. |
| A-4 supported-runtime transactions and clear unsupported-runtime refusal | ✅ complete, with runtime boundary below | Fresh transaction probes pass on actual OMP, local Node, Node 22 and Bun. `loadSQLiteModule()` refusal passes both the focused regression and actual exported-API smoke with an unavailable module. Actual Node 18 refusal is recorded in phase lines 63/71 and was not repeated in this run. Hosted CI itself was not run. |
| Parent A-4 ledger updated | ✅ complete | `plan-durable-storage-adapters.md:56` records `validated`, non-blocking status, runtimes/refusal and continued validation path. Fresh supported-runtime evidence corroborates it. |
| Blocking/deferred assumptions assigned to Phase 1 | ✅ complete | A-4 is the only runtime-validation assumption assigned here; current evidence resolves it. No unresolved phase-assigned blocker was found. |
| Phase-local material risk/fallback evidence | ✅ complete | Relative-origin identity now refuses rather than sharing scope; configured secret-bearing origins refuse; unsupported SQLite refuses without backend fallback. No authoritative store was switched. Later publication/rebinding/import rollback claims remain assigned to their later validation phases. |
| Deterministic check contract | ✅ complete | Fresh `npm run guardrails:check`: durable v2 pass; required unit/global-ratchet/complexity gates pass. |

## Prior Iteration Findings
- R1 resolved: relative local origins cannot silently collapse independent projects. `identity.ts:36-43` refuses them; real-Git regression passes (`storage.test.ts:74-99`).
- R2 resolved: configuration rejects secret-bearing URI aliases and uses identity's canonical form for incoming origins (`identity.ts:58-70`, `config.ts:68-83,110-120`). Credential-bearing incoming origin selects the same project/backend in the live API smoke; canonical alias ambiguity and secret rejection regressions pass.
- R3 resolved: shared suite is exported and consumes actual public operation types (`conformance.ts:4-9`). The fixture's revision/correction return values satisfy that type (`storage-conformance.test.ts:23-78`); strict compilation and three behavioral cases pass.
- R4 resolved: inventory now includes retained presentation pages/assets/binary payloads, copied sources, manifest/provenance and byte readers (`persistence-inventory.md:47-69`). The discovery boundary distinguishes canonical retention, optional exports, rebuildable projections and excluded authority.

## Review Axes

### Spec / acceptance-contract axis
- Worst finding: **none remaining**.
- Verdict input: Pass. All seven assigned acceptance criteria have direct source/runtime evidence; prior four defects are resolved.
- No later-phase feature completeness was required or inferred from Phase 1 completion.

### Standards axis — explicitly scoped sequential fallback
- No sub-agent dispatch tool is available. This was a second, explicitly scoped sequential pass after the acceptance pass.
- Seeds: `code-review-universal/reference/typescript.md` (narrowing, strict mode, immutability, tests, ESM/module boundaries) and `reference/code-quality-universal.md` (reuse, abstraction, duplicate shapes, TOCTOU and overly broad operations). Smell subset: `duplicate-code`, `primitive-obsession`, `speculative-generality`; not a full catalog audit.
- Reuse checked against existing SQL-memory/token-attribution identity utilities. Their raw-remote/fallback behavior is not the new safe, canonical artifact-identity contract. Shared config/identity now reuse the same new canonicalization rather than disagreeing.
- Worst finding: **none remaining**. The divergent fixture interface is removed. SQLite remains lazy at the capability boundary; eager imports are confined to test/smoke registration. Mandatory byte-identical plugin copies are packaging, not an unnecessary duplication finding. Signature-only operations are explicitly accepted Phase 1 scope, not speculative unused runtime implementations.
- The throwaway fixture is not evidence that a production adapter implements every operation, hash validation, publication, search, receipt or recovery behavior; those checks remain later-phase scope.

Cross-axis ranking: **none**; per-axis findings and verdict inputs remain separate.

## Verification Status
- Phase goal achieved: **yes**.
- User goal: **met for the Phase 1 technical contract layer**. Four production backends and complete workflows are not yet delivered and are intentionally later-phase work.
- Scope adhered: yes; reviewed shared boundary/fixtures, runtime test wiring and mandatory bundle mirrors. No out-of-scope implementation change identified in that batch.
- Assignment changes: this new review report only. Pre-existing staged/unstaged changes and completed iteration artifact were preserved.

### Fresh Commands / Observed Outcomes
1. `npm run guardrails:check` — exit 0; durable v2 pass; coverage 89.5% versus 84%; zero new/hard-ceiling complexity violations.
2. `npx vitest run --reporter=verbose skills/_shared/scripts/storage.test.ts skills/_shared/scripts/storage-conformance.test.ts skills/_shared/scripts/storage-visibility.test.ts skills/_shared/scripts/storage-capability.test.ts scripts/codex-plugin.test.ts` — **24 passed / 5 files**.
3. `npm run test:sqlite-runtime` — Node v26.8.1 and Bun-backed v26.3.0 transaction smokes passed.
4. `/tmp/buck-node22/node_modules/node-linux-x64/bin/node --experimental-strip-types skills/_shared/storage/sqlite-runtime-smoke.ts` — passed on Node v22.23.3. `bun --version`: 1.4.0; `omp --version`: 18.8.9.
5. `npx tsc --ignoreConfig --noEmit --strict --target ES2022 --module NodeNext --moduleResolution NodeNext --skipLibCheck --types node skills/_shared/storage/*.ts skills/_shared/scripts/storage*.test.ts` — exit 0. This uses the relevant strict repository settings but is not a whole-repository TypeScript claim.
6. `diff -rq skills/_shared/storage plugins/buck-workflow/skills/_shared/storage` — exit 0. Plugin behavioral suite separately confirms recursive canonical-copy parity, including tests.
7. Disposable Bun API smoke — exit 0, printed `STORAGE_API_SMOKE_PASS: canonical override, secret rejection, relative-origin refusal, path override, no SQL env switch, private scope, capability refusal`.
8. Actual OMP invocation from `/tmp`: `omp --no-extensions --no-skills --no-rules --no-tools --no-lsp --no-session --no-title --mode rpc -e /tmp/buck-storage-rereview-omp-probe.ts` — exit 0, no extension-loading failure; printed `SQLite transaction smoke passed (v26.3.0)` and `OMP_SQLITE_REREVIEW_PROBE:v26.3.0:commit-and-rollback`.

Temporary probes were removed. No source fixes, permanent tests, config/guardrails changes or lifecycle updates were made by this reviewer.

## Guardrails Verdict
- Contract: **durable**; version **2**; runner **1.0.0**; status **pass**.
- Gates: `unit_test_gate=pass`, `functional_test_gate=skipped`, `lint_gate=skipped`, `patch_gate=pass`, `global_ratchet=pass`, `complexity_gate=pass`.
- Unit/global-ratchet/complexity required; functional/lint disabled; patch advisory.
- Coverage: **89.5%**, baseline **84%**. Numeric patch coverage is **null**; the runner's patch pass is not proof of a measured patch percentage.
- Complexity: 30 existing hotspots; zero new or hard-ceiling violations. Proposed coverage-baseline raise was not applied.

## User Goal Analysis
- Inherited goal: choose where durable state lives, resume reliably across sessions/worktrees and keep unmerged work out of unrelated ordinary retrieval.
- Met for this phase: typed byte/revision operations, consistent project config/identity, explicit branch/worktree/run/private scope, visibility predicate, reusable fixture boundary, persistence census and SQLite capability validation.
- Partial/missing within this phase: none identified.
- Verdict: **met for the phase**; the inherited full feature still requires the remaining accepted phases.

## Documentation Impact
Flagged, non-blocking: new versioned config schema, canonical identity/fail-closed rules, shared storage module/conformance boundary and supported-runtime refusal should be reflected in living conventions/architecture docs. Do not describe this as a production adapter cutover. Recommend `/b-docs` before `/b-save`.

## How-to Impact
No immediate how-to impact: Phase 1 adds a contract/module layer, not a new connected user-facing storage action. Configuration, migration and recovery procedures remain in the later accepted documentation scope.

## Issue Classification
- In-plan implementation defects: **none remaining**. No new iteration artifact is warranted.
- Out-of-plan scope discoveries: **none**.
- Verification warnings: hosted CI was not run; Node 22's configured CI major was exercised locally, and `.github/workflows/test.yml:16-23` runs `npm test` with Node 22 and Bun. Whole-repo TypeScript diagnostics are pre-existing according to phase evidence and were not rerun to confirm. Actual Node 18 refusal is inherited phase evidence; fresh unavailable-module refusal was independently exercised.
- `.context/memory/index.md` has no Phase 1 closeout entry; SQL save/receipt creation remains supervisor-owned. No historical memory file/index was modified.

## Completion Audit
1. Objective: the seven explicit Phase 1 deliverables; not the complete eight-phase user feature.
2. Each deliverable maps to current source lines, focused tests or runtime output in the matrix.
3. Current source was inspected and authoritative fresh guardrails passed; status fields/checkboxes were not treated as proof.
4. Real config/identity APIs, real Git fixtures and actual OMP/Node 22/Bun SQLite transactions match the phase's claim scope. No UI or production backend workflow is claimed.
5. Hosted CI, full-project compilation and the inherited actual Node 18 result are explicitly bounded rather than reported as fresh green evidence.
6. Both axes and every assigned criterion were reviewed; no truncated/partial review is represented as completion.

## Verdict
**Pass with warnings** — no remaining in-plan defects. Verification boundaries above do not claim full-project/full-CI or later-phase completion.

## Recommended Next Step
Supervisor recommendation only: `/b-docs` for the module/config convention impact, then `/b-save` and `/b-commit`. The supervisor owns lifecycle, acceptance metadata, durable SQL save and loop-state disposition. This reviewer does not select the next loop state.
