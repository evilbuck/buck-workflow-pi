---
status: completed
date: 2026-10-12
updated: 2026-10-12
subject: 2026-10-10.durable-storage-adapters
topics: [review, iteration, storage-consumers]
informs: []
addresses: phase-5-remaining-consumers.md
completed: null
from_review: b-review
related: [iterate-phase-5-remaining-consumers.md, review-phase-5-remaining-consumers-rereview-2026-10-12.md]
---

# Iteration: Phase 5 remaining consumers — rereview

## Source
- Reviewed after: `/b-build` and partial prior repair.
- Phase: `phase-5-remaining-consumers.md`; parent step 5 in `plan-durable-storage-adapters.md`.
- Full completion matrix, independent axes and fresh checks: `review-phase-5-remaining-consumers-rereview-2026-10-12.md`.
- Baseline: current uncommitted implementation against `202ca5d`.
- This artifact carries the current obligations from the earlier iteration; R IDs are stable. R9's legacy-URL gate is now repaired, so do not reimplement or re-pin that defect. The nine High findings remain. No out-of-plan or documentation-only work is included here.

## Critical Issues

### 1. Use trusted identity and one pinned store/run
- **File**: `skills/_shared/storage/consumers.ts:135-146,190-213`; `extensions/buck-loop/persist.ts:137-199`; migrated consumers and bundle.
- **Problem**: placeholder project/branch IDs, physical-path worktree IDs, per-write random runs, omitted project origin/override/external root and separate resume identity prevent real retrieval and isolation.
- **Proposed fix**: reuse `withConfiguredStore`/trusted context and existing identity/reference helpers with actual repository cwd. Bind and pin backend/project/branch/worktree/run once per run; retain stable retrievable run identity. Remove alternate identity/store-opening convention.
- **Verification**: actual production writers/readers in two projects and two real worktrees with same logical names on required adapters; exact ID/revision lookup; no collisions; explicit configured root/project override honored; mismatched mid-run config refused.

### 2. Observe authoritative persistence failures before completion
- **File**: `consumers.ts:153-159,186-188`; review loop `326-328,732-738`; loop activity/audit/ranking; attribution/import terminal paths.
- **Problem**: queue tail resolves rejection; changed promise-returning calls are discarded; completion/exit can precede retention.
- **Proposed fix**: separate queue continuation from pending failure evidence, await persistence at operation/terminal/shutdown boundaries and migrate every changed callsite. Resolve/pin context at enqueue/run start rather than deferred execution.
- **Verification**: fault actual consumer boundary; no success/terminal notification after failure, no write lost to process exit, drain rejects unacknowledged failure and later success does not erase it.

### 3. Migrate durable reader/resume/cursor/dedupe authority
- **File**: `extensions/buck-loop/{persist,scan}.ts`; `extensions/code-review-iteration/{run-state,loop}.ts`; importer manifest loading; attribution `db.ts:123-145`.
- **Problem**: retained adapter copies are mirrors. Readers/list/resume still require old files; attribution dedupe in its former Buck table can prevent retrying failed retention.
- **Proposed fix**: route authoritative writes and reads through the service under exact persisted context. Optional local projections must not select fallback authority. Preserve artifact-over-bookmark reconciliation, immutable evidence, fail-closed outages and host ownership. Ordinary same-checkout restart is not deferred to later recovery phases.
- **Verification**: restart after removing optional local projections; exact state/pass/cursor/dedupe readback on every adapter; simultaneous real worktrees; stale bookmark reconciliation; failed retain followed by retry must recover the missing row.

### 4. One authoritative completed save attempt
- **File**: `extensions/buck-loop/sql-save.ts:82-87,123-124,138-164,218-233,287-297`; `skills/b-save-improved/scripts/save-apply.ts:641` and save wrapper.
- **Problem**: local receipt written before durable receipt; retry returns local IDs without repairing missing durable receipt; completion/verify do not validate authoritative attempt/status/duties. SQL-mode metadata bypasses adapter sealing.
- **Proposed fix**: bind facts and all metadata duties to one selected-store attempt; read/repair/complete/verify the authoritative receipt. Preserve rows/no-fact semantics and exact project/branch/worktree/run binding. Local completed JSON must never authorize save/commit.
- **Verification**: injected outage/crash around facts/receipt/metadata boundaries for both entrypoints, rows and no-fact; absent/incomplete/mismatched durable receipt cannot verify even when local receipt says completed.

### 5. Update existing logical artifact rather than creating another
- **File**: `consumers.ts:173-183`; `save-apply.ts:600-619`; review/ranking conversions; canonical/bundle.
- **Problem**: native subject-relative name differs from prefixed physical-name seal; expected revisions/typed links and move semantics omitted.
- **Proposed fix**: use existing logical reference conversion and exact conditional writes, retaining links, corrections/tombstones and moves. Remove duplicate identity paths rather than introduce aliases.
- **Verification**: create via native surface, change through save, read the same token/logical artifact via native/lifecycle/site; exactly one current artifact, links intact, stale updates refused.

