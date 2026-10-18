---
status: active
date: 2026-10-12
subject: 2026-10-10.durable-storage-adapters
topics: [review, storage-consumers, receipts, branch-isolation]
review_verdict: request-changes
addresses: phase-5-remaining-consumers.md
related: [iterate-phase-5-review-recovery.md, review-phase-5-remaining-consumers-rereview-2026-10-12.md]
---

# Plan Path Review: Phase 5 — Remaining Durable Consumers (recovery review)

## Verdict
**Needs work.** Nine High in-plan defects and one Medium cutover remainder. This review assignment is complete; Phase 5 implementation is not accepted. The supervisor owns loop routing. Completed phase metadata does not override source-state defects.

## Plan Source
- Phase: `phase-5-remaining-consumers.md`; parent: `plan-durable-storage-adapters.md`, step 5.
- Goal: migrate every remaining Buck-owned durable consumer to one selected storage service, preserving receipts, exact bytes, private runs, reliable resume and host ownership.
- Baseline: current working tree against `202ca5d999b65c9093a30bdf81e365ae218c783a`; prior Phase 1–4 work is prerequisite context, not reopened scope.
- Explicit phase input resolves subject `2026-10-10.durable-storage-adapters`; stale current-session subject is ignored. Current-session has no active goal field.
- Parent research, assumptions ledger, material risks and full persistence census were read. A-1–A-5 are validated; none is an unresolved Phase-5 blocking assumption.

## Evidence Sources
- Initial Git status: pre-existing staged/unstaged consumer implementation, earlier review/iteration documents, untracked shared helper/tests/notes and unrelated Phase-4 artifacts. These were not modified or staged by this reviewer.
- Initial diff summaries: 31 unstaged tracked paths (736 insertions / 166 deletions), 10 staged paths (650 insertions / 16 deletions), plus untracked paths. Overlap exists; these are not additive unique-file counts.
- Relevant recent commits: `202ca5d`, `fbe9b5a`, `db31575`, `849ef5a`, `065b776`. Neither commit messages nor checked criteria were treated as proof.
- Current source: shared consumers/config/store seam, both save paths, loop persistence/audits/activity/ranking/phase completion, review writers/readers and production callsites, hook capture/enablement, attribution/dedupe, import source/manifest/LTM transport, presentation CLI and blueprint instructions, site source and all three page entrypoints, canonical/bundled presentation script, installer shipping entry and confinement prerequisite diff.
- Fresh execution: authoritative guardrails; five focused consumer suites; actual presentation CLI.
- Earlier failure observations are explicitly historical. Their defective paths remain in the inspected source; known failing scenarios were not rerun merely to confirm them.

## Completion Matrix

