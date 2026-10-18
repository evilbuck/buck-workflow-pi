---
status: active
date: 2026-10-12
subject: 2026-10-10.durable-storage-adapters
topics: [review, storage-consumers, branch-isolation, receipts]
review_verdict: request-changes
addresses: phase-5-remaining-consumers.md
---

# Plan Path Review: Phase 5 — Remaining Durable Consumers

## Verdict
**Needs work.** Ten in-plan defects remain. The deterministic contract passes, but consumer smokes reproduce identity collisions, failed external-file retention, false save verification, stale logical reads, unmerged LTM export, and a broken documented presentation command. Phase completion metadata is not proof of completion.

## Plan Source
- Phase: `phase-5-remaining-consumers.md`.
- Parent: `plan-durable-storage-adapters.md`, step 5; research: `research-durable-storage-adapters.md`.
- Goal: migrate all remaining Buck-owned durable writers **and readers** to the selected adapter, preserving scope, resume, receipt and host-ownership semantics.
- Baseline: uncommitted working-tree changes against `202ca5d` (`fix(workflow-state): enforce git metadata and symlink confinement`). Current source was also inspected for named unchanged callers. Prior adapter/native-access commits are prerequisites, not a requirement to re-review other phases.
- Explicit phase path overrides the stale `.context/workflow/current-session.json` subject. That file has no active `goal` field.

## Evidence Sources
- Starting tree: 30 modified tracked paths plus pre-existing untracked consumer modules, presentation scripts, implementation notes and Phase-4 artifacts. None was staged or modified by this review.
- Reviewed changed families: consumer helper; loop activity/choice/repair/ranking/save/resume/report; review pass/state/report; attribution; turn-memory; import manifests; save-apply; plan reader; presentation retention; configured-store opener and SQLite synchronous access; installer/bundle entries.
- Inspected named unchanged consumers: loop scanner/phase completion, review state/pass readers and production loop callsites, save wrapper, importer source/HTTP pipeline, turn-memory enablement, all three Astro page entrypoints, b-blueprint writer.
- Relevant commits: `202ca5d`, `fbe9b5a`, `db31575`, `849ef5a`, `065b776`. The review relies on current source and observed commands, not commit descriptions or phase checkboxes.

## Completion Matrix

| Deliverable | Status | Direct evidence / missing part |
|---|---|---|
| AC1: both save pipelines use same-adapter batches and attempt receipts | Partial | `save-apply.ts:594-644` and `consumers.ts:51-76` persist file-mode bytes/attempts. Receipt-outage smoke retries successfully with no durable receipt and verifier `verified` (R4). SQL-mode metadata skips sealing; two logical identities are used for the same plan (R5). |
| AC2: loop, review, hook, attribution, dedupe and import state persist through the service; run-private after merge | Partial | Writes were added, but shared retention invents project/branch/run identity and external-files rejects run keys (R1). Production callers do not await/drain retention (R2); read paths still depend on filesystem/host Buck tables (R3). Hook remains legacy-URL gated (R9). |
| AC3: retained packages and attachments are adapter-backed, binary intact | Partial | Actual CLI with `--cwd` retained two artifacts; binary readback was exactly `[0,255,128,42]`. Documented command without `--cwd` exits 2 (R8). b-blueprint remains an unretained writer (R10). |
| AC4: plan-site uses adapter-backed source through the existing seam | Missing | Stub replaced in `sql.ts`, but `index.astro:3-6`, `[subject].astro:4-10`, `[subject]/[...doc].astro:5-12` still instantiate `FilesystemPlanSource` directly (R7). |
| AC5: host-owned sessions/stats/LTM ownership preserved; no unmerged LTM mirror | Partial | Changed attribution code adds Buck-owned writes; no new `messages` write found. Import smoke sent an uncommitted private memory to an isolated HTTP LTM receiver: `imported=1`, `privateBodySent=true` (R6). |
| AC6: every persistence inventory row migrated or genuinely unchanged/excluded | Missing | Inventory claims phase-completion retention which does not exist; omits b-blueprint retention and reclassifies previously durable evidence as transient/user-owned without implementation proof (R10). |
| Implementation detail 1: save and loop persistence cutover | Partial | R1–R5; loop scan/resume still require canonical physical files. |
| Implementation detail 2: hooks, plan bridge, attribution cutover | Partial | Existing bridge is a prerequisite; attribution still writes/dedupes first in its old DB, and hook capture remains URL gated (R3/R9). |
| Implementation detail 3: immutable review evidence and resume | Partial | Existing immutable refusal remains; focused run-state tests pass. Retained artifacts receive fresh unrelated run IDs, and production readers/callers are not migrated (R1–R3). |
| Implementation detail 4: packages/import/LTM boundary | Partial | Exact binary bytes supported; documented CLI and b-blueprint incomplete; private LTM export persists (R6/R8/R10). |
| Implementation detail 5: adapter-backed site | Missing | R7; source class is not connected to actual page callers. |
| Focused verification per state kind | Partial | Five focused files: 55 passing tests. Real consumer smokes found failures below. No PostgreSQL consumer workflow exercised in this review. |
| Two-worktree concurrent resume fixture | Not-verifiable | Added tests use manually supplied synthetic worktree/run IDs, not two real worktrees exercising production resume. The reader remains filesystem-dependent. |
| Deterministic check contract | Complete | Fresh `npm run guardrails:check`: durable v2 `pass`, coverage 88.7 versus baseline 84, no new complexity violations. |
| Actual site build/surface | Not-verifiable | `npm run build` in `docs/plans` exits 127: `astro: command not found`. No rendered/browser surface claimed. Source-level disconnected caller is independently proven. |
| Blocking assumptions assigned to Phase 5 | Complete | Parent A1–A5 are validated; no deferred/blocking assumption is assigned to this phase. This does not waive consumer acceptance defects. |
| Scope-relevant material safety claims | Partial | Parent risks 3 (private body bypass) and 5 (uncertain persistence/receipt success) are contradicted by R6 and R2/R4. Parent later-phase publication/migration/recovery claims were not reopened. No silent backend fallback is an acceptable recovery. |

