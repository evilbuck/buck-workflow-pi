---
date: 2026-09-28
domains: [extensions, testing, tooling]
topics: [fix-pr, agent-tool, cli-adapter, cancellation, inventory, seen-id-validation, output-boundary]
related: [.context/2026-09-28.fix-pr-native-pr-tool/phase-1-tool-contract-adapter.md]
priority: medium
status: completed
subject: 2026-09-28.fix-pr-native-pr-tool
artifacts: [phase-1-tool-contract-adapter.md, plan-fix-pr-native-pr-tool-phases.md, draft-commit.md]
---

# fix-pr feedback adapter phase 1

Implemented `fix_pr_feedback` as a registered OMP tool that invokes the canonical fetcher through `bun` without a shell. The adapter writes optional seen IDs to a 0600 file in an adapter-owned temporary directory, removes it on every terminal path after directory creation, emits one static metadata-free progress update per invocation, limits returned candidates to metadata, and fails closed on cancellation, setup write failure, nonzero exits, and invalid JSON.

The fetcher now writes each inventory to a unique 0700 directory with a 0600 `inventory.json`, preventing concurrent tool calls from overwriting inventories while preserving the JSON summary schema. The bundled Codex fetcher and fixture tests remain byte-identical.

Verification: focused adapter/fetcher tests passed (15 tests), Codex parity passed (7 tests), extension integration passed (18 tests), and durable guardrails passed. The guardrails coverage rose from 84% to 87.9%; no baseline was rewritten.

## Review iteration

Fixed all three phase-1 review findings: default script traversal now starts from the extension directory (not its parent); progress no longer forwards raw PR metadata or unbounded heartbeat updates; seen-ID writing is inside the cleanup scope.

Fresh verification: 18 focused adapter/fetcher tests passed, including a real default-path CLI launch, repeated large stderr chunks across two invocations, and deterministic write failure cleanup. Direct Bun tool smoke returned the canonical CLI's argument-validation error (exit 2), proving resolution without network access. Durable guardrails passed: coverage 87.9%, required unit/ratchet/complexity gates passing; lint and functional gates disabled/skipped.

Modified for iteration: adapter and its tests, phase and iterate artifacts, draft commit, this memory and memory index. Existing unrelated workflow session pointer was left untouched. Umbrella backlog item remains active for subsequent phases; no new backlog work identified. Independent review and loop-state selection remain with the supervisor.

## Seen-ID re-review iteration

Rejected CR/LF in each seen ID at both the TypeBox schema and direct runtime boundary. Invalid input now returns `invalid_input` before temporary-directory creation or CLI invocation, preventing one array item from producing multiple seen records. The canonical CLI format is unchanged.

Fresh evidence: 23 focused adapter/fetcher tests passed, including five embedded/trailing separator regressions. A direct default-tool Bun invocation with one embedded-LF ID returned structured `invalid_input` without an inventory. Durable guardrails passed with 87.9% coverage; required unit/ratchet/complexity passed, patch passed, lint/functional disabled.

Modified in this re-review iteration: `extensions/fix-pr-feedback/index.ts`, its test file, `iterate-tool-contract-adapter-re-review.md`, phase-1 artifact, existing draft commit, this memory, and memory index. Umbrella backlog remains active because later phases remain; no new backlog item is needed. Unrelated session pointer and existing changes remain untouched. Supervisor owns independent re-review and subsequent loop state.

## Output-boundary third-review iteration

Removed CLI stderr from failure results entirely; only the trusted failure category and exit code reach the agent. Stdout is bounded at 1 MiB in UTF-8 bytes; overflow discards the buffer, kills the child with SIGKILL, and fails closed. Each returned candidate string is limited to 1,024 characters, rejecting oversized metadata instead of truncating identifiers. Existing CLI and inventory schemas remain unchanged.

Fresh evidence: 27 focused adapter/fetcher tests passed. A throwaway Bun smoke using real child processes verified untrusted stderr redaction, overflow termination, temporary-file cleanup, and the canonical CLI's exit-2 validation path. The incidental default-path permanent test was removed in favor of this runtime smoke. Durable guardrails passed with 87.9% coverage; required unit/ratchet/complexity gates pass, patch passes, lint/functional disabled. An initial complexity-11 candidate validator was repaired using a shared type-narrowing predicate; no baseline changed.

Modified in this iteration: adapter and its tests, third-review iterate artifact, phase-1 verification documentation, draft commit, this memory, and memory index. Umbrella backlog stays active for later phases; no new backlog item. Unrelated session pointer and prior changes remain untouched. Supervisor owns independent re-review, save/commit, and loop-state selection.

## Cancellation fourth-review iteration

Added a 250 ms SIGTERM grace period followed by SIGKILL, output-pipe destruction, and explicit settlement without waiting for `close`. Abort listeners and timers are removed on settlement. Cancellation never returns a success inventory; the adapter's existing `finally` removes its private directory. Descendant processes are not claimed to be terminated; closing their inherited pipes prevents them from blocking the tool.

Fresh evidence: 29 focused adapter/fetcher tests passed, including deterministic ignored-SIGTERM and exit-with-held-pipes regressions. A throwaway real-child Bun smoke exercised both cases using Node subprocesses and verified cancellation, destroyed pipes, and removed private directories; smoke-owned descendants were killed explicitly and the smoke script removed. Durable v2 guardrails passed (unit/ratchet/complexity/patch pass; lint/functional disabled).

