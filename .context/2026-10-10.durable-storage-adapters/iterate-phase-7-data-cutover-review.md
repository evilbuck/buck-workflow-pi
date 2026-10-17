---
status: completed
date: 2026-10-16
updated: 2026-10-16
subject: 2026-10-10.durable-storage-adapters
topics: [review, iteration, data-cutover]
informs: []
addresses: phase-7-data-cutover.md
completed: 2026-10-16
from_review: b-review
---

# Iteration: Phase 7 existing-data cutover

## Source
- Reviewed after: `/b-build-hard`.
- Phase: `phase-7-data-cutover.md`.
- Plan: `plan-durable-storage-adapters.md`, step 7, A-5, material risks 4 and 6.
- Baseline: `2adebce09a54e37677adcd4da8023947c4e75d8b` plus the staged/unstaged implementation present at review start. Earlier phase commits are supporting source context, not newly reviewed scope.
- Scope: Phase 7 only. Its completed status and checked criteria are not implementation proof.

## Critical Issues

### 1. Preserve history and domain metadata through a read-only migration snapshot
- **File**: `skills/_shared/storage/cutover.ts:1-49`
- **Problem**: Criterion 1 is not implemented by these array helpers. The only round-trip test calls existing `exportArtifacts`/`importArtifacts` directly. All three store implementations export `list()` and import `writeBatch()` (`file-store.ts:326-333`, `sqlite-store.ts:309-316`, `postgres-store.ts:262-269`). That exports the ordinary current view, not retained revision history. File selection explicitly drops non-current revisions of the selected branch (`file-store.ts:215-222`). `ArtifactRevision` has no receipt, correction-idempotency, checkpoint/publication, or legacy rank/category import-provenance envelope (`contract.ts:21-31`); legacy metadata is separately stored in PostgreSQL (`postgres-store.ts:272-281,316-349`). Those side records are not moved by the existing round trip. File export also calls the normal list path, which can reconcile editable bodies and write a new revision (`file-store.ts:142-148,105-129`), so the source is not guaranteed read-only. A backend switch can therefore lose old versions, correction semantics, receipt/checkpoint evidence, and ranks despite successfully copying one current artifact.
- **Proposed fix**: Implement a scoped, versioned migration snapshot/export/import route retaining exact revisions, bytes, hashes, links, pointers, correction/idempotency records, lifecycle/save provenance, importer metadata, and publication evidence. Use a read-only consistent source snapshot rather than ordinary discovery/reconciliation. Connect legacy memory mapping to this route across the selected adapters. Verify historical versions and domain behavior after import, not only one current body/hash/link.


- **Jev failure**: Jev failed: missing, unreadable, or oversized file skills/_shared/storage/cutover.ts:1-49. Re-review this finding with Jev.

### 2. Quarantine ambiguous legacy data durably using actual provenance evidence
- **File**: `skills/_shared/storage/cutover.ts:19-28`
- **Problem**: Criterion 2 and A-5 are not enforced. `hasExactProvenance` checks only nonempty project/branch/revision and hash shape; no checkpoint, merge proof, or hash/bytes validation is consulted. Direct execution accepts `{key:{projectId:'p',branchId:'b'},revision:'r',sha256:'a'.repeat(64)}` despite having no checkpoint evidence or even payload bytes. `splitLegacy` only returns two in-memory arrays, has no production caller, and does not retain an explicit recovery/import scope. It cannot preserve quarantined records across restart or prevent an importer from inserting ambiguous records into ordinary branch retrieval.
- **Proposed fix**: Persist the original legacy records and all available metadata in an explicit private recovery/import scope with an import manifest. Validate identity/hash evidence without synthesizing branch/publication proof; retain ambiguous provenance privately until explicit verified mapping. Integrate this decision into the actual importer. Exercise named-branch legacy records lacking exact checkpoint evidence as well as entirely missing branch data; verify ordinary retrieval excludes quarantine after restart.


