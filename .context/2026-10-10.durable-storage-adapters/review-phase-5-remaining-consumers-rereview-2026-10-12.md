---
status: active
date: 2026-10-12
subject: 2026-10-10.durable-storage-adapters
topics: [review, storage-consumers, receipts, branch-isolation]
review_verdict: request-changes
addresses: phase-5-remaining-consumers.md
related: [review-phase-5-remaining-consumers-2026-10-12.md, iterate-phase-5-remaining-consumers-rereview.md]
---

# Plan Path Review: Phase 5 — Remaining Durable Consumers (rereview)

## Verdict
**Needs work.** Nine High in-plan findings remain (R1–R8, R10). R9's legacy-URL enablement defect is repaired, but its obsolete pool cleanup remains incomplete. The review assignment is complete; this is not acceptance of the implementation or authorization to advance the loop.

## Plan Source
- Phase: `phase-5-remaining-consumers.md`; parent: `plan-durable-storage-adapters.md`, step 5.
- Goal: migrate every remaining Buck-owned durable writer and reader to the selected service, preserving run privacy, exact bytes, receipts, resume and host ownership.
- User goal: users can choose durable storage per project and keep unmerged work invisible on other branches; inherit reliable session/worktree resume from the parent.
- Baseline: current working tree against `202ca5d999b65c9093a30bdf81e365ae218c783a`. Prior Phase 1–4 implementation is prerequisite context, not this review's scope.
- Read parent decision closure, ledger, relevant material risks, research and persistence inventory. A1–A5 are recorded validated; no unresolved blocking assumption is assigned to Phase 5.
- Explicit phase path takes precedence over stale current-session subject metadata. Current-session has no active goal field.

## Evidence Sources
- Initial `git status --porcelain`: extensive pre-existing staged/unstaged consumer changes and untracked implementation/review/Phase-4 artifacts. None belongs to this review assignment.
- `git diff HEAD --stat`: 37 tracked paths, 1,102 insertions / 131 deletions, excluding untracked helpers/tests/notes.
- Current source inspection: shared consumer helper; configured-store/trusted identity seam; save receipt/apply; loop resume, audits and phase completion; review pass/state and production callsites; attribution/dedupe; importer source/manifests/LTM transport; hook enablement/capture; presentation command and blueprint instructions; all three plan-site pages.
- Relevant existing commits: `202ca5d`, `fbe9b5a`, `db31575`, `849ef5a`, `065b776`. Commit messages and completed checkboxes were not used as completion proof.
- Previous review's concrete smoke observations are retained as historical evidence, not presented as newly run. Their failure-producing code paths remain visible in current source. Known failures were not rerun merely to confirm them.
- Fresh evidence: authoritative guardrails; two turn-memory test files; direct runtime enablement/status smoke without SQL_MEMORY_URL.

## Completion Matrix

