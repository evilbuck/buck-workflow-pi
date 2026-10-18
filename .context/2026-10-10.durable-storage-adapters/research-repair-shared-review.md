---
status: completed
date: 2026-10-15
addresses: phase-5-remaining-consumers.md
---

# Shared consumer and review persistence repairs

Current changes (this assignment, not prior staged privacy work):
- `consumers.ts`: explicit checkout-only retain API; resolve destination before queued execution; stable workspace-run artifact keys; separate per-write receipt identity; conditional revision support, inherited typed links, exact revision-byte readback; only root index is lifecycle metadata; nested unclassified Markdown is capture knowledge, not a private audit.
- `workflow-state.ts`: internal bound-store reopening; attempt binding seam; persisted consumer destination binding refuses backend changes inside a workspace branch run; capture identity path and Git branch before asynchronous context resolution; await pool close.
- `file-store.ts`: run-private repo-files projections live beneath the machine-private manifest, with branch/worktree/run/subject namespacing; they do not dirty or influence checkout fingerprints.
- Review iteration: await create and final report persistence; record clean state only after report retention; run/pass/command reads enumerate the selected adapter, not Git-common-dir exports; immutable pass keys carry the review run ID; command append starts from retained bytes; prune tombstones retained run artifacts before removing exports. Old local-only runs are not a fallback (historical cutover belongs to Phase 7).
- Hook: bind each window attempt to its own receipt run, read back written revisions before completing, reuse completed receipt on replay. Host consumed-window policy unchanged.
- Plan reader: preserve visible review/iterate/brainstorm/capture/grill/memory/backlog Markdown alongside plan kinds; private run records and binary attachments remain excluded.
- Vitest: always isolate XDG config from operator configuration, not only when the operator lacks XDG_CONFIG_HOME.

Verification so far: targeted Vitest run of consumer-persist, plan-source, hook-store, review run-state and review loop: **5 files / 50 tests passed**. Includes actual default hook storage (only probabilistic extraction/judgment mocked), default plan-source subprocess using Bun (optional Astro install absent), real Git worktree destination binding, missing review exports, stale CAS/link retention, and real loop resume/rebase scenarios. Pre-fix hook completion test failed on attempted instead of complete receipt; added required successful readback duty and exact persisted-byte checks, then passed. Production review retain smoke through Bun returned a bound run ID in 13.10ms on an isolated repo-files fixture. Full contract and cross-worker integration still pending; this note is not phase or iteration closeout.

Four-adapter runtime smoke (Bun, production APIs, disposable pgvector/PostgreSQL 18): **pass**. For each adapter, created a review run/pass/command, removed Git-common-dir and `.context` exports, recovered the exact run and bytes through the service, refused overwriting immutable retained evidence, preserved links during knowledge updates, refused stale CAS, and loaded `review-proof.md` through the real `SqlPlanSource` default loader. Observed review run IDs: repo-files `20261016T024951-fu5apy`; external-files `20261016T024951-199md8`; SQLite `20261016T024951-4f3hby`; PostgreSQL `20261016T024951-2vdlbx`. All returned command ID `node-eval`, immutable refusal true, and the review document. Initial PostgreSQL 17 fixture lacked required vector/uuidv7 prerequisites; replaced with cached pgvector PG18, without changing product migrations.

Mutation checks: removing the final-report await made the fault regression fail on a resolved local path; replacing hook attempt binding with workspace run made the receipt regression fail on a missing attempt receipt; restoring the old reader whitelist removed review/iterate/brainstorm/nested documents and failed the reader regression. Each mutation was restored. A new lifecycle regression failed before the reducer fix: nested capture index incorrectly changed canonical draft inspection to legacy completed. The reducer now uses kind plus exact root-relative logical name; no basename-only evidence aliasing.

Repo-files and external-files knowledge projections now include subject identity in their path. This keeps canonical logical names subject-relative without aliasing equal names from different subjects; low-level FileStorageStore's explicit unnamespaced fixture mode remains separate. Private projections remain machine-private. Constructor callers migrated to the actual contextRoot/manifestRoot contract (removed ignored root argument).