## Spec Axis Findings

All findings below are **in-plan**. IDs are stable and match the iteration artifact.

### R1 — High: retention bypasses trusted configuration and scope
`skills/_shared/storage/consumers.ts:135-146,190-213`; `extensions/buck-loop/persist.ts:135-199`.

`retainConfiguredArtifact` resolves config with no origin, uses `configured-project` / `configured-branch`, passes physical paths as worktree IDs and creates a bare UUID run for every write. Project overrides are therefore ignored; knowledge writes from unrelated projects/branches collide; run-private records do not share a stable resumable identity. External root configuration is also ignored in its separate store opener. Resume adds another project/branch scheme (Git common-dir hash and branch name) instead of the existing trusted resolver.

Observed with two real repositories with different origins, one SQLite configuration, and the same subject/logical name: the real project's visible review rows were `0`; the placeholder scope held only the second project's `private-project-b`, replacing the first. External-file audit retention failed with `Run-scoped artifact ids are unsafe`.

**Fix:** use the existing configured-store/context resolver with actual repository cwd and bound stable project/branch/worktree/run IDs; honor project overrides and external roots; preserve one logical run across state/pass/audit writes. Remove the placeholder/special SQLite identity paths. Verify real projects/branches/worktrees on all required adapters, not reads under invented placeholder IDs.

### R2 — High: asynchronous persistence errors are detached from completion
`consumers.ts:153-159,186-188`; `extensions/code-review-iteration/loop.ts:326-328,732-738`; `extensions/buck-loop/activity-log.ts:173-184`; attribution/import/audit writers.

The scheduled write rejects, but the global drain handles rejection by resolving. Production callsites discard the new promises; only tests invoke the drain. Activity close schedules retention but does not return/await it. Writes can fail after the caller reports success, or importer `process.exit()` can terminate them. One global mutable-config queue also does not pin the destination when scheduled.

Observed fault: invalid adapter config made the individual write reject, while `flushConfiguredRetains()` resolved. The claimed failure-propagating drain is not failure-propagating.

**Fix:** await persistence at the owning operation and every terminal/shutdown boundary, bind the store/context at run start, and preserve drain failure. Migrate every changed Promise-returning callsite. Outages must block authoritative progress without discarding earlier errors.

### R3 — High: retained copies did not replace durable reader authority
`extensions/buck-loop/persist.ts:125-175,208-219`; `scan.ts:92-133`; `extensions/code-review-iteration/run-state.ts:129-173,252-259`; `skills/b-memory-import/scripts/import-context-memory.ts:562-569,758-768`; `extensions/token-attribution/db.ts:123-145`.