| Deliverable | Status | Evidence / missing piece |
|---|---|---|
| AC1: both saves use same-adapter batches and attempt receipts | Partial | `consumers.ts:51-76` writes batch/receipt; `save-apply.ts:594-626` seals file-mode bytes. `sql-save.ts:82-87,123-124,138-164,218-233,287-297` still trusts local retry/completed flags instead of authoritative completed receipt/duties; SQL-mode apply skips seal at `save-apply.ts:641`. R4/R5. |
| AC2: loop/review/hook/attribution/import authority and run privacy | Partial | New retained copies exist, but `consumers.ts:135-146` uses placeholder scope and fresh runs; `153-159,186-188` loses drain failures. Loop resume requires local projection (`persist.ts:208-219`), review readers require local files (`run-state.ts:129-173,252-258`), importer loads local manifest (`562-569`). R1–R3; R9 cleanup remains. |
| AC3: retained packages/attachments, binary intact | Partial | Binary package helper exercised by focused tests (`consumer-persist.test.ts:161-205`). Actual CLI exits 1 with `cwd is not defined` at `retain-package.ts:34`; blueprint still has file-only package instructions. R8/R10. |
| AC4: actual plan-site source connected, stub removed, no redesign | Missing | Stub replaced in `sql.ts`, but all three page entrypoints still instantiate FilesystemPlanSource directly. Loader includes only plan kind (`consumers.ts:87-94`) and emits null subject status (`sql.ts:34-45`). R7; fix proposal in iteration. |
| AC5: host rows untouched and no private LTM mirror | Partial | Inspected attribution SQL targets remain Buck-owned; no new host messages/session/LTM-row mutation identified. Importer still builds payloads from raw Markdown (`758-775`) and sends them (`819-829`) without publication eligibility. R6. |
| AC6: original census reconciled against actual migration/exclusion | Missing | Inventory claims phase-completion retention, but `phase-completion.ts:88-123` writes only files. Blueprint retention missing; original durable auto-fix/review/PR evidence ownership is relabeled without proof (`inventory:97,104`). R10; fix proposal in iteration. |
| Detail 1: saves and loop cutover | Partial | Retention wiring exists; authoritative read/resume/receipt and pinned identities missing (R1–R5). |
| Detail 2: hook, plan bridge, attribution | Partial | Prerequisite bridge already calls workflow_state; hook capture enablement works without legacy URL in passing suites. Attribution dedupe precedes retention (`db.ts:123-145`), and hook retains obsolete pool API. |
| Detail 3: review immutable pass/state/report persistence | Partial | Local immutable refusal remains (`run-state.ts:204-226`); store writes use new runs and physical run-directory identity. Production loop discards returned promises (`loop.ts:326-328,732-738`); service-backed recovery missing. |
| Detail 4: packages/import/publication boundary | Partial | Correctly injected SQLite package helper preserves bytes. Production CLI and blueprint retention incomplete; raw private memory export remains. |
| Detail 5: site seam connection | Missing | Actual pages bypass the new source; required fix in iteration. |
| Focused state-kind verification | Partial | Five suites / 37 tests pass. These exercise helpers/injected SQLite contexts, not all real adapter consumer boundaries. Actual CLI smoke fails before retention. |
| Two real worktrees / independent mutable resume | Not-verifiable | This assignment did not exercise a production two-worktree fixture. Helper scopes are synthetic; actual reader and identity defects preclude acceptance. |
| Deterministic contract | Complete | Fresh durable v2 guardrails pass, exit 0. |
| Actual rendered adapter-only site | Not-verifiable | No rendered-site/browser execution performed. Earlier review recorded missing Astro executable; this review did not install dependencies or claim that historical failure as fresh output. Disconnected pages independently establish R7. |
| Blocking assumptions | Complete | No unresolved blocker assigned here in parent A-1–A-5; recorded evidence retained. |
| Deferred assumptions | Complete | None assigned to this phase. Later publication/history/migration work remains in its declared phases. |
| Material safety claims relevant to consumers | Partial | Parent risk 3's private-body boundary contradicted by R6; risk 5's uncertain-persistence/completion mitigation contradicted by R2/R4. Later-phase rollback/publication fixtures are not demanded in Phase 5. |

## Spec Axis Findings

All findings below are **in-plan**. Stable IDs preserve traceability to the earlier reports.