- **Jev failure**: Jev failed: missing, unreadable, or oversized file skills/_shared/storage/cutover.ts:19-28. Re-review this finding with Jev.

### 3. Produce a full before/after verification report
- **File**: `skills/_shared/storage/cutover.ts:31-42`
- **Problem**: Criterion 3 requires the full before/after record set. `dryRun` iterates only source revisions and maps destination to revision/hash, dropping destination-only records and ignoring scope, links, provenance, and side metadata. Direct execution of `dryRun([], [{revision:'destination-only',sha256:'different'}])` returns `{added:[],changed:[],unchanged:[]}`. Thus an unexpected destination record is invisible to the report; equal payload hashes can also hide metadata differences.
- **Proposed fix**: Compare complete scoped snapshot inventories in both directions, including destination-only records and exact identity/metadata differences. Carry the verified inventories/digests into cutover so concurrent changes invalidate the authorization to switch. Exercise destination-only rows and equal-byte/different-link or provenance cases.


- **Jev failure**: Jev failed: missing, unreadable, or oversized file skills/_shared/storage/cutover.ts:31-42. Re-review this finding with Jev.

### 4. Commit import progress durably with imported data and final visibility
- **File**: `skills/_shared/storage/cutover.ts:45-49`
- **Problem**: Criterion 4 is not implemented. `nextImportBatch` marks selected revisions imported before any write occurs, accepts an unbound in-memory cursor, and has no persistence, transaction, staging visibility, or production caller. Direct execution returns `importedRevisions:['r']` without opening any store. Existing imports buffer all revisions and invoke ordinary `writeBatch`; there is no cutover cursor/resume path. The test merely passes a returned object into the next helper call; it never interrupts a process, reopens a store, or tests partial visibility. Persisting this returned cursor before a failed batch would skip unwritten data; persisting it afterward leaves a crash window requiring safe replay, while file writes reject existing immutable revisions (`file-store.ts:343-349`).
- **Proposed fix**: Retain a migration attempt bound to source snapshot/destination/scope, advance its cursor only with verified durable batch commit, make replay idempotent, and keep incomplete imports outside ordinary visibility until final verification. Add a real interruption/reopen fixture on both sides of the data/cursor commit boundary, proving no duplicate or skipped revisions and no partial visible cutover.


- **Jev failure**: Jev failed: missing, unreadable, or oversized file skills/_shared/storage/cutover.ts:45-49. Re-review this finding with Jev.

### 5. Implement an actual atomic backend switch and executable rollback
- **File**: `skills/_shared/storage/cutover.ts:63-65`
- **Problem**: Criteria 3 and 5 and material-risk-4 recovery are missing. `rollbackPlan` only returns two string arrays and `deleteSource:false`; it does not export destination-only revisions, retain a rescue, verify/restore a source snapshot, switch config, or rebind pinned runs. The module has no storage/config I/O and is not imported by production code. The CLI has SQL schema migration and prior-phase recovery operations, but no backend cutover/rollback dispatch (`workflow-state-cli.ts:40-78`, `workflow-state.ts:29-45`). Existing consumers explicitly refuse a changed configured destination (`workflow-state.ts:333-349`), so manual config editing is not a verified migration route. Neither a crash between config write and verification nor a post-cutover rescue/rollback is exercised by the three tests.
- **Proposed fix**: Implement the operator cutover transaction/journal: verify a read-only source snapshot and destination inventory, atomically change project config with concurrency protection, and validate/rebind the intended persisted run context. Recover interruption around the config switch. Before rollback, use the same snapshot export/import route to retain destination-only writes and correction ancestry durably, then restore the verified source/config without deletion or dual-write fallback. Prove new destination writes remain recoverable after rollback and do not duplicate/supersede unrelated scope state.


- **Jev failure**: Jev failed: missing, unreadable, or oversized file skills/_shared/storage/cutover.ts:63-65. Re-review this finding with Jev.

