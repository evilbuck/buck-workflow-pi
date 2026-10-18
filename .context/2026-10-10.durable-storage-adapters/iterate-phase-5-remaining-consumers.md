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
---

# Iteration: Phase 5 remaining durable consumers

## Source
- Reviewed after: `/b-build` (consumer cutover / second build-pass changes).
- Phase: `phase-5-remaining-consumers.md`.
- Parent plan: `plan-durable-storage-adapters.md`, step 5.
- Full evidence and independent axes: `review-phase-5-remaining-consumers-2026-10-12.md`.
- Baseline: working-tree implementation against `202ca5d`.
- All ten issues below are in-plan; no out-of-plan work or documentation-only impact is included.

## Critical Issues

### 1. Trusted configuration/identity bypass causes collisions and invalid external-file writes
- **Severity:** High.
- **File**: `skills/_shared/storage/consumers.ts:135-146,190-213`; `extensions/buck-loop/persist.ts:135-199`; their migrated consumers and bundle.
- **Problem**: no origin passed to config; invented `configured-project` and `configured-branch`; physical paths as worktree IDs; bare UUIDs/new run for each retained record; a second resume identity algorithm; external configured root ignored. Real native reads do not see these records. Different projects overwrite same-named knowledge; file adapters reject private keys.
- **Observed:** two temporary repositories with different origins wrote the same review key. Real project list returned zero rows; placeholder list held only the second project's bytes. External-files audit write threw `Run-scoped artifact ids are unsafe`.
- **Proposed fix**: reuse `withConfiguredStore` / trusted resolver with actual cwd and stable bound project/branch/worktree/run identity; pin selection per run; honor project overrides/root; remove duplicate identity/opening paths. Persist one retrievable run identity across state/pass/audit writes.
- **Verification:** production writers/readers in two real projects/branches and worktrees; exact ID/revision readback and no collision on each required backend. Replace placeholder-ID tests with trusted-context behavior checks.

### 2. Persistence drain swallows failure and production callers discard retention promises
- **Severity:** High.
- **File**: `skills/_shared/storage/consumers.ts:153-159,186-188`; review loop/state/report, loop activity/audit/ranking, attribution/import callers.
- **Problem**: rejected tail becomes resolved; changed Promise-returning writers are not awaited in production; activity close resolves before retention; importer can call `process.exit()` before retention completes. Failure cannot block the operation that claimed durability.
- **Observed:** invalid adapter config rejected the scheduled write while `flushConfiguredRetains()` resolved.
- **Proposed fix**: await authoritative persistence at operation/terminal/shutdown boundaries and migrate every Promise-returning callsite. Keep queue continuation separate from failure evidence; a drain must fail if retained work failed. Bind context/store when the run starts rather than rereading mutable config at deferred execution.
- **Verification:** outages and process-boundary tests with actual consumer entrypoints; no success/completion notification or lost error on failed retention; a later successful write does not clear an earlier unacknowledged failure.

### 3. Durable readers still require old files/tables; retention is only a mirror
- **Severity:** High.
- **File**: `extensions/buck-loop/{persist,scan}.ts`; `extensions/code-review-iteration/{run-state,loop}.ts`; `skills/b-memory-import/scripts/import-context-memory.ts`; `extensions/token-attribution/db.ts`.
- **Problem**: external/PostgreSQL projection reads are file-only; SQLite resume requires the file to exist; review state/pass and import manifest reads use old files; attribution dedupes in old Buck table before retention. Random per-write runs lack durable reader pointers. Same-checkout restart is Phase-5 scope, not deferred cross-worktree recovery.
- **Observed:** SQLite projection retained `building`; local file edited to `aborted`; `readProjection()` still returned `building`. Source shows `resume()` returns before store read when the file is absent.
- **Proposed fix**: migrate read/list/resume/cursor/dedupe authority to service and exact persisted run context. Optional materializations must not be fallback authority. Keep authoritative artifact precedence, immutable pass rules, and fail closed on outage/config mismatch. Retain host-owned tables/session data untouched.
- **Verification:** restart with optional projections removed; exact pass/cursor/state lookup on every adapter; stale bookmark reconciliation; two real worktrees cannot share mutable pointers. Failed attribution retain must be recoverable on retry without old-table dedupe losing it.

