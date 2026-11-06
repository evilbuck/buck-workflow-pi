---
status: completed
date: 2026-10-04
subject: 2026-10-04.buck-loop-save-client
informs: [plan-save-client.md]
---

# Buck-loop save-client diagnosis and verification

## Incidents are distinct

The original Phase 1 iterating stop occurred after assigned fixes landed, but an iterate artifact remained active. That kept the iterating postcondition ambiguous and produced the misleading `phase status is completed, not completed` explanation. Canonical source already closes a single finished iterate before rescanning and corrects that diagnostic. A disposable replay of the historical subject changed ambiguous to confirmed, then selected review. No operator-worktree files were changed.

The later Phase 2 saving stop had two child attempts, five failed `sql_memory` calls per attempt, and successful supervisor connectivity probes. Child reports recorded argument-validation failures receiving `{}` with missing `op`. Both children returned final prose without a SQL receipt; the supervisor retried generic ambiguity once, then blocked. This is not evidence of a database outage.

The operator's manual b-save was another surface: no callable `sql_memory` in that session, so portable saving produced a Markdown checkpoint. That cannot satisfy a configured loop's SQL receipt. Open phases 3–4 correctly keep the subject active; lifecycle close-verified exit 2 is not itself a persistence failure.

## Actual runtime boundary

OMP 18.6 uses its native SDK through the legacy extension shim. The repo's installed Pi SDK and the older fork under `~/.omp/plugins` are not authoritative for live OMP behavior. Actual OMP supports `modelPattern`, `toolNames`, `restrictToolNames`, `allowRestrictedCustomTools`, `disableExtensionDiscovery`, `enableMCP`, and `enableLsp`; the legacy shim forwards them. Claims that these options were silently ignored were rejected after inspecting native `sdk.ts` and the shim.

The native agent loop validates arguments before executing the tool. Rejection bypasses `sqlMemoryTool.execute` and its callback, but emits `tool_execution_end` with `isError: true` and the validation text in `result.content`. The old save client only retained callback failures. Normalized activity omitted that text, leaving the supervisor without the failure signal.

The original root-union schema validates well-formed calls. Configured save providers use OpenAI responses/completions adapters that preserve the union; an Anthropic-only empty-properties reproduction does not explain this incident. The historical logs do not retain original argument payloads, so why `{}` was generated remains unproven. The replacement object-rooted schema exposes operation fields while retaining branch requirements in host validation. No validator bypass or fabricated fallback was added.

## Confirmed defects repaired

- `run-step.ts` now passes the child's cwd to `sqlMemoryTool`; `remember` no longer derives author/project/branch/commit from the supervisor cwd.
- Save-stage validation events and executor failures survive in `RunStepResult.sqlFailure`, with the existing redaction/truncation policy. A later successful SQL call clears a corrected failure.
- `loop.ts` verifies the receipt first. An unverified save with an unresolved tool failure blocks with the sanitized cause instead of entering generic postcondition ambiguity. A verified completed receipt remains authoritative despite late errors or pool teardown.
- `sql-save.ts` now instructs `remember` with the exact directive subject and phase, plus `previousId` for corrections. Source-key reuse and active same-project readback are internal; the directive no longer asks the child to assemble raw memory SQL or perform a contradictory separate readback.
- Required core tools and injected SQL tool cover b-save duties. Native retain/learn mirrors are optional; their absence is not a SQL blocker.

## Verification

### Failing-before / passing-after regressions

Two selected regressions initially failed: a validation-rejected save lost its failure despite final prose; a child remember call used the supervisor's email, branch, and commit. Both pass after the client repair. Permanent supervisor regressions prove unresolved failure blocks without another save or commit, and a completed verified receipt still authorizes commit despite a late client error. Operation-schema regressions reject absent op, missing SQL statement, missing remember subject, empty remember body, and incomplete correction input.

Removed wording-only directive assertions instead of re-pinning prose, retaining semantic credential-leak guards. Database correction integration had an incidental exact result-envelope assertion that rejected an added notice; it now checks the returned successor ID, retaining linked-successor, idempotency, immutability, and rollback checks.

