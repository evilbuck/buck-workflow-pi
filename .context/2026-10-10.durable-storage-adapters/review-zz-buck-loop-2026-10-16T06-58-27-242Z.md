---
status: active
date: 2026-10-16
subject: 2026-10-10.durable-storage-adapters
topics: [code-review, data-cutover, crash-recovery, publication]
review_verdict: request-changes
addresses: phase-7-data-cutover.md
---

# Plan Path Review: Phase 7 existing-data cutover

## Verdict

**Needs work.** Two reproduced in-plan defects: interruption during cutover preparation cannot resume through the documented command, and branch export silently loses rewrite-publication authority. The real cutover/rollback happy path and all nine focused regressions pass. Required durable guardrails pass. This review does not choose a loop state or change phase/lifecycle metadata.

## Plan Source

- File: `.context/2026-10-10.durable-storage-adapters/phase-7-data-cutover.md`.
- Goal: scoped lossless migration, explicit legacy quarantine, verified atomic switching, interrupted-cutover recovery, and rescue before rollback.
- Inherited user goal: users choose durable storage per project, resume reliably across sessions/worktrees, and keep unmerged work private.
- Baseline: `2adebce09a54e37677adcd4da8023947c4e75d8b` plus the Phase 7 staged/unstaged source present at assignment start. No upstream is configured on `feat/storage-adapter`; no upstream-diff claim is made. Source-state verification is authoritative on this long-lived branch.
- References followed: parent plan step 7, scope/design contract, A-5 and material risks 4/6; parent research; previous Phase 7 iteration and implementation evidence. Earlier phase completion claims are context, not new proof.

## Evidence Sources

- Initial Git status: existing implementation/docs/artifact changes were already staged; phase, overview, and previous iteration had additional unstaged changes; two existing ranking/review files were untracked. Those changes were preserved, not staged by this review.
- Recent baseline commit: `2adebce feat(storage): publish verified checkpoints and recover private scopes`; earlier adapter/access/consumer commits are supporting context only.
- Modified implementation inspected: `skills/_shared/storage/{migration,cutover,file-store,sqlite-store,postgres-store,contract,db,sqlite-capability}.ts`, `skills/_shared/scripts/{workflow-state,workflow-state-cli,storage-migration-cli,storage-cutover.test}.ts`, shared access instructions, importer skill, installer inventory, and migration documentation/how-tos. Canonical migration/cutover/operator CLI SHA-256 values match their three bundle counterparts.
- Phase affected-file scope: canonical/bundled storage and CLI surfaces, importer, installer, SQL-memory documentation and how-tos all belong to the phase's declared files. No new out-of-scope implementation changes were identified in this delta.
- Verification: fresh focused Vitest suite, fresh durable guardrails runner, isolated real-CLI cutover/rollback smoke, SIGKILL during real-CLI cutover preparation, and a real-Git/SQLite scoped-publication regression smoke.
- Standards pass: explicit separate sequential fallback after the acceptance pass; this harness exposes no task/sub-agent dispatch tool.

## Findings — Spec / Acceptance Axis

### R1. Cutover recovery intent is retained only after import — in-plan

`skills/_shared/storage/cutover.ts:85-99` runs `importSnapshot` before creating the main cutover journal. `skills/_shared/scripts/storage-migration-cli.ts:58-66` requires that journal to resume. Killing a real cutover after its first private import-journal replacement leaves `.import` but no main journal; `migration-resume` exits 1. Config stays on the source and the destination remains invisible, but the promised operational restart path is unavailable during preparation. This violates criterion 4, implementation detail 4, and the mandatory interrupted-cutover validation of material risk 4.

Fix: persist bound cutover intent before staging, then resume its import and switch phases from the same original path. Preserve inventory/config checks and exact replay. Exercise loss during staging and the data-commit/pre-main-journal window. Full actionable detail is in `iterate-phase-7-recovery-provenance-rereview.md`, Issue 1.

### R2. Branch export drops the authority needed for mapped publication — in-plan

`skills/_shared/storage/migration.ts:150-166,175-182` removes other-branch revision/pointer records and validates only receipt/checkpoint/correction revision dependencies. The private publication ledger (`publication.ts:90-105`) uses `branchId: publication-authority`, so branch export drops its rewrite attestation even for an included checkpoint. Import succeeds, but reconciliation against the same integration ref no longer publishes the artifact. No source Git history changed. This violates scoped provenance-preserving migration (criterion 1 and the phase context requiring retained publication status); it also contradicts the documented refusal of incomplete provenance subsets.

Fix: retain only correctly scoped required authority, or refuse the incomplete branch export and require project export. Never include unrelated private ledger entries as a shortcut. Full detail is in the iteration artifact, Issue 2.

## Findings — Standards Axis

