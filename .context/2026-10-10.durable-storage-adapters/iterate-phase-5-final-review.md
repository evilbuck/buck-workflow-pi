---
status: completed
date: 2026-10-12
updated: 2026-10-15
subject: 2026-10-10.durable-storage-adapters
topics: [review, iteration, storage-consumers]
informs: []
addresses: phase-5-remaining-consumers.md
completed: 2026-10-15
from_review: b-review
related: [review-phase-5-final-2026-10-12.md, iterate-phase-5-review-recovery.md]
---
superseded_by: iterate-phase-5-current-state-2026-10-15.md

# Iteration: Phase 5 — current-source final review

## Source
- Reviewed after `/b-build` and partial repairs; exact acceptance contract: `phase-5-remaining-consumers.md`, parent `plan-durable-storage-adapters.md` step 5.
- Baseline: current worktree against `202ca5d999b65c9093a30bdf81e365ae218c783a`.
- Stable R IDs retain prior review traceability. R8 is repaired: actual default/explicit-cwd CLI invocations wrote exact binary bytes and matching revision receipts to configured SQLite. Do not reimplement R8.
- Only in-plan defects appear below. Publication/rewrite/orphan recovery and legacy migration remain assigned to later phases; ordinary selected-adapter consumer resume is required here.

## Critical Issues

### 1. R1 — Reuse trusted binding and pin one destination/run
- **File**: `skills/_shared/storage/consumers.ts:125-159,190-213`; `extensions/buck-loop/persist.ts:137-199`; consumer callers; canonical/bundle.
- **Problem**: retains use `configured-project`/`configured-branch`, raw physical worktree paths and fresh random runs per write. Config loading has no project origin; external-file opener ignores configured root. Resume invents separate identity. Hook fallback reuses a worktree identity as its receipt run while attempts differ per window (`hooks/post/turn-memory.ts:110-121`). Writes do not use the trusted native reader's scope and do not pin the selected store across a run.
- **Proposed fix**: reuse `resolveTrustedContext`/`withConfiguredStore` and existing identity helpers with actual checkout cwd. Pin store/project/branch/worktree/run at run start, persist retrievable exact run identity, and reject incompatible mid-run config changes. Give hook attempts valid distinct receipt-run identity while keeping dedupe scoped. Remove duplicate openers/identity convention.
- **Verification**: production writers/readers in two projects and two real worktrees on required adapters; configured project/root overrides honored; exact revisions retrievable through normal service scope; repeated captures and changed config cannot corrupt attempts.

### 2. R2 — Await authoritative durability and preserve failure evidence
- **File**: `consumers.ts:153-159,186-188`; review `loop.ts:144-148,326-328,580-600,732-738`; loop activity/audit/ranking and attribution/import terminal boundaries.
- **Problem**: queue continuation consumes rejection and flush returns that success-resolving tail. Production callsites discard new persistence promises. Activity close waits only for stream finish; importer exits immediately after scheduling manifest retention. Success/shutdown can precede authoritative persistence or ignore its error.
- **Proposed fix**: preserve pending error evidence independently from continuation; await authoritative operation and terminal/shutdown boundaries. Bind context before queued execution. Migrate every changed API caller, including creation, review/fixer, command, report, attribution and import paths.
- **Verification**: fault a real consumer boundary; terminal success refuses, flush rejects outstanding failure, later success cannot erase it, process exit cannot lose a queued write.

### 3. R3 — Make selected adapter the reader/resume/cursor/dedupe authority
- **File**: `extensions/buck-loop/persist.ts:125-177,208-234`; review `run-state.ts:129-173,252-258`; importer `import-context-memory.ts:562-581,764-768`; attribution `db.ts:123-145`.
- **Problem**: adapter copies remain mirrors. Resume requires the local bookmark and subject directory, review reads/listing require files, importer loads the file manifest, attribution dedupe precedes retained write and prevents failed-retain retry. SQLite opener errors fall back to local projection.
- **Proposed fix**: selected-service writes and reads under exact persisted context; optional projection never becomes outage fallback or hidden authority. Preserve artifact-over-bookmark rules, immutable passes, fail-closed outage and host ownership.
- **Verification**: same-checkout restart with projections removed on every adapter; exact state/pass/cursor/dedupe readback, concurrent real worktrees, stale bookmark reconciliation, failed-retain retry restores missing durable row.

### 4. R4 — Verify one authoritative completed save attempt
- **File**: `extensions/buck-loop/sql-save.ts:82-87,123-124,135-164,218-233,287-297`; `skills/b-save-improved/scripts/save-apply.ts:641`; both save entrypoints.
- **Problem**: local receipt precedes store receipt; retry returns local IDs without repairing authoritative receipt. Completion changes only local JSON; verification checks local completed flag plus visible facts/probe, never persisted completed receipt and required duties. SQL-mode metadata skips adapter sealing.
- **Proposed fix**: one persisted selected-store attempt owns facts and all metadata duties. Repair/read/complete/verify its authoritative receipt with exact identity and rows/no-fact semantics. Local JSON must not authorize commit.
- **Verification**: failure/crash at fact/receipt/metadata boundaries for both save entrypoints, rows and no-fact; absent/incomplete/mismatched store receipt never verifies despite local completion.