| ID / severity | Current location | Defect and required repair |
|---|---|---|
| R1 / High | `skills/_shared/storage/consumers.ts:135-146,190-213`; `extensions/buck-loop/persist.ts:137-199` | Retains invent configured-project/configured-branch, create a new run on every write, accept physical worktree paths, omit origin-based project selection/external root; resume invents separate project/ref identities. Reuse trusted cwd/config binding and pin destination plus exact run once. Existing authority is `workflow-state.ts:173-187,228-261`. |
| R2 / High | `consumers.ts:153-159,186-188`; review `loop.ts:326-328,732-738`; activity/audit/attribution/import writers | Queue continuation resolves rejection and flush returns that success-resolving tail. Production callers discard persistence promises; activity close only waits for stream finish. Await durable boundaries and preserve failures before success/exit. |
| R3 / High | `persist.ts:125-177,208-234`; review `run-state.ts:129-173,252-258`; importer `562-581`; attribution `db.ts:123-145` | Adapter writes remain mirrors, not authoritative readers/resume/cursors/dedupe. Local file disappearance prevents restart; failed retain cannot retry after old-table dedupe. Route both readers/writers through exact persisted service context; no local fallback on outage. |
| R4 / High | `sql-save.ts:82-87,123-124,138-164,218-233,287-297`; `save-apply.ts:641` | Local receipt precedes durable receipt; retry returns local IDs without repairing missing durable receipt. Completion/verify never read authoritative completed status/duties. SQL-mode metadata bypasses seal. One persisted attempt must own facts, metadata and completion verification for both saves. |
| R5 / High | `consumers.ts:173-183`; `save-apply.ts:600-619`; native projection `workflow-state.ts:286-296` | New classifier uses subject-prefixed physical logical names while existing native projection uses subject-relative names, creating separate artifacts. Conditional revision/link/move semantics omitted. Use the existing exact logical reference and conditional update convention. |
| R6 / High | `skills/b-memory-import/scripts/import-context-memory.ts:758-775,819-829` | Raw filesystem source goes into Hindsight retain payloads without adapter/publication eligibility. Retaining a manifest does not prevent unmerged-body leakage. Read selected-store source and send only publication-proven knowledge; quarantine ambiguous legacy records. |
| R7 / High | `docs/plans/src/pages/index.astro:3-6`, `[subject].astro:4-10`, `[subject]/[...doc].astro:5-12`; `sql.ts:11-45` | Pages bypass configured source; new loader loses non-plan documents/status and uses site cwd as workflow root. Connect actual reader seam, preserve documents/status/links/previews and explicit checkout binding, exercise actual adapter-only rendered content. |
| R8 / High | canonical and bundled `skills/b-present/scripts/retain-package.ts:32-35` | Positional filtering has been repaired, but `cwd` is undeclared. Fresh CLI exits 1: `retain-package: cwd is not defined`. Derive optional cwd from validated flag, exercise default and explicit invocation, and synchronize bundle. |
| R10 / High | `phase-completion.ts:88-123`; `skills/b-blueprint/SKILL.md:51-58,197-203`; census reconciliation | Phase/overview writers remain file-only despite retention claim; blueprint package lacks retention. Durable evidence exclusions contradict original ownership census. Migrate remaining owned writers/readers and demonstrate valid exclusions rather than narrowing scope through notes. |

### R9 / Medium — repaired gate, incomplete clean cutover
`hooks/post/turn-memory.ts:93-103` retains unused SQL pool/getter/reset functions; repository search finds only implementation-only tests, not production callers. Fresh hook/enablement suites pass without SQL_MEMORY_URL. Remove dead API/tests as part of cutover and verify actual default hook service-backed write/dedupe on each adapter. Host session journal ownership remains unchanged; its existing dedupe projection is not proof of new adapter authority.

### Historical runtime evidence, not rerun here
The original report records: real SQLite receipt-write failure followed by retry/local completion yielded verified save with null durable receipt (R4); native read remained stale after save-apply updated a second key (R5); local HTTP receiver received `UNMERGED-SECRET-SMOKE` (R6). Current inspected source retains those paths. R8 has changed: the former absent-flag parsing defect is fixed, replaced by the freshly observed undefined-cwd failure.

## Standards Axis — Explicit Sequential Fallback
No task/sub-agent dispatch is available. A second standards pass, after acceptance inspection, used TypeScript async/error/no-floating-promises guidance, universal reuse/duplicate-state guidance and only Duplicate Code, Shotgun Surgery and Dead Code smell references.

- **S1 / High, worst:** lost asynchronous durability failures and unawaited changed APIs (`consumers.ts:153-159,186-188`, review production calls above). Completion cannot ignore the result of authoritative persistence.
- **S2 / High:** divergent duplicate identity/store openers (`consumers.ts:135-213`, `persist.ts:137-199`) ignore the existing trusted opener's project/root/branch contract, causing actual retrieval/isolation drift.
- **S3 / High:** duplicate logical-name conversion writes independent current artifacts; tests normalize placeholder identities instead of exercising real project/worktree contexts (`consumer-persist.test.ts:108-144`). Passing helper tests do not establish production isolation.
- **S4 / Low:** obsolete pool API is maintained solely by incidental implementation tests after its production caller was removed.
- Spec axis worst: **R6 — private knowledge sent to unscoped LTM (High)**.
- Standards axis worst: **S1 — lost asynchronous durability failure (High)**.
- Cross-axis ranking: **none**; findings are not combined into one ranked list.

