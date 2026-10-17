---
status: active
date: 2026-10-16
subject: 2026-10-10.durable-storage-adapters
topics: [code-review, end-to-end-proof, packaging, storage-docs]
review_verdict: pass-with-warnings
addresses: phase-8-proof-docs-package.md
---

# Plan Path Review: Phase 8 end-to-end proof, docs, and packaging

## Verdict

**Pass with warnings.** The three in-plan defects from `review-phase-8-proof-docs-package-2026-10-16.md` are resolved in current evidence. This review does not choose a loop state, close lifecycle, or edit phase status.

## Plan Source

- File: `.context/2026-10-10.durable-storage-adapters/phase-8-proof-docs-package.md`
- Goal: exercise complete workflows on all four adapters, run guardrails and install/bundle checks, and document configuration, publication, migration, recovery, and dotfile exclusions.
- Inherited user goal: users choose durable storage per project, resume reliably, and keep unmerged work invisible on other branches.
- Baseline: `1c4f54347b7f6a7a8e4c58d3ded86b8253040dc5` (`feat/storage-adapter`). No upstream. Source-state verification is authoritative. Checkboxes and `status: completed` were not treated as proof.
- Prior review `review-zz-buck-loop-2026-10-16T07-29-55-654Z.md` found R1–R3. This pass re-checks those defects against the later repair evidence.

## Evidence Sources

- Working tree at review start: unstaged phase/plan/docs/save/plan-site changes plus untracked research notes. Pre-existing staged plan-site copy (`docs/plans/package.json`, `Base.astro`, `index.astro`) was left untouched.
- Live reads this review: repo-files, external-files, and SQLite phase revisions through `workflow-state-cli.ts` with each proof's `XDG_CONFIG_HOME` and `BUCK_WORKFLOW_CONFIG`. SQLite receipt row queried directly.
- PostgreSQL disposable server `phase8-guarded-pg18` is gone (`docker ps -a` empty; port 54339 not listening). Evidence is the retained OMP `workflow_state` tool result, not a fresh query.
- This review ran `npm run guardrails:check` and `diff -rq` storage/CLI bundle parity. It did not re-run an isolated installer or Chromium.

## Findings — Spec / Acceptance Axis

No remaining in-plan implementation defect.

Prior R1 is closed. Fresh CLI reads returned the pinned phase revisions and hashes for repo-files (`e61c2440-0e43-49b3-86a9-fb05403c6254` / `44c1e9ec…`), external-files (`3e35e69f-02d3-4943-a3de-9ac0d5330a9a` / `4dd67759…`), and SQLite (`1788b9ab-ce3f-421f-a75a-61dd4050ef91` / `75dd9a13…`). The SQLite `artifact_runs` row for `run-36aefeef-9729-4097-b155-af416e7c791d` is `complete` with fact `c08c1b28-6f44-4812-9ac8-0bead4676e72`. PostgreSQL's retained OMP session `live-hook-rpc.jsonl` tool result returned phase `eb33ade3-1a8a-49d6-8c44-9378ed2f0110` / `2370834e…` and the same complete attempt `c01a65cc-279c-4746-83d9-312862e929eb`. Edge producer inventories and hook memory rows are on disk; the SQLite hook memory revision `14aaa4f5-a886-4b5a-8a5a-046ae74f2a8c` is in the selected database.

Prior R2 is closed. Parent acceptance items at `plan-durable-storage-adapters.md:181-195` are checked and point at the recheck ledger. This review's guardrails run re-executed the required unit suite.

Prior R3 is closed. `docs/plans/src/pages/index.astro:13` prints `adapter: {source.kind}`. `Base.astro:90` and `package.json:5` name the configured workflow adapter. No `filesystem (.context/)` or interchangeable SQL-memory sentence remains in `docs/plans` source.

## Findings — Standards Axis

Worst finding: stale comment, not a behavior defect. Sequential fallback pass; this harness has no task/sub-agent dispatch tool.

Seed: `skills/code-review-universal/reference/code-review-best-practices.md`, `skills/code-review-universal/reference/code-quality-universal.md`, and the diff-scoped comment/dead-code smells. The save identity repair reuses `contextPathOf`, rejects ambiguous logical paths, and stops writing non-repo narrative mirrors (`save-apply.ts` metadata path; `save-preflight.ts:239-248`). The plan reader memoizes one snapshot and previews only linked documents. `extensions/sql-memory/index.ts:409-411` registers no model-facing tool.

`docs/plans/src/lib/plans/index.ts:5` still says a filesystem fallback bypasses visibility. The function only constructs `SqlPlanSource`. The comment describes removed behavior. It does not restore a second store.

## Completion Matrix