### 6. Expose legacy diagnosis and finish the caller-based protocol cutover
- **File**: `skills/_shared/storage/cutover.ts:52-60`
- **Problem**: Criterion 6 is not delivered by isolated predicates. `doctorLegacySql` and `callersRemain` have no production callers; the former cannot be invoked as the CLI doctor. Running `bun skills/_shared/scripts/workflow-state-cli.ts doctor` exits 1 with `doctor requires --subject`, rather than diagnosing the legacy setting. `callersRemain(paths)` merely tests array length; no audit/removal is connected to it. This diff only adds the helper module, its bundle copy, a test, and completion metadata; it does not migrate/remove any remaining normal protocol or expose the promised diagnostic.
- **Proposed fix**: Add an explicit operator diagnostic using the authoritative configuration resolver and safe legacy-env inspection, reporting the actual migration path without adopting the env as backend selection. Audit remaining normal storage branches against migrated callers, retain only explicit administration, and remove genuinely obsolete branches after that audit. Verify the actual command under set/unset legacy env and explicit per-project adapter selection. Do not remove an active receipt requirement merely because its name contains SQL.


- **Jev failure**: Jev failed: missing, unreadable, or oversized file skills/_shared/storage/cutover.ts:52-60. Re-review this finding with Jev.

### 7. Enforce credential-safe output instead of an unused regex helper
- **File**: `skills/_shared/storage/cutover.ts:13-16`
- **Problem**: Criterion 7's output safety is not established. `redactSecrets` is only called by its unit test and the regex misses ordinary JSON metadata: direct execution of `redactSecrets(JSON.stringify({password:'cutover-fixture-secret'}))` returns the credential unchanged. The test checks only unquoted `password: hunter2`, not the actual config/doctor/export output surfaces. A future caller using this helper for serialized metadata would leak the value; there is currently no integrated safe cutover output path.
- **Proposed fix**: Keep connection credentials out of migration/config metadata by construction (store env references only), and use an existing safe redaction policy or structured sanitization at actual diagnostic/export metadata boundaries. Preserve artifact payload bytes/hashes rather than blindly redacting stored content. Exercise real config/doctor/export output with synthetic JSON/YAML/URL credential values and assert they are absent. Document generated private-state exclusions separately through the documentation workflow.


- **Jev failure**: Jev failed: missing, unreadable, or oversized file skills/_shared/storage/cutover.ts:13-16. Re-review this finding with Jev.

## Review Axes

- **Spec axis worst finding:** Issue 5 — no executable backend switch/rollback; Phase 7's central deliverable and declared recovery route are absent. Issues 1–6 are independently in-plan acceptance failures.
- **Standards axis worst finding:** Issue 7 — credential redaction misses serialized metadata. Separate sequential fallback pass; no task/sub-agent tool is available in this harness.
- Standards seed: `code-review-universal/reference/typescript.md` and `reference/code-quality-universal.md`; diff-scoped `code-smells/docs/{dead-code,primitive-obsession,comments}.md`.
- Additional standards evidence: the new production module has no production imports; cursor/rollback comments describe durable effects that their pure implementations do not enforce. Raw revision-ID arrays omit source/destination/scope binding. These support Issues 2/4/5/6 rather than new unrelated refactoring requests. Canonical/bundle duplication is the required packaging convention, not a smell finding.
- **Cross-axis ranking:** none. Findings stay attributed to their axis; shared evidence is not a merged ranking.

## Completion Matrix

