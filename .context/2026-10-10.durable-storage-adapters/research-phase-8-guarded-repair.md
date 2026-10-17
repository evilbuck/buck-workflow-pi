---
status: completed
date: 2026-10-16
subject: 2026-10-10.durable-storage-adapters
related: [phase-8-proof-docs-package.md, implementation-notes-phase-8.md]
---
# Guarded Phase 8 repair

## Scope
Repair the missing authoritative completion proof or a scanner/adapter mismatch. Do not rebuild storage implementation, start a later phase, select a parent loop transition, change parent loop state/counters, or fabricate acceptance evidence.

## Observed authority
- Checkout `resolveConsumerContext()` selects `repo-files`, from `/home/buckleyrobinson/.config/buck-workflow/config.yaml`, with no project override. `SQL_MEMORY_URL` is diagnosed as legacy, not adopted.
- Project: `origin-1c759a5441ae61606322cfd53d57f5e50b8496bbcacf262f2dddab64e360f127`; branch: `branch-2a8c8ce3-e8b9-455b-a413-b9dc7fba9ec5`; worktree: `worktree-45ffe88c-566e-4593-8a8a-2125695175dc`.
- Selected phase revision `19d13869-94d5-4f53-830d-bda575130965`, SHA-256 `6a32e1615d9b2026e5c3eef6c0d1ed247d7afd768862ccc677cf06a1d194fc91`, is pending. The CLI `read-receipt` returned null.
- The local save-attempt/receipt is explicitly for Phase 7, not Phase 8. It cannot prove Phase 8 completion.
- `scan.ts:88-104` in this checkout reads the selected adapter through `workflow_state list`. `building` confirms only when the assessed phase's acceptance is done (`scan.ts:534-535,580-585`). A save receipt alone cannot satisfy an unfinished build.

## Confirmed runtime mismatch
OMP's machine config loads `~/projects/development_tools/buck-workflow-pi`. That checkout's scanner reads filesystem paths directly and its save implementation uses legacy SQL memory. It does not exercise this branch's workflow adapter implementation.

The existing isolated SQLite OMP run therefore left two distinct facts: a completed filesystem phase, but selected SQLite phase revision `472a4cdf-1293-471b-adf3-94e00aa3c9ca` still pending and no adapter receipt. A read-only real OMP process using `--no-extensions -e /home/buckleyrobinson/projects/development_tools/storage-adapter.wt/extensions/index.ts`, with `BUCK_WORKFLOW_CONFIG=/tmp/phase8-omp/clone-sqlite/storage-config.yaml`, successfully used native `workflow_state` and read that exact revision and null receipt. The process-local extension override works without relinking the global installation.

Both the configured installed scanner and this checkout's selected-adapter scanner were exercised against the assigned phase and returned `phased-incomplete` / `postcondition: ambiguous`. The full selected-adapter scan completed in 124.62 seconds. Its earlier 60-second timeout was not an empty store result. Exact adapter readback confirms phases 1–7 remain completed, including the three restored revisions recorded in the implementation notes.

## Remaining evidence
Four real adapter workflows, parent acceptance recheck, and final packaging/site evidence are not established by the prior child report. Do not replace those missing observations with checkboxes or a fabricated completed receipt.

## Packaging and browser proof
- `bun /tmp/phase8-guarded-packaging.mjs` installed into a fresh temporary home and verified 386 managed surfaces linked to this source checkout, 22 shipped storage dependencies present, and all 19 canonical/bundled storage files byte-equal. Operator home links/config were not changed.
- A separate temporary Git project selected SQLite with an isolated identity registry. Retained `plan-authority.md` revision `6f59237b-d5ec-409f-a15f-468372b24a5b`, SHA-256 `e703e3d351a9d72e9efa4fa941fd259e30e197077eeb5a2c1fbed52413af63cf`, and its subject index, without canonical `.context` materialization. A filesystem-only decoy was planted deliberately.
- `npm run build` in `docs/plans` with that project/config and `NODE_OPTIONS=--max-old-space-size=8192` built four static routes successfully. This is a small selected-store integration build, not a claim that the full operator dataset's previous heap-exhaustion build is repaired.
- HTTP GET of the retained plan route returned 200 from the existing preview on port 4322. Real Chromium navigation from home → subject → plan rendered `Adapter-only plan` and `guarded-adapter-authority`, excluded the filesystem decoy, and emitted no page errors. Screenshot `/tmp/phase8-guarded-site.png` was inspected.
- The attempted dedicated tmux preview exited because Astro already retained a preview on port 4322; that existing service was not stopped. The created idle tmux session is temporary and does not own that preview.