### 4. Local receipt permits verified save after adapter receipt failure
- **Severity:** High.
- **File**: `extensions/buck-loop/sql-save.ts:82-87,121-164,218-233,287-297,326-330`; `skills/b-save-improved/scripts/save-apply.ts:638-644`; save wrapper.
- **Problem**: local receipt precedes durable write; retry returns its IDs without repairing adapter receipt; complete/verify rely on local completed JSON and visible facts rather than durable attempt/status/duties. SQL-mode apply bypasses metadata sealing entirely.
- **Observed:** receipt-persistence outage rejected first save; retry returned fact ID; local completion succeeded; adapter receipt was null; verifier returned `verified`.
- **Proposed fix**: one bound attempt for facts and all metadata duties through the selected service; read/complete/verify its authoritative receipt; retry incomplete attempts rather than trust local JSON; persist SQL-mode lifecycle/crossrefs/backlog/status edits on that same adapter. Keep no-fact semantics, duty attestation, and exact run/project/branch binding.
- **Verification:** crash/outage before/after fact/receipt/metadata boundaries, both save entrypoints, rows and no-fact. Absent/incomplete/mismatched durable receipt must never authorize commit even if local JSON says complete.

### 5. File-mode save writes duplicate logical artifact identity
- **Severity:** High.
- **File**: `skills/_shared/storage/consumers.ts:172-183`; `skills/b-save-improved/scripts/save-apply.ts:594-625`; review writer key conversions.
- **Problem**: native plan `logicalName=plan-demo.md` versus seal `<subject>/plan-demo.md`; same mismatch for index/review paths. Save file updates do not update native-token consumers; expected-revision and typed-link semantics are omitted.
- **Observed:** actual save-apply exited 0 and stored `memory: [smoke.md]` under prefixed name; native plan read stayed unchanged.
- **Proposed fix**: reuse one subject-relative logical reference conversion, conditionally update existing revisions, preserve links and move/tombstone semantics. Do not solve by adding aliases or pinning duplicate identities in tests.
- **Verification:** create through native surface, modify through save, read same token/logical artifact through native/lifecycle/site paths; no duplicate current pointers, stale writes rejected, links exact.

### 6. Memory importer exports unmerged private knowledge to host LTM
- **Severity:** High.
- **File**: `skills/b-memory-import/scripts/import-context-memory.ts:758-775,806-853`.
- **Problem**: raw filesystem scan feeds project-scoped Hindsight without adapter/publication checks. Retaining an importer manifest does not stop the body leak.
- **Observed:** isolated local HTTP receiver got `UNMERGED-SECRET-SMOKE` from an uncommitted branch memory; importer returned `code=0, imported=1`.
- **Proposed fix**: source adapter-backed records and allow unscoped LTM retain only for publication-proven revisions; quarantine legacy records without proof. Do not replace host LTM or infer publication from creation HEAD/status.
- **Verification:** actual import HTTP payload contains no private revision; an explicit eligible published revision is sent; manifests/dedupe resumable on selected adapter; no host data mutated outside its existing API ownership.

### 7. Plan-site reader is not connected to page entrypoints
- **Severity:** High.
- **File**: `docs/plans/src/pages/index.astro:3-6`, `[subject].astro:4-10`, `[subject]/[...doc].astro:5-12`; `docs/plans/src/lib/plans/sql.ts`.
- **Problem**: all pages instantiate `FilesystemPlanSource`; source factory/adapter choice unused. New source lists only plan kind, loses existing document/status behavior, and binds site process cwd rather than workflow checkout.
- **Proposed fix**: route existing pages through configured reader seam, resolve intended project checkout, preserve document/status/link/preview contracts and branch filtering before body loading. No UI redesign or filesystem fallback under database selection.
- **Verification:** actual built site with adapter-only plan/phase/spec/research/index content, same links/statuses, private branch negative case. Review build could not run because declared `astro` executable was absent (exit 127); provide the runtime before claiming rendered behavior.