| Deliverable | Status | Current-state evidence / missing part |
|---|---|---|
| 1. Scoped byte-exact export/import with IDs/history/links/corrections/ranks/lifecycle provenance | partial | Existing file round-trip passes for one current body/hash/link (`storage-cutover.test.ts:20-35`); historical revisions and domain side records are not exported, and source list may write. Issue 1. |
| 2. A-5 explicit legacy quarantine, no guessed publication/deletion | missing | Array split checks string presence/hash shape only; no durable recovery/import scope. Issue 2. |
| 3. Full dry-run, verified atomic config switch, read-only source | missing | Destination-only smoke is omitted; no config-switch implementation; source may reconcile edits. Issues 1/3/5. |
| 4. Interrupted import resumes with cursor, no duplicates/partial visibility | missing | Only in-memory batch selection is tested; no persisted migration attempt or restart fixture. Issue 4. |
| 5. Post-cutover write rescue and verified rollback | missing | ID-set subtraction is not rescue/restore; no operational rollback or crash fixture. Issue 5. |
| 6. Caller migration/protocol removal and legacy doctor | partial | Backend selection is already config-driven; new helpers are uncalled and actual doctor command fails. Issue 6. |
| 7. Credential-safe config/export, private-state exclusions | partial | Existing config forbids embedded connection strings (`docs/context-artifacts.md:128-139`); output sanitizer leaks JSON and is not integrated. Private-state/dotfile exclusion documentation still needs synchronization. Issue 7; documentation follow-up is non-blocking. |
| Blocking assumptions assigned to Phase 7 | complete | No unresolved blocking assumption in the parent ledger; A-5 is an accepted legacy-data hazard, not evidence that its quarantine implementation works. |
| Material risk 4 rollback/fallback | missing | Mandatory interruption/config-crash/post-write rollback fixtures absent; string-array return is not recovery evidence. Issues 4/5. |
| Material risk 6 credential safety | partial | Strict config precedent exists; migration diagnostic/export boundary not implemented or verified. Issue 7. |
| Deterministic verification | complete | Fresh `npm run guardrails:check` returns durable v2 `pass`: required unit, global-ratchet, and complexity gates pass. Coverage 88% vs 84% baseline; patch advisory; functional/lint skipped. This does not supply missing migration scenarios. |

## Verification Evidence

- `npx vitest run skills/_shared/scripts/storage-cutover.test.ts`: **1 file, 3 tests passed**. This proves the narrow file round-trip/helper assertions, not all seven phase criteria.
- Direct Bun helper smoke returned:

```json
{"destinationOnly":{"added":[],"changed":[],"unchanged":[]},"jsonSecret":"{\"password\":\"cutover-fixture-secret\"}","provenanceWithoutCheckpoint":true,"cursorBeforeAnyWrite":{"importedRevisions":["r"]}}
```

- A second direct smoke using a full valid legacy artifact and a same-byte/different-link destination returned:

```json
{"validLegacyWithoutMergeEvidence":["legacy-id"],"changedLinks":{"added":[],"changed":[],"unchanged":["legacy-id"]}}
```

- Actual operator command `bun skills/_shared/scripts/workflow-state-cli.ts doctor`: **exit 1**, `doctor requires --subject`.
- Production-reference search over `skills`, `extensions`, `hooks`, and `scripts`: new cutover helpers are referenced only in their module and `storage-cutover.test.ts`.
- No review source edits or permanent tests were made. Existing staged and unstaged implementation files were preserved.

## Guardrails Verdict

- Command: `npm run guardrails:check` — **pass**, durable contract version 2, runner version 1.0.0.
- Gates: `unit_test_gate=pass`, `functional_test_gate=skipped`, `lint_gate=skipped`, `patch_gate=advisory`, `global_ratchet=pass`, `complexity_gate=pass`.
- Coverage: **88%**, baseline **84%**, target **90%**; patch measurement `null`, advisory enforcement.
- Complexity: 29 retained hotspots against baseline size 30; no new or hard-ceiling violations.
- Runner proposes a coverage-baseline raise and complexity-inventory shrink; neither was applied. No code, contract, or baseline was modified by this review.

## Documentation and How-to Impact

- Non-blocking documentation impact: migration snapshot/provenance schema, legacy quarantine, verified backend switch, recovery, and private generated-state/dotfile exclusions need living documentation after implementation is real. `docs/sql-memory.md` was named in phase scope but not changed by this implementation.
- Non-blocking how-to impact: operators need configure/doctor/export/import/cutover/resume/rollback procedures with observable success checks once those commands exist.
- Recommended documentation route: `/b-docs` first, following `/b-howto` where applicable. These signals are not additional correctness findings.