No additional independent finding. Separate pass used `code-review-universal/reference/typescript.md` (unknown narrowing, async/error/resource handling), `reference/code-quality-universal.md` (abstraction boundaries, TOCTOU, redundant state), and diff-scoped `code-smells/docs/{duplicate-code,inappropriate-intimacy,primitive-obsession}.md`.

Checks covered bound context versus caller-supplied scope, migration-table identifier allowlisting, parameterized SQL values, read-only source opening, private-output permissions, source/body separation from diagnostics, transaction/generation publication, and canonical/bundle parity. Required release-bundle duplication is a repository convention, not a smell. Generic row casts and mutable journals warrant checking, but no additional consumer-visible failure was established; they are not promoted into findings. Acceptance failures above remain on their own axis.

## Completion Matrix

| Deliverable | Status | Direct evidence / missing piece |
|---|---|---|
| 1. Scoped exact IDs/bytes/history/links/corrections/ranks/lifecycle provenance | 🔄 partial | File→SQLite→file test preserves historical/current revisions, links, correction replay, receipt duties and complete inventories (`storage-cutover.test.ts:26-54`). Legacy ranks/successor metadata survive restart (`122-137`). Branch selection drops required rewrite-publication authority; R2. |
| 2. A-5 explicit legacy quarantine, no guessing/deletion | ✅ complete | `migration.ts:110-125,185-205`; restart/quarantine regressions at `storage-cutover.test.ts:112-137,151-162` pass. Mapped legacy originals and original pointers remain in recovery provenance; ordinary pointers are removed. |
| 3. Full dry-run, source verification, read-only source, atomic configuration switch | ✅ complete | `cutover.ts:18-24,85-135`; full bidirectional metadata diff test passes. Actual CLI external-files→SQLite reports empty before/three after rows, switched status, and readable original revision. Source export avoids discovery/reconciliation; SQL read-only opening/transactions inspected. Preparation recovery is separately incomplete in row 4. |
| 4. Interrupted import/cutover resumes by recorded cursor, no duplicates/partial visibility | 🔄 partial | Import reopen/exact-replay regression passes (`storage-cutover.test.ts:56-71`); config-written interruption test passes (`88-109`). Real CLI SIGKILL before main-journal creation leaves cursor 0 staging with no visible destination rows, but documented resume exits 1; R1. |
| 5. Rescue post-cutover writes before rollback to verified source | ✅ complete | Actual CLI correction `before→after`, rollback, consumer rebind, source read `before`, and private rescue containing both revisions plus correction ancestry. Regression re-imports the rescue and checks lineage (`storage-cutover.test.ts:88-109`). |
| 6. Remove obsolete normal transfer protocol; real legacy-env doctor without adoption | ✅ complete | Repository search finds no `exportArtifacts`/`importArtifacts`/`mapMemoryImport` implementation or caller. Actual subject-free doctor reports adapter external-files, legacy found, `adopt:false` with synthetic SQL_MEMORY_URL. Config-driven callers and receipt requirements remain. |
| 7. Credential-safe config/output and private-state exclusions | ✅ complete | Actual CLI stdout excludes synthetic URL credential; rescue mode is 0600. Outputs contain counts/digests, not payloads (`storage-migration-cli.ts:35-55,66-84`), and failures emit a fixed safe message (`workflow-state-cli.ts:59-61`). Config requires env references. `docs/sql-memory.md:61-69` documents generated private state and dotfile/Git exclusions. |
| Blocking assumptions assigned to this phase | ✅ complete | Parent ledger has no unresolved blocking assumption. A-5 is validated as a retained legacy-data hazard; current quarantine tests cover its implementation. |
| Material risk 4 rollback/fallback | 🔄 partial | Post-switch rescue/rollback works; import preparation interruption has no working documented resume route, R1. R2 also changes retained publication semantics. |
| Material risk 6 credential safety | ✅ complete | Fixed diagnostic output, private payload files, strict env-reference config, and synthetic credential smoke; no credential rotation claim or dotfile-manager changes. |
| Deterministic contract | ✅ complete | Fresh `npm run guardrails:check` emits durable v2 pass; detailed gates below. |

## Verification Evidence

### Focused regression command

`npx vitest run skills/_shared/scripts/storage-cutover.test.ts`:

```text
Test Files  1 passed (1)
     Tests  9 passed (9)
```

### Interrupted real CLI cutover

Isolated Git/config home, real SQLite source with 500 revisions, real CLI `migration-cutover`, SIGKILL on first atomic import journal replacement, then real CLI `migration-resume`:

```json
{"interrupted":{"code":null,"signal":"SIGKILL"},"journalExists":false,"importCursor":0,"stagedStatus":"staging","resumeExit":1,"resumeStdout":"","destinationVisible":0}
```

Resume stderr: `Migration refused; inspect private configuration, inventory, and journal. No credential-bearing diagnostic is emitted.` The failure is reproducible without outages, bad config, concurrent writers, or altered snapshots.

### Scoped publication smoke

