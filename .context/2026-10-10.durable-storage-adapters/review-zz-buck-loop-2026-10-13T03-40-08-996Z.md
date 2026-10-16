---
status: active
date: 2026-10-12
subject: 2026-10-10.durable-storage-adapters
topics: [review, storage-consumers, receipts, branch-isolation]
review_verdict: request-changes
addresses: phase-5-remaining-consumers.md
related: [iterate-phase-5-final-review.md, review-phase-5-recovery-2026-10-12.md]
---

# Plan Path Review: Phase 5 — Remaining Durable Consumers

## Verdict
**Needs work.** Eight High in-plan implementation defects remain (R1–R7, R10), plus Medium hook clean-cutover and required bundle/check defects (R9, R11). R8 presentation CLI defect is repaired and exercised. This review assignment is complete; Phase 5 is not accepted. The supervisor owns loop routing.

## Plan Source
- Exact phase: `.context/2026-10-10.durable-storage-adapters/phase-5-remaining-consumers.md`.
- Parent: `plan-durable-storage-adapters.md`, implementation step 5; linked `research-durable-storage-adapters.md` read.
- Goal: move every remaining Buck-owned durable consumer to the selected storage service, preserving complete receipts, private runs, binary packages, reliable resume and host ownership.
- User Goal: users choose durable storage per project and keep unmerged work invisible on other branches; inherited goal also requires reliable resume across sessions/worktrees.
- Baseline: current staged + unstaged + untracked source state against `202ca5d999b65c9093a30bdf81e365ae218c783a`. Long-lived branch history is prerequisite context, not a Phase-5 completion claim.
- Explicit path resolves subject `2026-10-10.durable-storage-adapters`; current-session's stale subject does not override it. Current-session has no active goal field.

## Evidence Sources
- Initial Git status: pre-existing consumer source/test/bundle changes, earlier staged review/iteration artifacts, phase/inventory/overview modifications, untracked shared consumer modules/notes and unrelated Phase-4 artifacts. Review did not modify or stage those paths.
- Relevant recent commits: `202ca5d`, `fbe9b5a`, `db31575`, `849ef5a`, `065b776`. No status field, checkbox or commit subject is proof.
- Modified groups inspected: `extensions/buck-loop/{persist,sql-save,activity-log,choice,ambiguity,ranking,loop}.ts`; `extensions/code-review-iteration/{run-state,report}.ts`; `extensions/token-attribution/db.ts`; turn-memory hook/enablement; save-apply; memory importer; presentation retention CLI/helper; plan-site SQL source; shared config/SQLite/trusted opener and bundle.
- Plan affected consumers verified by current-source inspection: both saves including `extensions/b-save-improved/index.ts:722-767`; loop save verification `loop.ts:1085-1107`; review production callers/readers; importer manifest and LTM transport; actual three site page entrypoints; phase completion and blueprint census remnants. Prerequisite plan bridge/lifecycle decisions were not reopened.
- Parent assumptions/material risks and full original/reconciled persistence census read. A-1–A-5 have validated status with recorded evidence; no unresolved Phase-5 blocking assumption is assigned.
- Fresh execution: authoritative guardrails twice, actual presentation CLI twice against isolated configured SQLite with exact binary/receipt readback, canonical/bundled CLI byte comparison.

## Completion Matrix

