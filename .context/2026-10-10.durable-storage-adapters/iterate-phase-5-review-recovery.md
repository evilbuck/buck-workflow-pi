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
related: [review-phase-5-recovery-2026-10-12.md, iterate-phase-5-remaining-consumers-rereview.md]
---

# Iteration: Phase 5 — recovery review

## Source
- Reviewed after `/b-build` and partial prior repairs.
- Exact phase: `phase-5-remaining-consumers.md`; parent: `plan-durable-storage-adapters.md`, step 5.
- Baseline: current working tree against `202ca5d`.
- Report: `review-phase-5-recovery-2026-10-12.md` contains completion matrix, separate standards axis and fresh verification.
- R IDs preserve earlier review traceability. This records only in-plan defects; no later-phase scope or documentation-only work is included.

## Critical Issues

### 1. Bind trusted identity and pin one destination/run
- **File**: `skills/_shared/storage/consumers.ts:135-146,190-213`; `extensions/buck-loop/persist.ts:137-199`; all retained consumers and bundle.
- **Problem**: placeholder project/branch scope, physical-path worktree IDs, per-write random runs and independent resume identity omit configured origin/project/root and prevent real scoped retrieval.
- **Proposed fix**: reuse existing trusted cwd/config/store seam and identity helpers. Pin backend/project/branch/worktree/run at run start; persist retrievable exact run identity; refuse incompatible mid-run configuration changes. Remove duplicate opener/identity convention.
- **Verification**: production writers/readers in two projects and two real worktrees on required adapters; same logical names do not collide; configured root/project overrides honored; changed destination refused.

### 2. Await authoritative durability and preserve errors
- **File**: `consumers.ts:153-159,186-188`; review `loop.ts:326-328,732-738`; loop activity/audit/ranking, attribution/import shutdown boundaries.
- **Problem**: queue tail resolves rejections; changed Promise-returning callers are unawaited. Terminal success/exit can precede persistence.
- **Proposed fix**: preserve pending failure evidence separately from queue continuation; await authoritative operation and terminal boundaries; bind context before deferred work. Migrate every changed API callsite.
- **Verification**: fault real consumer persistence boundary; completion refuses on error, drain rejects, later success cannot erase failure, process exit cannot lose pending write.

### 3. Make selected service the reader/resume/cursor/dedupe authority
- **File**: loop `persist.ts:125-177,208-234` and scan; review `run-state.ts:129-173,252-258`; importer `562-581`; attribution `db.ts:123-145`.
- **Problem**: copies retained but old files/tables remain reader authority. Missing local projection prevents restart; old-table dedupe skips retry after failed retention.
- **Proposed fix**: route reads/list/resume/cursors/dedupe and writes through exact persisted service context. Local projection is optional, never outage fallback. Preserve artifact-over-bookmark and immutable-pass rules and host ownership. Same-checkout restart is Phase-5 scope, not later recovery work.
- **Verification**: restart with optional projections removed on every adapter; exact state/pass/manifest/dedupe readback; simultaneous real worktrees; stale bookmark reconciliation; retry repairs failed retain.

### 4. Complete and verify one authoritative save attempt
- **File**: `sql-save.ts:82-87,123-124,138-164,218-233,287-297`; `save-apply.ts:641`; both save wrappers.
- **Problem**: local receipt precedes durable receipt; retry trusts local IDs without repair; local completed flag authorizes verification without authoritative receipt/status/duties. SQL-mode metadata bypasses adapter seal.
- **Proposed fix**: one selected-store persisted attempt owns facts plus all metadata duties. Repair/read/complete/verify that receipt, retaining rows/no-fact and exact project/branch/worktree/run binding. Local JSON must not authorize commit.
- **Verification**: failures/crashes around fact/receipt/metadata boundaries in both entrypoints; absent, incomplete or mismatched durable receipt cannot verify despite local completed flag; successful retries restore authority.

### 5. Update exact existing logical artifacts conditionally
- **File**: `consumers.ts:173-183`; `save-apply.ts:600-619`; review/ranking conversions; native `workflow-state.ts:286-296`; bundle.
- **Problem**: prefixed physical names diverge from existing native subject-relative keys; expected revision, links and move semantics omitted.
- **Proposed fix**: use existing reference conversion/conditional writes, preserve typed links/correction/tombstone/move semantics, remove duplicate identity path rather than add aliases.
- **Verification**: native creation → save update → same native token/lifecycle/site read; one current artifact; preserved links; stale update refusal.