Real feature commit, independent reachable integration commit, sealed/bound exact checkpoint, valid rewrite attestation, real SQLite snapshot selection/import, then reconciliation of both stores against the same integration ref:

```json
{"projectRecords":2,"branchRecords":1,"publishedBefore":["dbcb9a6c-214f-49e6-af8e-6148019b69d8"],"publishedAfter":[],"expectedRevision":"dbcb9a6c-214f-49e6-af8e-6148019b69d8"}
```

The scoped test exercised the same `selectSnapshot` function dispatched by actual branch export (`storage-migration-cli.ts:40`). It did not manufacture or edit snapshot rows.

### Actual operator happy path

Real CLI doctor/export/dry-run/cutover/resume/rollback; a real bound consumer writes a correction after switching:

```json
{
  "switched": "switched",
  "readAfter": "before",
  "resumed": "switched",
  "rolled": "rolled-back",
  "restored": "before",
  "rescueRevisions": ["before", "after"],
  "rescueCorrection": [["before", "after"]],
  "privateMode": "600",
  "stdoutContainsSecret": false
}
```

Limits: this independent review did not run PostgreSQL integration against a disposable server, reinstall the package, or exercise an OMP TUI session. The previous implementation notes describe PostgreSQL TEMP-table proof; that historical note is not claimed as a new run. This assignment changes no implementation, so no mutation test or additional permanent test was introduced. Throwaway scripts/fixtures were removed after collecting output.

## Review Axes

- Spec axis worst finding: **R2**, successful scoped migration changes the published view by dropping the exact rewrite authority. R1 independently blocks interruption recovery.
- Standards axis worst finding: **none independently established**, sequential fallback pass.
- Cross-axis ranking: **none**. Findings are not merged or reranked across axes.

## Verification Status / User Goal Analysis

- Goal achieved: **partial**. Operational full-project migration and rescue are real, not helper-only scaffolding; two scoped-provenance/restart cases remain incorrect.
- User goal: **partially met**. Adapter choice and ordinary isolation are implemented; reliable existing-data resume and unchanged mapped-publication semantics are not complete for all supported paths.
- Scope adhered: yes for reviewed implementation. Out-of-scope changes: none identified; unrelated pre-existing artifact/index changes preserved.
- Goal mode: current-session projection has no non-null goal field; it points at older work and does not override this explicit phase target.

## Guardrails Verdict

- Command: `npm run guardrails:check`.
- Contract: **durable**, version **2**, runner **1.0.0**.
- Status: **pass**.
- Gates: `unit_test_gate=pass`, `functional_test_gate=skipped`, `lint_gate=skipped`, `patch_gate=advisory`, `global_ratchet=pass`, `complexity_gate=pass`.
- Coverage: **88%**, baseline **84%**, target **90%**. Patch measurement null under advisory enforcement.
- Complexity: **29** retained hotspots versus baseline **30**; no new or hard-ceiling violations.
- Functional/lint disabled by the existing contract. Proposed ratchet updates were not applied. Passing deterministic gates do not override reproduced acceptance failures.

## Documentation Impact

No additional living-documentation gap beyond correction of the two in-plan behavior claims. The current change already adds the migration narrative, privacy exclusions and operator procedures. R1/R2 fixes must keep the existing resume/provenance text accurate; no separate documentation-only blocker or iteration finding is added.

## How-to Impact

No additional missing action guide: export/import/quarantine/switch/resume/rollback have dedicated how-tos. Resume must be made truthful for the preparation window as part of R1. No separate `/b-docs` or `/b-howto` action is needed from this review.

## Issue Classification

- In-plan implementation defects: **2**, R1 and R2 → `/b-iterate`.
- Out-of-plan discoveries: **none**.
- Historical memory index contains no Phase 7 closeout; supervisor recall covers earlier phases. Defer `/b-save`/commit until this phase is accepted; no SQL call or memory-body write was made during review.

## Completion Audit

1. Objective: preserve scoped durable data/provenance, quarantine ambiguous legacy records, switch verified backends, resume interruption, rescue before rollback, and keep credentials private.
2. Each deliverable maps to source and current output in the matrix.
3. Current implementation inspected and authoritative deterministic runner executed.
4. CLI claims exercised on actual CLI; publication semantics exercised with real Git and SQLite, not a mock echo.
5. Uncertainty is explicit: PostgreSQL/install/TUI not newly exercised; reproduced R1/R2 are not treated as achieved.
6. Both review axes completed using the permitted sequential fallback. No phase/lifecycle/loop transition was selected.

## Recommended Next Step

Supervisor: run `/b-iterate` on `iterate-phase-7-recovery-provenance-rereview.md`, then re-review this exact phase. Review deliverables are the report and iteration artifact only. Implementation, existing index entries, phase metadata and prior review artifacts remain untouched. Save/commit follows acceptance; the supervisor retains all loop-state authority.