## Documentation correction
Corrected remaining active bootstrap/save guidance that still selected legacy SQL or Markdown fallback, and documented that OMP's loaded package path is independent of cwd. Updated `GLOBAL_OR_PROJECT-AGENTS.md`, `docs/buck-workflow.md`, `docs/buck-loop.md`, `docs/sql-memory.md`, `docs/CHANGELOG.md`, and the existing backend-selection how-to. No global installation was relinked.

## Deterministic verification repair
- The reported corrupt-bookmark regression fixture used `scheduleConfiguredRetain`, which targets the generic workspace run. The actual bookmark reader uses its dedicated run. Both `persist.test.ts` and `loop.test.ts` used that incorrect seeding pattern. Their shared `fixtures.ts` now creates a real bookmark through `writeProjection`, locates the retained bookmark row rather than an unrelated save-attempt scope, then writes supplied bytes through `commitConsumerBatch` to that exact namespace. No production guard, expectation, or check threshold changed.
- `npx vitest run extensions/buck-loop/__tests__/persist.test.ts --reporter=verbose`: 21 passed, including unreadable JSON, negative/fractional loop counters, invalid maximum, and inherited enum keys. These now exercise corrupt authoritative bookmarks rather than absent ones.
- The first fresh guardrails run using a dedicated database in the existing `phase8-pg` container failed required unit/global-ratchet gates. Schema initialization then established the runtime prerequisite: that server lacks `vector`. A separate temporary pgvector PostgreSQL 17 also failed because `uuidv7()` is absent. These are real prerequisites, not permission to patch immutable migrations or fabricate a PostgreSQL proof.
- A new disposable `phase8-guarded-pg18` container uses the already-installed `pgvector/pgvector:pg18` image, exposed only on loopback port 54339 with throwaway trust authentication. All four canonical migrations applied successfully before parallel tests. The existing `phase8-pg` container was not replaced or reconfigured; the diagnosis-only `phase8_guarded_checks` database created there was subsequently dropped. The temporary idle tmux session was also removed; the operator's preview remains untouched.
- Final `npm run guardrails:check` with the supported PostgreSQL 18 + pgvector test database: **pass**, durable v2; required unit/global-ratchet/complexity passed, coverage 89.5% vs 84% baseline, 29 hotspots vs 30, no new/hard violations. Lint/functional are disabled and skipped; patch is advisory with no measured patch percentage. Exact runner JSON: `guardrails-repair-verdict.json`. No rebaseline, enforcement change, ignore expansion, or shared database migration was performed.
- After both fixture callers were migrated, `npx vitest run extensions/buck-loop/__tests__/persist.test.ts extensions/buck-loop/__tests__/loop.test.ts --reporter=verbose`: 142 passed (2 files). This includes interrupted-save identity/metadata guards, corrupted authoritative bookmark handling, and review of a completed blocked phase without rebuilding it.
- `npm run test:bun`: 70 passed / 0 failed. `npm run test:sqlite-runtime`: SQLite transaction smokes passed on Node v26.8.1 and Bun's Node-compatibility v26.3.0.
- A real `workflowExecutionTool` sandbox smoke found working `/usr/bin/bun`, `/usr/bin/node`, and `/usr/bin/git`. Missing runtime executables are not an established operator blocker.
- The first independent documentation-review process hit its deadline without a verdict; no independent review pass is claimed.
- The PostgreSQL memory-import test used globally fixed revision IDs while generating a new project each run. The second test/coverage invocation collided with retained IDs from the first. Its two source IDs now use the existing `randomUUID()` fixture pattern, preserving the assertions about exact IDs, categories, ranks, and successor links. The full 24-test PostgreSQL adapter suite passed twice consecutively against the same database, without clearing retained rows; the subsequent full guardrails passed.
- The assigned phase's declared checkpoint scope includes the bookmark/PostgreSQL fixtures, real plan-source regression, and narrow typed-save repair. All four genuine live RPC hook captures subsequently completed and their exact attempt-bound receipts read back; passing gates alone were never substituted for that producer evidence.