## Verdict and Routing

**Needs work.** Seven in-plan implementation issues; no out-of-plan findings. Inherited user goal is only partially met by earlier adapter selection/isolation; safe migration of existing data is not delivered. No out-of-scope implementation changes were observed in the reviewed delta. The legacy memory ledger does not record Phase 7 closeout; supervisor-provided SQL recall covers earlier phases only.

## Recommended Workflow

Start with `/b-iterate` against this artifact and the exact Phase 7 acceptance contract. Implement the operational migration/recovery path, not additional predicates standing in for it, then re-run `/b-review` against `phase-7-data-cutover.md`. Complete this iteration artifact only after the fixes and real interruption/rollback verification succeed. The supervisor owns loop state; this review does not advance it or alter phase/lifecycle status.

## Applied iteration — 2026-10-16

All seven assigned findings are addressed; original review evidence above remains historical.

| Finding | Applied behavior and proof |
|---|---|
| 1. Lossless retained history/domain migration | Version-1 complete project snapshots on all four adapters; exact bytes/hash/link/pointer/history/side-record inventories. File→SQLite→file regression exercises correction replay and receipt duties; real PostgreSQL TEMP-table round-trip digest matches. |
| 2. Actual legacy quarantine | Original legacy JSON and previously guessed `memory-import` rows retain original metadata, ranks, successor links and original revision/pointers privately, without ordinary pointers. Restart tests and actual CLI imports confirm exclusion. No branch name is promoted to proof. |
| 3. Complete dry-run | Full before/after table-row digest inventories and both set differences include destination-only rows and metadata-only changes. Source/destination digests bind switch authorization. |
| 4. Durable restart/no partial visibility | Cursor plus staged records share one atomic fsynced journal replacement. Final publication is one adapter transaction/generation. Real workers exited mid-batch and received SIGKILL after data commit; resume retained every revision without duplicates. Premature-visibility mutation makes the regression fail. |
| 5. Executable switch/rollback | Maintenance-window CLI verifies source/config/destination, atomically replaces project config, rebinds matching consumers, and resumes after SIGKILL following config replacement. Rollback durably rescues post-switch correction ancestry and restores the unchanged source/config. Rescue re-imported through both helper and actual CLI routes. |
| 6. Real doctor/caller cutover | Subject-free doctor runs under set/unset legacy env and explicit project selection without adoption. Obsolete current-view export/import methods and the unused helper protocol are removed; native/importer/turn-memory callers remain config-driven. Required receipts and explicit schema administration are retained. |
| 7. Credential-safe boundaries | No payload/config connection values on migration stdout; private exact snapshots are not regex-redacted. Actual JSON/YAML/URL fixture secrets stay absent from CLI stdout. Private-state exclusions and six operator guides document the boundary. |

Verification: nine focused regressions; all nine operator command surfaces exercised;
seven extracted shell fences syntax-checked and live-run; 12 shipped mirrors byte-equal;
22 shipped dependencies present. Final `npm run guardrails:check`: **pass**, durable v2,
unit/global-ratchet/complexity pass, coverage **88%** vs **84%** baseline, no new/hard
complexity violations; lint/functional disabled, patch advisory. No baselines changed.
Optional standalone TypeScript probe still reports the existing missing `pg`
declarations (`TS7016`); no TypeScript pass is claimed.

Cutover is explicitly offline maintenance: all project writers across worktrees must
remain stopped (`quiesced: true`) through switch/recovery/rollback. Sources and
destinations are never deleted. Detailed evidence and changed-file inventory:
`implementation-notes-phase-7.md`. Supervisor owns re-review against
`phase-7-data-cutover.md`, save, commit, lifecycle and loop routing.