### 5. R5 — Update exact existing logical artifacts conditionally
- **File**: `consumers.ts:96-106,173-183`; `save-apply.ts:600-619`; `workflow-state.ts:286-296`; ranking/review conversions; bundle.
- **Problem**: classifier includes subject prefix in logicalName whereas native writes use subject-relative names. Save creates another artifact, drops existing typed links, omits expected revision and move/tombstone semantics.
- **Proposed fix**: reuse existing logical reference conversion and conditional-write convention, preserve links/corrections/moves, remove duplicate identity paths instead of adding aliases.
- **Verification**: native creation → save update → same token/native/lifecycle/site read; one current artifact, links preserved, stale writer refused, old moved key not left authoritative.

### 6. R6 — Filter private knowledge before host-LTM payload construction
- **File**: `skills/b-memory-import/scripts/import-context-memory.ts:758-775,819-829`.
- **Problem**: raw Markdown files become Hindsight payloads without selected-store/publication eligibility. Retaining a manifest does not enforce a visibility boundary.
- **Proposed fix**: source selected-store revisions; mirror only publication-proven knowledge to unscoped LTM; quarantine ambiguous legacy records. Do not infer publication from status/creation HEAD or change host ownership.
- **Verification**: local HTTP receiver sees eligible published body but never private draft; selected-adapter manifest/dedupe survives restart; no production LTM required.

### 7. R7 — Connect actual site entrypoints and preserve reader contract
- **File**: all three `docs/plans/src/pages/` entrypoints; `docs/plans/src/lib/plans/{index,sql}.ts`.
- **Problem**: pages instantiate FilesystemPlanSource directly. New loader fetches only plan kind, emits null subject status, and assumes process cwd is workflow root.
- **Proposed fix**: use configured existing source seam and explicit workflow checkout resolution; preserve plan/phase/spec/research/index documents, status, links and previews. No union fallback that bypasses selected-store visibility. No UI redesign.
- **Verification**: real configured default loader, Astro build and actual rendered adapter-only content/status/links, negative private-branch case. Missing runtime is not-verifiable, not success.

### 10. R10 — Complete original census without relabeling retained evidence
- **File**: `extensions/buck-loop/phase-completion.ts:88-123`; `skills/b-blueprint/SKILL.md:51-58,197-203`; `persistence-inventory.md:75,91,97,100-104`; original retained evidence families.
- **Problem**: phase/overview writes remain file-only despite retention claim; standalone blueprint lacks package retention. Original auto-fix/review/PR retained evidence is excluded as transient/user-owned without concrete ownership proof.
- **Proposed fix**: migrate remaining Buck-owned writer/reader pairs and retained packages; every original row must map to real migration or valid demonstrated exclusion. Correct metadata claims only after behavioral proof; no scope reduction through notes.
- **Verification**: retained exact phase/overview revision after actual update, standalone blueprint retention, each original row mapped to concrete migrated behavior or demonstrated host/user/process-lifetime exclusion.

### 11. R11 — Restore required deterministic verification
- **File**: `skills/b-present/scripts/retain-package.test.ts`; `plugins/buck-workflow/skills/b-present/scripts/`; `scripts/codex-plugin.test.ts:92-99`.
- **Problem**: both fresh authoritative runs exit 1: unit and global-ratchet gates fail, coverage command exits 1. Both report 1 failed / 1931 passed / 30 skipped. Full repeated diagnostic names recursive bundle-path parity: canonical b-present includes `retain-package.test.ts`, bundle does not. Captured output also contains a file-store receipt-identity rejection; its originating consumer is not established by this tail.
- **Proposed fix**: synchronize the canonical b-present script/test directory with its declared bundled copy using existing packaging conventions, then rerun the unchanged contract. Investigate the receipt error separately rather than claiming it caused the named assertion failure. Do not weaken enforcement/baselines or delete a valid behavioral test.
- **Verification**: recursive/byte bundle parity and `npm run guardrails:check` pass in the supported normal environment; investigate any remaining unhandled receipt/persistence error.

## Warnings

### 9. R9 — Finish hook clean cutover
- **File**: `hooks/post/turn-memory.ts:93-103`; `extensions/turn-memory/__tests__/hook.test.ts:118-133`.
- **Problem**: obsolete pool/getter/reset API has only incidental implementation tests, no production caller. Enablement now honors opt-out without legacy SQL URL, but actual default adapter write/dedupe across backends remains unverified.
- **Suggested approach**: remove dead API and incidental tests as part of cutover; prove default hook persistence/dedupe without modifying host session ownership. Preserve user opt-out.

## Recommended Workflow
Return this review to the supervisor. `/b-iterate` repairs only these Phase-5 defects, then `/b-review` rechecks the exact phase. Reconcile prior iteration records and close addressed artifacts only after implementation and current verification. The supervisor exclusively owns loop routing; this review changes no lifecycle/phase/loop state. Documentation/how-to work is separate and non-blocking after correctness repair.