| Deliverable | Status | Evidence / missing piece |
|---|---|---|
| AC1: both saves use same-adapter batches and attempt receipts | Partial | `consumers.ts:51-76` writes batch and receipt; `save-apply.ts:595-622` seals file-mode bytes. `sql-save.ts:82-87,123-124,135-164,218-233,287-297` still trusts local completion/retry rather than authoritative complete receipt/duties; SQL-mode apply skips seal at `save-apply.ts:641`. R4/R5. |
| AC2: loop/review/hook/attribution/import service authority and run privacy | Partial | Retention wiring exists, but `consumers.ts:135-146` uses invented project/branch and fresh runs; `153-159,186-188` loses drain failures. Resume requires local files (`persist.ts:208-234`), review readers require local state (`run-state.ts:129-173,252-258`), importer reads file manifest (`562-569`). R1–R3/R9. |
| AC3: retained packages/attachments, binary intact | Partial | Actual repaired CLI under SQLite preserved binary hex `00ff89504e470d0a`, default and explicit `--cwd`, exact current revisions in matching receipts. Standalone blueprint still has only file output instructions (`b-blueprint/SKILL.md:51-58,197-203`). R10. No all-adapter package claim. |
| AC4: connect actual plan-site reader, remove stub, no redesign | Missing | Stub replaced by `SqlPlanSource`, but pages instantiate FilesystemPlanSource directly (`index.astro:3-6`, `[subject].astro:4-10`, `[subject]/[...doc].astro:5-12`). Loader fetches only plan kind and drops subject status (`consumers.ts:87-94`, `sql.ts:11-45`). Fix proposal R7. |
| AC5: host rows untouched; no private knowledge mirrored into LTM | Partial | Inspected attribution SQL targets remain Buck-owned; no new host `messages` or session/LTM-row replacement found. Importer still constructs raw Markdown payloads (`758-775`) and sends them (`819-829`) without publication eligibility. R6. |
| AC6: entire original persistence inventory reconciled | Missing | Claimed phase/overview retain contradicts file-only writes (`phase-completion.ts:88-123`); blueprint retention missing; original retained auto-fix/review/PR evidence relabeled excluded without ownership proof (`inventory:97,104`). Fix proposal R10. |
| Detail 1: saves + loop persistence | Partial | Retention added; trusted scope, authoritative reads/resume and completed receipt still missing (R1–R5). |
| Detail 2: hooks, plan bridge, attribution | Partial | Hook uses configured opener and respects opt-out without legacy URL; prerequisite bridge remains workflow_state-based. Attribution dedupe is still old-table-authoritative (`db.ts:123-145`); default hook run/receipt/dedupe remains incomplete. |
| Detail 3: review pass/state/report persistence, immutable evidence | Partial | Local immutable refusal preserved (`run-state.ts:204-226`); retention promises discarded by real loop (`loop.ts:326-328,732-738`); service-backed read/resume unavailable. |
| Detail 4: packages, import and published-only mirror | Partial | Actual CLI + binary readback now works in SQLite; private import filter, adapter manifest authority and blueprint retention missing. |
| Detail 5: site seam | Missing | Current pages bypass configured source; fix R7. |
| Focused state-kind verification | Partial | Actual CLI plus SQLite attachment/receipt exercised. Full production hook, attribution/import cursor and retained review authority on required adapters not established. |
| Two real worktrees: independent mutable resume | Not-verifiable | No production two-worktree runtime fixture executed in this assignment. Synthetic helper scopes are not real worktree proof. Source authority/identity defects independently block acceptance. |
| Required deterministic contract | Missing | Both fresh durable v2 runs fail unit/global-ratchet gates; bundle recursive-path parity names b-present. Fix R11. |
| Actual rendered adapter-only site | Not-verifiable | No Astro/browser execution this assignment. Prior recorded missing Astro executable remains historical, not fresh evidence; disconnected entrypoints independently establish R7. |
| Blocking assumptions | Complete | No unresolved blocking assumption assigned to Phase 5 in parent A-1–A-5. Runtime/library verification from preceding phases is not reopened. |
| Deferred assumptions | Complete | None assigned to this scope. Publication/history/legacy-cutover checks remain in their declared phases. |
| Relevant material safety claims | Partial | Parent risk 3's private-body boundary is contradicted by R6; risk 5's fail-closed persistence/completion by R2/R4. Safe refusal is not demonstrated for these consumers. Later-phase publication-revocation/rollback fixtures are not demanded here. |

## Review Axes
- **Spec axis worst finding: R6 / High — private knowledge can enter unscoped host-LTM payloads without publication eligibility.**
- **Standards axis worst finding: S1 / High — authoritative persistence errors and changed Promise results are discarded.** Explicit sequential fallback; no sub-agent dispatch tool available.
- Cross-axis ranking: **none**. The axes are not merged into one ranked list.

### Spec Axis Findings
All listed issues are **in-plan**, with current-source evidence and repair/verification proposals in `iterate-phase-5-final-review.md`.

