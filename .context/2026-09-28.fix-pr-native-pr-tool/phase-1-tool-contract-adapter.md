---
status: completed
phase: 1
order: 1
plan: plan-fix-pr-native-pr-tool.md
phases_overview: plan-fix-pr-native-pr-tool-phases.md
difficulty: hard
model_hint: strongest reasoning model available
buck_hint: /b-build-hard
goal: "Implement the fix_pr_feedback agent tool as a thin typed adapter over the existing fetch-feedback CLI, with fail-closed contract tests."
omp_execution: none
files:
  - extensions/fix-pr-feedback/index.ts
  - extensions/fix-pr-feedback/__tests__/index.test.ts
  - extensions/index.ts
  - skills/fix-pr/scripts/fetch-feedback.ts
from_plan_steps: [1, 2, 3]
depends_on: []
dependency_type: NONE
acceptance_criteria:
  - "[x] `extensions/fix-pr-feedback/index.ts` registers `fix_pr_feedback` via `api.registerTool`; wiring added in `extensions/index.ts`."
  - "[x] Tool accepts explicit `<owner/repo>`, positive PR number, optional seen IDs; seen IDs go to a private temp `--seen-ids-file`, never an interpolated shell command; temp file is cleaned on success, failure, and cancellation."
  - "[x] Adapter spawns `bun` without a shell, forwards bounded stderr progress, parses only successful stdout, and returns compact summary + `inventoryPath` — no raw review/CI payloads."
  - "[x] Nonzero exit or invalid JSON fails closed with a structured error and no success inventory; child process is disposed on cancellation."
  - "[x] If concurrent invocations can collide on the CLI's fixed inventory filename, the CLI creates a unique private inventory without changing its JSON schema; otherwise the CLI is untouched."
  - "[x] Tests assert exact argv, seen-ID handling, success summary, fail-closed results, cancellation cleanup, and payload non-leakage; existing fetcher tests stay green."
completed_at: 2026-09-28
completed_by: omp
---

# Phase 1: Tool Contract + Adapter Extension

## User Goal
Inherited from plan: engineers fixing review feedback get a complete, repeatable feedback inventory through an agent-callable tool instead of manually invoking a sibling script, with native `pr://` kept as orientation-only.

## Context
`skills/fix-pr/scripts/fetch-feedback.ts` is the sole exhaustive GitHub ingest (pagination, threads, checks, head OID). This phase exposes it as a thin OMP agent tool without reimplementing any of its logic. Reference wiring: `extensions/jev-tool/index.ts` and `extensions/index.ts`.

## Implementation Details
1. Verify the installed extension typings for tool registration, progress, and cancellation APIs before writing code (plan step 1).
2. Implement `extensions/fix-pr-feedback/index.ts`: resolve the CLI script relative to the extension/package; spawn `bun` without shell; private temp seen-IDs file when supplied; bounded stderr forwarding; parse only successful stdout; dispose temp file + child on failure or cancellation. No review-body parsing in the adapter.
3. Register the tool in `extensions/index.ts`.
4. If the CLI's fixed inventory path can collide under parallel tool calls, make it unique/private in `skills/fix-pr/scripts/fetch-feedback.ts` minimally (schema unchanged); otherwise leave the proven CLI unchanged.
5. Tests in `extensions/fix-pr-feedback/__tests__/index.test.ts` with fake process/fixture: exact argv, seen IDs, success summary, nonzero/invalid-JSON fail-closed, cancellation cleanup, raw-feedback non-leakage. Keep existing fetcher pagination/CI fixture tests as source of truth.

## Risks
- Adapter leaking untrusted review/CI text into the agent context — cap output; treat returned text as evidence, not instructions.
- Inventory filename collision under concurrent calls — resolve at the CLI boundary only if needed.

## Verification
`bunx vitest run extensions/fix-pr-feedback/__tests__/index.test.ts skills/fix-pr/scripts/fetch-feedback.test.ts`

Iteration verification: default-path Bun smoke reaches canonical CLI validation without GitHub access; 18 focused tests pass. Tool progress is one static, metadata-free update per invocation, not raw stderr. Seen-ID setup failures return structured errors and remove the temporary directory. Durable guardrails pass (lint/functional disabled).

Seen-ID re-review repair: each tool `seenIds` entry must contain no CR or LF. Schema and runtime both reject record separators; direct calls receive structured `invalid_input` before filesystem/process work. The CLI newline-delimited format remains unchanged. Five boundary regressions bring focused suites to 23 passing tests; direct Bun rejection smoke and durable guardrails pass.

Output-boundary third-review repair: failure responses never include CLI stderr. Stdout is capped at 1 MiB of UTF-8 bytes; overflow discards buffered output, kills the child, and returns `invalid_output`. Returned candidate strings are limited to 1,024 characters each; oversized metadata fails closed, preserving exact IDs rather than truncating them. Fresh evidence: 27 focused tests, real-child failure/overflow/cleanup smoke, and durable guardrails pass. Independent re-review remains with the supervisor.

Cancellation fourth-review repair: aborted fetches get a 250 ms SIGTERM grace period, then SIGKILL plus destruction of the adapter's output pipes and explicit settlement. This bounds waiting even when descendants keep pipes open; it does not promise process-tree termination. Abort listeners and timers are released on settlement, and private seen-ID cleanup remains in `finally`. Fresh evidence: 29 focused tests, real-child ignored-SIGTERM and descendant-held-pipe smoke, durable guardrails pass. Independent re-review remains with the supervisor.

Output-settlement fifth-review repair: stdout overflow immediately kills the child, destroys adapter-owned output pipes, and settles without requiring `close` or cancellation. A streaming UTF-8 decoder preserves code points split across buffers. Fresh evidence: 30 focused tests, real-child overflow/cleanup and split-Unicode-path smoke, and durable guardrails pass. Supervisor owns independent re-review.

Setup-failure sixth-review repair: temporary-directory creation errors return static structured `fetch_failed` without spawning or exposing an inventory or filesystem path. The cleanup scope starts only after successful creation. Fresh evidence: 31 focused tests, direct Bun missing-parent smoke, and durable guardrails pass; lint/functional disabled. Supervisor owns independent re-review.

Seventh-review repair: successful output now requires bounded, nonempty `inventoryPath` and `headRefOid`; cleanup failures after success or cancellation become static fail-closed `fetch_failed` responses with no inventory. Focused adapter/fetcher suites pass 34 tests; durable guardrails pass with unit, ratchet, complexity, and advisory patch gates passing (lint/functional disabled).

Eighth-review repair: cancellation is rechecked after asynchronous private-directory cleanup, so a late abort cannot return a successful inventory. Successful count summaries accept only the fetcher's five nonnegative integer buckets, and setup failures return static errors without private paths. Focused adapter/fetcher suites pass 36 tests; real default-path Bun smoke returns the canonical invalid-number error without network access; durable guardrails pass (required unit, ratchet, complexity; advisory patch; lint/functional disabled).

Ninth-review repair: recognized fetcher stages now map to a bounded sequence of static progress updates, with unknown text and repeated heartbeats discarded; the adapter creates its private temporary directory only for nonempty `seenIds`. Focused adapter/fetcher suites pass 36 tests; durable guardrails pass at 88% coverage (required unit, ratchet, complexity; advisory patch; lint/functional disabled).