### 6. Prevent private memory export into unscoped host LTM
- **File**: `skills/b-memory-import/scripts/import-context-memory.ts:758-775,819-829`.
- **Problem**: raw filesystem source enters retain payloads without selected-adapter/publication eligibility; retained manifest cannot prevent body leakage.
- **Proposed fix**: source adapter revisions and mirror only publication-proven knowledge into an unscoped host LTM. Quarantine ambiguous legacy records. Do not infer publication from status/creation HEAD or change host ownership.
- **Verification**: actual local HTTP payload excludes private revision, includes explicit eligible published revision; manifests/dedupe survive selected-adapter restart; no external production LTM data used.

### 7. Connect actual site through configured reader seam
- **File**: all three `docs/plans/src/pages/` entrypoints; `docs/plans/src/lib/plans/sql.ts`.
- **Problem**: pages instantiate FilesystemPlanSource directly; new source only lists plan kind, loses subject status and assumes site-process cwd is the workflow checkout.
- **Proposed fix**: route pages through configured source factory/seam, resolve intended checkout, preserve phase/spec/research/index/document/link/status/preview behavior and visibility before body loading. No UI redesign or database-to-files fallback.
- **Verification**: provide declared Astro runtime; build and exercise actual adapter-only plan/phase/spec/research/index site content and links/statuses, plus private-branch negative case. Missing runtime is a verification blocker, not permission to claim rendered completion.

### 8. Preserve presentation positional argument when --cwd is absent
- **File**: `skills/b-present/scripts/retain-package.ts:17-23`; bundled script/instruction.
- **Problem**: `cwdFlag=-1` makes the finder reject positional index zero.
- **Proposed fix**: exclude flag/value only when present; preserve default cwd and portable installed-skill resolution.
- **Verification**: exact documented invocation, explicit --cwd, invalid/missing value; exact binary/text readback and receipt from selected store.

### 10. Finish original census, including phase updates and blueprint retention
- **File**: `extensions/buck-loop/phase-completion.ts:88-123`; `skills/b-blueprint/SKILL.md:51-58,197-203`; persistence inventory and original evidence families.
- **Problem**: phase/overview writes are file-only despite retention claim; blueprint package lacks retention; durable auto-fix/review/PR evidence reclassified transient/user-owned without concrete evidence.
- **Proposed fix**: migrate still-owned writer/reader pairs and packages; reconcile every original census row with actual behavior and valid ownership exclusions. Optional projections cannot become hidden canonical authorities; do not narrow accepted scope via notes.
- **Verification**: exact retained revision after real phase/overview update and standalone blueprint generation; each census row maps to concrete migration or demonstrable host/user/process-lifetime exclusion.

## Warnings

### 9. Complete turn-memory cleanup after repaired gate
- **File**: `hooks/post/turn-memory.ts:93-103`; `extensions/turn-memory/__tests__/hook.test.ts:118-133`.
- **Problem**: obsolete cached SQL pool/getter/reset functions have no production callers, only implementation-only tests. Gate repair is proven; full default hook persistence/dedupe across adapters is not.
- **Suggested approach**: remove obsolete pool API and its incidental tests; verify actual default hook adapter write and branch/run dedupe without legacy URL unless explicitly configured as connection ENV. Preserve user opt-out and host session ownership.
- **Current evidence**: explicit enable/opt-out runtime smoke with no SQL_MEMORY_URL passed; 12 tests passed in enable/hook suites. This is not full adapter persistence proof.

## Fresh Verification
- `npm run guardrails:check`: durable v2 pass, coverage 88.7 / baseline 84; unit/global ratchet/complexity pass; functional/lint skipped; patch advisory; no new complexity violation.
- `env -u SQL_MEMORY_URL npx vitest run extensions/turn-memory/__tests__/enable.test.ts extensions/turn-memory/__tests__/hook.test.ts`: 2 files / 12 tests passed.
- Direct enablement/status smoke: legacyUrlPresent false, enabled true, status turn-memory on, optedOut true.
- Earlier concrete failure observations remain recorded in the original review; not falsely attributed to this run or rerun merely to confirm them.

## Recommended Workflow
Start with `/b-iterate` against Phase 5, then `/b-review` against `phase-5-remaining-consumers.md`. Complete this artifact and reconcile its earlier active iteration only after the repairs are implemented and verified; a review cannot mark implementation defects resolved.

Inside an OMP execution session the implementing `/b-iterate` must close the addressed iteration before returning, not leave it active waiting for review/save. Supervisor owns subsequent routing and loop state. Documentation/how-to follow-up is separate and non-blocking after correctness repair.