External/PostgreSQL resume still reads the local projection; even SQLite `resume()` first requires that physical file. Review resume/pass readers and importer manifests read only their old files. Attribution inserts/dedupes in the old Buck table before attempting retention, so a failed retain cannot be repaired by retrying the same old-table row. Fresh random run IDs returned by individual retains are not persisted as retrieval pointers. This is dual-write mirroring, not one selected authoritative service. Ordinary restart in the same checkout is Phase-5 scope; it cannot be silently deferred to Phase-6 cross-worktree recovery.

Observed SQLite inconsistency: after retaining `building`, editing the file to `aborted` left `readProjection()` returning `building`. The new fast path is neither a context-bound reader nor a coherent editable projection contract.

**Fix:** move authoritative read/list/resume/dedupe through the service with persisted exact run identity; make projections optional and scoped, not fallback authority; preserve artifact-over-bookmark rules and fail closed on store/config errors. Prove restart after removing optional materialization, and simultaneous independent worktrees.

### R4 — High: a failed durable receipt can still become a verified save
`extensions/buck-loop/sql-save.ts:121-164,82-87,218-233,287-297,326-330`; `skills/b-save-improved/scripts/save-apply.ts:638-644`.

The local receipt is written before the adapter receipt. Retry trusts that local receipt and returns without persisting the missing adapter receipt. Completion updates only the local JSON; verification checks visible memory IDs but not the authoritative receipt's attempt/status/duties. In addition, SQL-mode apply skips the new seal entirely, leaving its metadata/lifecycle writes outside the adapter batch.

Observed with real SQLite and an injected failure of receipt persistence: first save rejected; retry returned the memory ID; `completeSaveAttempt()` succeeded; authoritative receipt was `null`; `verifySqlSave()` returned `{status:"verified"}`.

**Fix:** record and verify the same bound attempt through the service, complete only after required metadata/readback duties succeed, repair incomplete attempts on retry, and persist SQL-mode metadata on the selected adapter. No local projection may authorize save/commit when the durable attempt is absent/incomplete.

### R5 — High: save-apply creates a second artifact rather than updating the existing one
`skills/_shared/storage/consumers.ts:172-183`; `skills/b-save-improved/scripts/save-apply.ts:594-625`; existing native key binding in `workflow-state.ts:203-205,286-296`.

The native surface addresses a subject plan as `logicalName=plan-demo.md`; file-mode sealing addresses it as `<subject>/plan-demo.md`. Final review writers also disagree on prefixed versus subject-relative names. Expected revisions/typed links are not preserved by the new classification path. Updating a file does not update the artifact downstream native readers use.

Observed: save-apply exited 0 and added `memory: [smoke.md]` to the prefixed plan artifact. Reading native `plan-demo.md` still returned the original bytes without that link.

**Fix:** reuse one logical-reference/path conversion convention, update exact existing artifacts conditionally, retain typed links and move/tombstone semantics, and verify readback through native tokens, lifecycle discovery and site consumers. Do not re-pin tests to the duplicate identity.

### R6 — High: importer still mirrors unmerged knowledge into host LTM
`skills/b-memory-import/scripts/import-context-memory.ts:758-775,806-853`.

The importer still scans raw `.context` Markdown and sends it to project-scoped Hindsight; adding a retained manifest does not apply publication visibility. No adapter/publication eligibility is checked before bodies enter retain payloads.

Observed using a local HTTP receiver, not a live LTM service: an uncommitted branch-private memory containing `UNMERGED-SECRET-SMOKE` was sent; result `code=0, imported=1, privateBodySent=true`.

**Fix:** read adapter-backed source and mirror only publication-proven revisions into unscoped host LTM; quarantine legacy records lacking proof. Keep host LTM ownership unchanged. Verify a private branch body is never sent and a deliberately published revision is eligible.

### R7 — High: plan-site adapter source is disconnected from the actual pages
`docs/plans/src/pages/index.astro:3-6`, `[subject].astro:4-10`, `[subject]/[...doc].astro:5-12`; `docs/plans/src/lib/plans/sql.ts:7-50`.

All three pages still instantiate the filesystem source directly, ignoring `createPlanSource()` and adapter selection. The new source also lists only `plan` kind, losing phase/spec/research/subject-index documents supported by the existing seam, and binds `process.cwd()` (the site directory in normal npm invocation) rather than an explicit workflow checkout. Removing the stub is not an operational cutover.