## Live recovery readback
Real operator CLI export from the isolated SQLite site fixture, import to an empty external-files destination, and destination re-export all returned digest `8dc0e1f6a06412a28945018f781c1c6fb5ea454b774bc9166b96593e311f1bc6` (two revisions and pointers, two search rows). Fresh ordinary CLI read returned the same plan revision `6f59237b-d5ec-409f-a15f-468372b24a5b` and SHA-256 `e703e3d351a9d72e9efa4fa941fd259e30e197077eeb5a2c1fbed52413af63cf`. No active backend configuration was switched and no user data was migrated. This smoke covers exact restore, not a claim of a new interrupted-cutover proof.

The two mainline throwaway packaging/browser scripts were removed after their observed smokes. Private fixture state and screenshots remain outside Git; no database, WAL/SHM, export, or journal was put in `.context/` or a dotfile source tree.

## Full-data site repair

The full operator-dataset build was exercised with a larger Node heap and failed on a concurrent file-store lock timeout. The lock was absent after that process exited; no lock was manually removed and no operator process was stopped. Inspection found that every subject/link lookup loaded all visible records again, while document props included every sibling's preview even when unlinked.

The existing reader now captures one view per instance and memoizes parsed subject documents. Production static routes share that reader; development requests create a fresh reader. Document preview props contain actual referenced targets, including same-subject links, rather than all siblings. No filesystem fallback, new storage backend, visibility bypass, global install relink or parent loop transition was introduced.

The real SQLite regression was expanded to change a plan after enumeration: the in-flight reader must preserve original bytes, and a fresh reader must return the new bytes. It failed before the repair with the new bytes leaking into the old view, then passed after the repair. Existing assertions still exclude private execution/binary/other-branch records. The update uses a separate test run rather than weakening the receipt's attempt identity guard.

After this change the **full selected repository**, not the small fixture, built with ordinary `npm run build` and no heap override: **963 pages, 3m 4s, exit 0**. Actual Chromium visited the built home (132 subjects, 830 documents), subject and assigned phase, hovered the linked repair proof, dismissed it with Escape, refocused it to show the same preview, followed it to the exact research document, and observed no page errors. Screenshot `/tmp/phase8-guarded-full-site.png` was inspected; the three mainline browser/packaging throwaway scripts have been removed. Existing user preview service was not replaced.

The first fresh gate run overlapped that full-data build and failed required unit/global-ratchet gates; its reported tail included existing five-second supervisor test timeouts. Resource contention is an inference, not a proven sole cause. A later unchanged-contract run passed after that build completed. After the subsequently discovered typed-save repair and small complexity refactor, another full runner passed in 192.32s with the same 89.5% coverage and 29 hotspots, no new/hard violations. No timeout, threshold, baseline or enforcement was weakened. Temporary hook diagnosis is not credited as a completed runtime producer scenario.

## Independent scoped repair review

A fresh read-only OMP reviewer using `openai-codex/gpt-6.1-sol` examined the unstaged diff of the two save scripts, real save regression, two plan readers, document route and real plan-source regression. It reported **no concrete consumer-visible correctness/security findings**. Scope: typed keys/links/CAS, path and subject containment, in-memory transforms, adapter-aware cleanup, consistent snapshot and linked previews. It did not inspect the user's staged diff and did not independently rerun the supplied test/build/browser evidence. It made no phase-completion or loop-state recommendation.


## Final coherent-point verification