First-commit integration: the four-adapter loop regression initially failed
because an unborn workspace's private scope changed to a named-branch scope after
its first commit. The trusted registry now persists ref-specific private branch
bindings through that first commit and descendants, checks lineage before reuse,
and retires the binding on unrelated rewrite. A native knowledge regression
proves first-commit readback and other-ref/rewrite isolation. Malformed Git HEAD
now produces a typed identity failure; the loop returns blocked, never idle,
without opening another project scope. Unchanged identities/destinations no
longer rewrite the registry or repeat an already-proven same-tip ancestry probe.
The unused synchronous SQLite-era pinned-scope reader and its test were removed.

Terminal subject selection also reads configured-store lifecycle, not local
directory presence. New report indexes initialize/activate through the shared
lifecycle reducer with conditional creation and exact revision readback.
The repo-files projection bootstrap is create-only and no longer swallows
storage failures. Report failure/adapter-only regressions exercise these paths.

Expanded actual Bun smoke passed on all four adapters after creating review
evidence on an unborn branch, making its first real Git commit, removing all
runtime and checkout exports, recovering canonical evidence, creating a terminal
report subject, removing its exports, and resolving that same retained active
subject. Observed runs: repo-files `20261016T030829-n2an18`, external-files
`20261016T030829-vt7ige`, SQLite `20261016T030829-bxwkt6`, PostgreSQL
`20261016T030829-svnrxc`. Each returned command `node-eval`, immutable refusal
true, visible `review-proof.md`, first-commit preservation true, and the same
`2026-10-16.code-review-iteration` report subject. Fixture clock date was Oct 16;
assignment artifacts retain the instructed Oct 15 date.

Fresh integrated native/file-store/review/loop run after the first-commit and
terminal-subject fixes: **6 files, 235 passed, 5 skipped**, exit 0
(`vitest run` for workflow-state, file-store, review report/loop, loop-storage
and loop). The five SQL-memory-specific legacy cases were skipped by their
existing environment gates; all four storage adapter checkpoint cases ran.

Additional integration proof:
- **16 files / 207 Vitest tests passed** across attribution, importer, auto-fix,
  pinned PR context, loop lifecycle helpers, consumers, default hook and plan reader.
- **70 Bun tests passed** through `npm run test:bun`; Node and Bun SQLite
  transaction smoke commands both passed.
- Review terminal-fault integration now faults the real configured retain at the
  final-report boundary: no clean result/commit and the canonical run stays
  `running`/pass 1. Report + loop suites: **34 passed**.
- Concurrent command append regression synchronizes real context binding and
  uses one actual SQLite connection. Removing command serialization then
  deterministically failed on a stale revision; restored code passed the full
  **12-test** run-state suite. No fake stored rows or source-text assertion.
- Legacy loop/run-step save fixtures now await facts, successful no-change
  metadata sealing, and complete receipt/readback on the same selected store.
  Removed obsolete live-SQL environment skips: these use configured repo-files
  rather than a SQL pool. All **6** selected save-recovery integration cases pass.
- Canonical/bundled b-save instructions now require the directive's executable
  facts/preflight/apply pipeline rather than stamping a local completion flag.
  Publication-unproven LTM mirroring remains withheld.
- First coherent unchanged full guardrails run failed: unit/coverage execution
  failed and four functions exceeded the existing complexity inventory. Bundle
  diagnostics identified stale shared test copies and a new canonical test absent
  from the bundle. Full unit JSON diagnostics are being captured before fixing;
  enforcement, baselines, timeouts and behavioral tests remain unchanged.

Final production-API four-adapter smoke after the latest source changes passed:
repo-files `20261016T032703-hpd5fh`, external-files `20261016T032703-y01qeq`,
SQLite `20261016T032703-l05lqt`, PostgreSQL `20261016T032703-fbx2xk`.
All recovered run/pass/command bytes after export removal and first commit,
preserved links/refused stale/immutable updates, loaded the visible review
document, and recovered the same retained terminal-report subject.

Actual default-hook storage-failure smoke also passed (probabilistic judgment
and extraction only were fixtures): malformed selected-store config left the
failed window consumed, no durable memory was invented, repaired-config replay
did not extract again, and the next independent window completed its own durable
receipt (`run-a16a59a3-690d-42e7-8823-bbd97ad278f2`). No live model/session claim.
Both throwaway smoke drivers and fixture roots were removed.