**Fix:** connect actual pages to the configured source through the existing seam without UI redesign; resolve the intended checkout, preserve existing document/status/link behavior and scope before loading bodies. Install/use the declared site dependencies and exercise the built surface with adapter-only data and negative branch visibility.

### R8 — High: documented presentation retention command always drops its package argument
`skills/b-present/scripts/retain-package.ts:17-20`; `skills/b-present/SKILL.md:141-153`.

Without `--cwd`, `cwdFlag=-1`, so the filter's `index !== cwdFlag + 1` removes argument zero. The documented one-positional-argument invocation has no package directory left.

Observed actual CLI: `bun .../retain-package.ts <package-dir>` exits 2 with usage. Adding `--cwd <repo>` exits 0, retains two artifacts and preserves binary bytes exactly.

**Fix:** exclude a flag value only when the flag is present; exercise the exact documented command on the configured store. Keep script resolution portable to the installed skill directory.

### R9 — Medium: turn-memory still requires an unrelated legacy SQL environment variable
`extensions/turn-memory/enable.ts:27-35`; `hooks/post/turn-memory.ts:26-29,106-107`.

SQLite/external-files/repo-files selection does not enable capture; even explicit `BUCK_TURN_MEMORY=1` is defeated by absent `SQL_MEMORY_URL`. Configured PostgreSQL with another connection ENV also remains disabled. Dead pool support remains although default persistence no longer uses it.

Observed enablement call without legacy URL returned `false` despite explicit opt-in. The shared configuration must control persistence, not a second environment mode switch.

**Fix:** gate capture on user opt-out and actual configured-store capability, remove obsolete pool path, and verify hook save/dedupe on each backend without `SQL_MEMORY_URL` unless explicitly selected as that backend's connection ENV.

### R10 — High: inventory closure hides still-unmigrated in-scope writers
`persistence-inventory.md:75,91,97,100-104`; `extensions/buck-loop/phase-completion.ts:88-123`; `skills/b-blueprint/SKILL.md:51-58,198-203`.

The inventory claims phase-completion writers retain through the store, but they contain only direct file writes. b-blueprint writes retained package bytes without the new retention step. The reconciliation also relabels b-auto-fix durable run/evidence and Buck-owned review/PR input evidence as transient or user-owned, despite the original census and parent's explicit ownership scope. Merely describing old files as projections does not migrate their writers/readers.

**Fix:** reconcile each original census row against actual writer and reader behavior; migrate remaining Buck-owned evidence/package writers. Exclude only genuinely host/user-owned or process-lifetime data with concrete evidence. Correct completion claims after behavioral proof, not instead of implementing the missing consumers.

## Standards Axis — Separate Sequential Fallback Pass

No task/sub-agent dispatch tool is available. A second explicitly scoped pass used the TypeScript async/error guide, universal reuse/duplicate-state guide, and only Duplicate Code, Shotgun Surgery and Dead Code smell references. Findings are independent of acceptance ranking.

- **S1 / High, worst standards finding:** ignored Promise-returning persistence plus a success-resolving failure drain (`consumers.ts:153-159,186-188`, production review loop callsites). Observed failure is R2; async exception and shutdown discipline are violated independently of the plan.
- **S2 / High:** duplicate configured-store/identity implementations in `consumers.ts:135-213` and `persist.ts:135-199` instead of reuse of `withConfiguredStore`/`resolveTrustedContext`. Actual divergence produces R1/R3. This is a concrete reuse/duplicate-code defect, not a request for another abstraction.
- **S3 / High:** duplicated physical-to-logical identity convention produces R5's stale consumer-visible plan. Reuse the existing subject-relative native identity.
- **S4 / Medium:** new consumer tests read using `configured-project`/`configured-branch` and invalid physical worktree/bare run IDs (`consumer-persist.test.ts:108-124`, review/attribution tests). Those fixtures normalize the broken implementation and cannot catch production isolation/file-adapter failures; use trusted real contexts and consumer behavior instead.
- **S5 / Low, non-blocking:** obsolete cached pool helpers in turn-memory are no longer used by defaultRemember. Remove with R9's in-plan cutover.
- Worst spec finding: **R6, unmerged private body sent into unscoped LTM** (High).
- Worst standards finding: **S1, false-success asynchronous retention drain** (High).
- Cross-axis ranking: **none**. No combined severity list was used.