After removing every temporary hook trace/probe edit, the full unchanged durable guardrails contract passed again in **190.01s**. Required unit/global-ratchet/complexity passed, coverage remained 89.5% against 84%, and hotspots remained 29 against 30 with no new/hard violations. Exact JSON remains `guardrails-repair-verdict.json`; disabled lint/functional and unmeasured advisory patch coverage are not claimed as exercised. No source changes followed that pass.

The unchanged production hook completed genuine memories and complete receipts on all four adapters in long-lived native RPC sessions. Later fresh-process checks verified both those hook receipts and the original pinned save receipts; unrelated later hook attempts did not authorize the older saves. See the live-workflow ledger for exact IDs/hashes.

The final changed-path check confirmed code-touching work, so the gate was mandatory. This branch has no upstream; the upstream-range probe reported that explicitly. Existing user-staged plan-site changes and unrelated `.context/` edits were left in place. No root staging, commit, parent lifecycle close or loop-state transition was performed.


## Documentation acceptance correction and private proof retention

The final documentation pass corrected the stale SQL-dependent turn-memory how-to/index, recorded the actual live-session acknowledgment boundary, added the typed-identity/in-memory rule inside the existing managed AGENTS block, and made storage/publication/migration/backup navigation explicit in the living workflow guide. Existing backup/export/import and cutover/recovery how-tos remain the canonical procedures. Only Markdown changed after the final passing application-code gate; the documented enablement precedence was separately exercised with the SQL gate variable absent.

All disposable PostgreSQL proof and final gates completed before cleanup. A private custom-format database backup was retained at `~/.local/state/buck-workflow/verification/2026-10-16.phase-8-guarded-repair/postgres.dump`, SHA-256 `ab2ff0dfbf952e6de0b60a91c760ff98ae4c37415119fa9003db48133194b798`. Only this repair's `phase8-guarded-pg18` container was stopped; the operator's `phase8-pg` container was untouched. This backup is not claimed as a separately restored migration proof.

Native sessions/transcripts, fixture state, exact producer inventories and judgment provenance were archived privately at the same directory's `omp-proof-state.tar.gz`, SHA-256 `2101d41d72ead28fc3a2aae5ddbafbe8c89611d9bd64ede50e2a2f85351c4595`. Directory mode is 0700 and archive/dump modes are 0600; the original container credential file and dependency trees were excluded. These private payloads are outside Git, `.context/` and dotfile-manager sources. Active throwaway harnesses are removed before the terminal rescan; the archive preserves their audit provenance.


## Guarded transition recheck

- The new guarded diagnosis read the selected authority through `resolveConsumerContext()` and `workflow-state-cli.ts`, not the phase export alone. Selection remains `repo-files` via `/home/buckleyrobinson/.config/buck-workflow/config.yaml`; its authoritative manifest root is `/home/buckleyrobinson/.config/buck-workflow/projects/origin-1c759a5441ae61606322cfd53d57f5e50b8496bbcacf262f2dddab64e360f127/repo-manifest`.
- The retained Phase 8 revision is now `759fb8b3-3463-4711-8a02-fc391f2843ae`, SHA-256 `cc4036f9f7a6f9cbe03b8354f10f72bb7d0758e6ddef9bf1f10471a92061e404`: `status: completed`, five checked acceptance criteria, zero open criteria. The halt's pending-phase observation predates this retained completion.
- `read-receipt` returns null. This is not a missing building prerequisite: `scan.ts` assesses the assigned phase's acceptance for `building`; verified save receipts belong to the separate `saving` postcondition. No attempt receipt was fabricated and no loop transition, parent save/checkpoint, lifecycle close, or next phase was selected.
- Fresh full selected-store `scan()` against the assigned phase with `state: building`, `sessionOutcome: ok`, and `retriesUsed: 0` completed in 129.09 seconds: `planFacts.kind: phased-complete`, `phasePath: null`, and `workFacts.postcondition: confirmed`. Review facts still report a parseable report, an iterate artifact, and documentation/how-to impact; this diagnosis does not route those facts or authorize a next state. The requested scanner stopping condition is satisfied.
- This diagnosis changed only this Markdown evidence note; no application code changed and the deterministic code gate was not rerun. The fresh full scanner invocation is the runtime verification for this repair check.