### 8. Presentation CLI drops first positional argument without --cwd
- **Severity:** High.
- **File**: `skills/b-present/scripts/retain-package.ts:17-20`; canonical/bundled b-present instruction.
- **Problem**: absent flag yields `cwdFlag=-1`; filter removes index zero as the presumed flag value. Exact documented invocation has no package path.
- **Observed:** documented command exits 2 / usage; adding `--cwd <repo>` exits 0 and preserves binary `[0,255,128,42]` across exact readback.
- **Proposed fix**: filter flag/value only when present; retain default-cwd invocation; keep installed-skill script resolution portable.
- **Verification:** actual documented command, explicit --cwd, and invalid/missing flag value; exact binary/text retained through selected store with receipt.

### 10. Inventory claims conceal still-unmigrated writers
- **Severity:** High.
- **File**: `extensions/buck-loop/phase-completion.ts:88-123`; `skills/b-blueprint/SKILL.md:51-58,198-203`; original and reconciled persistence inventory.
- **Problem**: phase completion is claimed retained but still direct file-only writes. b-blueprint package writer never invokes retention. Original durable b-auto-fix/review/PR evidence is reclassified transient/user-owned without concrete ownership or migration evidence. This is incomplete criterion 6, not merely documentation polish.
- **Proposed fix**: migrate still-owned writer/reader pairs; reconcile each original row with actual behavior and valid exclusions. Projections can be optional exports, not hidden second authorities. Correct completion claims only after proof; do not shrink accepted scope via notes.
- **Verification:** exact revision readback after real phase-status/overview updates and standalone blueprint generation; original census rows each backed by concrete migrated behavior or evidence they truly are excluded host/user/process-lifetime data.

## Warnings

### 9. Turn-memory still depends on unrelated SQL_MEMORY_URL
- **Severity:** Medium; in-plan implementation defect.
- **File**: `extensions/turn-memory/enable.ts:27-35`; `hooks/post/turn-memory.ts:26-29,106-107`.
- **Problem**: absent legacy URL disables SQLite/external/repo capture even with explicit opt-in; configured PostgreSQL using another connection ENV also remains disabled. Old pool helpers are dead after adapter write replacement.
- **Observed:** `isTurnMemoryEnabled(cwd,{BUCK_TURN_MEMORY:"1"})` returned false.
- **Suggested approach**: keep user opt-out but resolve actual selected-store capability/config; remove obsolete pool support. Verify real hook capture and branch/run dedupe without legacy URL for all configured adapters.

## Verification Baseline
- Fresh durable v2 guardrails: pass; coverage 88.7 / baseline 84; unit/global ratchet/complexity pass; functional/lint skipped; patch advisory. No contract weakened.
- Five focused Vitest files: 55 passing tests. Existing passing fixtures do not negate reproduced defects.
- Canonical/bundle consumer helper, consumer tests and b-present byte parity clean.
- Temporary isolated smoke scripts exercised actual writers/CLIs/local HTTP; no live external memory service used.
- Standards pass used explicit sequential fallback because no task dispatch tool exists; failures recorded independently of spec axis in the report.

## Recommended Workflow

Start with `/b-iterate` against this phase. Reuse existing trusted context/native-reference/service patterns; do not introduce a second identity or store-opening convention. Repair all in-plan issues and update affected consumers/tests/bundles. Then re-run `/b-review` against `phase-5-remaining-consumers.md`.

Inside OMP execution, `/b-iterate` completes this artifact before returning; supervisor re-reviews. Do not leave it active awaiting review/save after implementing its repairs. No authority to choose the next loop state is conferred by this artifact.