## Verification Status
- Goal achieved: **partial**. Bytes can be retained in SQLite, but the same service is not yet authoritative for scope, readers or completion.
- User goal: **partially met**, not reliable selected-backend resume or unmerged privacy.
- Scope adhered: modified consumer families fit the phase; SQLite/config/opener/install/bundle edits support the cutover. The adjacent confinement refactor is a behavior-preserving prerequisite-complexity adjustment described by the implementation notes; no new defect found there. Prior Phase-4 untracked artifacts were not changed or staged.
- Acceptance scope cannot be reduced by implementation notes deferring ordinary external/PostgreSQL resume to Phase 6.
- Source-state review completed; no PostgreSQL end-to-end consumer claim and no rendered site claim.

## Guardrails Verdict
- Command: `npm run guardrails:check` (fresh run, exit 0).
- Contract: **durable**, version **2**, status **pass**.
- Gates: `unit_test_gate=pass`, `functional_test_gate=skipped`, `lint_gate=skipped`, `patch_gate=advisory`, `global_ratchet=pass`, `complexity_gate=pass`.
- Coverage: **88.7**, baseline **84**; patch percentage **null** (advisory), threshold **90**.
- Complexity: 30 existing hotspots / baseline 30; no new or hard-ceiling violations.
- No enforcement, threshold or baseline was changed.

### Additional exercised verification
- Focused Vitest: `npx vitest run skills/_shared/scripts/consumer-persist.test.ts extensions/code-review-iteration/__tests__/run-state.test.ts extensions/token-attribution/__tests__/db.test.ts extensions/buck-loop/__tests__/sql-save-store.test.ts skills/b-save-improved/scripts/save-apply.test.ts`: **5 files / 55 tests passed**.
- Isolated real-consumer scripts used temporary Git repositories, config/identity roots, disk SQLite, external file selection, actual presentation/save-apply CLI child processes and a local HTTP receiver. Results are recorded in R1–R6/R8/R9. Fault injection was limited to rejecting durable receipt persistence; other persistence/readback was real. No external service/private project data was sent.
- `diff -q` consumers helper and consumer tests; `diff -qr` canonical/bundled b-present: clean.
- Actual site build: exit 127, missing `astro`; no browser test claimed.
- Temporary smoke scripts and fixtures removed. Production sources/tests/config/phase status/backlog unchanged by review.

## User Goal Analysis
- Goal: users choose durable storage, resume reliably across sessions/worktrees, and keep unmerged knowledge out of unrelated ordinary retrieval.
- Met: basic batch/receipt persistence and binary attachment retention can work with correctly supplied SQLite context.
- Partial: consumer wiring and immutable pass refusal.
- Missing: shared trusted identity/config for all callers, authoritative adapter readers, failure-aware completion, private LTM boundary, connected site, operational documented package retention.
- Verdict: **partially met** for this phase; no claim about completing later phases.

## Documentation Impact
- Flagged (non-blocking): docs must explain adapter authority rather than mirror/projection fallback; turn-memory enablement, importer publication eligibility, and site reader docs currently contradict the intended cutover. `docs/plans/README.md` still describes an unimplemented SQL source.
- Recommended: `/b-docs` after correctness repair and re-review, before `/b-save`.

## How-to Impact
- Flagged (non-blocking): selected-adapter capture/import/package retention and adapter-backed site invocation need accurate procedures/observable readback.
- Recommended: `/b-docs` first; it can follow `/b-howto` for changed actions. Documentation is not counted among correctness defects unless it is an explicit incomplete migration acceptance claim (R10).

## Issue Classification and Next Step
- In-plan: **R1–R10** → `iterate-phase-5-remaining-consumers.md` → `/b-iterate`, then `/b-review` against the same phase.
- Out-of-plan discoveries: **none**. Later publication/history/cutover work remains in its own phases.
- Review is **Needs work** independently of green guardrails. Do not save/commit this phase as accepted yet; supervisor owns routing and lifecycle.
- Historical memory index contains Phase-1 history, not a Phase-5 accepted closeout. Save only after the defects are addressed and re-reviewed.

## Completion Audit
1. Objective restated as all six consumer acceptance deliverables above.
2. Each deliverable mapped to current file ranges and/or observed output.
3. Current source inspected; deterministic contract freshly passed.
4. Actual CLI/save/import/retention paths exercised; site build attempted and unavailable runtime named.
5. Unproven two-worktree/PostgreSQL/site behavior remains partial/not-verifiable; checkbox status was not promoted to evidence.
6. Both review axes completed. No loop-state or phase-lifecycle change was made by this reviewer.