### 6. Exclude private knowledge before host-LTM payload construction
- **File**: `skills/b-memory-import/scripts/import-context-memory.ts:758-775,819-829`.
- **Problem**: raw Markdown goes to Hindsight without selected-store/publication eligibility.
- **Proposed fix**: source selected adapter revisions; mirror only publication-proven knowledge; quarantine ambiguous legacy records. Retained manifest alone is not a visibility boundary. Keep host authority untouched.
- **Verification**: actual local HTTP payload excludes private revision and includes deliberately eligible published revision; adapter manifest/dedupe survives restart. No production LTM data required.

### 7. Connect actual plan-site entrypoints and preserve reader contract
- **File**: all three `docs/plans/src/pages/` entrypoints; `docs/plans/src/lib/plans/sql.ts`.
- **Problem**: pages instantiate filesystem source; store loader includes only plans, loses subject status and assumes site cwd is workflow checkout.
- **Proposed fix**: use configured existing source seam, explicit workflow-root resolution, complete phase/spec/research/index/document/status/link/preview contract and pre-body visibility. No UI redesign or database-to-files fallback.
- **Verification**: declared Astro runtime; actual build/browser with adapter-only documents/status/links plus negative private-branch case. Missing runtime remains not-verifiable, not success.

### 8. Restore optional cwd variable in presentation CLI
- **File**: canonical and bundled `skills/b-present/scripts/retain-package.ts:32-35`.
- **Problem**: positional-filter repair removed the declaration of `cwd`; options construction still references it. Actual CLI exits 1 with `retain-package: cwd is not defined` before package/store access.
- **Proposed fix**: derive optional cwd from validated `cwdFlag` and value, preserving no-flag behavior; synchronize bundle and use installed-skill-relative invocation conventions.
- **Verification**: exact documented default invocation, explicit --cwd, malformed/missing flag value; actual configured-store exact text/binary readback and receipt. Do not reimplement the already repaired positional filter.

### 10. Finish original census instead of relabeling owned evidence
- **File**: `phase-completion.ts:88-123`; `skills/b-blueprint/SKILL.md:51-58,197-203`; `persistence-inventory.md:75,91,97,100-104` and original durable evidence families.
- **Problem**: phase/overview writes remain file-only despite retain claim; blueprint package lacks retention; durable auto-fix/review/PR evidence changed to transient/user-owned without concrete proof.
- **Proposed fix**: migrate remaining owned writer/reader pairs and retained packages; reconcile every original row against real behavior and valid ownership exclusion. Update completion claims only after proof; no silent accepted-scope reduction.
- **Verification**: retained exact phase/overview revision after actual update, standalone blueprint retention, each census row mapped to concrete migration or demonstrable host/user/process-lifetime exclusion.

## Warnings

### 9. Finish turn-memory clean cutover after repaired enablement
- **File**: `hooks/post/turn-memory.ts:93-103`; `extensions/turn-memory/__tests__/hook.test.ts:118-133`.
- **Problem**: obsolete pool/getter/reset API has only incidental tests, no production caller. Enablement repair is proven; full default hook adapter persistence/dedupe is not.
- **Suggested approach**: remove obsolete API/incidental tests, exercise default writer and branch/run dedupe on every adapter without legacy URL unless explicitly selected connection ENV. Preserve host session journal and user opt-out.

## Fresh Verification
- Authoritative `npm run guardrails:check`: durable v2 pass, exit 0; coverage 88.7 / baseline 84; unit/global ratchet/complexity pass; functional/lint skipped; patch advisory; no new complexity violations.
- Five focused Vitest suites: 37 tests passed with SQL_MEMORY_URL unset.
- Actual presentation CLI: exit 1, `cwd is not defined`; no package/store write occurred.
- Previous concrete failures are historical evidence, not rerun/fabricated fresh observations. No all-adapter workflow, production two-worktree or rendered-site success claimed.

## Recommended Workflow
Start `/b-iterate` against Phase 5 and reconcile this artifact with the earlier active iterations; then rerun `/b-review` against the same exact phase. Implementation must close addressed iteration artifacts before returning, not wait for review/save to mark them completed. The supervisor owns loop-state routing. Documentation/how-to synchronization is separate and non-blocking after correctness repair.