| Deliverable | Status | Current evidence / missing piece |
|---|---|---|
| AC1: both save pipelines write same-adapter batches/attempt receipts | Partial | `consumers.ts:51-76` batches bytes/receipt; `save-apply.ts:595-622` seals file-mode writes. `sql-save.ts:123-124,138-164,218-233,287-297` still trusts local receipt retry/completion and does not verify durable status/duties. SQL-mode metadata bypasses sealing at `save-apply.ts:641`. R4/R5. |
| AC2: loop/review/hook/attribution/dedupe/import state service-backed and run-private | Partial | Retention writes added, but `consumers.ts:135-146` invents scope and per-write run IDs; queue drain suppresses failures at `153-159,186-188`. Review readers at `run-state.ts:129-173`, importer manifest reads at `import-context-memory.ts:562-569` and loop `persist.ts:208-219` still require local files. R1–R3; R9 partially repaired. |
| AC3: retained packages/attachments, binary intact | Partial | `consumers.ts:228-254` retains package bytes. Prior explicit-cwd smoke proved binary round-trip. Current CLI `retain-package.ts:17-23` still drops positional index zero when flag absent; blueprint Step 7 remains file-only. R8/R10. |
| AC4: actual plan-site reader adapter-backed through existing seam, no redesign | Missing | `sql.ts:11-26` supplies a store-backed loader, but pages `index.astro:3-6`, `[subject].astro:4-10`, `[subject]/[...doc].astro:5-12` still instantiate FilesystemPlanSource. New loader lists only plan kind and returns null subject status (`sql.ts:34-45`). R7. |
| AC5: host-owned rows untouched; no unmerged LTM mirror | Partial | Attribution write targets remain Buck-owned; no new host messages write identified. Importer still scans raw Markdown (`758-775`) and sends the resulting bodies via retainBatch (`819-829`) with no publication eligibility. Prior local HTTP smoke observed private export. R6. |
| AC6: full persistence census reconciled with actual migration/exclusion evidence | Missing | Reconciliation claims phase-completion retention, but `phase-completion.ts:88-123` writes only files. Blueprint writer remains unretained; durable review/PR/auto-fix evidence exclusions contradict the original census. R10. |
| Implementation detail 1: save and loop cutover | Partial | Shared retention added; authoritative reads/receipts/config/run binding still incomplete (R1–R5). |
| Implementation detail 2: hook/bridge/attribution | Partial | Existing native bridge is prerequisite; hook URL gate repaired. Attribution insert/dedupe precedes retain and cannot retry a failed retain (`db.ts:123-145`). |
| Implementation detail 3: immutable review persistence | Partial | Local immutable write refusal retained (`run-state.ts:204-226`); store identity and authoritative readers incomplete, and loop discards persistence promises (`loop.ts:326-328,732-738`). |
| Implementation detail 4: packages/import/publication boundary | Partial | Byte-preserving retention exists; CLI/default invocation and blueprint incomplete; raw private bodies can still enter unscoped LTM. |
| Implementation detail 5: site connection | Missing | Store source remains disconnected from all page entrypoints. |
| Focused state-kind checks / exact readback | Partial | Fresh hook gate tests and runtime smoke pass; prior binary/readback smokes remain limited evidence. No new PostgreSQL consumer or all-adapter hook readback performed. |
| Two real worktrees / mutable resume isolation | Not-verifiable | No production two-worktree fixture was exercised in this review; current readers/identity code do not support claiming this criterion met. Requires the fixture prescribed in the iteration. |
| Guardrails | Complete | Fresh durable v2 runner passes; details below. |
| Actual rendered site | Not-verifiable | Previous site build reported missing Astro executable. No dependency repair occurred in this assignment and no browser verification is claimed. Disconnected pages independently establish R7. |
| Blocking assumptions | Complete | No unresolved Phase-5 blocker in parent A1–A5; their recorded validation paths remain unchanged. |
| Deferred assumptions | Complete | None assigned to this phase. Later-phase history/migration work was not reopened. |
| Relevant material safety claims | Partial | Parent risk 3 (private body bypass) and risk 5 (uncertain persistence/false completion) are contradicted by R6 and R2/R4. Reject-stale/resume-recorded-attempt safety is not established for these consumers. Later-phase rollback/publication validation remains in its declared phases. |

## Spec Axis Findings

Stable IDs refer to the original review. Every finding below is **in-plan**; no new scope or doc-only concern is made a blocker.