The diagnostic full unit run reported **2176 passed, 7 failed, 1 skipped**:
four plan-bridge flows still used subject-prefixed logical names, one prune
fixture planted only local JSON, and two bundle tests asserted copied source
bytes/path lists. Fixed the bridge to bind once and use subject-relative
conditional/link-preserving writes; migrated prune setup to real retained runs,
including removal of exports and canonical tombstone readback.

Removed only the two forbidden source-copy assertions, not behavioral tests.
Kept the release copies synchronized (including the shared test assets) and
replaced text-copy checking with actual bundled portable-CLI subprocesses proving
exact-byte persistence, conditional update and stale-write refusal.
Extracted existing CLI flag, direct-parent proof, attribution rendering and
checkpoint fault-setup responsibilities to satisfy the unchanged complexity
contract. No baseline/enforcement/timeout changes. Focused five-suite repair
verification: **61 passed**, including the formerly failing bridge/prune cases and bundled CLI behavior.

Fresh production plan-bridge smoke passed on **all four adapters**: initialized
canonical root lifecycle, read the native retained token, attached a typed spec
link, removed all checkout exports, then captured a follow-up under the same
logical plan key with the link intact. Exact final revisions: repo-files
`aefd7e50-799b-4033-bf64-f3eea6f01d11`, external-files
`b44d4a3f-5716-4854-8954-17756ca46f1e`, SQLite
`4f429f8a-fa84-4604-b41c-e9bda22079a2`, PostgreSQL
`30042576-dc0e-498b-ab68-6b637d63f3a4`. Only the event/journal host was simulated;
there were no model calls or fake storage rows. Driver/fixtures removed.

Second full contract run: **2181 passed, 1 failed, 1 skipped** at the unit gate;
the remaining unit failure was the 5000ms two-phase loop timeout. Complexity
passed; coverage execution also failed (its diagnostic alone does not establish
the same failing test). Kept timeouts, worker configuration and contract unchanged.

Removed repeated Git-process work in trusted context resolution: one verified
`rev-parse` observation supplies common directory, commit and symbolic ref;
unborn/no-Git cases retain explicit status proofs. Proven unchanged commit OIDs
reuse their ancestry result, including the workspace-private first-commit
binding. `HEAD^{commit}` still verifies the object before that reuse. Updated
the concurrency fixture rendezvous to observe the batched probe, not obsolete
per-field commands. Fresh native/consumer/four-adapter/complete loop verification:
**4 files / 172 passed**, 78.32s. Bundled runtime synchronized.

## Final verification

- `npm run guardrails:check` with disposable PostgreSQL enabled: **exit 0,
  status pass, durable contract v2**, after the final source edits.
- Required unit gate: pass (exit 0). Required global ratchet: **89.2% against
  unchanged 84%**. Required complexity: pass, no new/hard-ceiling violations.
- Functional/lint remain disabled/skipped. Advisory patch gate returned pass;
  its percentage is `null`, not a measured patch-coverage claim. Baseline-raise
  and inventory-shrink proposals were not applied.
- Fresh bundled-CLI smoke in independent Bun processes passed for every adapter:
  exact plan/checkpoint revisions survived first commit and export removal,
  malformed HEAD refused, another ref could not read the private checkpoint,
  and the original ref recovered it after repair/switch-back. Checkpoint IDs:
  repo-files `18a65315-cb1f-4a80-957a-4fb606f1b2c4`, external-files
  `579044b7-7f75-473b-b19d-fa978172d6d2`, SQLite
  `3b3bb8ce-c00e-4f48-b49b-d852e27003c2`, PostgreSQL
  `a307a3dc-d217-4a48-a27e-9488c2d29efb`. Driver/fixtures removed.
- Complete shared bundle and changed b-save/code-review-universal skill byte
  parity verified with `diff`/`cmp`; actual bundled CLI behavior also exercised.
- Optional legacy raw-SQL correction integration was not exercised; the selected
  storage adapter matrices did exercise disposable PostgreSQL. No live model,
  full OMP harness, browser/rendered-site or installation-matrix claim (Phase 8).
- Supervisor owns re-review/save/commit; no loop-state choice or commit made.