| ID / severity | Location | Defect |
|---|---|---|
| R1 / High | `consumers.ts:125-159,190-213`; `persist.ts:137-199` | Placeholder project/branch, physical worktree identity and per-write run IDs diverge from trusted native reader context. Origin/project override and external root omitted; no pinned destination/run. Hook's worktree-as-receipt-run fallback also cannot represent distinct attempts safely. |
| R2 / High | `consumers.ts:153-159,186-188`; review `loop.ts:144-148,326-328,580-600,732-738`; activity/import terminal boundaries | Success-resolving queue tail loses failures; new persistence promises not awaited by production callers. Import CLI calls process.exit immediately after scheduled manifest retention (`import-context-memory.ts:929-932`). |
| R3 / High | `persist.ts:125-177,208-234`; review `run-state.ts:129-173,252-258`; importer `562-581`; attribution `db.ts:123-145` | Retained copies are mirrors, not resume/read/cursor/dedupe authority. Missing projection prevents restart; opener outage falls back to files; old-table dedupe prevents repair of missing retained record. |
| R4 / High | `sql-save.ts:82-87,123-124,135-164,218-233,287-297`; `save-apply.ts:641`; save wrapper `index.ts:722-767` | Local receipt precedes durable receipt; retry trusts local IDs; local completed flag plus visible-fact/probe authorizes verification without authoritative completed receipt/duties. SQL-mode metadata skips seal. |
| R5 / High | `consumers.ts:96-106,173-183`; `save-apply.ts:600-619`; `workflow-state.ts:286-296` | Subject-prefixed physical logical names differ from native subject-relative identity; separate artifact created, links/conditional revision/move semantics omitted. |
| R6 / High | `import-context-memory.ts:758-775,819-829` | Raw filesystem bodies become Hindsight payloads without selected-store/publication check. Manifest retention is not a privacy filter. |
| R7 / High | three site entrypoints cited above; `sql.ts:11-45` | Actual site never selects new adapter source. New loader loses non-plan documents and subject status, assumes site cwd is workflow checkout. |
| R10 / High | `phase-completion.ts:88-123`; `b-blueprint/SKILL.md:51-58,197-203`; inventory reconciliation | Original owned writers/packages remain unmigrated; inventory claims retention where source is file-only and reclassifies retained evidence without proof. |
| R9 / Medium | `hooks/post/turn-memory.ts:93-103`; hook tests `118-133` | Removed production SQL-pool use leaves obsolete pool/getter/reset API maintained only by incidental tests; default full adapter capture/dedupe not verified. |
| R11 / Medium, blocking check | `scripts/codex-plugin.test.ts:92-99`; canonical/bundled `b-present/scripts/` | Canonical directory includes `retain-package.test.ts`, bundled copy does not. Both required guardrails runs fail this recursive path-parity test. |

### Repaired R8 — Current Runtime Evidence
`retain-package.ts:32` now declares optional cwd. Actual default invocation and explicit `--cwd` from a different process cwd both succeeded on configured SQLite. Canonical/bundled script is byte-identical (`cmp`, exit 0). Earlier positional/cwd failures are not current findings. This does not close blueprint retention or all-adapter verification.

### Historical Evidence Boundary
Prior reports record a missing durable receipt despite verified local completion (R4), stale native token after save writes a different key (R5), and local HTTP capture of a private body (R6). These known failures were not rerun merely to confirm them. Current source still contains the defective paths. CLI repair has changed source and was freshly exercised; no historical result is labeled fresh.

## Standards Axis — Separate Sequential Pass
After acceptance inspection, performed an explicitly scoped standards pass using `code-review-universal/reference/typescript.md` (async errors/no-floating-promises), `reference/code-quality-universal.md` (reuse/duplicate state), and only the Duplicate Code, Shotgun Surgery and Dead Code references from `code-smells`. No full-catalog or independent architecture redesign.

- **S1 / High, worst:** failure-swallowing tail and unawaited persistence API changes (`consumers.ts:153-159,186-188`, review callers above); actual terminal/shutdown paths can finish without durability. Appropriate repair is await propagation and failure retention, not extra abstractions or warning suppression.
- **S2 / High:** duplicate identity/store openers ignore existing trusted binding (`workflow-state.ts:173-187,228-261` vs `consumers.ts:135-213`, `persist.ts:137-199`). Native opener already supplies configured origin/project/root and durable branch/worktree identity; new convention causes retrieval drift.
- **S3 / High:** duplicate physical-to-logical conversion produces separate keys; helper fixtures normalize invented project/branch identities (`consumer-persist.test.ts:108-144`) rather than prove production context isolation.
- **S4 / Medium:** canonical/bundled directory mismatch violates declared packaging contract and fails the actual deterministic suite; script byte equality alone is not full directory parity.
- **S5 / Low:** unused SQL pool API survives only implementation tests. Remove dead API/incidental test after cutover; do not re-pin it.

## Verification Status
- Goal achieved: **partial**.
- User goal: **partially met**; selectable retention primitives and operational SQLite presentation CLI exist, but selected-service authority, scoped consumer lookup/resume and private LTM filtering remain incomplete.
- Scope adhered: inspected consumer/config/opener/SQLite/install/bundle changes support Phase 5. Adjacent confinement refactor is prerequisite maintenance recorded in implementation notes; no new review execution-policy redesign or host-data replacement found.
- Out-of-scope changes by reviewer: **none**. Sources/tests/config/phase/overview/lifecycle/backlog/legacy memory remained untouched.
- Ordinary adapter-only same-checkout restart is required in Phase 5. Implementation notes cannot silently defer it to Phase 6 without user-approved scope reduction.