### Real OMP save smoke

Ran the canonical nested `runStep` save code under compiled OMP 18.6, using configured `muse-code/muse-spark-1.3-contributor` with minimal thinking. A disposable git repository and PostgreSQL 18 + pgvector container isolated all writes from production and the operator's worktree. The throwaway bundle mapped legacy imports to OMP's bundled SDK/typebox namespaces; ordinary direct-import probes could not load the SDK, and a plain Bun probe resolved the old Pi SDK. Neither failed launcher was counted as verification.

Observed one native sql_memory call with `op: remember`, body, and exact subject `2026-10-04.save-client-smoke`. It returned ID `01a106f6-920f-79b1-b2ae-9b4d925573a7`; the child wrote a rows receipt with `completed: true`, and `verifySqlSave` returned `verified` for its exact attempt.

Independent database readback showed author `save-smoke@example.test`, project `https://example.test/save-client-smoke.git`, branch `save-smoke`, and commit `9d5f9f43bc07495eae9efd97b47e9418ee56cae4`, exactly matching the child checkout HEAD. No Markdown memory directory remained in the successful SQL fixture. The receipt, model output, and SQL activity were observed before fixture cleanup.

### Standards review and native provider emission

Independent standards review caught an xAI/Grok regression in the first object-rooted schema: typeless operation branches caused OMP to quarantine the entire tool. Running the actual OMP strict-schema checker on the registered schema reproduced `#/anyOf` before and null after adding explicit object types to every branch. Kept op discriminators and per-operation requirements; rejected the suggested required-only fragments because they could admit another operation's arguments and change migrate's optional acknowledgment. Permanent validation tests reject cross-operation field substitution.

Compiled OMP 18.6 then streamed the real `xai-oauth/grok-4.7` provider path with its `rejectRootObjectUnion: true` compatibility flag. The final native request payload contained `sql_memory` and the complete schema. The onPayload hook deliberately stopped before HTTP (`SMOKE_STOP_BEFORE_HTTP`); this proves actual provider emission, not a live Grok save. Failed source imports and a bundle launcher without an output file were not counted as proof. Generated source/bundles and disposable database containers were removed.

Restored the pre-existing policy distinction: gate denials do not set unresolved SQL work failure; host validation and database failures do. A save-role gate regression failed before this correction and passed afterward. ADR 0003 and living SQL docs now explicitly include argument-validation failures and the unchanged gate behavior. Credential-leak assertions were retained for phased and unphased directives; incidental wording assertions were not restored. Long-method and small notice-path duplication nits are pre-existing or do not justify widening this repair.

### Deterministic contract

Final `SQL_MEMORY_TEST_URL=<disposable local database> npm test`, after standards fixes: 92 Vitest files, 1,584 tests passed, no skipped tests; Bun suites 70 passed, 0 failed. Total 1,654.

`SQL_MEMORY_TEST_URL=<same database> npm run guardrails:check`: durable v2 contract, status pass. Unit, global ratchet, and complexity required gates passed. Coverage 89.5% against baseline 84%; target 90%. Patch gate passed but the runner reported patch percentage null; no numeric patch-coverage claim. Lint and functional gates are disabled/skipped. No baselines were changed.

Language-server diagnostics are clean for SQL tool changes and the new supervisor test. Existing typing gaps remain in `run-step.ts:370` (ModelRegistry/HostModelRegistry) and `run-step.test.ts:587,615` (older picker mocks lack source/confidence); none is introduced by this repair. No project-wide typecheck-clean claim.

## Recovery boundary

The fix is on `chore/cleanup-skills`, uncommitted. The existing operator process and older worktree are not automatically updated by source edits. Load the repaired extension/skill source in a fresh OMP process before resuming that loop. Do not manufacture a receipt from a manual Markdown save or modify historical bad receipts. This session did not stage, save, resume, or commit anything in `../review-ranking.wt`.