| Deliverable | Status | Direct evidence |
|---|---|---|
| 1. Real OMP workflow per backend with exact IDs/revisions and completed receipts, including restart/resume and named edge kinds | ✅ complete | CLI readback above for three adapters. PostgreSQL OMP tool result in `/tmp/phase8-omp/live/transcripts/postgres/live-hook-rpc.jsonl`. Seven-kind `skill-restart-exact.json` receipts are `complete` with duties `save-metadata` and `readback`. Hook and edge inventories match the research ledger. Limit: PostgreSQL server is gone, so this review did not re-query it. |
| 2. Parent acceptance criteria re-checked; checkboxes updated with evidence | ✅ complete | `plan-durable-storage-adapters.md:181-195` checked, evidence links at line 197. Guardrails unit gate re-ran the suite. |
| 3. Deterministic suite, guardrails, install, bundle parity, changed plan-site smoke | ✅ complete | Guardrails durable v2 **pass** this review (184.20s). `diff -rq` storage plus workflow-state CLI copies exit 0. Plan-site source labels match the adapter. Limit: isolated install and Chromium were not repeated; host `--verify` remains the known split-root detector and was not used as a missing-file claim. |
| 4. Storage, publication, migration/recovery, backup, dotfile exclusions, named docs, how-tos, changelog, AGENTS conventions | ✅ complete | `docs/howto/configure-storage-backend.md` including the exclusion paragraph; publication and cutover how-tos in `docs/howto/README.md:19-41`; backup/WAL warning in `docs/sql-memory.md:48-54`; changelog lines for adapter selection, plan-site snapshot, and typed save identity; AGENTS managed conventions already cover workflow_state, publication, and offline cutover. |
| 5. No dual-write, obsolete raw-SQL recall, or second active memory store | ✅ complete | `wire()` at `extensions/sql-memory/index.ts:409-411` registers nothing. `extensions/index.ts:33` wires `workflow_state`. Save no longer materializes non-repo bodies. |
| Blocking assumptions assigned to this phase | ✅ complete | Parent A-1–A-5 are `validated` and non-blocking. Phase 8 restates none as unresolved. |
| Material rollback/fallback this phase must validate | ✅ complete | The phase risk was late integration gaps. The four-backend proof and the typed-save resume of attempt `c01a65cc-279c-4746-83d9-312862e929eb` are the validation. Risk 6 exclusions are documented; no chezmoi file was edited. |

## Review Axes

- Spec axis worst finding: **none**. Prior R1–R3 are closed.
- Standards axis worst finding: stale filesystem-fallback comment at `docs/plans/src/lib/plans/index.ts:5`. Sequential fallback pass.
- Cross-axis ranking: **none**.

## Verification Status / User Goal Analysis

- Goal achieved: **yes**, with the PostgreSQL re-query and installer/browser limits above.
- User goal: **met** for this phase's integration proof. Branch privacy remains the earlier phases' visibility contract, re-checked by the passing suite rather than a new cross-branch fixture in this review.
- Scope adhered: yes. Out-of-scope changes: none introduced by this review.
- Goal mode: `.context/workflow/current-session.json` has no `goal` field. Its subject pointer is an older subject and does not override this phase.

## Guardrails Verdict

- Contract: **durable**
- Contract version: **2**
- Status: **pass**
- Gates: `unit_test_gate=pass`, `functional_test_gate=skipped`, `lint_gate=skipped`, `patch_gate=advisory`, `global_ratchet=pass`, `complexity_gate=pass`
- Coverage 88% vs baseline 84%; complexity 29 hotspots vs baseline 30; no new or hard-ceiling violations. Proposed ratchet updates were not applied.

## Documentation Impact

- No documentation impact
- Configuration, publication, migration/recovery, backup, and dotfile exclusions are already written. The stale plan-reader comment is a standards warning, not a `/b-docs` route.

## How-to Impact

- No how-to impact
- `docs/howto/configure-storage-backend.md` is indexed. Publication, export, cutover, and rollback how-tos already exist.

## Issue Classification

- In-plan issues: **none**
- Out-of-plan issues: `iterate-phase-4-native-access-rereview.md` is still `status: active`. It is a Phase 4 artifact, not a Phase 8 defect. Together with the still-active Phase 8 iterate file, `scan.ts` `hasIterate` is true. Ranking previously blocked on those two unfinished files. This review does not close either file.

## Warnings

- `implementation-notes-phase-8.md` still says the workflows and parent re-walk were not done. The research ledgers and the live reads above supersede that section. It is stale notes, not the acceptance authority.
- `iterate-phase-8-proof-docs-package.md` remains `status: active` even though its three critical issues are resolved. Iterate-file presence wins over this report. Closing it is `/b-iterate` bookkeeping, not a new product defect.
- PostgreSQL proof cannot be re-queried; the disposable server was removed after the OMP tool result was retained.

## Completion Audit

1. Deliverables are the five phase acceptance criteria plus packaging checks.
2. Each complete row cites a file, a CLI read, a database row, an OMP tool result, or a command run in this review.
3. Phase checkboxes were not treated as proof.
4. Guardrails and bundle parity were run. Isolated install and Chromium were not. PostgreSQL was not re-queried because the server is gone.
5. Missing live PostgreSQL re-query is a stated limit, not a missing transcript.
6. Both axes finished. No phase or loop transition was selected.

## Recommended Next Step

No new in-plan product work. The prior Phase 8 iterate file is stale relative to this evidence; Phase 4's still-active iterate file is outside this phase. This review does not close either file and does not authorize save, commit, or a loop transition.