Modified: adapter, adapter tests, fourth-review iterate artifact, phase-1 verification notes, draft commit, this memory, memory index. Backlog unchanged intentionally: umbrella remains active for later phases, no new work identified. Existing unrelated session pointer and changes remain untouched. Assignment files staged; supervisor owns independent re-review, save/commit, and loop-state selection.

## Output-settlement fifth-review iteration

Overflow now explicitly settles after SIGKILL and output-pipe disposal instead of waiting for `close`; private files are removed without external cancellation. Streaming UTF-8 decoding preserves exact candidate paths when multibyte code points span chunks. Existing byte and metadata bounds remain unchanged.

Fresh evidence: 30 focused adapter/fetcher tests passed. The overflow regression deliberately never emits `close`; the Unicode regression splits `é` between buffers. A throwaway Bun smoke with real Node children confirmed overflow settlement, pipe disposal, private-directory cleanup, and exact Unicode candidate metadata. Durable v2 guardrails passed: required unit/ratchet/complexity and advisory patch pass; lint/functional disabled. Coverage remains 87.9% against 84%; no baseline changed.

Modified: adapter, adapter tests, fifth-review iteration artifact, phase-1 verification notes, draft commit, this memory, and memory index. Backlog intentionally unchanged: the umbrella remains active for later phases and no new work was identified. Unrelated session pointer and changes remain untouched. Supervisor owns independent re-review, save/commit, and loop-state selection.

## Setup-failure sixth-review iteration

Caught temporary-directory creation failures before entering the cleanup scope. The tool returns static structured `fetch_failed`, without filesystem details, an inventory, or spawning a child. A filesystem-backed regression uses a missing parent beneath a unique private test root.

Fresh evidence: 31 focused adapter/fetcher tests pass. Direct Bun execution against a missing temporary parent returned the expected structured error and asserted no spawn, inventory, or filesystem-path disclosure. Durable v2 guardrails pass: unit/ratchet/complexity and advisory patch pass; lint/functional disabled. Coverage remains 87.9% against 84%; no baseline changed.

Modified: adapter, adapter tests, sixth-review iteration artifact, phase-1 verification notes, existing draft commit, this memory, and memory index. Backlog intentionally unchanged: umbrella remains active for later phases and no new work was identified. Unrelated session pointer and pre-existing changes remain untouched. Supervisor owns independent re-review, save/commit, and loop-state selection.

## Summary and cleanup seventh-review repair

Successful stdout now needs bounded nonempty `inventoryPath` and `headRefOid`, so malformed zero-exit fetcher output cannot advertise an unusable inventory. The injected cleanup boundary turns private-directory deletion failures after either success or cancellation into static `fetch_failed` results without filesystem paths or success metadata.

Fresh evidence: focused adapter/fetcher tests pass 34 tests; durable v2 guardrails pass (unit, ratchet, complexity, and advisory patch; lint/functional disabled). The seventh review artifact is completed. The phase remains complete; supervisor owns fresh independent review and loop-state selection.

## Eighth-review repair

Closed the remaining phase-1 completion-boundary findings. The adapter now checks cancellation after asynchronous private cleanup, whitelists the five canonical count buckets with nonnegative integers, and emits static setup failures rather than filesystem-bearing exceptions. Focused adapter/fetcher suites passed 36 tests; a real default-path Bun smoke returned the canonical exit-2 validation failure with no network access; durable v2 guardrails passed (unit, ratchet, complexity required; patch advisory; lint/functional disabled). The eighth-review artifact is completed; supervisor owns independent re-review and loop-state selection.

## Ninth-review repair

Mapped only recognized canonical-fetcher progress stages to static bounded updates, so CLI progress remains useful without forwarding titles, check names, paths, or arbitrary stderr. Repeated heartbeats and unknown chunks produce no update. The adapter now avoids creating a private directory when `seenIds` is empty; its cleanup failure boundary remains tested when IDs require a file. Focused adapter/fetcher suites passed 36 tests; durable v2 guardrails passed with 88% coverage and required unit, ratchet, and complexity gates passing. The ninth iteration artifact is completed; the supervisor owns independent re-review and loop-state selection.

## Tenth-review repair

Framed CLI stderr by complete newline records with streaming UTF-8 decoding. Split stage lines now classify correctly; coalesced lines each report; lines exceeding 4 KiB and incomplete metadata are discarded. Fixed stage allowlist, de-duplication, and update cap remain. Regression was observed failing before implementation and passing afterward; adapter suite passed 26 tests. Durable guardrails passed: 88% coverage versus 84% baseline; required unit, ratchet, and complexity gates passed; lint/functional are disabled.

Modified for this repair: adapter, adapter tests, and tenth-review iteration artifact. Supervisor owns independent review and loop-state selection.

## Phase 1 checkpoint closeout

A completed Phase 1 review reports no spec or standards findings. The loop's projection reached saving → committing, then committing → blocked when the commit guard found an unstaged canonical skill. The guard condition was subsequently cleared by staging that skill to match its Codex copy. The persisted phasePath had already advanced to pending Phase 2, so a blind resume would build the next phase rather than finish this checkpoint.

Fresh closeout evidence: focused adapter/fetcher/Codex suites passed 44 tests; a real default-path Bun tool invocation returned structured fetch_failed on canonical CLI exit 2 without inventory or GitHub access; durable v2 guardrails passed (required unit, global ratchet and complexity; advisory patch; lint and functional skipped). Removed a trailing blank line at EOF from both mirrored fetcher test files; the staged diff whitespace check passed. Phase 2 skill/docs cutover remains pending. The Phase 1 commit was created from its draft; the public handleLoop stop command then moved the stale blocked run to aborted, without building Phase 2.