| ID / severity | Current location | Defect and required repair |
|---|---|---|
| R1 / High | `skills/_shared/storage/consumers.ts:135-146,190-213`; `extensions/buck-loop/persist.ts:137-199` | Placeholder project/branch identity, fresh unrelated runs, unsafe physical worktree IDs, omitted origin/project override/root and separate resume identity defeat real retrieval/isolation. Reuse trusted cwd/config/context binding, pin the destination and stable run at start. |
| R2 / High | `consumers.ts:153-159,186-188`; `extensions/code-review-iteration/loop.ts:326-328,732-738`; importer `saveManifest` | Drain resolves rejection; authoritative writes are unawaited and terminal paths can report success/exit before durability. Await persistence at operation/shutdown boundaries, retain failure evidence and bind the destination before enqueueing. |
| R3 / High | `persist.ts:125-177,208-219`; `run-state.ts:129-173`; importer `562-581`; attribution `db.ts:123-145` | Adapter copies are mirrors, not read/resume/cursor/dedupe authority. Optional file disappearance prevents resume; old-table dedupe prevents retry after retain failure. Move both readers and writers to exact bound service identities; projections cannot be fallback authority. |
| R4 / High | `sql-save.ts:82-87,123-124,138-164,218-233,287-297`; `save-apply.ts:641` | Local receipt precedes durable write; retry skips repair; verification checks visible IDs/local completed flag instead of durable attempt/status/duties. SQL-mode metadata skips adapter sealing. One persisted attempt must own facts, metadata completion and verification for both entrypoints. |
| R5 / High | `consumers.ts:173-183`; `save-apply.ts:600-619`; native `workflow-state.ts:286-296` | Prefixed physical-name classifier writes a second artifact instead of updating the native subject-relative logical name; links and expected revision are omitted. Reuse existing logical reference conversion and conditional updates/move semantics. |
| R6 / High | `skills/b-memory-import/scripts/import-context-memory.ts:758-775,819-829` | Raw branch memory source has no publication check before LTM payload construction. Source adapter revisions and export only publication-proven knowledge; quarantine ambiguous legacy records. Preserve host ownership. |
| R7 / High | Three Astro entrypoints cited above; `docs/plans/src/lib/plans/sql.ts:11-45` | New reader is disconnected, only includes plans, loses subject status and uses site process cwd without explicit checkout resolution. Connect pages through the seam, preserve doc/status/link contracts and exercise actual adapter-only rendered content. |
| R8 / High | `skills/b-present/scripts/retain-package.ts:17-23` | Absent --cwd gives -1; the positional finder rejects index zero as its presumed value. Filter flag/value only when flag exists; prove exact documented invocation and explicit/invalid flag cases. |
| R10 / High | `phase-completion.ts:88-123`; `skills/b-blueprint/SKILL.md:51-58,197-203`; inventory reconciliation | Still-owned writers remain file-only; census exclusions silently reduce scope. Migrate writer/reader pairs and retained packages; reconcile every original row against concrete ownership and actual behavior. |

### R9 — partially repaired, Medium remainder
- `extensions/turn-memory/enable.ts:27-36` and hook status/capture no longer require SQL_MEMORY_URL. Fresh 12-test run and direct runtime smoke prove explicit enablement and opt-out without that variable.
- `hooks/post/turn-memory.ts:93-103` still contains obsolete cached pool/getter/reset API. Repository search finds consumers only in its own implementation-only pool test (`hook.test.ts:118-133`), not production. Remove obsolete API and its now-incidental tests as part of clean cutover.
- This evidence proves gate repair only. Default persistence and branch/run dedupe on all four adapters remain unchecked; do not infer full hook migration from a status/gate smoke.

## Standards Axis — Explicit Sequential Fallback Pass
No task dispatch tool is available. After acceptance inspection, a separate standards pass used TypeScript async/error/no-floating-promises sections, the universal reuse/redundant-state guide, and only Duplicate Code, Shotgun Surgery and Dead Code references.

- **Worst: S1 / High — lost asynchronous durability failures.** Failure-resolving queue drain and unawaited production calls remain (`consumers.ts:153-159,186-188`, review loop `326-328,732-738`). Completion must observe authoritative persistence failure, independently of the plan's wording.
- **S2 / High — divergent duplicate identity/store-opening responsibilities.** Consumers/resume reimplement trusted context/config and store opening already owned by `workflow-state.ts:173-187,228-261`. Concrete placeholder identities and ignored root/project overrides show behavioral drift, not cosmetic similarity. Reuse existing authority rather than add another abstraction.
- **S3 / High — duplicate physical-to-logical identity.** Native subject-relative key versus prefixed classifier creates consumer-visible stale reads. A single existing reference convention must own conversion.
- **S4 / Low — dead production pool API maintained by implementation-only tests.** R9 cleanup remains; no production reference found. Delete with cutover, rather than preserve artificial compatibility.
- Spec axis worst finding: **R6 — unmerged private knowledge export to unscoped LTM (High)**.
- Standards axis worst finding: **S1 — lost asynchronous durability failures (High)**.
- Cross-axis ranking: **none**; no merged priority list.