## Verification Status
- Goal achieved: **partial**; retention primitives exist but consumer authority/isolation/completion remain incomplete.
- User goal: **partially met**; selectable backend retention is not reliable adapter-only resume/private retrieval.
- Scope: inspected consumer/config/opener/SQLite/install/bundle changes support the accepted phase. Adjacent confinement change is the prerequisite-complexity refactor recorded by implementation notes; not treated as a new phase deliverable. No review execution-policy redesign or host-data replacement found in inspected changes.
- Out-of-scope changes by reviewer: none. Sources, tests, config, phase/overview/lifecycle/backlog/history remain unchanged.
- Ordinary external/PostgreSQL same-checkout resume cannot be deferred to Phase 6 without approved scope reduction; no such approval exists in this assignment.

## Guardrails Verdict
- Fresh command: `npm run guardrails:check`; exit **0**, wall time **74.39s**.
- Contract: **durable**, version **2**, runner **1.0.0**, status **pass**.
- Gates: `unit_test_gate=pass`, `functional_test_gate=skipped`, `lint_gate=skipped`, `patch_gate=advisory`, `global_ratchet=pass`, `complexity_gate=pass`.
- Coverage **88.7**, baseline **84**, target **90**; patch **null**, threshold **90** (advisory).
- Complexity: 30 existing hotspots / baseline 30; no new violations or hard-ceiling violations.
- Runner proposed coverage ratchet raise; no configuration/baseline/enforcement was changed.

### Additional fresh execution
- `env -u SQL_MEMORY_URL npx vitest run skills/_shared/scripts/consumer-persist.test.ts extensions/code-review-iteration/__tests__/run-state.test.ts extensions/token-attribution/__tests__/db.test.ts extensions/turn-memory/__tests__/enable.test.ts extensions/turn-memory/__tests__/hook.test.ts`: **5 files / 37 tests passed**, exit 0.
- `bun skills/b-present/scripts/retain-package.ts /tmp/phase-5-review-package --cwd /tmp`: exit **1**, `retain-package: cwd is not defined`. Failure occurs during options construction before package read/store write; no fixture or external data was created.
- No PostgreSQL consumer workflow, production two-worktree resume, default hook all-adapter readback or rendered-site verification claimed.

## User Goal Analysis
- Goal: choose durable storage, resume reliably across sessions/worktrees, keep unmerged work out of unrelated ordinary retrieval.
- Met: shared batch/receipt helper, correctly injected SQLite binary package round-trip, repaired hook enablement.
- Partial: retention wiring and local immutable pass refusal.
- Missing: trusted pinned scope, authoritative readers and completed receipts, private import boundary, operational presentation CLI/site, complete evidence/package census cutover.
- Verdict: **partially met**.

## Documentation Impact
Non-blocking: selected-store authority versus mirrors, capture enablement, importer eligibility, package retention and site configuration need living docs synchronized after correctness repair. Recommend `/b-docs` before accepted `/b-save`; this is not an iteration correctness defect.

## How-to Impact
Non-blocking: configured capture/import/package retention and adapter-backed site use need procedures with observable readback. Recommend `/b-docs` first, following `/b-howto` where applicable.

## Issue Classification
- In-plan: R1–R8 and R10 (nine High), R9 (Medium cutover remainder). Repair proposals in `iterate-phase-5-review-recovery.md`.
- Out-of-plan: none. Later history/publication/cutover work remains in its assigned phases.

## Recommended Next Step
Return **Needs work** and the iteration artifact to the supervisor. `/b-iterate` must repair these Phase-5 defects, then `/b-review` must recheck this exact phase. Accepted save/commit closeout is not justified; the historical memory ledger contains no accepted Phase-5 closeout. No loop-state decision or lifecycle transition was made.

## Completion Audit
1. Objective restated as all six phase deliverables.
2. Each mapped to direct source, fresh execution or explicit verification limit.
3. Current code inspected; deterministic contract freshly passed.
4. Actual changed CLI exercised; all-adapter/two-worktree/site limits not promoted to success.
5. Partial/missing/not-verifiable criteria remain unachieved despite checked metadata and green suites.
6. Both review axes completed using sequential fallback; assignment deliverable is the review, not an implementation pass.