## Guardrails Verdict
- Commands: direct `npm run guardrails:check`, then the same authoritative command under a temporary output-capture wrapper after confirming no reviewer code edits. Both exit **1**, wall times **77.12s** / **77.47s**.
- Contract: **durable**, version **2**, runner **1.0.0**, status **fail**.
- Gates: `unit_test_gate=fail`, `functional_test_gate=skipped`, `lint_gate=skipped`, `patch_gate=advisory`, `global_ratchet=fail`, `complexity_gate=pass`.
- Both unit outputs: **1 failed / 1931 passed / 30 skipped**. Named failure: `scripts/codex-plugin.test.ts > curated bundle specification > canonical copies have recursive path parity with skills/<name>/`; offenders `["b-present"]`.
- Direct directory reads confirm canonical `b-present/scripts/` contains `retain-package.test.ts` and `retain-package.ts`; bundle contains only `retain-package.ts`.
- Coverage command exit **1**, `current=null`, baseline **84**, target **90**; no valid new coverage percentage. Patch null/threshold 90 is advisory. Global-ratchet failure is the runner's failure verdict, not a measured coverage regression claim.
- Complexity: 30 hotspots / baseline 30; no new or hard-ceiling violations.
- Captured output also includes `receipt attempt or scope mismatch, or already complete` at `domain.ts:126` through file-store receipt persistence. Its originating consumer is not established by the tail; do not substitute it for the named parity failure.
- No baseline, enforcement or config changes made. Failing gates reported, not fixed in read-only review.

### Actual Presentation CLI Smoke
Isolated temp Git fixture with its own config, machine identities and SQLite database; no production data touched. Exact CLI was launched, retained artifacts read using trusted configured context, binary bytes compared, and revision membership/worktree identity asserted against the receipt.

| Invocation | Run ID | Exact binary revision | Receipt |
|---|---|---|---|
| default cwd | `run-073362da-9c66-4720-82e4-71bb18d23861` | `d9b880f8-dac0-41a5-9c13-e495a98cd241` | attempted; matching current binary revision/worktree |
| explicit `--cwd` | `run-dce5c6d5-557d-456c-8a1e-cc98070618ad` | `bab0409e-726f-4bd9-beeb-c90c28109621` | attempted; matching current binary revision/worktree |

Output `ok=true`, binary hex `00ff89504e470d0a`. Two artifacts retained per invocation. This proves attachment retention, not completed save metadata, published visibility, rendered pages or an entire workflow. Temporary fixtures/scripts removed after recording evidence.

## User Goal Analysis
- Goal: choose durable storage, resume reliably across sessions/worktrees, keep unmerged work out of unrelated ordinary retrieval.
- Met: shared batch/receipt primitive and configured SQLite CLI binary retention; native bridge prerequisite remains available.
- Partial: retained consumer copies and local immutable pass checks.
- Missing: trusted pinned consumer context, authoritative readers and completed save attempts, private import boundary, connected site and complete owned writer/package census.
- Verdict: **partially met**.

## Documentation Impact
Non-blocking: selected-service authority versus optional projections, capture enablement, published-only import, package retention and site configuration need living-doc synchronization after correctness repair. Recommend `/b-docs` before accepted `/b-save`; not an iteration correctness finding.

## How-to Impact
Non-blocking: configured capture/import/package retention and adapter-backed site use need procedures with observable readback. Recommend `/b-docs` first, following `/b-howto` where applicable.

## Issue Classification
- In-plan: R1–R7 and R10 (eight High), R9/R11 (Medium). Required gate failure blocks acceptance independently of source defects. Repair artifact: `iterate-phase-5-final-review.md`.
- Out-of-plan: **none**. Later publication/history/cutover work remains in assigned phases and is not demanded here.

## Recommended Next Step
Return **Needs work** and iteration artifact to supervisor. `/b-iterate` repairs the Phase-5 defects, then `/b-review` rechecks this exact phase; accepted `/b-save` → `/b-commit` is not justified yet. Historical memory ledger has no accepted Phase-5 closeout; record accepted work only after repair/review. No lifecycle transition, phase-status rewrite, SQL memory call or loop-state decision made.

## Completion Audit
1. Objective restated as all six phase deliverables.
2. Every deliverable mapped to source, actual CLI output, fresh gates or explicit verification limit.
3. Current source inspected; authoritative deterministic check run twice, failure preserved.
4. Actual changed CLI exercised with binary/receipt readback; all-adapter/two-worktree/rendered-site claims withheld.
5. Partial/missing/not-verifiable criteria remain unachieved despite completed phase metadata.
6. Both axes finished via explicit sequential fallback; deliverable is complete review plus in-plan iteration, not implementation acceptance.

## Assignment Artifacts
Only this report and `iterate-phase-5-final-review.md` were created in the repository for this assignment. These are the only paths authorized for staging; all pre-existing source, index and artifact changes are preserved.