## Verification Status
- Goal achieved: **partial**; selected-backend retention exists but not authoritative consumer reads/completion/isolation.
- User goal: **partially met**; reliable adapter resume/private retrieval cannot be claimed.
- Scope adhered: inspected consumer/helper/config/bundle/installer changes serve Phase 5. Prior confinement changes are prerequisite context. No new review execution policy, UI redesign or host data replacement introduced by this assignment.
- Out-of-scope changes by reviewer: none. Source/tests/config/phase/overview/lifecycle/backlog left untouched.
- Implementation notes' deferral of ordinary external/PostgreSQL resume does not reduce this accepted phase scope.

## Guardrails Verdict
- Fresh command: `npm run guardrails:check`, exit 0; runner wall time 73.95 seconds.
- Contract: **durable**, version **2**, runner **1.0.0**, status **pass**.
- Gates: `unit_test_gate=pass`, `functional_test_gate=skipped`, `lint_gate=skipped`, `patch_gate=advisory`, `global_ratchet=pass`, `complexity_gate=pass`.
- Coverage: **88.7** versus baseline **84**; target **90**; patch **null**, threshold **90** (advisory).
- Complexity: 30 existing hotspots / baseline 30; no new violations or hard-ceiling violations.
- No gate/threshold/baseline was changed; proposed ratchet raise not applied.

### Additional fresh verification
- `env -u SQL_MEMORY_URL npx vitest run extensions/turn-memory/__tests__/enable.test.ts extensions/turn-memory/__tests__/hook.test.ts`: **2 files, 12 tests passed**.
- Direct Bun runtime call to `isTurnMemoryEnabled`/`turnMemoryStatus` with explicit enable/opt-out and no legacy URL produced `{"legacyUrlPresent":false,"enabled":true,"status":"turn-memory: on","optedOut":true}`. No storage write or LTM request made by this smoke.
- No new all-adapter consumer, PostgreSQL workflow, rendered site or full hook durability claim. Historical reproduced failures are attributed to the earlier report, not fabricated as fresh output.

## User Goal Analysis
- Goal: choose durable storage, resume reliably, keep unmerged work out of unrelated retrieval.
- Met: backend batch/receipt primitives and byte-preserving package retention exist; explicit capture enablement no longer uses the legacy URL gate.
- Partial: consumer retention wiring and local immutable review refusal.
- Missing: trusted shared scope, authoritative readers, failure-aware completion/receipts, private import boundary, actual connected site and complete package/evidence cutover.
- Verdict: **partially met** for Phase 5.

## Documentation Impact
Non-blocking: adapter authority versus mirrors, capture enablement, importer publication eligibility, retention and site configuration need living docs synchronized after correctness repair. Recommend `/b-docs` before accepted closeout. Documentation impact is not included in the iteration defects.

## How-to Impact
Non-blocking: configured-store capture/import/package retention and adapter-backed site invocation require accurate procedures and observable readback. Recommend `/b-docs` first; follow `/b-howto` as appropriate.

## Issue Classification
- In-plan: R1–R8, R10 (nine High); R9 partially repaired with obsolete pool cleanup outstanding. Fix proposals and verification obligations in `iterate-phase-5-remaining-consumers-rereview.md`.
- Out-of-plan: none. Later publication/history/migration work remains in its assigned phases.

## Recommended Next Step
Report **Needs work** to the supervisor with the iteration artifact; `/b-iterate` repairs only this phase, then `/b-review` rechecks the same contract. Reviewer does not select the next loop state. Accepted `/b-docs` → `/b-save` → `/b-commit` closeout is not yet justified; historical memory index has no accepted Phase-5 closeout.

## Completion Audit
1. Objective restated as six concrete consumer deliverables.
2. Each deliverable mapped to current source and explicitly dated observations.
3. Current source inspected; authoritative deterministic contract freshly passed.
4. Actual revised gate exercised; site/all-adapter verification limits explicitly retained.
5. Partial/missing/not-verifiable criteria were not promoted by completed metadata or green tests.
6. Both review axes completed using the documented sequential fallback. No loop state/lifecycle change made.
